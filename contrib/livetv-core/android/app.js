import '@videojs/html/live-video/player';
import '@videojs/html/live-video/skin';
import { EngineManager, parseM3U } from '../src/index.js';
import * as hlsAdapterModule from '@videojs/hlsjs-video';
import * as shakaAdapterModule from '@videojs/shaka-video';
import embeddedM3u from '../fixtures/M3UPT.m3u';

const $ = (id) => document.getElementById(id);
const video = $('video');
const livePlayer = $('livePlayer');
const hero = $('hero');
const status = $('status');
const list = $('list');
const search = $('search');
const summary = $('summary');
const nowName = $('nowName');
const nowMeta = $('nowMeta');
const nowLogo = $('nowLogo');
const favoritesRail = $('favoritesRail');
const favoriteCount = $('favoriteCount');
const favoriteBtn = $('favoriteBtn');
const fullscreenBtn = $('fullscreenBtn');
const allChannelsBtn = $('allChannelsBtn');
const groupRail = $('groupRail');

const channels = parseM3U(embeddedM3u, { source: 'M3UPT embedded' });
const channelById = new Map(channels.map((c) => [c.id, c]));
const FAVORITES_KEY = 'livetv-favorites-v1';
let activeId = '';
let current = null;
let activeGroup = '';
let statusTimer = 0;

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null');
    if (Array.isArray(saved)) return new Set(saved.filter((id) => channelById.has(id)));
  } catch {}
  const defaults = channels.slice(0, 7).map((c) => c.id);
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(defaults)); } catch {}
  return new Set(defaults);
}

const favorites = loadFavorites();

function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch {}
}

function setStatus(text, error = false, sticky = false) {
  clearTimeout(statusTimer);
  status.textContent = text;
  status.classList.toggle('error', error);
  status.classList.add('show');
  if (!sticky) statusTimer = setTimeout(() => status.classList.remove('show'), error ? 5200 : 2300);
}

function setNowPlaying(profile) {
  nowName.textContent = profile?.name || 'Escolhe um canal';
  nowMeta.textContent = profile ? (profile.group || 'Live TV') : 'M3UPT · LiveTV';
  if (profile?.logo) {
    nowLogo.src = profile.logo;
    nowLogo.hidden = false;
    nowLogo.onerror = () => { nowLogo.hidden = true; };
  } else {
    nowLogo.hidden = true;
    nowLogo.removeAttribute('src');
  }
  favoriteBtn.textContent = profile && favorites.has(profile.id) ? '♥' : '♡';
  favoriteBtn.classList.toggle('active', Boolean(profile && favorites.has(profile.id)));
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
    if (event.type === 'engine-start') setStatus(`${name} · ${event.engine}`);
    if (event.type === 'engine-ready') setStatus(`${name} · em direto`);
    if (event.type === 'recovery-scheduled') setStatus(`${name} · a recuperar sinal…`, false, true);
    if (event.type === 'fallback-failed' || event.type === 'unrecoverable') {
      const msg = event.error?.message || String(event.error || event.type);
      setStatus(`${name} · ${msg}`, true);
    }
  }
});

function filtered() {
  const q = search.value.trim().toLowerCase();
  return channels.filter((c) => (!activeGroup || c.group === activeGroup) && (!q || `${c.name} ${c.group || ''} ${c.id || ''}`.toLowerCase().includes(q)));
}

function addLogo(parent, channel, className) {
  if (!channel.logo) return false;
  const img = document.createElement('img');
  img.className = className;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.src = channel.logo;
  img.alt = '';
  img.onerror = () => img.remove();
  parent.appendChild(img);
  return true;
}

function renderFavorites() {
  favoritesRail.textContent = '';
  const favoriteChannels = [...favorites].map((id) => channelById.get(id)).filter(Boolean);
  favoriteCount.textContent = favoriteChannels.length ? `${favoriteChannels.length} favoritos` : '';
  if (!favoriteChannels.length) {
    const empty = document.createElement('div');
    empty.className = 'emptyFav';
    empty.textContent = 'Adiciona canais com o coração no topo.';
    favoritesRail.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const c of favoriteChannels) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `favCard${activeId === c.id ? ' active' : ''}`;
    if (!addLogo(b, c, 'favLogo')) {
      const fallback = document.createElement('div');
      fallback.className = 'favFallback';
      fallback.textContent = c.name;
      b.appendChild(fallback);
    }
    b.setAttribute('aria-label', c.name);
    b.onclick = () => play(c);
    frag.appendChild(b);
  }
  favoritesRail.appendChild(frag);
}

function renderChannels() {
  const items = filtered();
  list.textContent = '';
  const frag = document.createDocumentFragment();
  for (const c of items) {
    const b = document.createElement('button');
    b.className = `channel${activeId === c.id ? ' active' : ''}`;
    b.type = 'button';
    addLogo(b, c, 'channelLogo');
    const info = document.createElement('div');
    info.className = 'channelInfo';
    const n = document.createElement('div');
    n.className = 'channelName';
    n.textContent = c.name;
    const g = document.createElement('div');
    g.className = 'channelGroup';
    g.textContent = `${c.group || 'Live TV'}${favorites.has(c.id) ? ' · ♥' : ''}`;
    info.append(n, g);
    b.appendChild(info);
    b.onclick = () => play(c);
    frag.appendChild(b);
  }
  list.appendChild(frag);
  summary.textContent = `${items.length} de ${channels.length}`;
}

function renderGroups() {
  groupRail.textContent = '';
  const groups = ['', ...new Set(channels.map((c) => c.group).filter(Boolean))];
  groups.sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'pt'));
  const frag = document.createDocumentFragment();
  for (const g of groups) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `groupChip${g === activeGroup ? ' active' : ''}`;
    b.textContent = g || 'Todos';
    b.onclick = () => {
      activeGroup = g;
      renderGroups();
      renderChannels();
    };
    frag.appendChild(b);
  }
  groupRail.appendChild(frag);
}

function render() {
  renderFavorites();
  renderChannels();
  setNowPlaying(current);
}

async function play(profile) {
  if (!profile) return;
  current = profile;
  activeId = profile.id;
  document.body.classList.add('has-channel');
  render();
  nativeHeaders(profile);
  setStatus(`${profile.name} · a ligar…`, false, true);
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

function toggleFavorite() {
  if (!current) {
    setStatus('Seleciona primeiro um canal.');
    return;
  }
  if (favorites.has(current.id)) favorites.delete(current.id);
  else favorites.add(current.id);
  saveFavorites();
  render();
}

function nextChannel() {
  const base = filtered().length ? filtered() : channels;
  if (!base.length) return;
  const idx = current ? base.findIndex((c) => c.id === current.id) : -1;
  play(base[(idx + 1 + base.length) % base.length]);
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setActiveNav(name) {
  document.querySelectorAll('.navItem').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
}

favoriteBtn.addEventListener('click', toggleFavorite);
fullscreenBtn.addEventListener('click', async () => {
  try {
    const target = livePlayer || hero;
    if (target?.requestFullscreen) await target.requestFullscreen();
    else if (hero?.requestFullscreen) await hero.requestFullscreen();
  } catch (error) {
    setStatus(`Ecrã inteiro indisponível · ${error?.message || error}`, true);
  }
});
allChannelsBtn.addEventListener('click', () => { setActiveNav('channels'); scrollToId('channelsSection'); });
search.addEventListener('input', renderChannels);

document.querySelectorAll('.navItem').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.nav;
    if (action === 'zap') {
      setActiveNav('zap');
      nextChannel();
      return;
    }
    setActiveNav(action);
    if (action === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (action === 'channels') scrollToId('channelsSection');
    if (action === 'favorites') scrollToId('favoritesSection');
    if (action === 'search') {
      scrollToId('channelsSection');
      setTimeout(() => search.focus(), 350);
    }
  });
});

window.addEventListener('beforeunload', () => { clearNativeHeaders(); manager.destroy(); });
renderGroups();
setNowPlaying(null);
render();

const initial = [...favorites].map((id) => channelById.get(id)).find(Boolean) || channels[0];
if (initial) setTimeout(() => play(initial), 220);
