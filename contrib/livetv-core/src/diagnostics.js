import { needsTransportProxy } from './network-policy.js';
import { normalizeStreamProfile, preferredEngines } from './stream-profile.js';

function withoutHost(headers = {}) {
  const out = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (name.toLowerCase() === 'host' || value == null) continue;
    out[name] = String(value);
  }
  return out;
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function timeoutError(timeoutMs) {
  const error = new Error(`Request timed out after ${timeoutMs} ms`);
  error.name = 'AbortError';
  return error;
}

async function fetchResource(fetcher, url, {
  headers = {},
  method = 'GET',
  timeoutMs = 10000,
  readText = false,
  maxBytes = 1024 * 1024
} = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = controller && timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : null;
  const started = nowMs();

  try {
    const response = await fetcher(url, {
      method,
      headers,
      redirect: 'follow',
      signal: controller?.signal
    });
    let text = '';
    if (readText) {
      const declaredLength = Number(response.headers?.get?.('content-length') || 0);
      if (declaredLength && declaredLength > maxBytes * 4) {
        throw new Error(`Response is too large for a manifest probe (${declaredLength} bytes)`);
      }
      text = await response.text();
      if (text.length > maxBytes) text = text.slice(0, maxBytes);
    }
    return {
      response,
      text,
      elapsedMs: Math.round(nowMs() - started)
    };
  } catch (error) {
    if (timedOut) throw timeoutError(timeoutMs);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveUri(uri, baseUrl) {
  try { return new URL(uri, baseUrl).href; } catch { return uri; }
}

function hlsCodecs(text) {
  const codecs = new Set();
  for (const match of String(text).matchAll(/\bCODECS="([^"]+)"/gi)) {
    for (const codec of match[1].split(',')) {
      const value = codec.trim();
      if (value) codecs.add(value);
    }
  }
  return [...codecs];
}

function dashCodecs(text) {
  const codecs = new Set();
  for (const match of String(text).matchAll(/\bcodecs\s*=\s*["']([^"']+)["']/gi)) {
    for (const codec of match[1].split(',')) {
      const value = codec.trim();
      if (value) codecs.add(value);
    }
  }
  return [...codecs];
}

function nextUriAfter(lines, markerIndex) {
  for (let i = markerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    return line;
  }
  return '';
}

function hlsVariantUri(text) {
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('#EXT-X-STREAM-INF:')) return nextUriAfter(lines, i);
  }
  return '';
}

function hlsSegmentUri(text) {
  const source = String(text);
  const map = source.match(/#EXT-X-MAP:[^\n]*\bURI="([^"]+)"/i);
  if (map?.[1]) return map[1];

  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return line;
  }
  return '';
}

function detectFormat(profile, response, text) {
  const type = String(response?.headers?.get?.('content-type') || profile.type || '').toLowerCase();
  const url = String(response?.url || profile.url || '').toLowerCase();
  if (text.startsWith('#EXTM3U') || type.includes('mpegurl') || /\.m3u8(?:$|[?#])/.test(url)) return 'hls';
  if (/<MPD\b/i.test(text) || type.includes('dash+xml') || /\.mpd(?:$|[?#])/.test(url)) return 'dash';
  if (type.startsWith('video/') || type.startsWith('audio/')) return 'progressive';
  return profile.type || 'unknown';
}

function drmSummary(profile) {
  if (!profile.drm) return { enabled: false };
  return {
    enabled: true,
    type: profile.drm.type || '',
    keySystem: profile.drm.keySystem || '',
    licenseConfigured: Boolean(profile.drm.licenseUri),
    clearKeyCount: Object.keys(profile.drm.clearKeys || {}).length
  };
}

function baseResult(profile) {
  const enginePlan = preferredEngines(profile);
  return {
    id: profile.id,
    name: profile.name,
    group: profile.group,
    url: profile.url,
    status: 'error',
    format: '',
    contentType: '',
    codecs: [],
    drm: drmSummary(profile),
    transportRequired: needsTransportProxy(profile.headers) || needsTransportProxy(profile.drm?.headers),
    engineSelected: enginePlan[0] || '',
    fallback: enginePlan.slice(1),
    http: { manifest: null, variant: null, segment: null },
    timings: { manifestMs: null, variantMs: null, segmentMs: null, totalMs: null },
    finalUrl: '',
    error: ''
  };
}

function responseStatus(result, key, fetched) {
  result.http[key] = fetched.response.status;
  result.timings[`${key}Ms`] = fetched.elapsedMs;
}

function requireOk(result, key, fetched) {
  responseStatus(result, key, fetched);
  if (!fetched.response.ok) {
    const error = new Error(`${key} returned HTTP ${fetched.response.status}`);
    error.status = fetched.response.status;
    throw error;
  }
}

export async function probeStream(input, {
  fetcher = globalThis.fetch?.bind(globalThis),
  timeoutMs = 10000,
  probeSegment = true,
  maxManifestBytes = 1024 * 1024
} = {}) {
  if (!fetcher) throw new Error('probeStream requires a fetch implementation');
  const profile = normalizeStreamProfile(input);
  const result = baseResult(profile);
  const started = nowMs();

  try {
    const manifest = await fetchResource(fetcher, profile.url, {
      headers: withoutHost(profile.headers),
      timeoutMs,
      readText: true,
      maxBytes: maxManifestBytes
    });
    requireOk(result, 'manifest', manifest);
    result.finalUrl = manifest.response.url || profile.url;
    result.contentType = manifest.response.headers?.get?.('content-type') || profile.type || '';
    result.format = detectFormat(profile, manifest.response, manifest.text);

    if (result.format === 'hls') {
      result.codecs = hlsCodecs(manifest.text);
      let mediaText = manifest.text;
      let mediaBase = result.finalUrl;
      const variant = hlsVariantUri(manifest.text);

      if (variant) {
        const variantUrl = resolveUri(variant, mediaBase);
        const variantResponse = await fetchResource(fetcher, variantUrl, {
          headers: withoutHost(profile.headers),
          timeoutMs,
          readText: true,
          maxBytes: maxManifestBytes
        });
        requireOk(result, 'variant', variantResponse);
        mediaText = variantResponse.text;
        mediaBase = variantResponse.response.url || variantUrl;
        result.codecs = [...new Set([...result.codecs, ...hlsCodecs(mediaText)])];
      }

      if (probeSegment) {
        const segment = hlsSegmentUri(mediaText);
        if (segment) {
          const segmentUrl = resolveUri(segment, mediaBase);
          const segmentResponse = await fetchResource(fetcher, segmentUrl, {
            headers: { ...withoutHost(profile.headers), Range: 'bytes=0-0' },
            timeoutMs,
            readText: false
          });
          responseStatus(result, 'segment', segmentResponse);
          if (!(segmentResponse.response.ok || segmentResponse.response.status === 206)) {
            const error = new Error(`segment returned HTTP ${segmentResponse.response.status}`);
            error.status = segmentResponse.response.status;
            throw error;
          }
          try { await segmentResponse.response.body?.cancel?.(); } catch { /* probe only */ }
        }
      }
    } else if (result.format === 'dash') {
      result.codecs = dashCodecs(manifest.text);
    }

    result.status = 'ok';
  } catch (error) {
    result.status = error?.name === 'AbortError' ? 'timeout' : (error?.status ? 'http' : 'error');
    result.error = error?.message || String(error);
  } finally {
    result.timings.totalMs = Math.round(nowMs() - started);
  }

  return result;
}

export async function probePlaylist(channels, {
  concurrency = 6,
  onResult = () => {},
  ...probeOptions
} = {}) {
  const input = Array.isArray(channels) ? channels : [];
  const results = new Array(input.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(input.length || 1, Number(concurrency) || 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= input.length) return;
      const result = await probeStream(input[index], probeOptions);
      results[index] = result;
      onResult(result, index, input.length);
    }
  });
  await Promise.all(workers);
  return results;
}
