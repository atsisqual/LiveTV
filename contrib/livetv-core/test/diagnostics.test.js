import test from 'node:test';
import assert from 'node:assert/strict';
import { probeStream } from '../src/diagnostics.js';

test('probes HLS master, variant and first segment with codec discovery', async () => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers || {} });
    if (String(url).endsWith('master.m3u8')) {
      return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,CODECS="avc1.640028,mp4a.40.2"\n720/index.m3u8\n', {
        status: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' }
      });
    }
    if (String(url).endsWith('720/index.m3u8')) {
      return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg-1.ts\n', {
        status: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' }
      });
    }
    if (String(url).endsWith('720/seg-1.ts')) {
      return new Response(new Uint8Array([0x47]), {
        status: 206,
        headers: { 'content-type': 'video/mp2t', 'content-range': 'bytes 0-0/1000' }
      });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const result = await probeStream({
    name: 'Demo HLS',
    url: 'https://example.test/live/master.m3u8',
    type: 'application/x-mpegURL'
  }, { fetcher, timeoutMs: 1000 });

  assert.equal(result.status, 'ok');
  assert.equal(result.format, 'hls');
  assert.deepEqual(result.codecs, ['avc1.640028', 'mp4a.40.2']);
  assert.equal(result.http.manifest, 200);
  assert.equal(result.http.variant, 200);
  assert.equal(result.http.segment, 206);
  assert.equal(result.engineSelected, 'videojs');
  assert.deepEqual(result.fallback, ['shaka']);
  assert.equal(calls[2].headers.Range, 'bytes=0-0');
});

test('reports restricted-header streams as Shaka-first and preserves request headers', async () => {
  let seenHeaders;
  const fetcher = async (_url, options = {}) => {
    seenHeaders = options.headers;
    return new Response('#EXTM3U\n#EXTINF:5,\nsegment.ts\n', {
      status: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' }
    });
  };

  const result = await probeStream({
    name: 'Header HLS',
    url: 'https://example.test/live.m3u8',
    headers: { 'User-Agent': 'Demo/1', Referer: 'https://example.test/' }
  }, { fetcher, probeSegment: false });

  assert.equal(result.status, 'ok');
  assert.equal(result.transportRequired, true);
  assert.equal(result.engineSelected, 'shaka');
  assert.equal(seenHeaders['User-Agent'], 'Demo/1');
});

test('classifies HTTP manifest errors', async () => {
  const result = await probeStream({ name: 'Broken', url: 'https://example.test/nope.m3u8' }, {
    fetcher: async () => new Response('missing', { status: 404 }),
    timeoutMs: 1000
  });
  assert.equal(result.status, 'http');
  assert.equal(result.http.manifest, 404);
  assert.match(result.error, /HTTP 404/);
});
