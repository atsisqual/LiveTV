const RECENTS_KEY = 'livetv-recent-v1';
const DRAWER_VIEW_KEY = 'livetv-drawer-view-v1';
const SCREEN_MODE_KEY = 'livetv-screen-mode-v1';
const SPEED_KEY = 'livetv-speed-v1';

const svg = (body, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" aria-hidden="true">${body}</svg>`;

function safeJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function installOperatorV070(api) {
  const ui = document.getElementById('operatorUi');
  const chrome = ui?.querySelector('.opChrome');
  const top = ui?.querySelector('.opTop');
  const bottom = ui?.querySelector('.opBottom');
  const drawer = document.getElementById('opDrawer');
  const video = api.video;
  if (!ui || !chrome || !top || !bottom || !drawer || !video) return;

  const style = document.createElement('style');
  style.textContent = `
    :root{--op-drawer-w:min(34vw,460px)}
    .opTopActions{display:flex;gap:10px;align-items:center;flex:0 0 auto}
    .opTopActions .opRound{width:58px;height:58px}
    .opMoreMenu{position:absolute;right:4.2vw;top:calc(4.5vh + 68px);width:275px;background:rgba(31,32,35,.97);border-radius:15px;overflow:hidden;display:none;pointer-events:auto;box-shadow:0 18px 50px rgba(0,0,0,.45);backdrop-filter:blur(18px)}
    .opMoreMenu.open{display:block}
    .opMenuItem{height:70px;width:100%;border:0;border-bottom:1px solid rgba(255,255,255,.11);background:transparent;color:#f6f7f8;display:flex;align-items:center;gap:20px;padding:0 22px;text-align:left;font-size:17px}
    .opMenuItem:last-child{border-bottom:0}.opMenuItem svg{width:27px;height:27px;stroke:currentColor;fill:none;stroke-width:2}
    .opNowBadge{padding:7px 14px;border-radius:999px;background:#0c9de4;color:#fff;font-size:12px;font-weight:780;letter-spacing:.04em;display:none}
    .opNowBadge.show{display:inline-flex}
    .opSideCtl{position:absolute;top:28%;bottom:26%;width:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;pointer-events:none}
    .opSideCtl.left{left:3.5vw}.opSideCtl.right{right:3.5vw}
    .opSideCtl svg{width:28px;height:28px;stroke:#fff;fill:none;stroke-width:2.2}
    .opSideRange{pointer-events:auto;width:210px;height:22px;transform:rotate(-90deg);accent-color:#fff}
    .opSideValue{font-size:10px;color:#d6d7d9;min-width:34px;text-align:center}
    .opDrawer{display:block!important;position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:auto!important;width:var(--op-drawer-w)!important;max-height:none!important;border-radius:0!important;background:#191c21!important;padding:24px 24px 28px!important;overflow:auto!important;transform:translateX(101%);opacity:1;transition:transform .24s ease;box-shadow:-16px 0 50px rgba(0,0,0,.30);z-index:125}
    .opDrawer.open{transform:translateX(0)}
    body.player-mode.drawer-open .hero{right:var(--op-drawer-w)!important;transition:right .24s ease}
    body.player-mode.drawer-open .opTop{right:calc(var(--op-drawer-w) + 4.2vw)!important;transition:right .24s ease}
    body.player-mode.drawer-open .opBottom{right:calc(var(--op-drawer-w) + 6.5vw)!important;transition:right .24s ease}
    body.player-mode.drawer-open .opSideCtl.right{right:calc(var(--op-drawer-w) + 3.5vw)!important}
    .opDrawerHandle{position:fixed;left:calc(100% - var(--op-drawer-w) - 20px);top:46%;width:42px;height:70px;border:0;border-radius:22px 0 0 22px;background:#191c21;color:#fff;display:none;place-items:center;z-index:126;pointer-events:auto;font-size:34px;box-shadow:-8px 0 20px rgba(0,0,0,.22)}
    body.drawer-open .opDrawerHandle{display:grid}
    .drawerTabs{display:grid;grid-template-columns:1fr 1fr;background:#202329;border:1px solid #40454d;border-radius:30px;overflow:hidden;margin:6px 0 28px}
    .drawerTab{height:58px;border:0;background:transparent;color:#999da4;display:grid;place-items:center}.drawerTab.active{background:#73777f;color:#fff}.drawerTab svg{width:27px;height:27px;fill:currentColor;stroke:none}
    .drawerHeading{font-size:22px;font-weight:760;margin:0 0 18px}.drawerDivider{height:1px;background:#343940;margin:26px 0 24px}
    .drawerSearch{width:100%;height:44px;border-radius:13px;border:1px solid #373c44;background:#13161a;color:#fff;padding:0 13px;font-size:14px;outline:none;margin:-4px 0 16px}.drawerSearch:focus{border-color:#67c6ff}
    .channelShelf{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.channelShelf.list{display:flex;flex-direction:column;gap:7px}
    .drawerChannel{position:relative;min-width:0;height:92px;border:1px solid #343941;border-radius:18px;background:#1a1d22;color:#fff;display:flex;align-items:center;justify-content:center;padding:11px}.drawerChannel.active{background:#3a3e45;border-color:#565c65}.drawerChannel.active:after{content:"";position:absolute;right:11px;top:10px;width:8px;height:8px;border-radius:50%;background:#80c6ff}.drawerChannel img{max-width:76px;max-height:53px;object-fit:contain}.drawerChannel .name{font-size:12px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .channelShelf.list .drawerChannel{height:62px;justify-content:flex-start;gap:12px;padding:8px 12px}.channelShelf.list .drawerChannel img{width:56px;height:42px}.channelShelf.list .drawerChannel .name{text-align:left;font-size:14px}
    .drawerMore{display:block;margin:18px auto 0;border:1px solid #3b4048;background:#20242a;color:#fff;border-radius:999px;padding:9px 16px}
    .guideTitle{font-size:22px;font-weight:760;margin:4px 0 20px}.guideTimeline{position:relative;padding-left:0}.guideTimeline:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;background:#3e434b;opacity:.65;transform:translateX(-50%);pointer-events:none}
    .guideCard{position:relative;margin:0 0 14px;border-radius:10px;overflow:hidden;background:#303338;border:1px solid #3a3f46;min-height:120px}.guideCard.current{border-color:#68c8ff;box-shadow:0 0 0 1px rgba(104,200,255,.25)}
    .guideArtwork{height:88px;background:#24272c center/cover no-repeat;position:relative}.guideArtwork:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 20%,rgba(0,0,0,.65))}.guideLogo{position:absolute;left:16px;top:18px;max-width:92px;max-height:48px;object-fit:contain;z-index:2}.guideMeta{padding:9px 12px 11px}.guideName{font-size:14px;font-weight:720}.guideDesc{font-size:11px;color:#a8acb2;line-height:1.3;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.guideTimePill{width:max-content;min-width:86px;margin:0 auto 14px;padding:8px 18px;border-radius:999px;background:#737780;color:#fff;text-align:center;font-weight:720;position:relative;z-index:2}.guideNow{background:#65c4ef;font-size:13px}.guideProgress{height:3px;background:#555b63}.guideProgress>span{display:block;height:100%;background:#77cdf5}.screenTitle{font-size:24px;font-weight:760;margin:80px 0 26px}.screenChoices{border:1px solid #41464e;border-radius:20px;overflow:hidden}.screenChoice{height:80px;width:100%;border:0;border-bottom:1px solid #41464e;background:transparent;color:#fff;display:flex;align-items:center;gap:18px;padding:0 22px;font-size:20px;text-align:left}.screenChoice:last-child{border-bottom:0}.radio{width:29px;height:29px;border:3px solid #fff;border-radius:50%;display:grid;place-items:center}.screenChoice.active .radio:after{content:"";width:13px;height:13px;border-radius:50%;background:#fff}.screenHint{color:#a5a9af;font-size:14px;line-height:1.45;margin-top:24px}
    .speedChoices{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.speedChoice{height:58px;border:1px solid #3a3f46;border-radius:15px;background:#202329;color:#fff;font-size:16px}.speedChoice.active{background:#6e737b}
    .unlockBtn{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;border:0;background:rgba(20,20,21,.9);color:#fff;display:none;place-items:center;z-index:150;pointer-events:auto}.unlockBtn svg{width:34px;height:34px;stroke:currentColor;fill:none;stroke-width:2}
    .operatorUi.locked .opChrome{opacity:0!important;pointer-events:none!important}.operatorUi.locked .unlockBtn{display:grid}
    @media(max-height:500px){:root{--op-drawer-w:min(34vw,430px)}.opMoreMenu{top:70px}.opDrawer{padding:16px 18px 22px!important}.drawerTabs{margin-bottom:18px}.drawerHeading{font-size:18px;margin-bottom:12px}.drawerChannel{height:76px}.guideArtwork{height:74px}.opSideCtl{top:24%;bottom:24%}.opSideRange{width:170px}}
  `;
  document.head.appendChild(style);

  const topActions = document.createElement('div');
  topActions.className = 'opTopActions';
  topActions.innerHTML = `
    <button id="opPip" class="opRound" aria-label="Picture in Picture">${svg('<rect x="4" y="5" width="16" height="14" rx="2"/><rect x="12" y="11" width="6" height="5" rx="1" fill="currentColor" stroke="none"/>')}</button>
    <button id="opMore" class="opRound" aria-label="Mais opções">${svg('<circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none"/>')}</button>`;
  top.appendChild(topActions);

  const moreMenu = document.createElement('div');
  moreMenu.id = 'opMoreMenu';
  moreMenu.className = 'opMoreMenu';
  moreMenu.innerHTML = `
    <button class="opMenuItem" data-menu="pip">${svg('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="none"/>')}<span>PiP</span></button>
    <button class="opMenuItem" data-menu="lock">${svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')}<span>Bloquear</span></button>
    <button class="opMenuItem" data-menu="screen">${svg('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>')}<span>Opções de Ecrã</span></button>
    <button class="opMenuItem" data-menu="speed">${svg('<path d="M5 17a8 8 0 1 1 14 0"/><path d="M12 13l4-4"/>')}<span>Velocidade</span></button>`;
  chrome.appendChild(moreMenu);

  const nowBadge = document.createElement('span');
  nowBadge.id = 'opNowBadge';
  nowBadge.className = 'opNowBadge';
  nowBadge.textContent = 'AGORA';
  const endTime = document.getElementById('opEnd');
  endTime?.insertAdjacentElement('afterend', nowBadge);

  const sideLeft = document.createElement('div');
  sideLeft.className = 'opSideCtl left';
  sideLeft.innerHTML = `${svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')}<input id="opBrightness" class="opSideRange" type="range" min="0.08" max="1" step="0.02" value="0.7"><span id="opBrightnessValue" class="opSideValue">70%</span>`;
  const sideRight = document.createElement('div');
  sideRight.className = 'opSideCtl right';
  sideRight.innerHTML = `${svg('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/>')}<input id="opVolume" class="opSideRange" type="range" min="0" max="1" step="0.02" value="1"><span id="opVolumeValue" class="opSideValue">100%</span>`;
  chrome.append(sideLeft, sideRight);

  const handle = document.createElement('button');
  handle.id = 'opDrawerHandle';
  handle.className = 'opDrawerHandle';
  handle.innerHTML = '›';
  chrome.appendChild(handle);

  const unlock = document.createElement('button');
  unlock.id = 'opUnlock';
  unlock.className = 'unlockBtn';
  unlock.innerHTML = svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.5"/>');
  ui.appendChild(unlock);

  let drawerView = localStorage.getItem(DRAWER_VIEW_KEY) || 'grid';
  let channelLimit = 120;
  let locked = false;

  function setDrawerOpen(open) {
    drawer.classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    moreMenu.classList.remove('open');
    ui.classList.remove('chrome-hidden');
  }

  function closeDrawer() { setDrawerOpen(false); }
  handle.onclick = closeDrawer;

  function recentIds() {
    const ids = safeJson(RECENTS_KEY, []);
    return Array.isArray(ids) ? ids.filter((id) => api.channelById.has(id)).slice(0, 6) : [];
  }

  function rememberCurrent() {
    const id = api.current?.id;
    if (!id) return;
    const next = [id, ...recentIds().filter((x) => x !== id)].slice(0, 6);
    saveJson(RECENTS_KEY, next);
  }
  video.addEventListener('playing', rememberCurrent);
  if (api.current) rememberCurrent();

  function channelButton(channel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `drawerChannel${api.current?.id === channel.id ? ' active' : ''}`;
    if (channel.logo) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = channel.logo;
      img.alt = '';
      img.onerror = () => img.remove();
      button.appendChild(img);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = channel.name;
    if (!channel.logo || drawerView === 'list') button.appendChild(name);
    button.onclick = () => {
      closeDrawer();
      api.play(channel, false);
    };
    return button;
  }

  function renderChannelsDrawer() {
    const recents = recentIds().map((id) => api.channelById.get(id)).filter(Boolean);
    drawer.innerHTML = `
      <div class="drawerTabs">
        <button class="drawerTab ${drawerView === 'grid' ? 'active' : ''}" data-view="grid" aria-label="Grelha">${svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>')}</button>
        <button class="drawerTab ${drawerView === 'list' ? 'active' : ''}" data-view="list" aria-label="Lista">${svg('<rect x="4" y="5" width="16" height="4" rx="1"/><rect x="4" y="15" width="16" height="4" rx="1"/>')}</button>
      </div>
      <div class="drawerHeading">Canais Recentes</div>
      <div id="recentShelf" class="channelShelf ${drawerView}"></div>
      <div class="drawerDivider"></div>
      <div class="drawerHeading">Todos os Canais</div>
      <input id="drawerSearch" class="drawerSearch" placeholder="Pesquisar canal" autocomplete="off">
      <div id="allShelf" class="channelShelf ${drawerView}"></div>
      <button id="drawerMore" class="drawerMore">MOSTRAR MAIS</button>`;

    const recentShelf = drawer.querySelector('#recentShelf');
    if (!recents.length) {
      recentShelf.innerHTML = '<div style="color:#8f949c;font-size:13px">Ainda não há canais recentes.</div>';
    } else recents.forEach((c) => recentShelf.appendChild(channelButton(c)));

    const search = drawer.querySelector('#drawerSearch');
    const allShelf = drawer.querySelector('#allShelf');
    const more = drawer.querySelector('#drawerMore');
    const drawAll = () => {
      const q = search.value.trim().toLowerCase();
      const all = api.channels.filter((c) => !q || `${c.name} ${c.group || ''} ${c.id || ''}`.toLowerCase().includes(q));
      const visible = all.slice(0, channelLimit);
      allShelf.textContent = '';
      visible.forEach((c) => allShelf.appendChild(channelButton(c)));
      more.style.display = visible.length < all.length ? '' : 'none';
      more.textContent = `MOSTRAR MAIS · ${visible.length}/${all.length}`;
    };
    search.oninput = () => { channelLimit = 120; drawAll(); };
    more.onclick = () => { channelLimit += 120; drawAll(); };
    drawer.querySelectorAll('[data-view]').forEach((button) => {
      button.onclick = () => {
        drawerView = button.dataset.view;
        localStorage.setItem(DRAWER_VIEW_KEY, drawerView);
        channelLimit = 120;
        renderChannelsDrawer();
      };
    });
    drawAll();
  }

  function programmeArtwork(programme) {
    if (programme?.icon) return `url("${String(programme.icon).replace(/"/g, '%22')}")`;
    if (api.current?.logo) return `linear-gradient(135deg,#252a31,#16191e),url("${String(api.current.logo).replace(/"/g, '%22')}")`;
    return 'linear-gradient(135deg,#313740,#171a1f)';
  }

  function renderGuideDrawer() {
    drawer.innerHTML = `<div class="guideTitle">Programação · ${escapeHtml(api.current?.name || '')}</div><div id="guideTimeline" class="guideTimeline"></div>`;
    const timeline = drawer.querySelector('#guideTimeline');
    if (!api.epgLoaded) {
      timeline.innerHTML = '<div style="padding:20px;color:#a9adb3">A carregar programação…</div>';
      api.loadEpg();
      setTimeout(() => { if (drawer.classList.contains('open') && drawer.dataset.kind === 'guide') renderGuideDrawer(); }, 900);
      return;
    }
    const items = api.upcomingProgrammes(api.current);
    if (!items.length) {
      timeline.innerHTML = '<div style="padding:20px;color:#a9adb3">Sem programação disponível.</div>';
      return;
    }
    const now = Date.now();
    items.forEach((p, index) => {
      const current = p.start <= now && p.stop > now;
      const time = document.createElement('div');
      time.className = `guideTimePill${current ? ' guideNow' : ''}`;
      time.textContent = current ? 'AGORA' : api.formatClock(p.start);
      timeline.appendChild(time);

      const card = document.createElement('div');
      card.className = `guideCard${current ? ' current' : ''}`;
      const pct = current ? Math.max(0, Math.min(100, ((now - p.start) / Math.max(1, p.stop - p.start)) * 100)) : 0;
      card.innerHTML = `
        <div class="guideArtwork" style="background-image:${programmeArtwork(p)}">
          ${api.current?.logo ? `<img class="guideLogo" src="${escapeHtml(api.current.logo)}" alt="">` : ''}
        </div>
        ${current ? `<div class="guideProgress"><span style="width:${pct.toFixed(1)}%"></span></div>` : ''}
        <div class="guideMeta"><div class="guideName">${escapeHtml(p.title)}</div>${p.desc ? `<div class="guideDesc">${escapeHtml(p.desc)}</div>` : ''}</div>`;
      timeline.appendChild(card);
    });
  }

  function applyScreenMode(mode) {
    const selected = ['normal','stretch','zoom'].includes(mode) ? mode : 'normal';
    localStorage.setItem(SCREEN_MODE_KEY, selected);
    video.style.objectFit = selected === 'stretch' ? 'fill' : selected === 'zoom' ? 'cover' : 'contain';
    return selected;
  }
  let screenMode = applyScreenMode(localStorage.getItem(SCREEN_MODE_KEY) || 'normal');

  function renderScreenDrawer() {
    const choices = [
      ['normal','Normal'],['stretch','Esticado'],['zoom','Zoom']
    ];
    drawer.innerHTML = `<div class="screenTitle">Opções de Ecrã</div><div class="screenChoices"></div><div class="screenHint">Altera a forma como a emissão ocupa o ecrã. A escolha fica guardada para os próximos canais.</div>`;
    const box = drawer.querySelector('.screenChoices');
    choices.forEach(([id,label]) => {
      const b = document.createElement('button');
      b.className = `screenChoice${screenMode === id ? ' active' : ''}`;
      b.innerHTML = `<span class="radio"></span><span>${label}</span>`;
      b.onclick = () => { screenMode = applyScreenMode(id); renderScreenDrawer(); };
      box.appendChild(b);
    });
  }

  let speed = Number(localStorage.getItem(SPEED_KEY) || '1') || 1;
  video.playbackRate = speed;
  function renderSpeedDrawer() {
    drawer.innerHTML = `<div class="screenTitle">Velocidade</div><div class="speedChoices"></div><div class="screenHint">Algumas emissões em direto podem ignorar alterações de velocidade.</div>`;
    const box = drawer.querySelector('.speedChoices');
    [0.5,0.75,1,1.25,1.5,2].forEach((value) => {
      const b = document.createElement('button');
      b.className = `speedChoice${speed === value ? ' active' : ''}`;
      b.textContent = `${value}×`;
      b.onclick = () => { speed = value; video.playbackRate = value; localStorage.setItem(SPEED_KEY, String(value)); renderSpeedDrawer(); };
      box.appendChild(b);
    });
  }

  function openDrawer(kind) {
    drawer.dataset.kind = kind;
    channelLimit = 120;
    if (kind === 'channels') renderChannelsDrawer();
    else if (kind === 'guide') renderGuideDrawer();
    else if (kind === 'screen') renderScreenDrawer();
    else if (kind === 'speed') renderSpeedDrawer();
    setDrawerOpen(true);
  }

  document.getElementById('opChannelsBtn').onclick = () => openDrawer('channels');
  document.getElementById('opGuideBtn').onclick = () => openDrawer('guide');
  document.getElementById('opInfo').onclick = () => openDrawer('guide');

  function requestPip() {
    moreMenu.classList.remove('open');
    try {
      if (window.LiveTVNative?.enterPictureInPicture) {
        window.LiveTVNative.enterPictureInPicture();
        return;
      }
      if (document.pictureInPictureEnabled && !document.pictureInPictureElement) video.requestPictureInPicture?.();
    } catch {}
  }
  document.getElementById('opPip').onclick = requestPip;
  document.getElementById('opMore').onclick = (event) => {
    event.stopPropagation();
    moreMenu.classList.toggle('open');
  };

  moreMenu.querySelectorAll('[data-menu]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.menu;
      moreMenu.classList.remove('open');
      if (action === 'pip') requestPip();
      if (action === 'screen') openDrawer('screen');
      if (action === 'speed') openDrawer('speed');
      if (action === 'lock') {
        locked = true;
        closeDrawer();
        ui.classList.add('locked');
      }
    };
  });
  unlock.onclick = () => {
    locked = false;
    ui.classList.remove('locked');
    ui.classList.remove('chrome-hidden');
    window.LiveTVShowControls?.();
  };

  const brightness = document.getElementById('opBrightness');
  const brightnessValue = document.getElementById('opBrightnessValue');
  brightness.oninput = () => {
    const value = Number(brightness.value);
    brightnessValue.textContent = `${Math.round(value * 100)}%`;
    try { window.LiveTVNative?.setBrightness?.(value); } catch {}
  };
  const volume = document.getElementById('opVolume');
  const volumeValue = document.getElementById('opVolumeValue');
  volume.value = String(Number.isFinite(video.volume) ? video.volume : 1);
  volumeValue.textContent = `${Math.round(Number(volume.value) * 100)}%`;
  volume.oninput = () => {
    video.volume = Number(volume.value);
    volumeValue.textContent = `${Math.round(Number(volume.value) * 100)}%`;
  };
  video.addEventListener('volumechange', () => {
    volume.value = String(video.volume);
    volumeValue.textContent = `${Math.round(video.volume * 100)}%`;
  });

  function updateNowBadge() {
    const p = api.nowProgramme(api.current);
    nowBadge.classList.toggle('show', Boolean(p));
  }
  video.addEventListener('playing', updateNowBadge);
  setInterval(updateNowBadge, 30000);
  updateNowBadge();

  document.addEventListener('pointerdown', (event) => {
    if (!moreMenu.classList.contains('open')) return;
    if (event.target.closest('#opMoreMenu,#opMore')) return;
    moreMenu.classList.remove('open');
  }, true);

  window.addEventListener('orientationchange', () => {
    if (screen.orientation?.type?.startsWith('portrait')) {
      closeDrawer();
      moreMenu.classList.remove('open');
      if (locked) { locked = false; ui.classList.remove('locked'); }
    }
  });
}
