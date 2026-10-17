import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaylistStore } from '../src/playlist-store.js';

const embedded = `#EXTM3U\n#EXTINF:-1 tvg-id="one",One\nhttps://example.test/one.m3u8`;
const remote = `#EXTM3U\n#EXTINF:-1 tvg-id="two",Two\nhttps://example.test/two.m3u8`;

test('startup uses embedded playlist without touching the network', async () => {
  let calls = 0;
  const store = new PlaylistStore({
    embeddedText: embedded,
    remoteUrl: 'https://example.test/list.m3u',
    fetcher: async () => { calls += 1; throw new Error('network should not be used'); }
  });
  const channels = await store.load();
  assert.equal(channels[0].id, 'one');
  assert.equal(calls, 0);
  assert.equal(store.status().source, 'embedded');
});

test('failed remote refresh keeps the already loaded embedded list', async () => {
  const store = new PlaylistStore({
    embeddedText: embedded,
    remoteUrl: 'https://example.test/list.m3u',
    retry: { maxAttempts: 1 },
    fetcher: async () => { throw new Error('offline'); }
  });
  await store.load();
  const channels = await store.refresh();
  assert.equal(channels[0].id, 'one');
  assert.equal(store.status().source, 'embedded');
});

test('successful refresh atomically replaces the playlist and stores validators', async () => {
  const headers = new Map([['etag', '"v2"'], ['last-modified', 'Fri, 17 Oct 2026 18:00:00 GMT']]);
  const store = new PlaylistStore({
    embeddedText: embedded,
    remoteUrl: 'https://example.test/list.m3u',
    fetcher: async () => ({
      ok: true,
      status: 200,
      text: async () => remote,
      headers: { get: (name) => headers.get(name) || '' }
    })
  });
  await store.load();
  const channels = await store.refresh();
  assert.equal(channels[0].id, 'two');
  assert.equal(store.status().source, 'https://example.test/list.m3u');
  assert.equal(store.status().etag, '"v2"');
});

test('HTTP 404 is not retried and falls back to current list', async () => {
  let calls = 0;
  const store = new PlaylistStore({
    embeddedText: embedded,
    remoteUrl: 'https://example.test/list.m3u',
    retry: { maxAttempts: 5, baseDelayMs: 1 },
    fetcher: async () => {
      calls += 1;
      return { ok: false, status: 404, headers: { get: () => '' } };
    }
  });
  await store.load();
  const channels = await store.refresh();
  assert.equal(channels[0].id, 'one');
  assert.equal(calls, 1);
});
