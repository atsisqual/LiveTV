import test from 'node:test';
import assert from 'node:assert/strict';

import { VideoJsEngine } from '../src/engines/videojs-engine.js';
import { ShakaEngine } from '../src/engines/shaka-engine.js';

class FakeMediaElement extends EventTarget {
  constructor() {
    super();
    this.readyState = 0;
    this.error = null;
  }
}

class FakeHlsAdapter extends EventTarget {
  attach(target) { this.target = target; }
  set source(value) {
    this._source = value;
    queueMicrotask(() => {
      this.target.readyState = 1;
      this.target.dispatchEvent(new Event('loadedmetadata'));
    });
  }
  get source() { return this._source; }
  destroy() { this.destroyed = true; }
}

test('VideoJsEngine uses the official HlsJsAdapter shape instead of the legacy videojs() factory', async () => {
  const media = new FakeMediaElement();
  const transportCalls = [];
  const engine = new VideoJsEngine({
    adapterModule: { HlsJsAdapter: FakeHlsAdapter },
    transportResolver: async (request) => {
      transportCalls.push(request);
      return `/proxy?url=${encodeURIComponent(request.url)}`;
    },
    readinessTimeoutMs: 1000
  });

  const result = await engine.load(media, {
    name: 'HLS',
    url: 'https://cdn.example.test/live.m3u8',
    type: 'application/x-mpegURL',
    headers: { 'User-Agent': 'Demo/1' },
    lowLatency: true,
    retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 }
  });

  assert.equal(result.engine, 'videojs');
  assert.equal(engine.adapter.source.type, 'application/vnd.apple.mpegurl');
  assert.equal(engine.adapter.source.preferPlayback, 'mse');
  assert.equal(engine.adapter.source.engine.hlsJs.lowLatencyMode, true);
  assert.match(engine.adapter.source.src, /^\/proxy\?/);
  assert.equal(transportCalls[0].requestType, 'manifest');
  await engine.destroy();
  assert.equal(result.adapter.destroyed, true);
});

class FakeNetworkingEngine {
  registerRequestFilter(filter) { this.filter = filter; }
  unregisterRequestFilter(filter) { if (this.filter === filter) this.filter = null; }
}

class FakePlayer {
  constructor() { this.network = new FakeNetworkingEngine(); }
  getNetworkingEngine() { return this.network; }
}

class FakeShakaAdapter extends EventTarget {
  constructor() {
    super();
    this.engine = new FakePlayer();
    this.error = null;
  }
  attach(target) { this.target = target; }
  set source(value) {
    this._source = value;
    queueMicrotask(() => {
      this.target.readyState = 1;
      this.target.dispatchEvent(new Event('loadedmetadata'));
    });
  }
  get source() { return this._source; }
  destroy() { this.destroyed = true; }
}

test('ShakaEngine detects numeric LICENSE request types and sends licence headers to transportResolver', async () => {
  const media = new FakeMediaElement();
  const calls = [];
  const shaka = {
    net: {
      NetworkingEngine: {
        RequestType: { MANIFEST: 0, SEGMENT: 1, LICENSE: 2 }
      }
    }
  };
  const engine = new ShakaEngine({
    adapterModule: { ShakaAdapter: FakeShakaAdapter, shaka },
    transportResolver: async (request) => {
      calls.push(request);
      return `/proxy?kind=${request.requestType}`;
    },
    readinessTimeoutMs: 1000
  });

  const result = await engine.load(media, {
    name: 'DRM',
    url: 'https://cdn.example.test/manifest.mpd',
    type: 'application/dash+xml',
    headers: { Referer: 'https://example.test/' },
    drm: {
      type: 'widevine',
      keySystem: 'com.widevine.alpha',
      licenseUri: 'https://license.example.test/wv',
      headers: { Authorization: 'Bearer abc' }
    },
    retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 }
  });

  const request = { uris: ['https://license.example.test/wv'], headers: {} };
  await result.player.getNetworkingEngine().filter(2, request);
  assert.equal(calls.at(-1).requestType, 'license');
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer abc');
  assert.match(request.uris[0], /kind=license/);
  await engine.destroy();
  assert.equal(result.adapter.destroyed, true);
});
