import { parseM3U } from './m3u-parser.js';
import { withRetry } from './network-policy.js';

function httpError(response) {
  const error = new Error(`Playlist request failed with HTTP ${response.status}`);
  error.status = response.status;
  error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
  return error;
}

export class PlaylistStore {
  constructor({
    embeddedText = '',
    embeddedSource = 'embedded',
    remoteUrl = '',
    fetcher = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
    parser = parseM3U,
    retry = {},
    requestTimeoutMs = 10000,
    minChannels = 1,
    onEvent = () => {}
  } = {}) {
    this.embeddedText = embeddedText;
    this.embeddedSource = embeddedSource;
    this.remoteUrl = remoteUrl;
    this.fetcher = fetcher;
    this.parser = parser;
    this.retry = retry;
    this.requestTimeoutMs = Math.max(0, Number(requestTimeoutMs || 0));
    this.minChannels = Math.max(1, Number(minChannels || 1));
    this.onEvent = onEvent;
    this.current = [];
    this.currentSource = '';
    this.etag = '';
    this.lastModified = '';
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail, count: this.current.length, source: this.currentSource });
  }

  parse(text, source) {
    const channels = this.parser(text, { source });
    if (!Array.isArray(channels) || channels.length < this.minChannels) {
      throw new Error(`Playlist ${source} contains fewer than ${this.minChannels} valid channel(s)`);
    }
    return channels;
  }

  snapshot() {
    return this.current.slice();
  }

  status() {
    return {
      count: this.current.length,
      source: this.currentSource,
      remoteUrl: this.remoteUrl,
      etag: this.etag,
      lastModified: this.lastModified
    };
  }

  loadEmbedded() {
    if (!this.embeddedText) throw new Error('No embedded playlist is available');
    this.current = this.parse(this.embeddedText, this.embeddedSource);
    this.currentSource = this.embeddedSource;
    this.emit('playlist-ready', { mode: 'embedded' });
    return this.snapshot();
  }

  async load({ preferRemote = false } = {}) {
    if (preferRemote && this.remoteUrl) {
      try {
        return await this.refresh();
      } catch (error) {
        this.emit('remote-load-failed', { error });
      }
    }

    if (this.current.length) return this.snapshot();
    if (this.embeddedText) return this.loadEmbedded();
    if (this.remoteUrl) return this.refresh();
    throw new Error('No embedded or remote playlist source is configured');
  }

  async fetchRemoteOnce() {
    if (!this.fetcher) throw new Error('No fetch implementation is available');
    if (!this.remoteUrl) throw new Error('No remote playlist URL is configured');

    const headers = {};
    if (this.etag) headers['If-None-Match'] = this.etag;
    if (this.lastModified) headers['If-Modified-Since'] = this.lastModified;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller && this.requestTimeoutMs
      ? setTimeout(() => controller.abort(), this.requestTimeoutMs)
      : null;

    try {
      const response = await this.fetcher(this.remoteUrl, {
        headers,
        signal: controller?.signal
      });
      if (response.status === 304 && this.current.length) {
        return { notModified: true, channels: this.snapshot(), response };
      }
      if (!response.ok) throw httpError(response);
      const text = await response.text();
      const channels = this.parse(text, this.remoteUrl);
      return { notModified: false, channels, response };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async refresh({ keepCurrentOnError = true } = {}) {
    try {
      const result = await withRetry(
        () => this.fetchRemoteOnce(),
        this.retry,
        ({ attempt, delay, error }) => this.emit('playlist-retry', { attempt, delay, error })
      );

      if (!result.notModified) {
        this.current = result.channels;
        this.currentSource = this.remoteUrl;
        this.etag = result.response.headers?.get?.('etag') || this.etag;
        this.lastModified = result.response.headers?.get?.('last-modified') || this.lastModified;
        this.emit('playlist-ready', { mode: 'remote' });
      } else {
        this.emit('playlist-not-modified');
      }
      return this.snapshot();
    } catch (error) {
      this.emit('playlist-refresh-failed', { error });
      if (keepCurrentOnError && this.current.length) return this.snapshot();
      if (keepCurrentOnError && this.embeddedText) return this.loadEmbedded();
      throw error;
    }
  }
}
