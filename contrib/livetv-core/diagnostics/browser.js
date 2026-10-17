import { EngineManager } from '../src/engine-manager.js';

const $ = (id) => document.getElementById(id);
const state = {
  meta: null,
  channels: [],
  probeResults: new Map(),
  playbackResults: new Map(),
  activeManager: null,
  activeIndex: -1,
  cancelled: false
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function setStatus(text) {
  $('status').textContent = text;
}

function filteredChannels() {
  const q = $('search').value.trim().toLowerCase();
  const group = $('group').value;
  return state.channels.filter((channel) => {
    if (group && channel.group !== group) return false;
    if (!q) return true;
    return [channel.name, channel.id, channel.group, channel.url].some((value) => String(value || '').toLowerCase().includes(q));
  });
}

function statusClass(value) {
  return value === 'ok' ? 'ok' : value === 'running' ? 'running' : value ? 'bad' : '';
}

function resultCells(index) {
  const probe = state.probeResults.get(index);
  const playback = state.playbackResults.get(index);
  return {
    network: probe?.status || '',
    http: probe ? [probe.http?.manifest, probe.http?.variant, probe.http?.segment].filter((x) => x != null).join(' / ') : '',
    codec: probe?.codecs?.join(', ') || '',
    engine: playback?.engine || probe?.engineSelected || state.channels[index]?.engineSelected || '',
    fallback: playback?.fallbackUsed ? 'SIM' : (playback ? 'não' : (probe?.fallback?.join(' → ') || state.channels[index]?.fallback?.join(' → ') || '')),
    latency: probe?.timings?.totalMs != null ? `${probe.timings.totalMs} ms` : '',
    error: playback?.error || probe?.error || '',
    playback: playback?.status || ''
  };
}

function renderRows() {
  const channels = filteredChannels();
  $('count').textContent = `${channels.length} / ${state.channels.length}`;
  $('rows').innerHTML = channels.map((channel) => {
    const cells = resultCells(channel.index);
    const drm = channel.drm ? `${channel.drm.type || channel.drm.keySystem || 'DRM'}` : '—';
    return `<tr data-index="${channel.index}">
      <td>${channel.index + 1}</td>
      <td class="name">${channel.logo ? `<img src="${esc(channel.logo)}" alt="">` : ''}<span><strong>${esc(channel.name)}</strong><small>${esc(channel.group || 'Sem grupo')}</small></span></td>
      <td>${channel.transportRequired ? 'proxy' : 'direto'}</td>
      <td>${esc(drm)}</td>
      <td class="network ${statusClass(cells.network)}">${esc(cells.network || '—')}</td>
      <td class="http">${esc(cells.http || '—')}</td>
      <td class="codec">${esc(cells.codec || '—')}</td>
      <td class="engine">${esc(cells.engine || channel.engineSelected || '—')}</td>
      <td class="fallback">${esc(cells.fallback || '—')}</td>
      <td class="latency">${esc(cells.latency || '—')}</td>
      <td class="playback ${statusClass(cells.playback)}">${esc(cells.playback || '—')}</td>
      <td class="error" title="${esc(cells.error)}">${esc(cells.error || '—')}</td>
      <td class="actions"><button data-action="probe" data-index="${channel.index}">Rede</button><button data-action="play" data-index="${channel.index}">Playback</button></td>
    </tr>`;
  }).join('');
}

function updateRow(index) {
  const row = document.querySelector(`tr[data-index="${index}"]`);
  if (!row) return;
  const cells = resultCells(index);
  for (const [name, value] of Object.entries({
    network: cells.network || '—',
    http: cells.http || '—',
    codec: cells.codec || '—',
    engine: cells.engine || '—',
    fallback: cells.fallback || '—',
    latency: cells.latency || '—',
    playback: cells.playback || '—',
    error: cells.error || '—'
  })) {
    const cell = row.querySelector(`.${name}`);
    if (!cell) continue;
    cell.textContent = value;
    if (name === 'network' || name === 'playback') cell.className = `${name} ${statusClass(value === '—' ? '' : value)}`;
    if (name === 'error') cell.title = value === '—' ? '' : value;
  }
}

async function probeOne(index) {
  state.probeResults.set(index, { status: 'running' });
  updateRow(index);
  try {
    const response = await fetch(`/api/probe?index=${index}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.probeResults.set(index, await response.json());
  } catch (error) {
    state.probeResults.set(index, { status: 'error', error: error?.message || String(error), http: {}, timings: {} });
  }
  updateRow(index);
}

async function runPool(items, worker, concurrency = 6) {
  let cursor = 0;
  const jobs = Array.from({ length: Math.max(1, Math.min(items.length || 1, concurrency)) }, async () => {
    while (!state.cancelled) {
      const slot = cursor++;
      if (slot >= items.length) return;
      await worker(items[slot], slot);
    }
  });
  await Promise.all(jobs);
}

async function probeVisible() {
  state.cancelled = false;
  const items = filteredChannels();
  $('probeVisible').disabled = true;
  $('stop').disabled = false;
  let done = 0;
  setStatus(`A diagnosticar ${items.length} canais...`);
  await runPool(items, async (channel) => {
    await probeOne(channel.index);
    done += 1;
    setStatus(`${done}/${items.length} canais diagnosticados`);
  }, Number($('concurrency').value || 6));
  $('probeVisible').disabled = false;
  $('stop').disabled = true;
  setStatus(state.cancelled ? `Diagnóstico interrompido em ${done}/${items.length}` : `Diagnóstico concluído: ${done}/${items.length}`);
}

function proxyUrl(profile, url, requestType) {
  if (String(url).startsWith('/api/proxy?') || String(url).startsWith(`${location.origin}/api/proxy?`)) return url;
  const index = profile?.metadata?.diagnosticIndex;
  const params = new URLSearchParams({
    token: state.meta.proxyToken,
    index: String(index),
    kind: String(requestType || 'manifest'),
    url
  });
  return `/api/proxy?${params}`;
}

function waitForPlaying(video, timeoutMs = 10000) {
  if (!video.paused && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Playback did not start within ${timeoutMs} ms`)), timeoutMs);
    const finish = (error) => {
      clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onPlaying);
      video.removeEventListener('error', onError);
      if (error) reject(error); else resolve();
    };
    const onPlaying = () => finish();
    const onError = () => finish(video.error || new Error('Media element error'));
    video.addEventListener('playing', onPlaying, { once: true });
    video.addEventListener('timeupdate', onPlaying, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function playOne(index) {
  const channel = state.channels[index];
  if (!channel) return;

  if (state.activeManager) await state.activeManager.destroy();
  state.activeManager = null;
  state.activeIndex = index;

  const video = $('smokeVideo');
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.muted = true;
  video.playsInline = true;

  const playback = { status: 'running', engine: '', fallbackUsed: false, error: '' };
  state.playbackResults.set(index, playback);
  updateRow(index);
  $('nowPlaying').textContent = `${channel.name} — a testar...`;

  const events = [];
  const manager = new EngineManager({
    readinessTimeoutMs: 15000,
    maxSameEngineRecoveries: 1,
    transportResolver: ({ profile, url, requestType }) => proxyUrl(profile, url, requestType),
    onEvent: (event) => {
      events.push(event);
      if (event.type === 'engine-ready') playback.engine = event.engine;
      if (event.type === 'engine-start' && event.reason === 'fallback-after-fatal') playback.fallbackUsed = true;
    }
  });
  state.activeManager = manager;

  try {
    const loaded = await manager.load(video, channel);
    playback.engine = playback.engine || loaded?.engine || '';
    await video.play();
    await waitForPlaying(video);
    playback.status = 'ok';
    $('nowPlaying').textContent = `${channel.name} — OK (${playback.engine})`;
  } catch (error) {
    playback.status = 'error';
    playback.error = error?.message || String(error);
    const ready = [...events].reverse().find((event) => event.type === 'engine-ready');
    if (ready) playback.engine = ready.engine;
    $('nowPlaying').textContent = `${channel.name} — erro: ${playback.error}`;
  }
  updateRow(index);
}

async function init() {
  setStatus('A carregar snapshot M3UPT...');
  const [metaResponse, channelsResponse] = await Promise.all([fetch('/api/meta'), fetch('/api/channels')]);
  if (!metaResponse.ok || !channelsResponse.ok) throw new Error('Não foi possível carregar os dados de diagnóstico');
  state.meta = await metaResponse.json();
  state.channels = await channelsResponse.json();

  const groups = [...new Set(state.channels.map((channel) => channel.group || ''))].sort((a, b) => a.localeCompare(b));
  $('group').innerHTML = '<option value="">Todos os grupos</option>' + groups.map((group) => `<option value="${esc(group)}">${esc(group || 'Sem grupo')}</option>`).join('');
  $('snapshot').textContent = `${state.meta.extinfEntries} EXTINF · ${state.meta.parsedChannels} canais válidos · ${Math.round(state.meta.bytes / 1024)} KB · upstream ${String(state.meta.upstreamCommit || '').slice(0, 10)}`;
  renderRows();
  setStatus('Pronto. O diagnóstico de rede não inicia playback; o botão Playback usa as engines reais.');
}

$('search').addEventListener('input', renderRows);
$('group').addEventListener('change', renderRows);
$('probeVisible').addEventListener('click', probeVisible);
$('stop').addEventListener('click', () => { state.cancelled = true; });
$('rows').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'probe') probeOne(index);
  if (button.dataset.action === 'play') playOne(index);
});
window.addEventListener('beforeunload', () => state.activeManager?.destroy());

init().catch((error) => setStatus(`Erro: ${error?.message || error}`));
