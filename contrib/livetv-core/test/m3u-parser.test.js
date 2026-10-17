import test from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U } from '../src/m3u-parser.js';
import { preferredEngines } from '../src/stream-profile.js';

test('parses M3U metadata, headers and ClearKey DRM', () => {
  const text = `#EXTM3U\n#EXTINF:-1 tvg-id="demo" tvg-logo="https://example.test/logo.png" group-title="Portugal",Demo HD\n#EXTVLCOPT:http-user-agent=DemoAgent/1.0\n#EXTVLCOPT:http-referrer=https://example.test/\n#KODIPROP:inputstream.adaptive.manifest_type=mpd\n#KODIPROP:inputstream.adaptive.license_type=clearkey\n#KODIPROP:inputstream.adaptive.license_key=00112233445566778899aabbccddeeff:ffeeddccbbaa99887766554433221100\nhttps://cdn.example.test/live/manifest.mpd`;
  const [item] = parseM3U(text);
  assert.equal(item.id, 'demo');
  assert.equal(item.name, 'Demo HD');
  assert.equal(item.group, 'Portugal');
  assert.equal(item.type, 'application/dash+xml');
  assert.equal(item.headers['User-Agent'], 'DemoAgent/1.0');
  assert.equal(item.headers.Referer, 'https://example.test/');
  assert.equal(item.drm.type, 'clearkey');
  assert.equal(item.drm.clearKeys['00112233445566778899aabbccddeeff'], 'ffeeddccbbaa99887766554433221100');
  assert.deepEqual(preferredEngines(item), ['shaka', 'videojs']);
});

test('parses URL pipe headers and puts restricted-header HLS on Shaka first', () => {
  const [item] = parseM3U(`#EXTM3U\n#EXTINF:-1 group-title="News",News\nhttps://cdn.example.test/live.m3u8|User-Agent=UA%2F1.0&Origin=https%3A%2F%2Fexample.test`);
  assert.equal(item.headers['User-Agent'], 'UA/1.0');
  assert.equal(item.headers.Origin, 'https://example.test');
  assert.deepEqual(preferredEngines(item), ['shaka', 'videojs']);
});

test('parses Kodi stream headers and Widevine license headers', () => {
  const [item] = parseM3U(`#EXTM3U\n#EXTINF:-1,DRM\n#KODIPROP:inputstream.adaptive.manifest_type=mpd\n#KODIPROP:inputstream.adaptive.stream_headers=Referer=https%3A%2F%2Fexample.test%2F&User-Agent=UA%2F2\n#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n#KODIPROP:inputstream.adaptive.license_key=https://license.example.test/wv|Authorization=Bearer%20abc|R{SSM}|\nhttps://cdn.example.test/manifest.mpd`);
  assert.equal(item.headers.Referer, 'https://example.test/');
  assert.equal(item.headers['User-Agent'], 'UA/2');
  assert.equal(item.drm.type, 'widevine');
  assert.equal(item.drm.keySystem, 'com.widevine.alpha');
  assert.equal(item.drm.licenseUri, 'https://license.example.test/wv');
  assert.equal(item.drm.headers.Authorization, 'Bearer abc');
});

test('matches quoted EXTVLCOPT values used by the real M3UPT playlist', () => {
  const [item] = parseM3U(`#EXTM3U\n#EXTINF:-1 group-title="TV" tvg-id="RTP1.pt",RTP 1\n#EXTVLCOPT:http-user-agent="Mozilla/5.0 (X11; Linux x86_64) Firefox/152.0"\n#EXTVLCOPT:http-origin=https://www.rtp.pt\n#EXTVLCOPT:http-referrer=https://www.rtp.pt/play/direto/rtp1\nhttps://streaming-live.rtp.pt/liverepeater/smil:rtp1HD.smil/playlist.m3u8`);
  assert.equal(item.headers['User-Agent'], 'Mozilla/5.0 (X11; Linux x86_64) Firefox/152.0');
  assert.equal(item.headers.Origin, 'https://www.rtp.pt');
  assert.equal(item.id, 'RTP1.pt');
});

test('does not leak metadata when a channel URL is commented out', () => {
  const items = parseM3U(`#EXTM3U\n#EXTINF:-1 tvg-id="disabled",Disabled\n#EXTVLCOPT:http-origin=https://disabled.example.test\n#https://disabled.example.test/live.m3u8\n#EXTINF:-1 tvg-id="working",Working\nhttps://working.example.test/live.m3u8`);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'working');
  assert.equal(items[0].headers.Origin, undefined);
});
