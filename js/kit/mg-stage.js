/* game-kit 10af67dd: js/mg-stage.js — edit in game-kit and run tools/kit-sync.js */
// Shared stage helpers of the hands-on library mini games (standard 1.24.0: darkroom-develop, tape-splice, switchboard, steam-letter, puzzle-box,
// rubbing, knot-untangle, torn-paper, safe-listen, footprint-track). They draw on a canvas or an SVG in one stage view and keep their buttons
// in a side column, so the window fits a phone without scrolling (portrait: the side under the view; a low landscape phone: the side on the right).
//   const s = stageLayout(f, 'mgx-dr', { view: '<canvas></canvas>', side: '...' })   s.view / s.side / s.wrap
//   crisp(canvas, (g, w, h) => draw())      a 2D canvas in device pixels that redraws when its box changes (not on creation); returns { g, w, h, fit }
//   drag(el, { down(p, e), move(p, e), up(p, e) })   pointer (mouse / touch / pen) with capture; p = { x, y } in the element's CSS px
//   hold(btn, { tick(dt), up() })            press and hold (pointer, and Space / Enter while the button has focus); tick gets seconds
//   loop(f, (dt, t) => {})                   a frame loop that stops when the window is gone
//   solved(f)                                the clear: the side controls fold away so 「次へ」 fits under the view (no scrolling)
//   solvable(host, fn, peek)                 the auto-solve path of the play scripts: host.mgSolve() plays the answer through the real rule;
//                                            host.mgPeek() tells a play script what it needs to aim real input (state, points in CSS px)
//   noise2(seed)                             smooth 2D value noise 0..1 (stone grain, dust, paper fibres)
import { rng } from './mg-frame.js';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export { rng };

export function stageLayout(f, cls, { view = '<canvas></canvas>', side = '', label = '' } = {}) {
  f.root.classList.add('mgx--st');
  f.body.innerHTML = `<div class="mgx-st ${cls}"><div class="mgx-st-view"${label ? ` role="img" aria-label="${label}"` : ''}>${view}</div><div class="mgx-st-side">${side}</div></div>`;
  const wrap = f.body.firstElementChild;
  return { wrap, view: wrap.querySelector('.mgx-st-view'), side: wrap.querySelector('.mgx-st-side'), q: (s) => wrap.querySelector(s), qa: (s) => [...wrap.querySelectorAll(s)] };
}

export function crisp(canvas, draw) {
  const g = canvas.getContext('2d');
  const o = { g, w: 0, h: 0, fit };
  function fit(paint = true) {
    const r = canvas.getBoundingClientRect(), d = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1;
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (w !== o.w || h !== o.h || canvas.width !== Math.round(w * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); o.w = w; o.h = h; }
    g.setTransform(d, 0, 0, d, 0, 0);
    if (draw && paint) draw(g, o.w, o.h);
  }
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return; } fit(); }); ro.observe(canvas); }
  fit(false);   // the first paint is the game's (its state may not exist yet)
  return o;
}

export function drag(el, { down, move, up } = {}) {
  let on = false;
  const at = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (down && down(at(e), e) === false) return;
    on = true; e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener('pointermove', (e) => { if (on && move) move(at(e), e); });
  const end = (e) => { if (!on) return; on = false; if (up) up(at(e), e); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return { get on() { return on; } };
}

export function hold(btn, { tick, up, down } = {}) {
  let t0 = 0, on = false, raf = 0;
  const step = (t) => { if (!on) return; const dt = Math.min(0.1, (t - t0) / 1000 || 0); t0 = t; if (tick) tick(dt); raf = requestAnimationFrame(step); };
  const start = (e) => { if (on || btn.disabled) return; if (e) e.preventDefault(); on = true; btn.classList.add('held'); if (down) down(); t0 = performance.now(); raf = requestAnimationFrame(step); };
  const stop = () => { if (!on) return; on = false; btn.classList.remove('held'); cancelAnimationFrame(raf); if (up) up(); };
  btn.style.touchAction = 'none';
  btn.addEventListener('pointerdown', (e) => { if (e.button > 0) return; try { btn.setPointerCapture(e.pointerId); } catch {} start(e); });
  btn.addEventListener('pointerup', stop); btn.addEventListener('pointercancel', stop); btn.addEventListener('lostpointercapture', stop);
  btn.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.stopPropagation(); start(e); } });
  btn.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') stop(); });
  btn.addEventListener('blur', stop);
  btn.addEventListener('click', (e) => e.preventDefault());
  return { start, stop, get on() { return on; } };
}

export function loop(f, fn) {
  let last = 0, raf = 0;
  const step = (t) => {
    if (!f.root.isConnected) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    fn(dt, t / 1000);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export function solved(f) { f.root.classList.add('mgx--solved'); }

export function solvable(host, fn, peek) { host.mgSolve = fn; if (peek) host.mgPeek = peek; if (typeof window !== 'undefined') window.__mgSolve = fn; }

/** a calm check: ctx.calm or the OS "reduce motion" */
export const calmOf = (ctx = {}) => !!ctx.calm || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export function noise2(seed = 1, cells = 16) {
  const r = rng(seed), n = cells, v = Array.from({ length: (n + 1) * (n + 1) }, () => r());
  const at = (i, j) => v[((j % n + n) % n) * (n + 1) + ((i % n + n) % n)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {   // x, y in 0..1 (it wraps)
    const fx = x * n, fy = y * n, i = Math.floor(fx), j = Math.floor(fy), tx = s(fx - i), ty = s(fy - j);
    return lerp(lerp(at(i, j), at(i + 1, j), tx), lerp(at(i, j + 1), at(i + 1, j + 1), tx), ty);
  };
}

/** shuffle a copy (seeded) */
export function shuffled(list, r) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
