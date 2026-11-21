// Text too close to its frame (playtest finding: 札の家ドット版 「UIの説明文などの枠からのマージンがほとんどないです」).
// framePaddingSource: the source of a function to evaluate in the page. It looks at every visible element that draws a frame (a border
// of 1 px or more on all four sides, or an outline drawn inside the box with a negative outline-offset) and holding text of its own,
// and measures the gap between the frame's inner line and the nearest line of its text (Range client rects of its text nodes; text
// inside a nested framed element belongs to that one). Returns [{ sel, text, gap: { l, r, t, b }, min, need }] for the boxes under
// the minimum: a box needs `box` px on every side (12 by default), a button or a chip needs `button` px left / right and half of
// that top / bottom (it is one line). Used by tools/check-playtest.mjs (P23) and by any game's play scripts (eval the source).
export const FRAME_PAD = { box: 12, button: 8 };

export const framePaddingSource = (o = FRAME_PAD) => `(() => {
  const BOX = ${Number(o.box) || 12}, BTN = ${Number(o.button) || 8};
  const px = (v) => parseFloat(v) || 0;
  const visible = (el) => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const frameOf = (el) => {
    const s = getComputedStyle(el);
    const bw = ['Left', 'Right', 'Top', 'Bottom'].map((k) => (s['border' + k + 'Style'] !== 'none' && s['border' + k + 'Style'] !== 'hidden' ? px(s['border' + k + 'Width']) : 0));
    const border = bw.every((w) => w >= 1);
    const ow = s.outlineStyle !== 'none' ? px(s.outlineWidth) : 0, off = px(s.outlineOffset);
    const inner = ow > 0 && off < 0;   // a line drawn inside the box: the frame the eye sees is there
    if (!border && !inner) return null;
    const ins = inner ? Math.max(-off, 0) : 0;
    return { l: Math.max(bw[0], ins), r: Math.max(bw[1], ins), t: Math.max(bw[2], ins), b: Math.max(bw[3], ins) };
  };
  const out = [];
  const all = [...document.querySelectorAll('body *')].filter((el) => !['SCRIPT', 'STYLE', 'CANVAS', 'svg', 'IMG', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  const framed = new Map();
  for (const el of all) { const f = frameOf(el); if (f && visible(el)) framed.set(el, f); }
  for (const [el, f] of framed) {
    const r = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n, g = { l: 1e9, r: 1e9, t: 1e9, b: 1e9 }, text = '';
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      // the nearest framed ancestor must be this element
      let p = n.parentElement; while (p && p !== el && !framed.has(p)) p = p.parentElement;
      if (p !== el || !visible(n.parentElement)) continue;
      // text in a scrolling part between it and the frame: only left / right count (a scrolled line passes the top and bottom on purpose)
      let sc = false; for (let a = n.parentElement; a && a !== el; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if (o === 'auto' || o === 'scroll' || o === 'hidden') { sc = true; break; } }
      // a line cut with an ellipsis (overflow hidden on a part inside the frame): only what that part shows counts
      let cl = -1e9, cr = 1e9; for (let a = n.parentElement; a && a !== el; a = a.parentElement) { const o = getComputedStyle(a); if (o.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); cl = Math.max(cl, ar.left + px(o.paddingLeft)); cr = Math.min(cr, ar.right - px(o.paddingRight)); } }
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q0 of rg.getClientRects()) {
        const q = { left: Math.max(q0.left, cl), right: Math.min(q0.right, cr), top: q0.top, bottom: q0.bottom, width: q0.width, height: q0.height };
        if (q.width < 1 || q.height < 1 || q.bottom < r.top || q.top > r.bottom) continue;
        g.l = Math.min(g.l, q.left - r.left - f.l); g.r = Math.min(g.r, r.right - q.right - f.r);
        if (!sc) { g.t = Math.min(g.t, q.top - r.top - f.t); g.b = Math.min(g.b, r.bottom - q.bottom - f.b); }
      }
      if (text.length < 40) text += n.textContent.trim().slice(0, 40 - text.length);
    }
    if (g.l === 1e9) continue;
    if (g.t === 1e9) { g.t = BOX; g.b = BOX; }
    const btn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || /(^|[ -])(btn|chip)([ -]|$)/.test(el.className || '');
    const needX = btn ? BTN : BOX, needY = btn ? BTN / 2 : BOX;
    const min = Math.min(g.l, g.r, g.t, g.b);
    const bad = g.l < needX || g.r < needX || g.t < needY || g.b < needY;
    if (!bad) continue;
    const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
    out.push({ sel, text, gap: { l: Math.round(g.l), r: Math.round(g.r), t: Math.round(g.t), b: Math.round(g.b) }, min: Math.round(min), need: [needX, needY] });
  }
  return out;
})()`;

// Text cut off by a box that cannot scroll (playtest finding: 札の家ドット版 iPhone 「スクロールできないので文字が見られません」).
// clippedTextSource(root): the source of a function to evaluate in the page. For every visible line of text under `root` (a CSS selector,
// default the whole page) it finds the nearest ancestor that clips (overflow hidden / clip / auto / scroll); when a line lies outside that
// ancestor's visible box by 2 px or more and the ancestor cannot scroll to it (overflow hidden / clip, or no more scroll room in that
// direction from the top), the line is reported: [{ sel, text, out: { t, b }, scroll }]. A line below the fold of a box that scrolls is fine.
export const clippedTextSource = (root = 'body') => `(() => {
  const out = [], seen = new Set();
  const rootEl = document.querySelector(${JSON.stringify(root)}) || document.body;
  const visible = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } return true; };
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t || !n.parentElement || !visible(n.parentElement)) continue;
    let clip = null;
    for (let a = n.parentElement; a && a !== document.documentElement; a = a.parentElement) { const o = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(o.overflowY)) { clip = a; break; } }
    if (!clip) continue;
    const cr = clip.getBoundingClientRect(), s = getComputedStyle(clip);
    const top = cr.top + (parseFloat(s.borderTopWidth) || 0), bottom = cr.bottom - (parseFloat(s.borderBottomWidth) || 0);
    const canScroll = /(auto|scroll)/.test(s.overflowY) && clip.scrollHeight > clip.clientHeight + 1;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      const ot = Math.round(top - q.top), ob = Math.round(q.bottom - bottom);
      if (ot < 2 && ob < 2) continue;
      if (canScroll) continue;
      const sel = clip.tagName.toLowerCase() + (clip.id ? '#' + clip.id : '') + (typeof clip.className === 'string' && clip.className.trim() ? '.' + clip.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      const k = sel + t.slice(0, 20); if (seen.has(k)) break; seen.add(k);
      out.push({ sel, text: t.slice(0, 40), out: { t: Math.max(0, ot), b: Math.max(0, ob) }, scroll: { h: clip.scrollHeight, c: clip.clientHeight, y: s.overflowY } });
      break;
    }
  }
  return out;
})()`;
