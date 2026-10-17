# @livetv/playback-core

Backend-only playback layer for LiveTV, built on the current Video.js 10 architecture.

## Engines

- Ordinary HLS uses the official Video.js 10 `@videojs/hlsjs-video` adapter first.
- DASH, DRM and streams that require request-level `User-Agent`, `Referer`, `Origin`, `Cookie` or `Host` control use the official `@videojs/shaka-video` adapter first.
- Both paths attach to a normal `<video>` element. `EngineManager` performs bounded same-engine recovery and then tries the alternate engine.
- ClearKey and Widevine licence endpoints/headers are represented in the normalized stream profile.
- A `transportResolver` is the explicit boundary for headers browsers cannot set. It can point requests at an Android/native bridge, local proxy or other trusted transport.

This deliberately does **not** use the legacy `videojs(element, options)` API: in Video.js 10 the `video.js` npm package is a compatibility shim, while playback lives in adapter packages.

## Playlist ingestion

- Extended M3U parser: `tvg-*`, `#EXTVLCOPT`, `#EXTHTTP`, URL pipe headers and Kodi inputstream properties.
- `PlaylistStore` is embedded-first: boot from a bundled snapshot with zero network dependency, then refresh remotely without losing the working list when the source/network fails.
- The repository currently embeds `fixtures/M3UPT.m3u`, with provenance and hash in `fixtures/M3UPT.meta.json`.

## Diagnostics

The diagnostic tool is intentionally functional rather than branded. It uses the real M3UPT snapshot, a loopback-only local transport proxy and the actual playback engines.

```bash
cd contrib/livetv-core
npm install
npm run diagnostics
```

Open `http://127.0.0.1:4177`.

The page can:

- probe manifest, variant and first segment;
- display HTTP results, codecs, DRM, engine preference, fallback and latency;
- run real playback against one channel at a time through `EngineManager`;
- proxy restricted request headers locally and rewrite HLS child URIs so manifests and segments keep the required headers.

For a headless report:

```bash
npm run diagnostics:report -- --limit 0 --concurrency 6 --out m3upt-diagnostics.json
```

`--limit 0` means every parsed channel. Use `--no-segment` for a lighter manifest-only/variant-only pass.

The local proxy binds to `127.0.0.1` by default and blocks private/local targets unless `LIVETV_DIAGNOSTICS_ALLOW_PRIVATE=1` is explicitly set.
