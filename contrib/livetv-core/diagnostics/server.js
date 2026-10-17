import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { probeStream } from '../src/diagnostics.js';
import { parseM3U } from '../src/m3u-parser.js';
import { needsTransportProxy } from '../src/network-policy.js';
import { preferredEngines } from '../src/stream-profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fixturePath = path.join(root, 'fixtures', 'M3UPT.m3u');
const metaPath = path.join(root, 'fixtures', 'M3UPT.meta.json');
const indexPath = path.join(__dirname, 'index.html');
const appPath = path.join(__dirname, 'dist', 'app.js');
const host = process.env.LIVETV_DIAGNOSTICS_HOST || '127.0.0.1';
const port = Number(process.env.LIVETV_DIAGNOSTICS_PORT || 4177);
const allowPrivate = process.env.LIVETV_DIAGNOSTICS_ALLOW_PRIVATE === '1';
const proxyToken = randomBytes(24).toString('hex');

const [playlistText, snapshotMeta] = await Promise.all([
  readFile(fixturePath, 'utf8'),
  readFile(metaPath, 'utf8').then(JSON.parse)
]);

const channels = parseM3U(playlistText, { source: 'embedded:M3UPT' }).map((channel, index) => ({
  ...channel,
  metadata: { ...channel.metadata, diagnosticIndex: index }
}));

function json(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, status, value, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(value)
  });
  res.end(value);
}

function channelSummary(channel, index) {
  const plan = preferredEngines(channel);
  return {
    index,
    id: channel.id,
    name: channel.name,
    group: channel.group,
    logo: channel.logo,
    url: channel.url,
    type: channel.type,
    headers: channel.headers,
    drm: channel.drm,
    live: channel.live,
    lowLatency: channel.lowLatency,
    retry: channel.retry,
    metadata: channel.metadata,
    engineSelected: plan[0] || '',
    fallback: plan.slice(1),
    transportRequired: needsTransportProxy(channel.headers) || needsTransportProxy(channel.drm?.headers)
  };
}

function groupCounts() {
  const counts = new Map();
  for (const channel of channels) {
    const key = channel.group || 'Sem grupo';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function isPrivateIpv4(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function assertProxyTarget(value) {
  const target = new URL(value);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP(S) proxy targets are allowed');
  const hostname = target.hostname.toLowerCase();
  if (!allowPrivate && (
    hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local') || isPrivateIpv4(hostname)
  )) {
    throw new Error('Private/local proxy targets are blocked; set LIVETV_DIAGNOSTICS_ALLOW_PRIVATE=1 to override');
  }
  return target;
}

function proxyHref(target, index, kind = 'hls') {
  const params = new URLSearchParams({
    token: proxyToken,
    index: String(index),
    kind,
    url: target
  });
  return `/api/proxy?${params}`;
}

function rewriteHlsManifest(body, baseUrl, index) {
  const rewrite = (uri, kind = 'hls') => {
    try { return proxyHref(new URL(uri, baseUrl).href, index, kind); } catch { return uri; }
  };

  return String(body)
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.trim();
      if (!line) return raw;
      if (!line.startsWith('#')) return rewrite(line, 'hls');
      return raw.replace(/\bURI="([^"]+)"/g, (_all, uri) => `URI="${rewrite(uri, 'hls')}"`);
    })
    .join('\n');
}

function copyProxyResponseHeaders(upstream, res, rewritten) {
  const skip = new Set(['connection', 'transfer-encoding', 'content-length', 'content-encoding', 'set-cookie']);
  for (const [name, value] of upstream.headers.entries()) {
    if (skip.has(name.toLowerCase())) continue;
    res.setHeader(name, value);
  }
  res.setHeader('cache-control', rewritten ? 'no-store' : (upstream.headers.get('cache-control') || 'no-store'));
}

async function readRequestBody(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('Proxy request body too large');
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyRequest(req, res, requestUrl) {
  if (requestUrl.searchParams.get('token') !== proxyToken) return json(res, 403, { error: 'Invalid proxy token' });
  const index = Number(requestUrl.searchParams.get('index'));
  if (!Number.isInteger(index) || index < 0 || index >= channels.length) {
    return json(res, 400, { error: 'Invalid channel index' });
  }
  const rawTarget = requestUrl.searchParams.get('url');
  if (!rawTarget) return json(res, 400, { error: 'Missing proxy URL' });

  const channel = channels[index];
  const target = assertProxyTarget(rawTarget);
  const kind = (requestUrl.searchParams.get('kind') || '').toLowerCase();
  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'POST'].includes(method)) return json(res, 405, { error: 'Method not allowed' });

  const headers = {
    ...channel.headers,
    ...(kind.includes('license') ? (channel.drm?.headers || {}) : {})
  };
  for (const name of ['range', 'accept', 'content-type']) {
    if (req.headers[name]) headers[name] = String(req.headers[name]);
  }
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'host' || name.toLowerCase() === 'content-length') delete headers[name];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const body = method === 'POST' ? await readRequestBody(req) : undefined;
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'follow',
      signal: controller.signal
    });

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    const finalUrl = upstream.url || target.href;
    const isHls = method !== 'HEAD' && (
      contentType.includes('mpegurl') || /\.m3u8(?:$|[?#])/i.test(finalUrl)
    );

    if (isHls) {
      const original = await upstream.text();
      const rewritten = rewriteHlsManifest(original, finalUrl, index);
      copyProxyResponseHeaders(upstream, res, true);
      res.statusCode = upstream.status;
      res.setHeader('content-type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.end(rewritten);
      return;
    }

    copyProxyResponseHeaders(upstream, res, false);
    res.statusCode = upstream.status;
    if (method === 'HEAD' || !upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    if (!res.headersSent) json(res, error?.name === 'AbortError' ? 504 : 502, { error: error?.message || String(error) });
    else res.destroy(error);
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);

    if (requestUrl.pathname === '/') {
      const html = await readFile(indexPath, 'utf8');
      return text(res, 200, html, 'text/html; charset=utf-8');
    }
    if (requestUrl.pathname === '/app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      createReadStream(appPath).pipe(res);
      return;
    }
    if (requestUrl.pathname === '/api/meta') {
      return json(res, 200, {
        ...snapshotMeta,
        parsedChannels: channels.length,
        groups: groupCounts(),
        proxyToken
      });
    }
    if (requestUrl.pathname === '/api/channels') {
      return json(res, 200, channels.map(channelSummary));
    }
    if (requestUrl.pathname === '/api/probe') {
      const index = Number(requestUrl.searchParams.get('index'));
      if (!Number.isInteger(index) || index < 0 || index >= channels.length) {
        return json(res, 400, { error: 'Invalid channel index' });
      }
      const result = await probeStream(channels[index], {
        timeoutMs: Number(requestUrl.searchParams.get('timeout') || 10000),
        probeSegment: requestUrl.searchParams.get('segment') !== '0'
      });
      return json(res, 200, result);
    }
    if (requestUrl.pathname === '/api/proxy') return proxyRequest(req, res, requestUrl);

    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 500, { error: error?.message || String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`LiveTV diagnostics: http://${host}:${port}`);
  console.log(`Embedded M3UPT channels: ${channels.length}`);
});
