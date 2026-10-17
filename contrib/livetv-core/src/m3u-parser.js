import { canonicalHeaderName, inferMimeType, normalizeStreamProfile } from './stream-profile.js';

function splitOutsideQuotes(text, separator = ',') {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    if (!quoted && text[i] === separator) return [text.slice(0, i), text.slice(i + 1)];
  }
  return [text, ''];
}

function parseAttributes(text) {
  const out = {};
  const rx = /([A-Za-z0-9_-]+)=("([^"]*)"|[^\s,]+)/g;
  for (const match of text.matchAll(rx)) out[match[1]] = match[3] ?? match[2] ?? '';
  return out;
}

function decodeValue(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function parseHeaderQuery(text = '') {
  const headers = {};
  for (const part of String(text).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = decodeValue(part.slice(0, eq).trim());
    const value = decodeValue(part.slice(eq + 1).trim());
    if (key) headers[canonicalHeaderName(key.replace(/^http-/i, ''))] = value;
  }
  return headers;
}

function parsePipeOptions(line) {
  const pipe = line.indexOf('|');
  if (pipe < 0) return { url: line.trim(), headers: {} };
  return {
    url: line.slice(0, pipe).trim(),
    headers: parseHeaderQuery(line.slice(pipe + 1))
  };
}

function drmFromKodiProps(props) {
  const licenseType = props['inputstream.adaptive.license_type'] || props.inputstreamaddon || '';
  const licenseKey = props['inputstream.adaptive.license_key'] || '';
  const lower = licenseType.toLowerCase();
  if (!licenseType && !licenseKey) return null;

  const drm = {
    type: lower.includes('widevine') ? 'widevine' : (lower.includes('clearkey') ? 'clearkey' : lower),
    licenseUri: '',
    headers: {},
    clearKeys: {},
    rawLicenseKey: licenseKey
  };

  if (/^[0-9a-f]{16,64}:[0-9a-f]{16,64}$/i.test(licenseKey)) {
    const [kid, key] = licenseKey.split(':');
    drm.type = 'clearkey';
    drm.clearKeys[kid.toLowerCase()] = key.toLowerCase();
  } else if (/^https?:\/\//i.test(licenseKey)) {
    const parts = licenseKey.split('|');
    drm.licenseUri = parts[0];
    if (parts[1]) drm.headers = parseHeaderQuery(parts[1]);
  }
  return drm;
}

function kodiRequestHeaders(props) {
  return {
    ...parseHeaderQuery(props['inputstream.adaptive.common_headers'] || ''),
    ...parseHeaderQuery(props['inputstream.adaptive.manifest_headers'] || ''),
    ...parseHeaderQuery(props['inputstream.adaptive.stream_headers'] || '')
  };
}

function newPending() {
  return { info: {}, name: '', headers: {}, kodi: {}, extHttp: {}, group: '' };
}

export function parseM3U(text, { source = 'm3u' } = {}) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const items = [];
  let pending = newPending();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const [meta, name] = splitOutsideQuotes(line.slice(8));
      pending.info = parseAttributes(meta);
      pending.name = name.trim();
      if (pending.info['group-title']) pending.group = pending.info['group-title'];
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      pending.group = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const option = line.slice(11);
      const eq = option.indexOf('=');
      if (eq > 0) {
        const key = option.slice(0, eq).trim().replace(/^http-/, '');
        pending.headers[canonicalHeaderName(key)] = option.slice(eq + 1).trim();
      }
      continue;
    }

    if (line.startsWith('#EXTHTTP:')) {
      try {
        const value = JSON.parse(line.slice(9));
        for (const [k, v] of Object.entries(value || {})) pending.extHttp[canonicalHeaderName(k)] = String(v);
      } catch {
        // Invalid optional metadata must not discard the channel.
      }
      continue;
    }

    if (line.startsWith('#KODIPROP:')) {
      const prop = line.slice(10);
      const eq = prop.indexOf('=');
      if (eq > 0) pending.kodi[prop.slice(0, eq).trim()] = prop.slice(eq + 1).trim();
      continue;
    }

    if (line.startsWith('#')) continue;

    const pipe = parsePipeOptions(line);
    const headers = {
      ...pending.headers,
      ...pending.extHttp,
      ...kodiRequestHeaders(pending.kodi),
      ...pipe.headers
    };
    const drm = drmFromKodiProps(pending.kodi);
    const manifestType = String(pending.kodi['inputstream.adaptive.manifest_type'] || '').toLowerCase();
    const type = manifestType === 'mpd'
      ? 'application/dash+xml'
      : (manifestType === 'hls' ? 'application/x-mpegURL' : inferMimeType(pipe.url));

    const profile = normalizeStreamProfile({
      id: pending.info['tvg-id'] || pending.info['channel-id'] || pending.name || pipe.url,
      name: pending.name || pending.info['tvg-name'] || pending.info['tvg-id'] || pipe.url,
      group: pending.group || pending.info['group-title'] || '',
      logo: pending.info['tvg-logo'] || '',
      url: pipe.url,
      type,
      headers,
      drm,
      metadata: {
        source,
        tvgId: pending.info['tvg-id'] || '',
        tvgName: pending.info['tvg-name'] || '',
        catchup: pending.info.catchup || '',
        catchupSource: pending.info['catchup-source'] || '',
        kodi: { ...pending.kodi }
      }
    });
    items.push(profile);
    pending = newPending();
  }

  return items;
}
