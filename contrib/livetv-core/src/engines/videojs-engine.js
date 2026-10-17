import { resolveTransportUrl } from '../network-policy.js';

export class VideoJsEngine {
  constructor({ videojs, transportResolver, onFatal = () => {} } = {}) {
    if (!videojs) throw new Error('VideoJsEngine requires a videojs factory');
    this.videojs = videojs;
    this.transportResolver = transportResolver;
    this.onFatal = onFatal;
    this.player = null;
    this.errorHandler = null;
  }

  async load(element, profile) {
    await this.destroy();
    const src = await resolveTransportUrl(profile, profile.url, 'manifest', this.transportResolver);
    const options = {
      controls: true,
      autoplay: false,
      preload: 'auto',
      liveui: true,
      fluid: true,
      responsive: true,
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          useNetworkInformationApi: true,
          useDevicePixelRatio: true,
          limitRenditionByPlayerDimensions: false
        }
      }
    };

    this.player = this.videojs(element, options);
    this.errorHandler = () => {
      const error = this.player?.error?.();
      if (error) this.onFatal({ engine: 'videojs', error });
    };
    this.player.on('error', this.errorHandler);
    this.player.src({ src, type: profile.type || undefined });

    return { engine: 'videojs', player: this.player };
  }

  async destroy() {
    if (!this.player) return;
    try {
      if (this.errorHandler) this.player.off('error', this.errorHandler);
      this.player.dispose();
    } finally {
      this.player = null;
      this.errorHandler = null;
    }
  }
}
