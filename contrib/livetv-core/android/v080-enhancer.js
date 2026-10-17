const SCREEN_MODE_KEY = 'livetv-screen-mode-v1';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function isPlayerMode() {
  return document.body.classList.contains('player-mode');
}

function isInteractive(target) {
  return Boolean(target?.closest?.('button,input,.opDrawer,.opMoreMenu,.unlockBtn'));
}

function nativeNumber(name, fallback) {
  try {
    const fn = window.LiveTVNative?.[name];
    if (typeof fn === 'function') {
      const value = Number(fn.call(window.LiveTVNative));
      if (Number.isFinite(value)) return value;
    }
  } catch {}
  return fallback;
}

export function installOperatorV080(api) {
  const ui = document.getElementById('operatorUi');
  const drawer = document.getElementById('opDrawer');
  const moreMenu = document.getElementById('opMoreMenu');
  const video = api.video;
  if (!ui || !drawer || !video) return;

  const style = document.createElement('style');
  style.textContent = `
    .gestureHud{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:180;min-width:128px;padding:14px 18px;border-radius:18px;background:rgba(20,21,23,.90);backdrop-filter:blur(18px);color:#fff;display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0;pointer-events:none;transition:opacity .12s,transform .12s;box-shadow:0 16px 45px rgba(0,0,0,.35)}
    .gestureHud.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
    .gestureHudIcon{font-size:24px;line-height:1}.gestureHudText{font-size:15px;font-weight:760}.gestureHudBar{width:92px;height:4px;border-radius:4px;background:#50545a;overflow:hidden}.gestureHudFill{height:100%;background:#fff;width:50%}
    .opProgress:disabled{opacity:.42;pointer-events:none}
    .opSideCtl{opacity:.42;transition:opacity .15s}.opSideCtl.gesture-active{opacity:1}
    body.pip-mode .operatorUi{display:none!important}
    body.player-mode .hero video{touch-action:none}
    @media(max-height:500px){.gestureHud{min-width:112px;padding:11px 15px}.gestureHudIcon{font-size:21px}}
  `;
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.id = 'gestureHud';
  hud.className = 'gestureHud';
  hud.innerHTML = '<div id="gestureHudIcon" class="gestureHudIcon">◉</div><div id="gestureHudText" class="gestureHudText"></div><div class="gestureHudBar"><div id="gestureHudFill" class="gestureHudFill"></div></div>';
  document.body.appendChild(hud);
  const hudIcon = document.getElementById('gestureHudIcon');
  const hudText = document.getElementById('gestureHudText');
  const hudFill = document.getElementById('gestureHudFill');
  let hudTimer = 0;

  function showHud(icon, text, ratio = null) {
    clearTimeout(hudTimer);
    hudIcon.textContent = icon;
    hudText.textContent = text;
    const bar = hudFill.parentElement;
    if (ratio == null) {
      bar.style.display = 'none';
    } else {
      bar.style.display = '';
      hudFill.style.width = `${Math.round(clamp(ratio) * 100)}%`;
    }
    hud.classList.add('show');
    hudTimer = setTimeout(() => hud.classList.remove('show'), 850);
  }

  function overlayOpen() {
    return drawer.classList.contains('open') || Boolean(moreMenu?.classList.contains('open')) || ui.classList.contains('locked');
  }

  function reportOverlayState() {
    try { window.LiveTVNative?.setOverlayOpen?.(overlayOpen()); } catch {}
  }

  window.LiveTVCloseOverlay = () => {
    let changed = false;
    if (ui.classList.contains('locked')) {
      document.getElementById('opUnlock')?.click();
      changed = true;
    } else if (moreMenu?.classList.contains('open')) {
      moreMenu.classList.remove('open');
      changed = true;
    } else if (drawer.classList.contains('open')) {
      drawer.classList.remove('open');
      document.body.classList.remove('drawer-open');
      changed = true;
    }
    reportOverlayState();
    if (changed) window.LiveTVShowControls?.();
    return changed;
  };

  const observer = new MutationObserver(reportOverlayState);
  observer.observe(drawer, { attributes:true, attributeFilter:['class'] });
  observer.observe(ui, { attributes:true, attributeFilter:['class'] });
  if (moreMenu) observer.observe(moreMenu, { attributes:true, attributeFilter:['class'] });
  reportOverlayState();

  const brightness = document.getElementById('opBrightness');
  const brightnessValue = document.getElementById('opBrightnessValue');
  const volume = document.getElementById('opVolume');
  const volumeValue = document.getElementById('opVolumeValue');
  const leftCtl = document.querySelector('.opSideCtl.left');
  const rightCtl = document.querySelector('.opSideCtl.right');

  let brightnessLevel = clamp(nativeNumber('getBrightness', Number(brightness?.value || 0.7)), 0.08, 1);
  let volumeLevel = clamp(nativeNumber('getMediaVolume', Number(volume?.value || 1)));

  function setBrightness(value, fromGesture = false) {
    brightnessLevel = clamp(value, 0.08, 1);
    if (brightness) brightness.value = String(brightnessLevel);
    if (brightnessValue) brightnessValue.textContent = `${Math.round(brightnessLevel * 100)}%`;
    try { window.LiveTVNative?.setBrightness?.(brightnessLevel); } catch {}
    if (fromGesture) {
      leftCtl?.classList.add('gesture-active');
      showHud('☀', `${Math.round(brightnessLevel * 100)}%`, brightnessLevel);
    }
  }

  function setVolume(value, fromGesture = false) {
    volumeLevel = clamp(value);
    if (volume) volume.value = String(volumeLevel);
    if (volumeValue) volumeValue.textContent = `${Math.round(volumeLevel * 100)}%`;
    try {
      if (window.LiveTVNative?.setMediaVolume) window.LiveTVNative.setMediaVolume(volumeLevel);
      else video.volume = volumeLevel;
    } catch { video.volume = volumeLevel; }
    if (window.LiveTVNative?.setMediaVolume) video.volume = 1;
    if (fromGesture) {
      rightCtl?.classList.add('gesture-active');
      showHud(volumeLevel === 0 ? '🔇' : '🔊', `${Math.round(volumeLevel * 100)}%`, volumeLevel);
    }
  }

  if (brightness) brightness.oninput = () => setBrightness(Number(brightness.value));
  if (volume) volume.oninput = () => setVolume(Number(volume.value));
  setBrightness(brightnessLevel);
  setVolume(volumeLevel);

  function seekBy(seconds) {
    try {
      if (video.seekable?.length) {
        const start = video.seekable.start(0);
        const end = video.seekable.end(video.seekable.length - 1);
        video.currentTime = Math.max(start, Math.min(end, video.currentTime + seconds));
        return true;
      }
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        return true;
      }
    } catch {}
    return false;
  }

  function applyScreenMode(mode, announce = false) {
    const selected = ['normal','stretch','zoom'].includes(mode) ? mode : 'normal';
    localStorage.setItem(SCREEN_MODE_KEY, selected);
    video.style.objectFit = selected === 'stretch' ? 'fill' : selected === 'zoom' ? 'cover' : 'contain';
    if (announce) {
      const names = { normal:'Normal', stretch:'Esticado', zoom:'Zoom' };
      showHud('▣', names[selected]);
    }
    return selected;
  }

  function cycleScreenMode(direction = 1) {
    const modes = ['normal','stretch','zoom'];
    const current = localStorage.getItem(SCREEN_MODE_KEY) || 'normal';
    let index = Math.max(0, modes.indexOf(current));
    index = (index + direction + modes.length) % modes.length;
    return applyScreenMode(modes[index], true);
  }

  let touchStart = null;
  let pinchStart = 0;
  let pinchTriggered = false;
  let moved = false;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function distance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  document.addEventListener('touchstart', (event) => {
    if (!isPlayerMode() || overlayOpen() || isInteractive(event.target)) return;
    if (event.touches.length === 2) {
      pinchStart = distance(event.touches[0], event.touches[1]);
      pinchTriggered = false;
      touchStart = null;
      return;
    }
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStart = {
      x:t.clientX,
      y:t.clientY,
      brightness:brightnessLevel,
      volume:volumeLevel,
      time:performance.now()
    };
    moved = false;
  }, { passive:true, capture:true });

  document.addEventListener('touchmove', (event) => {
    if (!isPlayerMode() || overlayOpen() || isInteractive(event.target)) return;
    if (event.touches.length === 2 && pinchStart > 0) {
      const now = distance(event.touches[0], event.touches[1]);
      const ratio = now / Math.max(1, pinchStart);
      if (!pinchTriggered && (ratio > 1.16 || ratio < 0.86)) {
        pinchTriggered = true;
        cycleScreenMode(1);
      }
      event.preventDefault();
      return;
    }
    if (!touchStart || event.touches.length !== 1) return;
    const t = event.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dy) < 18 || Math.abs(dy) < Math.abs(dx) * 1.15) return;
    const edge = touchStart.x / Math.max(1, window.innerWidth);
    if (edge > .34 && edge < .66) return;
    moved = true;
    const delta = (-dy / Math.max(1, window.innerHeight)) * 1.45;
    if (edge <= .34) setBrightness(touchStart.brightness + delta, true);
    else setVolume(touchStart.volume + delta, true);
    event.preventDefault();
  }, { passive:false, capture:true });

  document.addEventListener('touchend', (event) => {
    leftCtl?.classList.remove('gesture-active');
    rightCtl?.classList.remove('gesture-active');
    if (!isPlayerMode() || overlayOpen()) {
      touchStart = null;
      pinchStart = 0;
      return;
    }
    if (pinchStart) {
      pinchStart = 0;
      touchStart = null;
      return;
    }
    if (!touchStart || moved || isInteractive(event.target)) {
      touchStart = null;
      return;
    }
    const changed = event.changedTouches?.[0];
    if (!changed) { touchStart = null; return; }
    const now = performance.now();
    const near = Math.hypot(changed.clientX - lastTapX, changed.clientY - lastTapY) < 70;
    if (now - lastTapAt < 330 && near) {
      const zone = changed.clientX / Math.max(1, window.innerWidth);
      if (zone < .34) {
        if (seekBy(-10)) showHud('↶', '−10 s');
      } else if (zone > .66) {
        if (seekBy(30)) showHud('↷', '+30 s');
      } else {
        if (video.paused) video.play().catch(() => {}); else video.pause();
        showHud(video.paused ? 'Ⅱ' : '▶', video.paused ? 'Pausa' : 'Reproduzir');
      }
      lastTapAt = 0;
    } else {
      lastTapAt = now;
      lastTapX = changed.clientX;
      lastTapY = changed.clientY;
    }
    touchStart = null;
  }, { passive:true, capture:true });

  const progress = document.getElementById('opProgress');
  function canSeekProgramme() {
    try {
      if (!api.nowProgramme(api.current) || !video.seekable?.length) return false;
      const start = video.seekable.start(0);
      const end = video.seekable.end(video.seekable.length - 1);
      return Number.isFinite(start) && Number.isFinite(end) && end - start > 20;
    } catch { return false; }
  }
  function updateProgressAvailability() {
    if (progress) progress.disabled = !canSeekProgramme();
  }
  if (progress) {
    progress.addEventListener('input', (event) => {
      if (!canSeekProgramme()) {
        event.stopImmediatePropagation();
        return;
      }
      const programme = api.nowProgramme(api.current);
      if (!programme) return;
      try {
        const ratio = clamp(Number(progress.value) / 1000);
        const targetWallClock = programme.start + (programme.stop - programme.start) * ratio;
        const seekableStart = video.seekable.start(0);
        const seekableEnd = video.seekable.end(video.seekable.length - 1);
        const secondsBehindLive = Math.max(0, (Date.now() - targetWallClock) / 1000);
        video.currentTime = Math.max(seekableStart, Math.min(seekableEnd, seekableEnd - secondsBehindLive));
      } catch {}
      event.stopImmediatePropagation();
    }, true);
  }
  ['loadedmetadata','durationchange','progress','timeupdate','playing'].forEach((name) => video.addEventListener(name, updateProgressAvailability));
  updateProgressAvailability();

  window.LiveTVOnPipChanged = (entered) => {
    document.body.classList.toggle('pip-mode', Boolean(entered));
    if (entered) {
      window.LiveTVCloseOverlay?.();
      ui.classList.add('chrome-hidden');
    } else if (isPlayerMode()) {
      ui.classList.remove('chrome-hidden');
      window.LiveTVShowControls?.();
    }
  };

  window.addEventListener('orientationchange', () => {
    if (!isPlayerMode()) reportOverlayState();
  });

  console.info('LiveTV operator layer v0.8.0 active');
}
