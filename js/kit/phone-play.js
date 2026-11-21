/* game-kit 1d2a49bf: js/phone-play.js — edit in game-kit and run tools/kit-sync.js */
// Phone play (standard 1.21.0, 札の家 ドット版 一人称, the user's phone play 2026-11-21:
// 「携帯で行う場合は横でのプレイを推奨にしたほうが良い」「メッセージや通知で領域を使いすぎているのでタスクなどは携帯の場合は常時表示をやめたほうが良い」
// 「可能なら携帯の場合に全画面表示できると良い」).
// On a phone (touch, the shorter side of the window 600 px or less; ?phone=1 forces it, game.json "ui": { "phone": false } turns it off):
//   - body.gf-phone + gf-portrait / gf-landscape. In portrait, a pixel-framed notice 「横向きでの プレイを おすすめします」 (a rotate icon in
//     SVG) with 「このまま遊ぶ」 (remembered: localStorage gf.portraitOk). Turning the phone hides it by itself.
//   - no permanent task / step / quest boxes: they hide behind a small 「目的」 chip (top left) that opens them on a tap (a tap outside or
//     on the chip closes them); when the goal changes (task:done, stage:up) they flash open for a few seconds by themselves.
//   - notifications one at a time (the lane queues the rest; each fades out on its own time), one line each. One message box at a time:
//     the thought / dialogue line hides the notices, the control hints, the tap label and the 目的 chip; a notice hides the goal flash
//     and the tap label (body.gf-saying / gf-hinting). A control hint is a badge beside its button (control-help data-gf-hint).
//   - 全画面: a button on the title and in the menu. Fullscreen API (Android Chrome) + screen.orientation.lock('landscape') where allowed;
//     where there is no page fullscreen (iOS Safari) a short 「ホーム画面に追加」 note instead (the page's manifest / apple-mobile-web-app
//     meta make a home-screen start fullscreen; the meta are added here when the page has none). Every call fails quietly.
// ctx.phone = { on, portrait, fullscreen(), canFullscreen, standalone, openGoal(on), flashGoal(sec) }
export const PHONE_CSS = `
body.gf-phone #hud-left{display:none}
body.gf-phone.gf-goal-open #hud-left,body.gf-phone.gf-goal-flash #hud-left{display:flex;position:fixed;top:calc(env(safe-area-inset-top,0px) + 58px);left:calc(env(safe-area-inset-left,0px) + 10px);width:min(78vw,360px)!important;max-height:min(60dvh,60vh);overflow:auto;z-index:30;pointer-events:auto}
body.gf-phone.gf-goal-flash:not(.gf-goal-open) #hud-left{pointer-events:none;animation:gf-goal-fade 4s ease forwards}
@keyframes gf-goal-fade{0%,80%{opacity:1}100%{opacity:0}}
body.gf-phone #hud-left #guide[data-open] .sg-card,body.gf-phone.gf-goal-open #hud-left #guide .sg-card>*{display:revert}
#gf-goal-chip{display:none}
body.gf-phone.gf-playing #gf-goal-chip{display:flex;position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:calc(env(safe-area-inset-left,0px) + 10px);z-index:31;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:6px 12px;font-size:15px}
body.gf-phone.gf-playing #gf-goal-chip.gf-new::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--gf-accent,#e0a040)}
body.gf-reading #gf-goal-chip{visibility:hidden!important}
body.gf-phone .tl-lane>.tl-item~.tl-item{display:none}
body.gf-phone.gf-playing.gf-portrait .tl-lane{margin-top:calc(env(safe-area-inset-top,0px) + 56px)}   /* below the 目的 chip */
body.gf-phone.gf-landscape #say{max-width:var(--gf-say-w,60vw)!important;font-size:14px;line-height:1.55}
body.gf-phone.gf-landscape #t-buttons{display:flex!important;flex-direction:column-reverse;align-items:flex-end;gap:8px}   /* landscape: the action buttons stand in a column at the right edge, the bottom middle stays free */
body.gf-phone.gf-landscape #t-buttons{flex-wrap:wrap-reverse;align-content:flex-start;max-height:calc(100vh - 150px);max-height:calc(100dvh - 150px)}   /* 1.21.1: a low screen (667x375, 844x340 with the address bar) wraps the column into a second one to its left instead of running up under the menu button (P31: #t-right over #t-menu) */
body.gf-phone.gf-landscape #touch{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}
body.gf-phone.gf-landscape .gf-reader{padding:max(8px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(8px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
/* 1.21.0 one message at a time (水無瀬病院 ドット版 一人称, iPhone landscape: 「通知が多すぎます」 - the 目的 chip, a control-hint card, the tap
   label and the thought line all at once, over each other). Priority: the thought / dialogue line > a notice or hint > the goal flash. */
body.gf-phone.gf-saying #gf-goal-chip,body.gf-phone.gf-saying:not(.gf-goal-open) #hud-left,body.gf-phone.gf-saying .tl-lane>.tl-item:not(.tl-read),body.gf-phone.gf-saying .gf-ch,body.gf-phone.gf-saying #prompt{visibility:hidden!important}
body.gf-phone.gf-hinting:not(.gf-goal-open) #hud-left{display:none!important}
body.gf-phone.gf-hinting #prompt{visibility:hidden!important}
body.gf-phone .tl-lane>.tl-item:not(.tl-read):not(.tl-lookcard){white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-height:2.9em;font-size:14px}
body.gf-phone .tl-lane>.tl-item:not(.tl-read):not(.tl-lookcard) .tl-body{overflow:hidden;text-overflow:ellipsis}
body.gf-phone .tl-lane>.tl-item:not(.tl-read):not(.tl-lookcard) .tl-body>small{display:inline;margin-right:.6em}
body.gf-phone.gf-playing #hs-tc,body.gf-phone.gf-playing .tl-lane{margin-left:calc(env(safe-area-inset-left,0px) + 118px);margin-right:calc(env(safe-area-inset-right,0px) + 64px)}
/* a control hint on a phone: a badge beside its lit button (the card itself only when there is no button for it, one line) */
body.gf-phone .gf-ch.gf-ch-badged{display:none!important}
body.gf-phone .gf-ch{font-size:14px;padding:6px 10px;gap:8px}
body.gf-phone .gf-ch .gf-ch-t span,body.gf-phone .gf-ch .gf-ch-more{display:none}
body.gf-phone .gf-ch .gf-ch-t b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.gf-phone .gf-ch button{min-height:36px}
body.gf-phone #t-buttons [data-k].gf-ch-lit{position:relative;overflow:visible}
body.gf-phone #t-buttons [data-k].gf-ch-lit::before{content:attr(data-gf-hint);position:absolute;right:calc(100% + 6px);top:50%;transform:translateY(-50%);padding:2px 6px;font-size:12px;line-height:1.4;white-space:nowrap;background:var(--gf-accent,#e0a040);color:#120d09;pointer-events:none}
body.gf-phone.gf-portrait #t-buttons [data-k].gf-ch-lit::before{right:auto;left:50%;top:auto;bottom:calc(100% + 4px);transform:translateX(-50%)}
#gf-rotate{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(16px,env(safe-area-inset-bottom,0px));background:rgba(8,6,4,.86)}
body.gf-phone.gf-portrait:not(.gf-portrait-ok) #gf-rotate{display:flex}
#gf-rotate .gf-rot-card{width:min(340px,100%);text-align:center;padding:22px 18px 18px;border:3px solid var(--gf-accent,#c9a25a);outline:2px solid var(--gf-accent,#c9a25a);outline-offset:-9px;background:var(--gf-surface,#1b140c);color:var(--gf-text,#efe4cc);image-rendering:pixelated}
#gf-rotate .gf-rot-card>svg{width:96px;height:96px;display:block;margin:4px auto 12px}
#gf-rotate .btn svg{width:18px;height:18px;flex:none}
#gf-rotate .btn{display:flex;align-items:center;justify-content:center;gap:8px}
#gf-rotate p{margin:0 0 10px;line-height:1.6;font-size:17px}
#gf-rotate .gf-rot-sub{font-size:14px;opacity:.85}
#gf-rotate .gf-rot-btns{display:grid;gap:10px;margin-top:14px}
#gf-rotate .btn{min-height:48px;font-size:16px}
.gf-fs-btn{display:none}
body.gf-phone:not(.gf-standalone) .gf-fs-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px}
#gf-fs-note{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);z-index:95;width:min(420px,calc(100vw - 32px));padding:14px 16px;border:2px solid var(--gf-accent,#c9a25a);background:var(--gf-surface,#1b140c);color:var(--gf-text,#efe4cc);line-height:1.6;font-size:15px}
#gf-fs-note button{margin-top:10px;min-height:44px;width:100%}
`;
// a phone turning from portrait to landscape, drawn in pixel steps (no emoji)
export const ROTATE_SVG = `<svg viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="8" height="14"/><rect x="9" y="13" width="13" height="8"/></g><g fill="currentColor"><rect x="6" y="13" width="2" height="1"/><rect x="18" y="16" width="1" height="2"/><rect x="14" y="4" width="4" height="1.5"/><rect x="17" y="4" width="1.5" height="5"/><rect x="15.5" y="7.5" width="4.5" height="1.5"/></g></svg>`;
const FLAG_SVG = `<svg viewBox="0 0 16 16" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M3 1h2v14H3zM5 2h8v2h-2v2h2v2H5z"/></svg>`;
const FS_SVG = `<svg viewBox="0 0 16 16" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/></svg>`;

const safe = (f, d) => { try { return f(); } catch { return d; } };
export const isPhoneSize = (w, h, touch) => !!touch && Math.min(w, h) <= 600;

export function installPhonePlay(ctx, { manifest = {}, bus, pm, ui } = {}) {
  if (typeof document === 'undefined' || (manifest.ui && manifest.ui.phone === false)) return null;
  const Q = new URLSearchParams(location.search), force = Q.get('phone') === '1';
  const st = document.createElement('style'); st.textContent = PHONE_CSS; document.head.appendChild(st);
  const B = document.body, root = document.documentElement;
  const standalone = !!(safe(() => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches) || navigator.standalone);
  const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  B.classList.toggle('gf-standalone', standalone);
  // iOS: a home-screen start opens fullscreen with these (the build's own head may already have them)
  const meta = (name, content) => { if (!document.querySelector(`meta[name="${name}"]`)) { const m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); } };
  meta('apple-mobile-web-app-capable', 'yes'); meta('mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  if (safe(() => localStorage.getItem('gf.portraitOk')) === '1') B.classList.add('gf-portrait-ok');

  // the portrait notice
  const rot = document.createElement('div'); rot.id = 'gf-rotate'; rot.setAttribute('role', 'dialog'); rot.setAttribute('aria-label', '横向きでのプレイ');
  rot.innerHTML = `<div class="gf-rot-card">${ROTATE_SVG}<p>横向きでの プレイを<br>おすすめします</p><p class="gf-rot-sub">スマホを横にすると、景色が広く見えて、操作のボタンが端に並びます。</p><div class="gf-rot-btns">${canFullscreen && !standalone ? `<button type="button" class="btn primary gf-rot-fs">${FS_SVG}<span>全画面で横向きにする</span></button>` : ''}<button type="button" class="btn gf-rot-ok">このまま遊ぶ</button></div></div>`;
  B.appendChild(rot);
  rot.querySelector('.gf-rot-ok').addEventListener('click', () => { B.classList.add('gf-portrait-ok'); safe(() => localStorage.setItem('gf.portraitOk', '1')); });
  const rfs = rot.querySelector('.gf-rot-fs'); if (rfs) rfs.addEventListener('click', () => api.fullscreen());

  // the goal chip
  const chip = document.createElement('button'); chip.type = 'button'; chip.id = 'gf-goal-chip'; chip.className = 'btn'; chip.setAttribute('aria-label', '目的を見る');
  chip.innerHTML = `${FLAG_SVG}<span>目的</span>`; B.appendChild(chip);
  let flashT = 0;
  const openGoal = (on) => { B.classList.toggle('gf-goal-open', on); chip.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) { chip.classList.remove('gf-new'); B.classList.remove('gf-goal-flash'); } };
  chip.addEventListener('click', (e) => { e.stopPropagation(); openGoal(!B.classList.contains('gf-goal-open')); });
  document.addEventListener('pointerdown', (e) => { if (B.classList.contains('gf-goal-open') && !e.target.closest('#hud-left, #gf-goal-chip')) openGoal(false); }, true);
  const flashGoal = (sec = 4) => { if (!api.on || B.classList.contains('gf-goal-open')) return; chip.classList.add('gf-new'); B.classList.remove('gf-goal-flash'); void B.offsetWidth; B.classList.add('gf-goal-flash'); clearTimeout(flashT); flashT = setTimeout(() => B.classList.remove('gf-goal-flash'), sec * 1000); };
  if (bus) { for (const ev of ['task:done', 'stage:up']) bus.on(ev, () => setTimeout(() => flashGoal(4), 600)); bus.on('game:start', () => setTimeout(() => flashGoal(5), 1500)); }

  // fullscreen
  const note = (html) => { let n = document.getElementById('gf-fs-note'); if (!n) { n = document.createElement('div'); n.id = 'gf-fs-note'; n.setAttribute('role', 'status'); B.appendChild(n); } n.innerHTML = `${html}<button type="button" class="btn">わかった</button>`; n.querySelector('button').onclick = () => n.remove(); };
  const fullscreen = async () => {
    if (canFullscreen && !document.fullscreenElement) {
      try { await (root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen()); } catch { /* refused: stays as it is */ }
    }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch { /* not allowed here */ }
    if (!canFullscreen && !standalone) note('このブラウザでは、ページを全画面にできません。<br>共有ボタン（□↑）から<b>「ホーム画面に追加」</b>を選び、ホーム画面のアイコンから開くと、全画面で遊べます。');
  };
  const fsBtn = (cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = `btn gf-fs-btn ${cls}`; b.innerHTML = `${FS_SVG}<span>全画面</span>`; b.addEventListener('click', (e) => { e.stopPropagation(); fullscreen(); }); return b; };
  const tb = document.querySelector('.gf-title-btns'); if (tb) tb.appendChild(fsBtn('gf-fs-title'));
  if (pm && pm.registerItem) safe(() => pm.registerItem({ id: 'fullscreen', label: '全画面', hidden: () => !api.on || standalone, run: () => { fullscreen(); } }));

  const api = ctx.phone = { on: false, portrait: false, fullscreen, canFullscreen, standalone, openGoal, flashGoal };
  const apply = () => {
    const on = force || isPhoneSize(innerWidth, innerHeight, ctx.isTouch);
    api.on = on; api.portrait = innerHeight > innerWidth;
    B.classList.toggle('gf-phone', on); B.classList.toggle('gf-portrait', on && api.portrait); B.classList.toggle('gf-landscape', on && !api.portrait);
    B.classList.toggle('gf-playing', !!(ctx.state && ctx.state.started && !ctx.state.ended));
    if (!on) openGoal(false);
    // landscape: the say band fits between the stick (left) and the buttons (right), centred
    if (on && !api.portrait) {
      const W = innerWidth, cx = W / 2; let gl = 0, gr = W;
      for (const e of document.querySelectorAll('#touch > *, #touch > * > *')) { const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < innerHeight * 0.45 || r.width > W * 0.6) continue; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || !(e.textContent.trim() || parseFloat(s.borderTopWidth) > 0 || s.backgroundColor !== 'rgba(0, 0, 0, 0)')) continue; if (r.right < cx) gl = Math.max(gl, r.right); else if (r.left > cx) gr = Math.min(gr, r.left); }
      B.style.setProperty('--gf-say-w', `${Math.max(220, Math.round(2 * Math.min(cx - gl, gr - cx) - 24))}px`);
    }
  };
  // which message is up (the classes drive the CSS above): checked often, it is a handful of lookups
  const shown = (e) => { if (!e) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && !!e.textContent.trim() && e.getBoundingClientRect().height > 4; };
  const msgs = () => {
    if (!api.on) { B.classList.remove('gf-saying', 'gf-hinting'); return; }
    const say = shown(document.getElementById('say'));
    B.classList.toggle('gf-saying', say);
    B.classList.toggle('gf-hinting', !say && ([...document.querySelectorAll('.tl-lane > .tl-item:not(.tl-read)')].some(shown) || shown(document.querySelector('.gf-ch:not(.gf-ch-badged)'))));
  };
  setInterval(msgs, 150);
  // a notice hidden behind the line does not age: it is seen when the line is gone
  const L = ctx.lane; if (L && L.o) { const p0 = L.o.paused; L.o.paused = () => !!(p0 && p0()) || (api.on && B.classList.contains('gf-saying')); }
  addEventListener('resize', apply); addEventListener('orientationchange', () => setTimeout(apply, 200));
  if (bus) { bus.on('game:start', apply); }
  setInterval(apply, 1000);
  apply();
  return api;
}
