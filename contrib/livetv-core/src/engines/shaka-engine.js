import { browserSafeHeaders, resolveTransportUrl } from '../network-policy.js';

async function loadAdapterModule(explicit) {
  if (explicit) return explicit;
  return import('@videojs/shaka-video');
}

function requestTypeName(shaka, type) {
  const values = shaka?.net?.NetworkingEngine?.RequestType || {};
  const found = Object.entries(values).find(([, value]) => value === type);
  return found ? found[0].toLowerCase().replaceAll('_', '-') : String(type).toLowerCase();
}

function mediaFailure(element, adapter, fallback) {
  return adapter?.error || element?.error || fallback || new Error('Shaka playback failed');
}

function waitForInitialMediaReady(element, adapter, timeoutMs) {
  if (element.readyState >= 1) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      element.removeEventListener('loadedmetadata', onReady);
      element.removeEventListener('canplay', onReady);
      element.removeEventListener('error', onError);
      adapter?.removeEventListener?.('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => finish();
    const onError = (event) => finish(mediaFailure(element, adapter, event?.error || event));
    const timer = setTimeout(
      () => finish(new Error(`Shaka adapter did not become ready within ${timeoutMs} ms`)),
      timeoutMs
    );

    element.addEventListener('loadedmetadata', onReady, { once: true });
    element.addEventListener('canplay', onReady, { once: true });
    element.addEventListener('error', onError, { once: true });
    adapter?.addEventListener?.('error', onError, { once: true });
  });
}

export class ShakaEngine {
  constructor({ adapterModule, transportResolver, onFatal = () => {}, readinessTimeoutMs = 15000 } = {}) {
    this.adapterModule = adapterModule;
    this.transportResolver = transportResolver;
    this.onFatal = onFatal;
    this.readinessTimeoutMs = readinessTimeoutMs;
    this.adapter = null;
    this.player = null;
    this.element = null;
    this.errorHandler = null;
    this.requestFilter = null;
  }

  async load(element, profile) {
    await this.destroy();
    const mod = await loadAdapterModule(this.adapterModule);
    const Adapter = mod.ShakaAdapter;
    const shaka = mod.shaka;
    if (!Adapter || !shaka) throw new Error('@videojs/shaka-video did not expose ShakaAdapter and shaka');

    this.element = element;
    this.adapter = new Adapter();
    this.adapter.attach(element);
    this.adapter.preload = 'auto';
    this.player = this.adapter.engine;
    if (!this.player) throw new Error('Shaka Player is not supported by this browser');

    const network = this.player.getNetworkingEngine?.();
    this.requestFilter = async (type, request) => {
      const requestType = requestTypeName(shaka, type);
      const isLicense = requestType === 'license';
      const mergedHeaders = {
        ...profile.headers,
        ...(isLicense ? (profile.drm?.headers || {}) : {})
      };
      const { safe } = browserSafeHeaders(mergedHeaders);
      request.headers = { ...(request.headers || {}), ...safe };

      if (this.transportResolver && Array.isArray(request.uris)) {
        request.uris = await Promise.all(request.uris.map((uri) =>
          resolveTransportUrl(profile, uri, requestType, this.transportResolver, mergedHeaders)));
      }
    };
    network?.registerRequestFilter?.(this.requestFilter);

    const shakaConfig = {
      abr: { enabled: true, restrictToElementSize: true },
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
      shakaConfig.drm = {};
      if (profile.drm.licenseUri && profile.drm.keySystem) {
        shakaConfig.drm.servers = { [profile.drm.keySystem]: profile.drm.licenseUri };
      }
      if (Object.keys(profile.drm.clearKeys || {}).length) {
        shakaConfig.drm.clearKeys = profile.drm.clearKeys;
      }
    }

    this.adapter.source = {
      src: profile.url,
      ...(profile.type && { type: profile.type }),
      engine: { shaka: shakaConfig }
    };

    await waitForInitialMediaReady(element, this.adapter, this.readinessTimeoutMs);

    this.errorHandler = (event) => {
      this.onFatal({ engine: 'shaka', error: mediaFailure(element, this.adapter, event?.error || event) });
    };
    this.adapter.addEventListener?.('error', this.errorHandler);
    element.addEventListener('error', this.errorHandler);

    return { engine: 'shaka', player: this.player, adapter: this.adapter };
  }

  async destroy() {
    if (!this.adapter) return;
    const adapter = this.adapter;
    const element = this.element;
    const player = this.player;
    this.adapter = null;
    this.element = null;
    this.player = null;
    try {
      if (this.errorHandler) {
        adapter.removeEventListener?.('error', this.errorHandler);
        element?.removeEventListener?.('error', this.errorHandler);
      }
      if (this.requestFilter) {
        player?.getNetworkingEngine?.()?.unregisterRequestFilter?.(this.requestFilter);
      }
      adapter.destroy?.();
    } finally {
      this.errorHandler = null;
      this.requestFilter = null;
    }
  }
}
