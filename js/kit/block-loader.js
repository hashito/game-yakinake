/* game-kit f33d12c8: js/block-loader.js — edit in game-kit and run tools/kit-sync.js */
// Block loading (standard 1.32.0, 夜勤明けの街 1.3.0: 「重すぎて開かないので各ブロック単位でロードする仕様に」).
// A big game is cut into blocks (a hospital, a street, a station ...). The title opens with the core only; starting, continuing or
// walking into the next block loads just that block's things (figures, zombie patterns, pictures ...) behind a loading screen with a
// progress bar and a short story line, then waits for the player's button (pixel games load first: everything of the block is ready
// before play, nothing is built midway). The block that is left is unloaded first (its geometry, textures and sounds disposed).
//
//   const bl = installBlockLoader(ctx, {
//     blocks: [{ id: 'H', name: '病院' }, ...],
//     startBlock: (o, snap) => 'H',                  // the block a new game / a save (snap = the saved snapshot or null) starts in
//     load: async (id, report, from) => {},          // report(0..1, text); load and build everything of the block
//     unload: async (id, to) => {},                  // dispose what only that block used
//     line: (id, from, o) => '...',                  // the story line on the loading screen (optional)
//     warm: (id) => [objects],                       // hidden objects to pre-compile / upload (optional; ctx.prewarmNow)
//     picture: (id, from, o) => url | Promise<url>,  // 1.33.0: a small dot picture of the place on the card (optional)
//     prefetch: (id) => [urls],                      // 1.33.0: the files of a block; the next one's are fetched at idle into the HTTP
//     next: (id) => id,                              //   cache while the player is in this one (no heap: the bodies are dropped)
//     auto: false,                                   // continue without the button (default: only in ?test=1 or ?autostart, without ?blockwait)
//   });
//   bl.current                     the loaded block id (null before the first load)
//   await bl.ensure(id, { line })  load id if it is not the current one (a no-op otherwise); resolves when the player may go on
//   bl.loading                     true while the loading screen is up (the game's input is blocked: ctx.blockers)
// The start flow: game-core's begin() awaits ctx.blockGate(o) before the game starts (a new game, つづきから, a restart after an ending).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function installBlockLoader(ctx, def) {
  const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const auto = def.auto != null ? !!def.auto : ((Q.has('test') || Q.has('autostart')) && !Q.has('blockwait'));   // 1.32.1: ?autostart (the contrast / select-range tools) too
  const names = Object.fromEntries((def.blocks || []).map((b) => [b.id, b.name || b.id]));
  const el = document.createElement('div');
  el.className = 'gf-block-load'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '読み込み');
  el.innerHTML = '<div class="gf-bl-box"><img class="gf-bl-pic" alt="" hidden><p class="gf-bl-kicker"></p><p class="gf-bl-line"></p><div class="gf-bl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="gf-bl-status" aria-live="polite"></p><button type="button" class="btn primary gf-bl-go" disabled>読み込み中…</button></div>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const api = { current: null, loading: false, timings: {}, el };
  let chain = Promise.resolve();
  if (ctx.blockers) ctx.blockers.push(() => api.loading);
  // 1.33.0: the card is opaque and covers the game: the frame loop neither updates nor draws behind it (game-core ctx.holdFrames)
  // and so does the title before the game starts (shell.css: an opaque full screen) unless def.drawBehindTitle - 2-3 s of frames at CPU 4x
  const title = typeof document !== 'undefined' ? document.getElementById('title') : null;
  const behindTitle = () => !def.drawBehindTitle && !!title && !(ctx.state && ctx.state.started) && !title.classList.contains('hidden');
  { const prev = ctx.holdFrames; ctx.holdFrames = () => api.loading || behindTitle() || !!(prev && prev()); }
  let picTurn = 0;
  const setPicture = (id, from, o) => {
    const img = $('.gf-bl-pic'), turn = ++picTurn;
    img.hidden = true; img.removeAttribute('src');
    if (!def.picture) return;
    Promise.resolve().then(() => def.picture(id, from, o)).then((url) => { if (url && turn === picTurn) { img.src = url; img.hidden = false; } }).catch(() => {});
  };
  const show = (id, line, from, o) => {
    setPicture(id, from, o);
    $('.gf-bl-kicker').textContent = names[id] || id;
    $('.gf-bl-line').innerHTML = line ? esc(line) : '';
    $('.gf-bl-line').hidden = !line;
    $('.gf-bl-bar i').style.width = '0%';
    $('.gf-bl-status').textContent = '読み込み中…';
    const b = $('.gf-bl-go'); b.disabled = true; b.textContent = '読み込み中…';
    el.classList.add('on'); api.loading = true;
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* no lock */ }
  };
  const report = (k, text) => {
    const v = Math.max(0, Math.min(1, k || 0));
    $('.gf-bl-bar i').style.width = `${Math.round(v * 100)}%`;
    $('.gf-bl-bar').setAttribute('aria-valuenow', String(Math.round(v * 100)));
    if (text) $('.gf-bl-status').textContent = text;
  };
  const waitGo = (label) => new Promise((resolve) => {
    const b = $('.gf-bl-go');
    b.disabled = false; b.textContent = label || '進む';
    $('.gf-bl-status').textContent = '準備ができました';
    if (auto) { resolve(); return; }
    const go = (e) => { if (e) e.preventDefault(); b.removeEventListener('click', go); removeEventListener('keydown', key); resolve(); };
    const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') go(e); };
    b.addEventListener('click', go); addEventListener('keydown', key);
    setTimeout(() => { try { b.focus(); } catch (e) { /* hidden */ } }, 0);
  });
  async function run(id, o = {}) {
    if (!id || (id === api.current && !o.force)) return;
    const from = api.current, t0 = performance.now();
    show(id, o.line != null ? o.line : def.line ? def.line(id, from, o) : '', from, o);
    await new Promise((r) => setTimeout(r, 30));   // the loading screen is painted before the work starts
    try {
      if (from && def.unload) { report(0, '前の場所を片づけています…'); await def.unload(from, id); }
      api.current = null;
      await def.load(id, (k, t) => report(k * 0.92, t), from);
      api.current = id;
      const warm = def.warm ? def.warm(id) || [] : null;
      if ((warm || ctx.prewarmPending) && ctx.prewarmNow) { report(0.94, '描画を準備中…'); try { await ctx.prewarmNow(warm || []); } catch (e) { console.warn('[block-loader] prewarm', e); } }
      // 1.33.0: the windows' pre-paint the title skipped (game-core ctx.warmLater), once, behind the first card
      if (ctx.warmLater) { const f = ctx.warmLater; ctx.warmLater = null; report(0.97, '画面を準備中…'); try { await f(); } catch (e) { console.warn('[block-loader] ui warm', e); } }
      report(1, '');
      api.timings[id] = Math.round(performance.now() - t0);
      if (ctx.bus) ctx.bus.emit('block:loaded', { id, from, ms: api.timings[id] });
    } catch (e) {
      console.error('[block-loader]', id, e);
      $('.gf-bl-status').textContent = '読み込みに失敗しました。ページを再読み込みしてください。';
      throw e;
    }
    await waitGo(o.goLabel || (from ? '進む' : 'はじめる'));
    el.classList.remove('on'); api.loading = false;
    prefetchNext(id);
    idleImages();
  }
  // 1.34.0: the windows' pictures the warm-up left out (game-core ctx.idleImages), loaded one by one at idle once play has begun
  function idleImages() {
    const list = ctx.idleImages; if (!list || !list.length || typeof Image === 'undefined') return;
    ctx.idleImages = null;
    const idle = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 5000 }) : setTimeout(f, 1000));
    const step = () => {
      if (api.loading) { setTimeout(() => idle(step), 2000); return; }
      const u = list.shift(); if (!u) return;
      const img = new Image(); img.decoding = 'async';
      const next = () => idle(step);
      img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(next); }; img.onerror = next;
      img.src = u;
    };
    idle(step);
  }
  // 1.33.0: the next block's files go into the HTTP cache at idle (fetched and dropped: nothing held), so walking on is a cache read
  const fetched = new Set();
  function prefetchNext(id) {
    if (!def.prefetch || typeof fetch !== 'function') return;
    const ids = (def.blocks || []).map((b) => b.id), nx = def.next ? def.next(id) : ids[ids.indexOf(id) + 1];
    if (!nx || nx === id) return;
    let urls = []; try { urls = (def.prefetch(nx) || []).filter((u) => u && !fetched.has(u)); } catch (e) { return; }
    const idle = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 800));
    const step = () => {
      if (api.loading) { setTimeout(() => idle(step), 2000); return; }
      const u = urls.shift(); if (!u) return;
      fetched.add(u);
      fetch(u, { priority: 'low' }).then((r) => r.arrayBuffer()).catch(() => {}).then(() => idle(step));
    };
    idle(step);
  }
  api.prefetched = fetched;
  api.ensure = (id, o = {}) => (chain = chain.then(() => run(id, o), () => run(id, o)));
  ctx.blockGate = (o = {}) => {
    const snap = o.resume && ctx.store ? ctx.store.load() : null;
    return api.ensure(def.startBlock(o, snap), { goLabel: o.resume ? 'つづける' : 'はじめる', line: def.line ? def.line(def.startBlock(o, snap), null, { ...o, start: true, snap }) : '' });
  };
  ctx.blocks = api;
  return api;
}
