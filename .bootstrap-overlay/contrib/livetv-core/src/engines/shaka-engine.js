import { browserSafeHeaders, resolveTransportUrl } from '../network-policy.js';

async function loadShaka(explicit) {
  if (explicit) return explicit;
  const mod = await import('shaka-player/dist/shaka-player.compiled.js');
  return mod.default || mod.shaka || globalThis.shaka || mod;
}

export class ShakaEngine {
  constructor({ shaka, transportResolver, onFatal = () => {} } = {}) {
    this.shaka = shaka;
    this.transportResolver = transportResolver;
    this.onFatal = onFatal;
    this.player = null;
    this.errorHandler = null;
  }

  async load(element, profile) {
    await this.destroy();
    const shaka = await loadShaka(this.shaka);
    shaka.polyfill?.installAll?.();
    if (shaka.Player?.isBrowserSupported && !shaka.Player.isBrowserSupported()) {
      throw new Error('Shaka Player is not supported by this browser');
    }

    this.player = new shaka.Player();
    await this.player.attach(element);

    this.errorHandler = (event) => this.onFatal({ engine: 'shaka', error: event?.detail || event });
    this.player.addEventListener('error', this.errorHandler);

    const config = {
      abr: { enabled: true },
      streaming: {
        lowLatencyMode: Boolean(profile.lowLatency),
        retryParameters: {
          maxAttempts: profile.retry.maxAttempts,
          baseDelay: profile.retry.baseDelayMs,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 0
        }
      },
      manifest: {
        retryParameters: {
          maxAttempts: profile.retry.maxAttempts,
          baseDelay: profile.retry.baseDelayMs,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 0
        }
      }
    };

    if (profile.drm) {
      config.drm = {};
      if (profile.drm.licenseUri && profile.drm.keySystem) {
        config.drm.servers = { [profile.drm.keySystem]: profile.drm.licenseUri };
      }
      if (Object.keys(profile.drm.clearKeys || {}).length) {
        config.drm.clearKeys = profile.drm.clearKeys;
      }
    }
    this.player.configure(config);

    const net = this.player.getNetworkingEngine();
    net?.registerRequestFilter(async (type, request) => {
      const requestType = String(type);
      const mergedHeaders = {
        ...profile.headers,
        ...(requestType.includes('LICENSE') ? (profile.drm?.headers || {}) : {})
      };
      const { safe } = browserSafeHeaders(mergedHeaders);
      request.headers = { ...(request.headers || {}), ...safe };

      if (this.transportResolver && Array.isArray(request.uris)) {
        request.uris = await Promise.all(request.uris.map((uri) =>
          resolveTransportUrl(profile, uri, requestType, this.transportResolver)));
      }
    });

    const manifest = await resolveTransportUrl(profile, profile.url, 'manifest', this.transportResolver);
    await this.player.load(manifest);
    return { engine: 'shaka', player: this.player };
  }

  async destroy() {
    if (!this.player) return;
    try {
      if (this.errorHandler) this.player.removeEventListener('error', this.errorHandler);
      await this.player.destroy();
    } finally {
      this.player = null;
      this.errorHandler = null;
    }
  }
}
