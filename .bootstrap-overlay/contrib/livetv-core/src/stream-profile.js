const HEADER_MAP = new Map([
  ['user-agent', 'User-Agent'],
  ['referer', 'Referer'],
  ['referrer', 'Referer'],
  ['origin', 'Origin']
]);

export function canonicalHeaderName(name) {
  const key = String(name || '').trim().toLowerCase();
  if (HEADER_MAP.has(key)) return HEADER_MAP.get(key);
  return key.split('-').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join('-');
}

export function inferMimeType(url = '') {
  const clean = String(url).split('#')[0].split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (clean.endsWith('.mpd')) return 'application/dash+xml';
  if (clean.endsWith('.mp4')) return 'video/mp4';
  if (clean.endsWith('.webm')) return 'video/webm';
  return '';
}

function normalizeHeaders(headers = {}) {
  const result = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (value == null || value === '') continue;
    result[canonicalHeaderName(name)] = String(value);
  }
  return result;
}

function normalizeDrm(drm = null) {
  if (!drm) return null;
  const type = String(drm.type || drm.licenseType || '').toLowerCase();
  const result = {
    type,
    keySystem: drm.keySystem || '',
    licenseUri: drm.licenseUri || drm.licenseUrl || '',
    headers: normalizeHeaders(drm.headers || {}),
    clearKeys: { ...(drm.clearKeys || {}) }
  };

  if (!result.keySystem) {
    if (type.includes('widevine')) result.keySystem = 'com.widevine.alpha';
    if (type.includes('clearkey') || type.includes('clear_key')) result.keySystem = 'org.w3.clearkey';
  }

  if (!result.type && result.keySystem === 'org.w3.clearkey') result.type = 'clearkey';
  if (!result.type && result.keySystem === 'com.widevine.alpha') result.type = 'widevine';
  return result;
}

export function normalizeStreamProfile(input = {}) {
  const url = String(input.url || input.src || '').trim();
  if (!url) throw new Error('Stream profile requires a URL');

  return {
    id: String(input.id || input.tvgId || input.name || url),
    name: String(input.name || input.title || input.tvgId || url),
    group: String(input.group || input.groupTitle || ''),
    logo: String(input.logo || input.tvgLogo || ''),
    url,
    type: input.type || inferMimeType(url),
    headers: normalizeHeaders(input.headers || {}),
    drm: normalizeDrm(input.drm),
    lowLatency: input.lowLatency !== false,
    live: input.live !== false,
    retry: {
      maxAttempts: Math.max(1, Number(input.retry?.maxAttempts || 4)),
      baseDelayMs: Math.max(0, Number(input.retry?.baseDelayMs || 350)),
      maxDelayMs: Math.max(250, Number(input.retry?.maxDelayMs || 6000))
    },
    metadata: { ...(input.metadata || {}) }
  };
}

export function preferredEngines(input) {
  const profile = normalizeStreamProfile(input);
  const isDash = profile.type === 'application/dash+xml' || /\.mpd(?:$|[?#])/i.test(profile.url);
  const hasDrm = Boolean(profile.drm?.keySystem || profile.drm?.licenseUri || Object.keys(profile.drm?.clearKeys || {}).length);
  return (isDash || hasDrm) ? ['shaka', 'videojs'] : ['videojs', 'shaka'];
}
