# LiveTV playback backend

This repository tracks `videojs/video.js` as the source base. LiveTV-specific code lives under `contrib/livetv-core` so upstream Video.js can be updated without mixing product/UI customisations into the player framework.

## Playback strategy

1. Follow the **Video.js 10 adapter architecture**, not the legacy Video.js 8 `videojs()` factory API.
2. Ordinary HLS starts with the official `@videojs/hlsjs-video` adapter.
3. DASH, DRM and streams requiring full request-header control start with the official `@videojs/shaka-video` adapter.
4. `EngineManager` performs bounded same-engine recovery before switching to the alternate engine.
5. `parseM3U()` converts extended M3U metadata into a normalized stream profile.
6. Restricted request headers such as `User-Agent`, `Origin`, `Referer`, `Cookie` and `Host` are preserved in the profile. Browsers cannot set all of them directly, so `transportResolver` is the boundary for an Android/native/local proxy or another trusted transport.
7. DRM configuration supports ClearKey and models Widevine licence endpoints/headers for the Shaka adapter.
8. `PlaylistStore` is embedded-first. The current real M3UPT snapshot is stored under `contrib/livetv-core/fixtures` and remote refresh can fail without removing the working list.
9. `contrib/livetv-core/diagnostics` provides network probes, a loopback transport proxy, a real-engine playback smoke test and a headless JSON report before any TV do Zé UI work begins.

## Deliberately not customised yet

The Video.js UI, branding and product layout are intentionally unchanged at this stage. The current work is focused on a reliable playback/data backend before adapting the product to the TV do Zé interface.

## Old prototype

The pre-Video.js Shaka Android prototype was preserved in branch `archive/shaka-prototype` before `main` was replaced by the Video.js upstream snapshot.

Upstream Video.js commit: `2d40a220e9608c027e9800e6ff60e5a31cedd451`
