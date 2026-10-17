# LiveTV playback backend

This repository tracks `videojs/video.js` as the source base. LiveTV-specific code lives under `contrib/livetv-core` so upstream Video.js can be updated without mixing UI/product customisations into the player framework.

## Playback strategy

1. Video.js is the primary engine for ordinary HLS and browser-native media.
2. Shaka Player is the secondary engine and is preferred for DASH and DRM profiles.
3. `EngineManager` performs bounded same-engine recovery before switching engines.
4. `parseM3U()` converts extended M3U metadata into a normalized stream profile.
5. Restricted request headers such as `User-Agent`, `Origin` and `Referer` are preserved in the profile. Browsers cannot set all of them directly, so `transportResolver` is the boundary for an Android/native/local proxy or another trusted transport.
6. DRM configuration supports ClearKey directly and models Widevine licence endpoints/headers for the Shaka engine.

## Deliberately not customised yet

The Video.js UI, branding and application layout are intentionally unchanged at this stage. The current work is focused on a reliable playback/data backend before adapting the product to the TV do Zé interface.

## Old prototype

The pre-Video.js Shaka Android prototype was preserved in branch `archive/shaka-prototype` before `main` was rebased onto Video.js upstream.
