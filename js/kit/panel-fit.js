/* game-kit 10af67dd: js/panel-fit.js — edit in game-kit and run tools/kit-sync.js */
// Fit a panel's content into its box without scrolling (standard 1.21.1, 水無瀬病院 ドット版 on an iPhone held sideways with the address bar
// showing, 844x340: 「ズレてます」 and the document text hidden under its picture). The user's rule: shrink the PICTURE first, then the text;
// scrolling is only the fallback for an unusually long text. Used by the document window (game-core), the talk window (talk-ui) and the
// reading panel (toast-lane). Each step lowers one CSS property / custom property of one element until the box no longer overflows:
//   fitPanel(box, [{ el, prop: '--pd-photo-w', from: 34, to: 16, step: -2, unit: '%' }, { el, prop: '--pd-scale', from: 1, to: 0.8, step: -0.04 }])
//   a step with max: after the fitting, it grows back while everything fits, up to max (the picture as large as the text allows)
//   keepFitted(box, run)   // run now, again when a picture loads, the fonts are ready or the box changes size; returns a stop function
export function fitPanel(box, steps, o = {}) {
  if (!box || typeof getComputedStyle === 'undefined') return null;
  const slack = o.slack ?? 1;
  const over = () => box.scrollHeight > box.clientHeight + slack;
  for (const s of steps) if (s && s.el) s.el.style.setProperty(s.prop, `${s.from}${s.unit || ''}`);
  const out = { fits: true, at: {} };
  for (const s of steps) {
    if (!s || !s.el) continue;
    let v = s.from, n = 0;
    while (over() && (s.step < 0 ? v + s.step >= s.to - 1e-6 : v + s.step <= s.to + 1e-6) && n++ < 200) { v = +(v + s.step).toFixed(4); s.el.style.setProperty(s.prop, `${v}${s.unit || ''}`); }
    out.at[s.prop] = v;
    if (!over()) break;
  }
  // 1.21.4: the picture back up to the room the text leaves (a later step - smaller type - may have made room; or the start was small
  // for a big screen): the first step grows while everything still fits, up to its max (default its start)
  const g = steps.find((s) => s && s.el && s.max != null);
  if (g && !over()) {
    let v = out.at[g.prop] ?? g.from, n = 0; const up = Math.abs(g.step);
    while (v + up <= g.max + 1e-6 && n++ < 200) { g.el.style.setProperty(g.prop, `${+(v + up).toFixed(4)}${g.unit || ''}`); if (over()) { g.el.style.setProperty(g.prop, `${v}${g.unit || ''}`); break; } v = +(v + up).toFixed(4); }
    if (v < g.max) { g.el.style.setProperty(g.prop, `${g.max}${g.unit || ''}`); if (over()) g.el.style.setProperty(g.prop, `${v}${g.unit || ''}`); else v = g.max; }   // 1.22.5: the last part step up to max itself (74 % when 75 % fits)
    out.at[g.prop] = v;
  }
  out.fits = !over();
  box._gfFit = { steps: steps.filter(Boolean).map((s) => ({ el: s.el, prop: s.prop, from: s.from, to: s.to, step: s.step, unit: s.unit || '', max: s.max })), at: out.at };   // for the check P39 (tools/menu-checks.mjs)
  box.toggleAttribute('data-fit-scroll', !out.fits);   // the fallback: the box scrolls (css may show a hint)
  // the first step (the picture) gave way for the words: P40 (tools/hud-checks.mjs picFitSource) then accepts a picture smaller than the room
  const s0 = steps.find((s) => s && s.el); box.toggleAttribute('data-fit-shrunk', !!s0 && out.at[s0.prop] !== undefined && out.at[s0.prop] !== s0.from);
  return out;
}
export function keepFitted(box, run) {
  if (!box) return () => {};
  let busy = false;
  const go = () => { if (busy || !box.isConnected) return; busy = true; try { run(); } finally { busy = false; } };
  go();
  for (const im of box.querySelectorAll('img')) if (!im.complete) im.addEventListener('load', go, { once: true });
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(go).catch(() => {});
  let ro = null, w = box.clientWidth, h = box.clientHeight;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { if (box.clientWidth === w && box.clientHeight === h) return; w = box.clientWidth; h = box.clientHeight; go(); }); ro.observe(box); }
  return () => { if (ro) ro.disconnect(); };
}
