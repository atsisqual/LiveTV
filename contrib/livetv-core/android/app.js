import { EngineManager, parseM3U } from '../src/index.js';
import * as hlsAdapterModule from '@videojs/hlsjs-video';
import * as shakaAdapterModule from '@videojs/shaka-video';
import embeddedM3u from '../fixtures/M3UPT.m3u';

const $ = (id) => document.getElementById(id);
const video = $('video');
const status = $('status');
const list = $('list');
const search = $('search');
const group = $('group');
const summary = $('summary');

const channels = parseM3U(embeddedM3u, { source: 'M3UPT embedded' });
let activeId = '';
let current = null;

function setStatus(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function nativeHeaders(profile) {
  try {
    if (!window.LiveTVNative?.setPlaybackHeaders) return;
    const headers = profile?.headers || {};
    window.LiveTVNative.setPlaybackHeaders(JSON.stringify({
      userAgent: headers['User-Agent'] || headers['user-agent'] || '',
      referer: headers.Referer || headers.referer || '',
      origin: headers.Origin || headers.origin || ''
    }));
  } catch {}
}

function clearNativeHeaders() {
  try { window.LiveTVNative?.clearPlaybackHeaders?.(); } catch {}
}

const manager = new EngineManager({
  hlsAdapterModule,
  shakaAdapterModule,
  readinessTimeoutMs: 18000,
  maxSameEngineRecoveries: 2,
  stabilityWindowMs: 30000,
  onEvent: (event) => {
    const name = current?.name || 'canal';
    if (event.type === 'engine-start') setStatus(`${name} · ${event.engine} · ${event.reason}`);
    if (event.type === 'engine-ready') setStatus(`${name} · ${event.engine} pronto`);
    if (event.type === 'recovery-scheduled') setStatus(`${name} · recuperar ${event.engine} (${event.attempt})…`);
    if (event.type === 'fallback-failed' || event.type === 'unrecoverable') {
      const msg = event.error?.message || String(event.error || event.type);
      setStatus(`${name} · ${msg}`, true);
    }
  }
});

function filtered() {
  const q = search.value.trim().toLowerCase();
  const g = group.value;
  return channels.filter((c) => (!g || c.group === g) && (!q || `${c.name} ${c.group} ${c.id}`.toLowerCase().includes(q)));
}

function render() {
  const items = filtered();
  list.textContent = '';
  const frag = document.createDocumentFragment();
  for (const c of items) {
    const b = document.createElement('button');
    b.className = `row${activeId === c.id ? ' active' : ''}`;
    b.type = 'button';
    if (c.logo) {
      const img = document.createElement('img');
      img.className = 'logo';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = c.logo;
      img.alt = '';
      img.onerror = () => img.remove();
      b.appendChild(img);
    }
    const info = document.createElement('div');
    info.className = 'info';
    const n = document.createElement('div');
    n.className = 'name';
    n.textContent = c.name;
    const g = document.createElement('div');
    g.className = 'group';
    g.textContent = `${c.group || 'Sem grupo'} · ${c.type || 'auto'}`;
    info.append(n, g);
    b.appendChild(info);
    b.onclick = () => play(c);
    frag.appendChild(b);
  }
  list.appendChild(frag);
  summary.textContent = `${items.length}/${channels.length} canais · M3UPT embebido no APK`;
}

async function play(profile) {
  current = profile;
  activeId = profile.id;
  render();
  nativeHeaders(profile);
  setStatus(`${profile.name} · a iniciar…`);
  try {
    video.pause();
    video.removeAttribute('src');
    video.load();
    await manager.load(video, profile);
    await video.play();
  } catch (error) {
    setStatus(`${profile.name} · ${error?.message || error}`, true);
  }
}

const groups = [...new Set(channels.map((c) => c.group).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt'));
for (const g of groups) {
  const o = document.createElement('option');
  o.value = g;
  o.textContent = g;
  group.appendChild(o);
}
search.addEventListener('input', render);
group.addEventListener('change', render);
window.addEventListener('beforeunload', () => { clearNativeHeaders(); manager.destroy(); });
render();
