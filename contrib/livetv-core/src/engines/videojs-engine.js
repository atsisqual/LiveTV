import { browserSafeHeaders, resolveTransportUrl } from '../network-policy.js';

async function loadAdapterModule(explicit) {
  if (explicit) return explicit;
  return import('@videojs/hlsjs-video');
}

function isHls(profile) {
  return /mpegurl/i.test(profile.type || '') || /\.m3u8(?:$|[?#])/i.test(profile.url || '');
}

function mediaFailure(element, adapter, fallback) {
  return adapter?.error || element?.error || fallback || new Error('Media playback failed');
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
      () => finish(new Error(`Video.js adapter did not become ready within ${timeoutMs} ms`)),
      timeoutMs
    );

    element.addEventListener('loadedmetadata', onReady, { once: true });
    element.addEventListener('canplay', onReady, { once: true });
    element.addEventListener('error', onError, { once: true });
    adapter?.addEventListener?.('error', onError, { once: true });
  });
}

export class VideoJsEngine {
  constructor({ adapterModule, transportResolver, onFatal = () => {}, readinessTimeoutMs = 15000 } = {}) {
    this.adapterModule = adapterModule;
    this.transportResolver = transportResolver;
    this.onFatal = onFatal;
    this.readinessTimeoutMs = readinessTimeoutMs;
    this.adapter = null;
    this.element = null;
    this.errorHandler = null;
  }

  async load(element, profile) {
    await this.destroy();
    const mod = await loadAdapterModule(this.adapterModule);
    const Adapter = mod.HlsJsAdapter;
    if (!Adapter) throw new Error('@videojs/hlsjs-video did not export HlsJsAdapter');

    const src = await resolveTransportUrl(
      profile,
      profile.url,
      'manifest',
      this.transportResolver,
      profile.headers
    );
    const { safe } = browserSafeHeaders(profile.headers);
    const hlsConfig = {
      lowLatencyMode: Boolean(profile.lowLatency),
      xhrSetup: (xhr) => {
        for (const [name, value] of Object.entries(safe)) {
          try { xhr.setRequestHeader(name, value); } catch { /* browser decides */ }
        }
      }
    };

    this.element = element;
    this.adapter = new Adapter();
    this.adapter.attach(element);
    this.adapter.preload = 'auto';

    const source = {
      src,
      ...(profile.type && { type: isHls(profile) ? 'application/vnd.apple.mpegurl' : profile.type }),
      ...(isHls(profile) && {
        preferPlayback: 'mse',
        engine: { hlsJs: hlsConfig }
      })
    };

    this.adapter.source = source;
    await waitForInitialMediaReady(element, this.adapter, this.readinessTimeoutMs);

    this.errorHandler = (event) => {
      this.onFatal({ engine: 'videojs', error: mediaFailure(element, this.adapter, event?.error || event) });
    };
    this.adapter.addEventListener?.('error', this.errorHandler);
    element.addEventListener('error', this.errorHandler);

    return { engine: 'videojs', player: this.adapter, adapter: this.adapter };
  }

  async destroy() {
    if (!this.adapter) return;
    const adapter = this.adapter;
    const element = this.element;
    this.adapter = null;
    this.element = null;
    try {
      if (this.errorHandler) {
        adapter.removeEventListener?.('error', this.errorHandler);
        element?.removeEventListener?.('error', this.errorHandler);
      }
      adapter.destroy?.();
    } finally {
      this.errorHandler = null;
    }
  }
}
