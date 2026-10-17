# Embedded M3UPT snapshot

`M3UPT.m3u` is a point-in-time copy of the public playlist from `LITUATUI/M3UPT`, kept here so LiveTV can boot and be tested without depending on a successful remote fetch.

`M3UPT.meta.json` records the exact upstream commit, source URL, SHA-256, byte size, EXTINF count and fetch timestamp used for the snapshot.

Runtime refresh remains optional: the embedded copy is the safe baseline, not a requirement to contact GitHub at startup.
