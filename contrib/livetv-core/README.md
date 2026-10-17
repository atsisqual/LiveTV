# @livetv/playback-core

Backend-only playback layer for LiveTV.

- Video.js first for standard HLS/browser media.
- Shaka preferred for DASH/DRM and used as fallback.
- Extended M3U parser with `tvg-*`, VLC HTTP options, `#EXTHTTP` and Kodi inputstream properties.
- ClearKey mapping and Widevine licence modelling.
- Retry/backoff and bounded engine recovery.
- Transport resolver hook for native/proxy handling of restricted headers (`User-Agent`, `Referer`, `Origin`).

The package intentionally has no LiveTV visual design. Product UI is added later on top of this API.
