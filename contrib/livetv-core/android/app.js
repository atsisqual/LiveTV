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
const heroBackdrop = $('heroBackdrop');
const status = $('status');
const list = $('list');
const search = $('search');
const summary = $('summary');
const pageTitle = $('pageTitle');
const browseTitle = $('browseTitle');
const nowName = $('nowName');
const nowMeta = $('nowMeta');
const nowLogo = $('nowLogo');
const fallbackLogo = $('fallbackLogo');
const fallbackText = $('fallbackText');
const retryBtn = $('retryBtn');
const favoritesRail = $('favoritesRail');
const favoriteCount = $('favoriteCount');
const favoriteBtn = $('favoriteBtn');
const fullscreenBtn = $('fullscreenBtn');
const allChannelsBtn = $('allChannelsBtn');
const groupRail = $('groupRail');
const homeView = $('homeView');
const browserView = $('browserView');
const miniNow = $('miniNow');
const miniNowLogo = $('miniNowLogo');
const miniNowName = $('miniNowName');
const miniNowMeta = $('miniNowMeta');
const loadMoreBtn = $('loadMoreBtn');

const channels = parseM3U(embeddedM3u, { source: 'M3UPT embedded' });
const channelById = new Map(channels.map((c) => [c.id, c]));
const FAVORITES_KEY = 'livetv-favorites-v2';
const LAST_CHANNEL_KEY = 'livetv-last-channel-v1';
const PAGE_SIZE = 120;
let activeId = '';
let current = null;
let activeGroup = '';
let viewMode = 'home';
let renderLimit = PAGE_SIZE;
let statusTimer = 0;
let playSession = 0;
let manager = null;

function preferredDefaultFavorites() {
  const wanted = [/^RTP\s*1$/i,/^RTP\s*2$/i,/^SIC$/i,/^TVI$/i,/RTP\s*Not[ií]cias/i,/SIC\s*Not[ií]cias/i,/CNN\s*Portugal/i];
  const result = [];
  for (const pattern of wanted) {
    const found = channels.find((c) => pattern.test(c.name || ''));
    if (found && !result.some((x) => x.id === found.id)) result.push(found);
  }
  for (const c of channels) {
    if (result.length >= 7) break;
    if (!result.some((x) => x.id === c.id)) result.push(c);
  }
  return result.map((c) => c.id);
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null');
    if (Array.isArray(saved)) return new Set(saved.filter((id) => channelById.has(id)));
  } catch {}
  const defaults = preferredDefaultFavorites();
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(defaults)); } catch {}
  return new Set(defaults);
}

const favorites = loadFavorites();

function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch {}
}

function friendlyError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  if (text.includes('403')) return 'Emissão recusada pelo servidor';
  if (text.includes('404')) return 'Emissão não encontrada';
  if (text.includes('timeout')) return 'O canal demorou demasiado a responder';
  if (text.includes('drm') || text.includes('license')) return 'Este canal exige proteção de conteúdo';
  return 'Canal temporariamente indisponível';
}

function setStatus(text, error = false, sticky = false) {
  clearTimeout(statusTimer);
  status.textContent = text;
  status.classList.toggle('error', error);
  status.classList.add('show');
  if (!sticky) statusTimer = setTimeout(() => status.classList.remove('show'), error ? 3500 : 1800);
}

function setHeroState(state, message = '') {
  hero.classList.remove('loading', 'failed', 'ready');
  hero.classList.add(state);
  fallbackText.textContent = message || (state === 'failed' ? 'Canal indisponível' : 'A preparar emissão…');
}

function applyLogo(img, url) {
  if (!img) return;
  if (!url) { img.hidden = true; img.removeAttribute('src'); return; }
  img.src = url;
  img.hidden = false;
  img.onerror = () => { img.hidden = true; };
}

function setNowPlaying(profile) {
  nowName.textContent = profile?.name || 'Escolhe um canal';
  nowMeta.textContent = profile ? (profile.group || 'Televisão em direto') : 'LiveTV';
  applyLogo(nowLogo, profile?.logo || '');
  applyLogo(fallbackLogo, profile?.logo || '');
  applyLogo(miniNowLogo, profile?.logo || '');
  miniNowName.textContent = profile?.name || 'Nenhum canal selecionado';
  miniNowMeta.textContent = profile ? (profile.group || 'Televisão em direto') : 'Toca para voltar ao direto';
  heroBackdrop.style.backgroundImage = profile?.logo ? `url("${String(profile.logo).replace(/"/g, '%22')}")` : 'none';
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

function createManager(session) {
  return new EngineManager({
    hlsAdapterModule,
    shakaAdapterModule,
    readinessTimeoutMs: 16000,
    maxSameEngineRecoveries: 1,
    stabilityWindowMs: 25000,
    onEvent: (event) => {
      if (session !== playSession) return;
      if (event.profile?.id && current?.id && event.profile.id !== current.id) return;
      if (event.type === 'engine-start') {
        if (event.reason === 'fallback-after-fatal' || event.reason === 'initial' && event.engine === 'videojs') setStatus('A ligar emissão…', false, true);
      }
      if (event.type === 'engine-load-failed') setStatus('A tentar outro player…', false, true);
      if (event.type === 'engine-ready') {
        setStatus('Em direto');
        setHeroState('ready');
      }
      if (event.type === 'recovery-scheduled') setStatus('A recuperar sinal…', false, true);
      if (event.type === 'fallback-failed') setStatus('A tentar alternativa…', false, true);
      if (event.type === 'unrecoverable') {
        const msg = friendlyError(event.error);
        setHeroState('failed', msg);
        setStatus(msg, true);
      }
    }
  });
}

function filtered() {
  const q = search.value.trim().toLowerCase();
  return channels.filter((c) => {
    if (viewMode === 'favorites' && !favorites.has(c.id)) return false;
    if (activeGroup && c.group !== activeGroup) return false;
    return !q || `${c.name} ${c.group || ''} ${c.id || ''}`.toLowerCase().includes(q);
  });
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
    empty.textContent = 'Adiciona canais com o coração.';
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
    b.onclick = () => { setView('home'); play(c); };
    frag.appendChild(b);
  }
  favoritesRail.appendChild(frag);
}

function renderChannels(resetLimit = false) {
  if (resetLimit) renderLimit = PAGE_SIZE;
  const items = filtered();
  const visible = items.slice(0, renderLimit);
  list.textContent = '';
  const frag = document.createDocumentFragment();
  for (const c of visible) {
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
    g.textContent = `${c.group || 'Televisão'}${favorites.has(c.id) ? ' · Favorito' : ''}`;
    info.append(n, g);
    b.appendChild(info);
    b.onclick = () => { setView('home'); play(c); };
    frag.appendChild(b);
  }
  list.appendChild(frag);
  summary.textContent = viewMode === 'favorites' ? `${items.length} favoritos` : `${items.length} canais`;
  loadMoreBtn.classList.toggle('show', visible.length < items.length);
  loadMoreBtn.textContent = visible.length < items.length ? `MOSTRAR MAIS · ${visible.length}/${items.length}` : '';
}

function renderGroups() {
  groupRail.textContent = '';
  const source = viewMode === 'favorites' ? channels.filter((c) => favorites.has(c.id)) : channels;
  const groups = ['', ...new Set(source.map((c) => c.group).filter(Boolean))];
  groups.sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'pt'));
  const frag = document.createDocumentFragment();
  for (const g of groups) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `groupChip${g === activeGroup ? ' active' : ''}`;
    b.textContent = g || 'Todos';
    b.onclick = () => { activeGroup = g; renderGroups(); renderChannels(true); };
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
  const session = ++playSession;
  current = profile;
  activeId = profile.id;
  try { localStorage.setItem(LAST_CHANNEL_KEY, profile.id); } catch {}
  renderFavorites();
  renderChannels();
  setNowPlaying(profile);
  setHeroState('loading', 'A ligar emissão…');
  setStatus('A ligar emissão…', false, true);
  nativeHeaders(profile);

  const previousManager = manager;
  manager = null;
  if (previousManager) {
    try { await previousManager.destroy(); } catch {}
  }
  if (session !== playSession) return;

  try {
    video.pause();
    video.removeAttribute('src');
    video.load();
    manager = createManager(session);
    await manager.load(video, profile);
    if (session !== playSession) return;
    await video.play();
  } catch (error) {
    if (session !== playSession) return;
    const msg = friendlyError(error);
    setHeroState('failed', msg);
    setStatus(msg, true);
  }
}

function toggleFavorite() {
  if (!current) { setStatus('Seleciona primeiro um canal.'); return; }
  if (favorites.has(current.id)) favorites.delete(current.id); else favorites.add(current.id);
  saveFavorites();
  render();
}

function nextChannel() {
  const base = channels;
  if (!base.length) return;
  const idx = current ? base.findIndex((c) => c.id === current.id) : -1;
  play(base[(idx + 1 + base.length) % base.length]);
}

function setActiveNav(name) {
  document.querySelectorAll('.navItem').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
}

function setView(mode, focusSearch = false) {
  viewMode = mode;
  activeGroup = '';
  renderLimit = PAGE_SIZE;
  const browserMode = mode === 'channels' || mode === 'favorites' || mode === 'search';
  homeView.classList.toggle('hidden', browserMode);
  browserView.classList.toggle('active', browserMode);
  setActiveNav(mode === 'channels' ? 'channels' : mode);
  const titles = { home: 'Para Si', zap: 'Zapping', channels: 'Explorar', favorites: 'Favoritos', search: 'Pesquisa' };
  pageTitle.textContent = titles[mode] || 'LiveTV';
  browseTitle.textContent = mode === 'favorites' ? 'Os Meus Canais' : mode === 'search' ? 'Pesquisar' : 'Todos os canais';
  if (mode !== 'search') search.value = '';
  renderGroups();
  renderChannels(true);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focusSearch) setTimeout(() => search.focus(), 120);
}

favoriteBtn.addEventListener('click', toggleFavorite);
fullscreenBtn.addEventListener('click', async () => {
  try {
    const target = livePlayer || hero;
    if (target?.requestFullscreen) await target.requestFullscreen();
    else if (hero?.requestFullscreen) await hero.requestFullscreen();
  } catch { setStatus('Ecrã inteiro indisponível', true); }
});
allChannelsBtn.addEventListener('click', () => setView('channels'));
miniNow.addEventListener('click', () => setView('home'));
retryBtn.addEventListener('click', () => current && play(current));
loadMoreBtn.addEventListener('click', () => { renderLimit += PAGE_SIZE; renderChannels(); });
search.addEventListener('input', () => renderChannels(true));

document.querySelectorAll('.navItem').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.nav;
    if (action === 'zap') {
      setView('home');
      pageTitle.textContent = 'Zapping';
      setActiveNav('zap');
      nextChannel();
      return;
    }
    setView(action, action === 'search');
  });
});

video.addEventListener('playing', () => {
  setHeroState('ready');
  status.classList.remove('show');
});
video.addEventListener('waiting', () => {
  if (current && !hero.classList.contains('failed')) setStatus('A recuperar sinal…', false, true);
});

window.addEventListener('beforeunload', () => {
  clearNativeHeaders();
  manager?.destroy();
});

setNowPlaying(null);
renderGroups();
render();
setView('home');

let initial = null;
try { initial = channelById.get(localStorage.getItem(LAST_CHANNEL_KEY) || ''); } catch {}
if (!initial) initial = [...favorites].map((id) => channelById.get(id)).find(Boolean) || channels[0];
if (initial) setTimeout(() => play(initial), 180);
