# @livetv/playback-core

Backend-only playback layer for LiveTV.

- Video.js first for ordinary HLS/browser media.
- Shaka preferred for DASH, DRM, and streams that require request-level `User-Agent`, `Referer` or `Origin` handling.
- Extended M3U parser with `tvg-*`, VLC HTTP options, `#EXTHTTP`, URL pipe headers and Kodi inputstream properties.
- ClearKey mapping plus Widevine license URI/header modelling.
- Retry/backoff, bounded same-engine recovery and automatic fallback.
- Transport resolver hook for native/proxy handling of restricted browser headers on manifests, segments and license requests.
- `PlaylistStore` is embedded-first: the app can boot from a bundled M3U snapshot with zero network dependency, then refresh remotely without losing the working list if the network/source fails.

## M3UPT compatibility

The parser is explicitly covered for metadata patterns used by the current `LITUATUI/M3UPT` playlist, including quoted VLC `User-Agent` values and disabled/commented channel URLs. A disabled entry is discarded before a new `#EXTINF` starts so request headers or DRM metadata cannot leak into the following channel.

The package intentionally has no LiveTV visual design. Product UI is added later on top of this API.
