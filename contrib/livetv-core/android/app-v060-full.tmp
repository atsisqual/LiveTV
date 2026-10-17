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
const EPG_URL = 'https://raw.githubusercontent.com/LITUATUI/M3UPT/main/EPG/epg-m3upt.xml.gz';
const epgByChannel = new Map();

let activeId = '';
let current = null;
let activeGroup = '';
let viewMode = 'home';
let renderLimit = PAGE_SIZE;
let statusTimer = 0;
let playSession = 0;
let manager = null;
let playerMode = false;
let controlsTimer = 0;
let epgLoaded = false;
let epgLoading = false;

function icon(path, viewBox = '0 0 24 24') {
  return `<svg viewBox="${viewBox}" aria-hidden="true">${path}</svg>`;
}

function installPlayerUi() {
  const style = document.createElement('style');
  style.textContent = `
    .operatorUi{display:none;position:fixed;inset:0;z-index:120;pointer-events:none;color:#fff;font-family:inherit}
    body.player-mode .operatorUi{display:block}
    .opChrome{position:absolute;inset:0;opacity:1;transition:opacity .22s;pointer-events:none}
    .operatorUi.chrome-hidden .opChrome{opacity:0}
    .operatorUi.chrome-hidden .opChrome button,.operatorUi.chrome-hidden .opChrome input{pointer-events:none!important}
    .opTop{position:absolute;left:4.2vw;right:4.2vw;top:4.5vh;display:flex;align-items:center;gap:14px}
    .opRound{pointer-events:auto;width:58px;height:58px;border:0;border-radius:50%;background:rgba(20,20,21,.90);color:#fff;display:grid;place-items:center;backdrop-filter:blur(16px)}
    .opRound svg{width:29px;height:29px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
    .opTitleBar{height:58px;min-width:0;flex:1;border-radius:32px;background:rgba(25,25,26,.88);display:flex;align-items:center;padding:0 18px;gap:16px;backdrop-filter:blur(16px)}
    .opLogo{width:70px;height:40px;object-fit:contain;flex:0 0 auto}
    .opTitle{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
    .opInfo{pointer-events:auto;width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:#fff;font-size:23px;font-weight:800}
    .opBottom{position:absolute;left:6.5vw;right:6.5vw;bottom:5.5vh;height:78px;border-radius:39px;background:rgba(26,26,27,.90);display:flex;align-items:center;padding:0 22px;gap:15px;backdrop-filter:blur(18px)}
    .opCtl{pointer-events:auto;border:0;background:transparent;color:#fff;min-width:48px;height:52px;border-radius:26px;display:grid;place-items:center;font-size:12px;font-weight:750}
    .opCtl:active{background:rgba(255,255,255,.12)}
    .opCtl svg{width:29px;height:29px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
    .opTime{font-size:13px;color:#c6c7ca;font-variant-numeric:tabular-nums;min-width:44px;text-align:center}
    .opProgress{pointer-events:auto;flex:1;min-width:120px;accent-color:#34aeea}
    .opLink{pointer-events:auto;border:0;background:transparent;color:#fff;font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:0 10px;height:52px}
    .opDivider{width:1px;height:32px;background:rgba(255,255,255,.28)}
    .opDrawer{position:absolute;left:6.5vw;right:6.5vw;bottom:15.5vh;max-height:43vh;border-radius:24px;background:rgba(20,20,22,.94);backdrop-filter:blur(18px);padding:18px;display:none;pointer-events:auto;overflow:auto}
    .opDrawer.open{display:block}
    .opDrawerTitle{font-size:17px;font-weight:780;margin:0 0 12px}
    .opChannels{display:flex;gap:11px;overflow-x:auto;padding-bottom:4px}
    .opChannel{flex:0 0 105px;height:86px;border:1px solid rgba(255,255,255,.13);background:#1d2025;border-radius:17px;display:grid;place-items:center;padding:10px;color:#fff}
    .opChannel.active{outline:2px solid #6cc7ff;background:#343940}
    .opChannel img{max-width:72px;max-height:48px;object-fit:contain}
    .opChannel span{font-size:11px;text-align:center}
    .opProgram{display:grid;grid-template-columns:66px 1fr;gap:12px;padding:10px 4px;border-top:1px solid rgba(255,255,255,.08)}
    .opProgram:first-of-type{border-top:0}.opProgramTime{color:#aeb2b8;font-size:12px}.opProgramTitle{font-size:14px;font-weight:700}.opProgramDesc{font-size:11px;color:#aeb2b8;margin-top:3px;line-height:1.25}
    body.player-mode{overflow:hidden;padding-bottom:0!important}
    body.player-mode .appHeader,body.player-mode .favoritesPanel,body.player-mode .browserView,body.player-mode .bottomNav{display:none!important}
    body.player-mode .homeView{display:block!important}
    body.player-mode .hero{position:fixed!important;inset:0!important;z-index:100!important;border-radius:0!important;margin:0!important;min-height:100vh!important}
    body.player-mode .hero live-video-player,body.player-mode .hero live-video-skin{width:100%!important;height:100vh!important}
    body.player-mode .hero live-video-skin{aspect-ratio:auto!important}
    body.player-mode .heroInfo,body.player-mode .heroLogo{display:none!important}
    body.player-mode .heroShade{background:linear-gradient(180deg,rgba(0,0,0,.08),transparent 30%,transparent 65%,rgba(0,0,0,.14))!important}
    body.player-mode .status{top:50%;left:50%;right:auto;transform:translate(-50%,-50%);width:auto;max-width:70vw}
    @media(max-height:500px){.opTop{top:3vh}.opBottom{bottom:3.5vh;height:68px}.opDrawer{bottom:17vh}.opRound{width:52px;height:52px}.opTitleBar{height:52px}.opBottom{left:5vw;right:5vw}.opTitle{font-size:18px}}
  `;
  document.head.appendChild(style);

  const ui = document.createElement('div');
  ui.id = 'operatorUi';
  ui.className = 'operatorUi';
  ui.innerHTML = `
    <div class="opChrome">
      <div class="opTop">
        <button id="opClose" class="opRound" aria-label="Fechar">${icon('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
        <div class="opTitleBar">
          <img id="opLogo" class="opLogo" alt="">
          <div id="opTitle" class="opTitle">Em direto</div>
          <button id="opInfo" class="opInfo" aria-label="Informação">ⓘ</button>
        </div>
      </div>
      <div id="opDrawer" class="opDrawer"></div>
      <div class="opBottom">
        <button id="opBack10" class="opCtl" aria-label="Recuar 10 segundos">${icon('<path d="M9 7H4V2"/><path d="M4.6 6.2A9 9 0 1 1 3 12"/><text x="9" y="16" fill="currentColor" stroke="none" font-size="8" font-weight="800">10</text>')}</button>
        <button id="opPlay" class="opCtl" aria-label="Pausa">${icon('<path d="M9 5v14M15 5v14"/>')}</button>
        <button id="opFwd30" class="opCtl" aria-label="Avançar 30 segundos">${icon('<path d="M15 7h5V2"/><path d="M19.4 6.2A9 9 0 1 0 21 12"/><text x="7" y="16" fill="currentColor" stroke="none" font-size="8" font-weight="800">30</text>')}</button>
        <span id="opStart" class="opTime">--:--</span>
        <input id="opProgress" class="opProgress" type="range" min="0" max="1000" value="1000">
        <span id="opEnd" class="opTime">--:--</span>
        <button id="opChannelsBtn" class="opLink">Canais</button>
        <span class="opDivider"></span>
        <button id="opGuideBtn" class="opLink">Programação</button>
      </div>
    </div>`;
  document.body.appendChild(ui);

  const showChrome = () => {
    ui.classList.remove('chrome-hidden');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (playerMode && !document.getElementById('opDrawer').classList.contains('open')) ui.classList.add('chrome-hidden');
    }, 4500);
  };
  ui.addEventListener('click', (e) => {
    if (e.target.closest('button,input,.opDrawer')) return;
    if (ui.classList.contains('chrome-hidden')) showChrome(); else ui.classList.add('chrome-hidden');
  });
  document.getElementById('opClose').onclick = () => exitPlayerMode();
  document.getElementById('opPlay').onclick = () => {
    if (video.paused) video.play().catch(() => {}); else video.pause();
    updateOperatorPlayback();
    showChrome();
  };
  document.getElementById('opBack10').onclick = () => seekBy(-10);
  document.getElementById('opFwd30').onclick = () => seekBy(30);
  document.getElementById('opProgress').addEventListener('input', (e) => seekToProgress(Number(e.target.value)));
  document.getElementById('opChannelsBtn').onclick = () => toggleDrawer('channels');
  document.getElementById('opGuideBtn').onclick = () => toggleDrawer('guide');
  document.getElementById('opInfo').onclick = () => toggleDrawer('guide');
  ['mousemove','touchstart','pointerdown'].forEach((name) => document.addEventListener(name, () => playerMode && showChrome(), { passive:true }));
  window.LiveTVShowControls = showChrome;
}

installPlayerUi();

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
function saveFavorites() { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch {} }

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
  img.src = url; img.hidden = false; img.onerror = () => { img.hidden = true; };
}
function formatClock(ms) {
  if (!Number.isFinite(ms)) return '--:--';
  return new Date(ms).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', hour12:false });
}
function parseXmlTime(value) {
  const m = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-])?(\d{2})?(\d{2})?/);
  if (!m) return NaN;
  let t = Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (m[7] && m[8] && m[9]) {
    const off = ((+m[8]) * 60 + (+m[9])) * 60000;
    t += m[7] === '+' ? -off : off;
  }
  return t;
}
function decodeXml(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/\s+/g,' ').trim();
}
function extractTag(body, tag) {
  const m = body.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
}
async function loadEpg() {
  if (epgLoaded || epgLoading) return;
  epgLoading = true;
  try {
    const response = await fetch(EPG_URL, { cache:'no-store' });
    if (!response.ok) throw new Error(`EPG HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    let xml;
    const u8 = new Uint8Array(bytes);
    if (u8[0] === 0x1f && u8[1] === 0x8b && 'DecompressionStream' in window) {
      const ds = new DecompressionStream('gzip');
      xml = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
    } else {
      xml = new TextDecoder().decode(bytes);
    }
    const wanted = new Set(channels.map((c) => c.id).filter(Boolean));
    const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
    let match;
    while ((match = re.exec(xml))) {
      const attrs = match[1];
      const channel = (attrs.match(/\bchannel="([^"]+)"/i) || [])[1] || '';
      if (!wanted.has(channel)) continue;
      const start = parseXmlTime((attrs.match(/\bstart="([^"]+)"/i) || [])[1]);
      const stop = parseXmlTime((attrs.match(/\bstop="([^"]+)"/i) || [])[1]);
      if (!Number.isFinite(start) || !Number.isFinite(stop)) continue;
      const item = {
        start, stop,
        title: extractTag(match[2], 'title') || 'Programa',
        desc: extractTag(match[2], 'desc'),
        category: extractTag(match[2], 'category')
      };
      if (!epgByChannel.has(channel)) epgByChannel.set(channel, []);
      epgByChannel.get(channel).push(item);
    }
    for (const items of epgByChannel.values()) items.sort((a,b) => a.start-b.start);
    epgLoaded = true;
    updateProgrammeUi();
  } catch (error) {
    console.warn('EPG unavailable', error);
  } finally {
    epgLoading = false;
  }
}
function programmesFor(profile) { return profile ? (epgByChannel.get(profile.id) || []) : []; }
function nowProgramme(profile, when = Date.now()) {
  const items = programmesFor(profile);
  return items.find((p) => p.start <= when && p.stop > when) || null;
}
function upcomingProgrammes(profile, when = Date.now()) {
  const items = programmesFor(profile);
  const found = items.findIndex((p) => p.stop > when);
  const idx = found < 0 ? items.length : found;
  return items.slice(idx, idx + 7);
}
function setNowPlaying(profile) {
  const programme = nowProgramme(profile);
  nowName.textContent = profile?.name || 'Escolhe um canal';
  nowMeta.textContent = programme?.title || (profile ? (profile.group || 'Televisão em direto') : 'LiveTV');
  applyLogo(nowLogo, profile?.logo || '');
  applyLogo(fallbackLogo, profile?.logo || '');
  applyLogo(miniNowLogo, profile?.logo || '');
  miniNowName.textContent = profile?.name || 'Nenhum canal selecionado';
  miniNowMeta.textContent = programme?.title || (profile ? (profile.group || 'Televisão em direto') : 'Toca para voltar ao direto');
  heroBackdrop.style.backgroundImage = profile?.logo ? `url("${String(profile.logo).replace(/"/g, '%22')}")` : 'none';
  favoriteBtn.classList.toggle('active', Boolean(profile && favorites.has(profile.id)));
  updateProgrammeUi();
}
function updateProgrammeUi() {
  const title = document.getElementById('opTitle');
  const logo = document.getElementById('opLogo');
  const programme = nowProgramme(current);
  if (title) title.textContent = programme?.title || current?.name || 'Em direto';
  if (logo) { logo.src = current?.logo || ''; logo.style.display = current?.logo ? '' : 'none'; }
  const start = document.getElementById('opStart');
  const end = document.getElementById('opEnd');
  if (start) start.textContent = programme ? formatClock(programme.start) : '--:--';
  if (end) end.textContent = programme ? formatClock(programme.stop) : '--:--';
  if (playerMode) updateGuideDrawer(false);
}
function updateOperatorPlayback() {
  const play = document.getElementById('opPlay');
  if (play) {
    play.innerHTML = video.paused
      ? icon('<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>')
      : icon('<path d="M9 5v14M15 5v14"/>');
  }
  const progress = document.getElementById('opProgress');
  const programme = nowProgramme(current);
  if (progress && programme) {
    const pct = Math.max(0, Math.min(1000, ((Date.now() - programme.start) / Math.max(1, programme.stop - programme.start)) * 1000));
    if (document.activeElement !== progress) progress.value = String(Math.round(pct));
  }
}
function seekBy(seconds) {
  try {
    if (video.seekable?.length) {
      const start = video.seekable.start(0), end = video.seekable.end(video.seekable.length - 1);
      video.currentTime = Math.max(start, Math.min(end, video.currentTime + seconds));
    } else if (Number.isFinite(video.duration)) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }
  } catch {}
}
function seekToProgress(value) {
  try {
    if (video.seekable?.length) {
      const start = video.seekable.start(0), end = video.seekable.end(video.seekable.length - 1);
      video.currentTime = start + (end - start) * (value / 1000);
    } else if (Number.isFinite(video.duration)) {
      video.currentTime = video.duration * (value / 1000);
    }
  } catch {}
}
function renderChannelDrawer() {
  const drawer = document.getElementById('opDrawer');
  const source = [...favorites].map((id) => channelById.get(id)).filter(Boolean);
  const items = source.length ? source : channels.slice(0, 12);
  drawer.innerHTML = `<div class="opDrawerTitle">Canais</div><div class="opChannels"></div>`;
  const rail = drawer.querySelector('.opChannels');
  for (const c of items) {
    const b = document.createElement('button');
    b.className = `opChannel${current?.id === c.id ? ' active' : ''}`;
    if (c.logo) b.innerHTML = `<img src="${c.logo}" alt="">`; else b.innerHTML = `<span>${c.name}</span>`;
    b.onclick = () => { drawer.classList.remove('open'); play(c, false); };
    rail.appendChild(b);
  }
}
function updateGuideDrawer(force = true) {
  const drawer = document.getElementById('opDrawer');
  if (!drawer || (force === false && !drawer.classList.contains('open'))) return;
  const items = upcomingProgrammes(current);
  drawer.innerHTML = `<div class="opDrawerTitle">Programação · ${current?.name || ''}</div>`;
  if (!epgLoaded) {
    drawer.innerHTML += `<div class="opProgram"><div class="opProgramTime">EPG</div><div><div class="opProgramTitle">A carregar programação…</div></div></div>`;
    loadEpg();
    return;
  }
  if (!items.length) {
    drawer.innerHTML += `<div class="opProgram"><div class="opProgramTime">—</div><div><div class="opProgramTitle">Sem programação disponível</div></div></div>`;
    return;
  }
  for (const p of items) {
    const row = document.createElement('div');
    row.className = 'opProgram';
    row.innerHTML = `<div class="opProgramTime">${formatClock(p.start)}<br>${formatClock(p.stop)}</div><div><div class="opProgramTitle">${p.title}</div>${p.desc ? `<div class="opProgramDesc">${p.desc}</div>` : ''}</div>`;
    drawer.appendChild(row);
  }
}
function toggleDrawer(kind) {
  const drawer = document.getElementById('opDrawer');
  const same = drawer.dataset.kind === kind && drawer.classList.contains('open');
  if (same) { drawer.classList.remove('open'); return; }
  drawer.dataset.kind = kind;
  if (kind === 'channels') renderChannelDrawer(); else updateGuideDrawer(true);
  drawer.classList.add('open');
  document.getElementById('operatorUi').classList.remove('chrome-hidden');
}
function enterPlayerMode() {
  if (playerMode) return;
  playerMode = true;
  document.body.classList.add('player-mode');
  document.getElementById('operatorUi').classList.remove('chrome-hidden');
  try { window.LiveTVNative?.enterPlaybackMode?.(); } catch {}
  updateProgrammeUi();
  window.LiveTVShowControls?.();
}
function exitPlayerMode() {
  if (!playerMode) return;
  playerMode = false;
  document.body.classList.remove('player-mode');
  document.getElementById('opDrawer')?.classList.remove('open');
  try { window.LiveTVNative?.exitPlaybackMode?.(); } catch {}
  setView('home');
}
window.LiveTVExitPlayer = exitPlayerMode;

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
function clearNativeHeaders() { try { window.LiveTVNative?.clearPlaybackHeaders?.(); } catch {} }

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
      if (event.type === 'engine-start') setStatus('A ligar emissão…', false, true);
      if (event.type === 'engine-load-failed') setStatus('A tentar outro player…', false, true);
      if (event.type === 'engine-ready') { setStatus('Em direto'); setHeroState('ready'); }
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
  img.className = className; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
  img.src = channel.logo; img.alt = ''; img.onerror = () => img.remove();
  parent.appendChild(img); return true;
}
function renderFavorites() {
  favoritesRail.textContent = '';
  const favoriteChannels = [...favorites].map((id) => channelById.get(id)).filter(Boolean);
  favoriteCount.textContent = favoriteChannels.length ? `${favoriteChannels.length} favoritos` : '';
  if (!favoriteChannels.length) {
    const empty = document.createElement('div'); empty.className = 'emptyFav'; empty.textContent = 'Adiciona canais com o coração.';
    favoritesRail.appendChild(empty); return;
  }
  const frag = document.createDocumentFragment();
  for (const c of favoriteChannels) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `favCard${activeId === c.id ? ' active' : ''}`;
    if (!addLogo(b, c, 'favLogo')) { const f = document.createElement('div'); f.className = 'favFallback'; f.textContent = c.name; b.appendChild(f); }
    b.setAttribute('aria-label', c.name); b.onclick = () => { setView('home'); play(c, true); }; frag.appendChild(b);
  }
  favoritesRail.appendChild(frag);
}
function renderChannels(resetLimit = false) {
  if (resetLimit) renderLimit = PAGE_SIZE;
  const items = filtered(), visible = items.slice(0, renderLimit);
  list.textContent = ''; const frag = document.createDocumentFragment();
  for (const c of visible) {
    const b = document.createElement('button'); b.className = `channel${activeId === c.id ? ' active' : ''}`; b.type = 'button';
    addLogo(b, c, 'channelLogo');
    const info = document.createElement('div'); info.className = 'channelInfo';
    const n = document.createElement('div'); n.className = 'channelName'; n.textContent = c.name;
    const g = document.createElement('div'); g.className = 'channelGroup'; g.textContent = `${c.group || 'Televisão'}${favorites.has(c.id) ? ' · Favorito' : ''}`;
    info.append(n, g); b.appendChild(info); b.onclick = () => { setView('home'); play(c, true); }; frag.appendChild(b);
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
  groups.sort((a,b)=>a===''?-1:b===''?1:a.localeCompare(b,'pt'));
  const frag = document.createDocumentFragment();
  for (const g of groups) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `groupChip${g === activeGroup ? ' active' : ''}`; b.textContent = g || 'Todos';
    b.onclick = () => { activeGroup = g; renderGroups(); renderChannels(true); }; frag.appendChild(b);
  }
  groupRail.appendChild(frag);
}
function render() { renderFavorites(); renderChannels(); setNowPlaying(current); }

async function play(profile, openLandscape = false) {
  if (!profile) return;
  const session = ++playSession;
  current = profile; activeId = profile.id;
  try { localStorage.setItem(LAST_CHANNEL_KEY, profile.id); } catch {}
  renderFavorites(); renderChannels(); setNowPlaying(profile);
  setHeroState('loading', 'A ligar emissão…'); setStatus('A ligar emissão…', false, true); nativeHeaders(profile);
  if (openLandscape) enterPlayerMode();

  const previousManager = manager; manager = null;
  if (previousManager) { try { await previousManager.destroy(); } catch {} }
  if (session !== playSession) return;
  try {
    video.pause(); video.removeAttribute('src'); video.load();
    manager = createManager(session);
    await manager.load(video, profile);
    if (session !== playSession) return;
    await video.play();
  } catch (error) {
    if (session !== playSession) return;
    const msg = friendlyError(error); setHeroState('failed', msg); setStatus(msg, true);
  }
}
function toggleFavorite() {
  if (!current) { setStatus('Seleciona primeiro um canal.'); return; }
  if (favorites.has(current.id)) favorites.delete(current.id); else favorites.add(current.id);
  saveFavorites(); render();
}
function nextChannel(openLandscape = true) {
  if (!channels.length) return;
  const idx = current ? channels.findIndex((c) => c.id === current.id) : -1;
  play(channels[(idx + 1 + channels.length) % channels.length], openLandscape);
}
function setActiveNav(name) { document.querySelectorAll('.navItem').forEach((b) => b.classList.toggle('active', b.dataset.nav === name)); }
function setView(mode, focusSearch = false) {
  viewMode = mode; activeGroup = ''; renderLimit = PAGE_SIZE;
  const browserMode = mode === 'channels' || mode === 'favorites' || mode === 'search';
  homeView.classList.toggle('hidden', browserMode); browserView.classList.toggle('active', browserMode);
  setActiveNav(mode === 'channels' ? 'channels' : mode);
  const titles = { home:'Para Si', zap:'Zapping', channels:'Explorar', favorites:'Favoritos', search:'Pesquisa' };
  pageTitle.textContent = titles[mode] || 'LiveTV';
  browseTitle.textContent = mode === 'favorites' ? 'Os Meus Canais' : mode === 'search' ? 'Pesquisar' : 'Todos os canais';
  if (mode !== 'search') search.value = '';
  renderGroups(); renderChannels(true); window.scrollTo({ top:0, behavior:'instant' });
  if (focusSearch) setTimeout(() => search.focus(), 120);
}

favoriteBtn.addEventListener('click', toggleFavorite);
fullscreenBtn.addEventListener('click', () => current ? enterPlayerMode() : setStatus('Seleciona primeiro um canal.'));
allChannelsBtn.addEventListener('click', () => setView('channels'));
miniNow.addEventListener('click', () => setView('home'));
retryBtn.addEventListener('click', () => current && play(current, playerMode));
loadMoreBtn.addEventListener('click', () => { renderLimit += PAGE_SIZE; renderChannels(); });
search.addEventListener('input', () => renderChannels(true));
document.querySelectorAll('.navItem').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.nav;
    if (action === 'zap') { setView('home'); pageTitle.textContent = 'Zapping'; setActiveNav('zap'); nextChannel(true); return; }
    setView(action, action === 'search');
  });
});
video.addEventListener('playing', () => { setHeroState('ready'); status.classList.remove('show'); updateOperatorPlayback(); });
video.addEventListener('play', updateOperatorPlayback);
video.addEventListener('pause', updateOperatorPlayback);
video.addEventListener('timeupdate', updateOperatorPlayback);
video.addEventListener('waiting', () => { if (current && !hero.classList.contains('failed')) setStatus('A recuperar sinal…', false, true); });
window.addEventListener('beforeunload', () => { clearNativeHeaders(); manager?.destroy(); });
setInterval(() => { if (current) { setNowPlaying(current); updateOperatorPlayback(); } }, 30000);

renderGroups(); setNowPlaying(null); render(); loadEpg();
let initial = null;
try { initial = channelById.get(localStorage.getItem(LAST_CHANNEL_KEY) || ''); } catch {}
if (!initial) initial = [...favorites].map((id) => channelById.get(id)).find(Boolean) || channels[0];
if (initial) setTimeout(() => play(initial, false), 180);
