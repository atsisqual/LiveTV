// Exact-layout corrections verified against the provided decompiled MEO Go 6.13.3 player.
// This layer intentionally contains only measurements/behaviour we can ground in the
// original resources instead of approximating them from screenshots.

export function installOperatorV091(api) {
  const ui = document.getElementById('operatorUi');
  const drawer = document.getElementById('opDrawer');
  if (!ui || !drawer) return;

  const style = document.createElement('style');
  style.textContent = `
    /* Decompiled reference: player_button_size/info_height/timeline_height = 48dp,
       player margins = 24dp horizontal / 16dp vertical, side view = 280dp. */
    :root{--op-drawer-w:280px!important;--op-control-h:48px;--op-player-x:24px;--op-player-y:16px}

    .opTop{left:var(--op-player-x)!important;right:var(--op-player-x)!important;top:var(--op-player-y)!important;gap:16px!important}
    .opRound,.opTopActions .opRound{width:48px!important;height:48px!important;min-width:48px!important;border-radius:24px!important;flex:0 0 48px}
    .opRound svg{width:24px!important;height:24px!important}
    .opTitleBar{height:48px!important;min-height:48px!important;border-radius:24px!important;padding:0 14px 0 0!important;gap:0!important;overflow:hidden}
    .opLogo{height:32px!important;width:25%!important;min-width:64px;max-width:104px;padding:0 12px!important;object-fit:contain!important;flex:0 0 25%!important}
    .opTitle{font-size:16px!important;font-weight:400!important;line-height:48px!important;padding:0 16px!important;min-width:0!important}
    .opInfo{width:48px!important;height:48px!important;min-width:48px!important;font-size:22px!important;flex:0 0 48px}
    .opTopActions{gap:8px!important;flex:0 0 auto}

    /* The original timeline is ConstraintLayout-based. There is no global flex gap.
       Every gap below corresponds to an explicit native margin. */
    .opBottom{
      left:var(--op-player-x)!important;right:var(--op-player-x)!important;bottom:var(--op-player-y)!important;
      height:48px!important;min-height:48px!important;border-radius:24px!important;
      padding:0!important;gap:0!important;overflow:hidden!important;display:flex!important;align-items:center!important
    }
    .opCtl{width:48px!important;min-width:48px!important;max-width:48px!important;height:48px!important;min-height:48px!important;flex:0 0 48px!important;margin:0!important;padding:8px!important}
    .opCtl svg{width:32px!important;height:32px!important}
    #opStart{min-width:0!important;width:auto!important;flex:0 0 auto!important;margin-left:16px!important;padding:0!important;font-size:10px!important;white-space:nowrap!important}
    .opProgress{width:0!important;min-width:0!important;flex:1 1 0!important;height:48px!important;margin:0!important;padding:0 8px!important;box-sizing:border-box!important}
    #opEnd{min-width:0!important;width:auto!important;flex:0 0 auto!important;margin-left:4px!important;margin-right:16px!important;padding:0!important;font-size:10px!important;white-space:nowrap!important}
    .opNowBadge{flex:0 0 auto!important;margin:0 16px 0 0!important;padding:2px 8px!important;font-size:10px!important;line-height:18px!important}
    .opLink{height:48px!important;min-width:0!important;flex:0 0 auto!important;padding:0!important;margin:0!important;font-size:10px!important;font-weight:500!important;letter-spacing:.15em!important;line-height:48px!important;white-space:nowrap!important;overflow:visible!important}
    #opChannelsBtn{margin-left:16px!important}
    .opDivider{width:1px!important;min-width:1px!important;flex:0 0 1px!important;height:20px!important;margin:0 16px!important;background:rgba(255,255,255,.25)!important}
    #opGuideBtn{margin-right:16px!important}

    /* Reference MotionScene: player_placeholder receives exactly marginEnd=280dp,
       duration=250ms and a linear interpolator. */
    .opDrawer{width:280px!important;padding:16px!important;transition:transform 250ms linear!important}
    body.player-mode.drawer-open .hero{right:280px!important;transition:right 250ms linear!important}
    body.player-mode.drawer-open .opTop{right:304px!important;transition:right 250ms linear!important}
    body.player-mode.drawer-open .opBottom{right:304px!important;transition:right 250ms linear!important}
    body.player-mode.drawer-open .opSideCtl.right{right:304px!important;transition:right 250ms linear!important}

    /* 280 - (16 * 2) = 248; 3 native-sized 76dp cards + two 10dp gaps = 248. */
    .channelShelf{grid-template-columns:repeat(3,76px)!important;gap:10px!important;justify-content:start!important}
    .drawerChannel{width:76px!important;height:76px!important;min-width:76px!important;max-width:76px!important;padding:8px!important;border-radius:16px!important}
    .drawerChannel img{max-width:58px!important;max-height:44px!important}
    .channelShelf.list{gap:8px!important}
    .channelShelf.list .drawerChannel{width:100%!important;max-width:none!important;height:58px!important;min-height:58px!important}

    /* Decompiled Compose channel-side view uses titleMedium and 12dp bottom spacing. */
    .drawerHeading{font-size:16px!important;line-height:24px!important;font-weight:500!important;margin:0 0 12px!important}
    .drawerSearch{margin:0 0 16px!important}
    .drawerDivider{margin:24px 0!important}

    /* Drawer handle in layout_player_motion.xml is 30x44dp. */
    .opDrawerHandle{width:30px!important;height:44px!important;left:calc(100% - 280px - 15px)!important;border-radius:15px 0 0 15px!important;font-size:26px!important}

    @media(max-height:500px){
      .opTop{top:16px!important}.opBottom{bottom:16px!important;height:48px!important}
      .opRound,.opTopActions .opRound,.opTitleBar{height:48px!important}
      .opDrawer{padding:16px!important}
    }
  `;
  document.head.appendChild(style);

  // Keep copy aligned with the original Portuguese resources.
  const normalizeDrawerCopy = () => {
    const search = drawer.querySelector('#drawerSearch');
    if (search) search.placeholder = 'Pesquisar canais';
  };
  const observer = new MutationObserver(normalizeDrawerCopy);
  observer.observe(drawer, { childList:true, subtree:true });
  normalizeDrawerCopy();

  // Prevent accidental horizontal overflow from ever truncating the two native
  // timeline actions again. If space becomes exceptionally small, the seekbar is
  // the only element allowed to collapse, matching ConstraintLayout behaviour.
  const progress = document.getElementById('opProgress');
  if (progress) progress.style.minWidth = '0px';

  console.info('LiveTV operator parity layer v0.9.1 active');
}
