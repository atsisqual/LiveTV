import { normalizeStreamProfile, preferredEngines } from './stream-profile.js';
import { needsTransportProxy, retryDelay } from './network-policy.js';
import { VideoJsEngine } from './engines/videojs-engine.js';
import { ShakaEngine } from './engines/shaka-engine.js';

export class EngineManager {
  constructor({
    videojs,
    shaka,
    transportResolver,
    onEvent = () => {},
    maxSameEngineRecoveries = 2,
    stabilityWindowMs = 30000
  } = {}) {
    this.videojs = videojs;
    this.shaka = shaka;
    this.transportResolver = transportResolver;
    this.onEvent = onEvent;
    this.maxSameEngineRecoveries = Math.max(0, Number(maxSameEngineRecoveries || 0));
    this.stabilityWindowMs = Math.max(0, Number(stabilityWindowMs || 0));
    this.element = null;
    this.profile = null;
    this.order = [];
    this.engineIndex = -1;
    this.engine = null;
    this.recoveryCount = 0;
    this.recovering = false;
    this.destroyed = false;
    this.stabilityTimer = null;
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail, profile: this.profile });
  }

  createEngine(name) {
    const common = {
      transportResolver: this.transportResolver,
      onFatal: (detail) => this.handleFatal(detail)
    };
    if (name === 'videojs') return new VideoJsEngine({ ...common, videojs: this.videojs });
    if (name === 'shaka') return new ShakaEngine({ ...common, shaka: this.shaka });
    throw new Error(`Unknown playback engine: ${name}`);
  }

  clearStabilityTimer() {
    if (this.stabilityTimer) clearTimeout(this.stabilityTimer);
    this.stabilityTimer = null;
  }

  armStabilityReset(engine) {
    this.clearStabilityTimer();
    if (!this.stabilityWindowMs || !this.recoveryCount) return;
    this.stabilityTimer = setTimeout(() => {
      this.recoveryCount = 0;
      this.emit('recovery-budget-reset', { engine });
    }, this.stabilityWindowMs);
  }

  async load(element, input) {
    this.destroyed = false;
    await this.stopEngine();
    this.element = element;
    this.profile = normalizeStreamProfile(input);
    this.order = preferredEngines(this.profile).filter((name) => name !== 'videojs' || this.videojs);
    this.engineIndex = -1;
    this.recoveryCount = 0;

    if (!this.transportResolver && (needsTransportProxy(this.profile.headers) || needsTransportProxy(this.profile.drm?.headers))) {
      this.emit('transport-required', { headers: this.profile.headers });
    }

    let lastError;
    for (let i = 0; i < this.order.length; i++) {
      try {
        return await this.startEngine(i, 'initial');
      } catch (error) {
        lastError = error;
        this.emit('engine-load-failed', { engine: this.order[i], error });
      }
    }
    throw lastError || new Error('No playback engine available');
  }

  async startEngine(index, reason) {
    await this.stopEngine();
    const name = this.order[index];
    if (!name) throw new Error('No fallback engine available');
    this.engineIndex = index;
    if (reason !== 'same-engine-recovery') this.recoveryCount = 0;
    this.engine = this.createEngine(name);
    this.emit('engine-start', { engine: name, reason });
    const result = await this.engine.load(this.element, this.profile);
    this.emit('engine-ready', { engine: name, reason });
    this.armStabilityReset(name);
    return result;
  }

  async handleFatal(detail) {
    if (this.destroyed || this.recovering || !this.profile) return;
    this.recovering = true;
    this.clearStabilityTimer();
    try {
      const currentName = this.order[this.engineIndex];
      this.emit('fatal', { engine: currentName, error: detail?.error || detail });

      if (this.recoveryCount < this.maxSameEngineRecoveries) {
        this.recoveryCount += 1;
        const delay = retryDelay(this.recoveryCount, this.profile.retry);
        this.emit('recovery-scheduled', { engine: currentName, attempt: this.recoveryCount, delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          await this.startEngine(this.engineIndex, 'same-engine-recovery');
          return;
        } catch (error) {
          this.emit('recovery-failed', { engine: currentName, error });
        }
      }

      const next = this.engineIndex + 1;
      if (next < this.order.length) {
        try {
          await this.startEngine(next, 'fallback-after-fatal');
          return;
        } catch (error) {
          this.emit('fallback-failed', { engine: this.order[next], error });
        }
      }
      this.emit('unrecoverable', { error: detail?.error || detail });
    } finally {
      this.recovering = false;
    }
  }

  async stopEngine() {
    this.clearStabilityTimer();
    if (!this.engine) return;
    const instance = this.engine;
    this.engine = null;
    try {
      await instance.destroy();
    } catch (error) {
      this.emit('engine-destroy-failed', { error });
    }
  }

  async destroy() {
    this.destroyed = true;
    await this.stopEngine();
    this.element = null;
    this.profile = null;
    this.order = [];
    this.engineIndex = -1;
  }
}
