const ORIGINAL_UI_PREF_KEY = 'livetv-original-ui-v090';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function interactive(target) {
  return Boolean(target?.closest?.('button,input,.opDrawer,.opMoreMenu,.unlockBtn'));
}

export function installOperatorV090(api) {
  const ui = document.getElementById('operatorUi');
  const drawer = document.getElementById('opDrawer');
  const video = api.video;
  if (!ui || !drawer || !video) return;

  const style = document.createElement('style');
  style.textContent = `
    :root{
      --op-drawer-w:280px;
      --op-bg:#191c20;
      --op-pill:#242424;
      --op-accent:#66b5e6;
      --op-muted:rgba(255,255,255,.60);
    }
    .opTop{left:24px!important;right:24px!important;top:16px!important;gap:12px!important}
    .opRound{width:48px!important;height:48px!important;border-radius:24px!important;background:rgba(36,36,36,.90)!important}
    .opRound svg{width:24px!important;height:24px!important}
    .opTitleBar{height:48px!important;border-radius:24px!important;background:rgba(36,36,36,.90)!important;padding:0 16px!important;gap:12px!important}
    .opLogo{width:74px!important;height:36px!important}
    .opTitle{font-size:17px!important;font-weight:500!important;letter-spacing:.01em}
    .opInfo{width:32px!important;height:32px!important;font-size:20px!important}
    .opTopActions{gap:8px!important}
    .opTopActions .opRound{width:48px!important;height:48px!important}
    .opMoreMenu{right:24px!important;top:72px!important;width:260px!important;background:rgba(36,36,36,.98)!important;border-radius:12px!important}
    .opMenuItem{height:64px!important;padding:0 20px!important;gap:18px!important;font-size:16px!important}
    .opBottom{left:24px!important;right:24px!important;bottom:16px!important;height:48px!important;border-radius:100px!important;background:rgba(36,36,36,.90)!important;padding:0 16px!important;gap:8px!important}
    .opCtl{min-width:48px!important;width:48px!important;height:48px!important;border-radius:24px!important}
    .opCtl svg{width:25px!important;height:25px!important}
    .opTime{font-size:12px!important;min-width:42px!important;color:rgba(255,255,255,.72)!important}
    .opProgress{min-width:100px!important;height:48px!important;accent-color:var(--op-accent)!important}
    .opLink{height:48px!important;font-size:12px!important;letter-spacing:.10em!important;padding:0 10px!important}
    .opDivider{height:28px!important}
    .opNowBadge{background:var(--op-accent)!important;padding:5px 10px!important;font-size:11px!important;cursor:pointer;user-select:none}
    .opSideCtl{width:48px!important;opacity:.68!important}
    .opSideCtl.left{left:24px!important}.opSideCtl.right{right:24px!important}
    .opSideCtl svg{width:24px!important;height:24px!important}
    .opSideRange{width:180px!important}
    .opDrawer{width:var(--op-drawer-w)!important;background:var(--op-bg)!important;padding:16px 20px 24px!important}
    body.player-mode.drawer-open .hero{right:var(--op-drawer-w)!important}
    body.player-mode.drawer-open .opTop{right:calc(var(--op-drawer-w) + 24px)!important}
    body.player-mode.drawer-open .opBottom{right:calc(var(--op-drawer-w) + 24px)!important}
    body.player-mode.drawer-open .opSideCtl.right{right:calc(var(--op-drawer-w) + 24px)!important}
    .opDrawerHandle{left:calc(100% - var(--op-drawer-w) - 20px)!important;background:var(--op-bg)!important}
    .drawerTabs{height:48px!important;margin:0 0 24px!important;border-radius:24px!important;background:#202329!important}
    .drawerTab{height:48px!important}.drawerTab.active{background:#73777f!important}
    .drawerHeading{font-size:19px!important;margin:0 0 16px!important}
    .drawerDivider{margin:24px 0!important;background:#343940!important}
    .channelShelf{grid-template-columns:repeat(3,76px)!important;gap:12px!important;justify-content:space-between!important}
    .drawerChannel{width:76px!important;height:76px!important;min-width:76px!important;border-radius:18px!important;padding:8px!important;background:#1a1d22!important}
    .drawerChannel img{max-width:58px!important;max-height:42px!important}
    .drawerChannel.active{background:#3a3e45!important;border-color:#565c65!important}
    .channelShelf.list{gap:7px!important}.channelShelf.list .drawerChannel{width:100%!important;height:58px!important;min-width:0!important;border-radius:14px!important}
    .channelShelf.list .drawerChannel img{width:50px!important;height:36px!important}
    .drawerSearch{height:42px!important;border-radius:12px!important;background:#13161a!important}
    .guideTitle{font-size:20px!important;margin:2px 0 18px!important}
    .guideCard{border-radius:9px!important;background:#303338!important}.guideArtwork{height:96px!important}
    .guideTimePill{min-width:84px!important;padding:7px 16px!important;background:#61656b!important}.guideNow{background:var(--op-accent)!important}
    .guideProgress>span{background:var(--op-accent)!important}
    .screenTitle{font-size:22px!important;margin:56px 0 22px!important}
    .screenChoice{height:72px!important;font-size:18px!important}.radio{width:28px!important;height:28px!important}
    .unlockBtn{width:267px!important;height:58px!important;border-radius:100px!important;background:rgba(53,53,53,.96)!important;display:none!important;grid-template-columns:auto 1fr;gap:14px;padding:0 22px!important;font-size:15px;font-weight:700;touch-action:none}
    .operatorUi.locked .unlockBtn{display:grid!important}
    .unlockBtn svg{width:27px!important;height:27px!important}
    .unlockHint{white-space:nowrap;text-align:left}.unlockTrack{position:absolute;left:10px;right:10px;bottom:5px;height:3px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}.unlockTrack>span{display:block;height:100%;width:0;background:#fff;transition:width .08s}
    .scrubTooltip{position:fixed;z-index:190;display:none;transform:translate(-50%,-100%);pointer-events:none;background:#242424;color:#fff;border-radius:8px;padding:7px 12px;min-width:104px;max-width:190px;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.36)}
    .scrubTooltip.show{display:block}.scrubTime{font-size:12px;font-weight:800}.scrubTitle{font-size:11px;color:rgba(255,255,255,.72);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gestureCoach{position:fixed;z-index:185;left:50%;bottom:82px;transform:translateX(-50%);padding:10px 16px;border-radius:24px;background:rgba(36,36,36,.92);color:#fff;font-size:12px;opacity:0;pointer-events:none;transition:opacity .18s;white-space:nowrap}.gestureCoach.show{opacity:1}
    @media(max-height:500px){
      .opTop{top:12px!important}.opBottom{bottom:12px!important}.opDrawer{padding-top:12px!important}.guideArtwork{height:78px!important}.screenTitle{margin-top:42px!important}.opMoreMenu{top:66px!important}
    }
  `;
  document.head.appendChild(style);

  const nowBadge = document.getElementById('opNowBadge');
  if (nowBadge) {
    nowBadge.title = 'Ir para o direto';
    nowBadge.addEventListener('click', () => {
      try {
        if (!video.seekable?.length) return;
        const end = video.seekable.end(video.seekable.length - 1);
        if (Number.isFinite(end)) {
          video.currentTime = Math.max(0, end - .35);
          video.play().catch(() => {});
          window.LiveTVShowControls?.();
        }
      } catch {}
    });
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'scrubTooltip';
  tooltip.innerHTML = '<div class="scrubTime">--:--</div><div class="scrubTitle"></div>';
  document.body.appendChild(tooltip);
  const progress = document.getElementById('opProgress');

  function updateScrubTooltip() {
    if (!progress || progress.disabled || !api.current) {
      tooltip.classList.remove('show');
      return;
    }
    const programme = api.nowProgramme(api.current);
    if (!programme) return;
    const ratio = clamp(Number(progress.value) / 1000);
    const target = programme.start + (programme.stop - programme.start) * ratio;
    const rect = progress.getBoundingClientRect();
    const x = rect.left + rect.width * ratio;
    tooltip.querySelector('.scrubTime').textContent = api.formatClock(target);
    tooltip.querySelector('.scrubTitle').textContent = programme.title || api.current.name || '';
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.classList.add('show');
  }
  if (progress) {
    progress.addEventListener('pointerdown', updateScrubTooltip, true);
    progress.addEventListener('input', updateScrubTooltip, true);
    ['pointerup','pointercancel','change','blur'].forEach((name) => progress.addEventListener(name, () => tooltip.classList.remove('show'), true));
  }

  const unlock = document.getElementById('opUnlock');
  if (unlock) {
    const originalUnlock = unlock.onclick;
    unlock.innerHTML = `${unlock.innerHTML}<span class="unlockHint">Deslize para desbloquear</span><span class="unlockTrack"><span></span></span>`;
    const fill = unlock.querySelector('.unlockTrack span');
    let startX = 0;
    let dragging = false;
    unlock.onclick = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    };
    unlock.addEventListener('pointerdown', (event) => {
      dragging = true;
      startX = event.clientX;
      unlock.setPointerCapture?.(event.pointerId);
      fill.style.width = '0%';
      event.preventDefault();
    });
    unlock.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const ratio = clamp((event.clientX - startX) / 150);
      fill.style.width = `${Math.round(ratio * 100)}%`;
      event.preventDefault();
    });
    const finishUnlock = (event) => {
      if (!dragging) return;
      dragging = false;
      const ratio = clamp((event.clientX - startX) / 150);
      fill.style.width = '0%';
      if (ratio >= .72 && typeof originalUnlock === 'function') originalUnlock.call(unlock, event);
      event.preventDefault();
    };
    unlock.addEventListener('pointerup', finishUnlock);
    unlock.addEventListener('pointercancel', () => { dragging = false; fill.style.width = '0%'; });
  }

  // The original Android player uses a draggable side drawer. Keep the same
  // interaction model: swipe from the right edge to reveal channels and drag
  // the open drawer to the right to dismiss it.
  let edgeStart = null;
  let drawerDrag = null;

  document.addEventListener('touchstart', (event) => {
    if (!document.body.classList.contains('player-mode') || interactive(event.target)) return;
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    if (!drawer.classList.contains('open') && t.clientX >= window.innerWidth - 26) {
      edgeStart = { x:t.clientX, y:t.clientY };
    } else if (!drawer.classList.contains('open') && t.clientX > window.innerWidth * .34 && t.clientX < window.innerWidth * .66) {
      edgeStart = { x:t.clientX, y:t.clientY, center:true };
    }
  }, { passive:true, capture:true });

  document.addEventListener('touchend', (event) => {
    if (!edgeStart || drawer.classList.contains('open')) { edgeStart = null; return; }
    const t = event.changedTouches?.[0];
    if (!t) { edgeStart = null; return; }
    const dx = t.clientX - edgeStart.x;
    const dy = t.clientY - edgeStart.y;
    if (!edgeStart.center && dx < -72 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      document.getElementById('opChannelsBtn')?.click();
    } else if (edgeStart.center && dy < -105 && Math.abs(dy) > Math.abs(dx) * 1.35) {
      document.getElementById('opChannelsBtn')?.click();
    }
    edgeStart = null;
  }, { passive:true, capture:true });

  drawer.addEventListener('pointerdown', (event) => {
    if (!drawer.classList.contains('open') || interactive(event.target)) return;
    drawerDrag = { x:event.clientX };
    drawer.style.transition = 'none';
  }, true);
  drawer.addEventListener('pointermove', (event) => {
    if (!drawerDrag) return;
    const dx = Math.max(0, event.clientX - drawerDrag.x);
    drawer.style.transform = `translateX(${dx}px)`;
  }, true);
  const finishDrawerDrag = (event) => {
    if (!drawerDrag) return;
    const dx = Math.max(0, event.clientX - drawerDrag.x);
    drawerDrag = null;
    drawer.style.transition = '';
    drawer.style.transform = '';
    if (dx > 72) document.getElementById('opDrawerHandle')?.click();
  };
  drawer.addEventListener('pointerup', finishDrawerDrag, true);
  drawer.addEventListener('pointercancel', () => {
    drawerDrag = null;
    drawer.style.transition = '';
    drawer.style.transform = '';
  }, true);

  // One short, non-blocking hint on first landscape playback. It reflects the
  // gestures that are actually implemented, rather than advertising dead UI.
  const coach = document.createElement('div');
  coach.className = 'gestureCoach';
  coach.textContent = '↑ Canais · duplo toque ±10/30s · deslize nas laterais para brilho/volume';
  document.body.appendChild(coach);
  const showCoachOnce = () => {
    try {
      if (localStorage.getItem(ORIGINAL_UI_PREF_KEY) === '1') return;
      localStorage.setItem(ORIGINAL_UI_PREF_KEY, '1');
      coach.classList.add('show');
      setTimeout(() => coach.classList.remove('show'), 4200);
    } catch {}
  };
  const bodyObserver = new MutationObserver(() => {
    if (document.body.classList.contains('player-mode')) showCoachOnce();
  });
  bodyObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });

  console.info('LiveTV operator layer v0.9.0 active (decompiled-app-informed reimplementation)');
}
