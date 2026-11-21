// Frames that hold their text (水無瀬病院 ドット版, iPhone landscape with the address bar, 2026-11-21: in a framed window the inner frame sat
// up-left of the outer one and ended half way down, cutting through the body text; the picture was squashed).
// frameNestSource(root) is page code (a string for page.evaluate) over the visible panels under `root` (default: the whole page):
//   spill   a framed box (a border, or an outline drawn inside it) whose content runs out of it (overflow visible, content taller / wider
//           than the box) - the frame line crosses the text
//   cross   a line of text that a frame line cuts: the line's box partly inside and partly outside a framed ancestor that does not scroll
//   escape  a framed box that sticks out of the framed panel it sits in (the inner frame not inside the outer one)
//   inset   a frame's inner line drawn as an outline with a negative offset (Safari misdraws it; use an inset box-shadow)
//   squash  a picture (img, or a background-image box with data-ratio / aspect-ratio) drawn more than 8 % off its own shape
// Returns [{ kind, sel, text?, by }]. check-playtest P32 runs it on every window, card and the reading panel at 844x390, 667x375, 844x340.
export function frameNestSource(root = 'body') {
  return `(() => {
    const out = [], R = document.querySelector(${JSON.stringify(root)}) || document.body;
    const vis = (e) => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
    const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') || e.tagName;
    const framed = (e) => { const s = getComputedStyle(e); return parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none' && parseFloat(s.borderBottomWidth) >= 1 || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && parseFloat(s.outlineOffset) < 0); };
    const scrolls = (e) => /auto|scroll/.test(getComputedStyle(e).overflowY);
    const clips = (e) => /hidden|clip|auto|scroll/.test(getComputedStyle(e).overflowY);
    const boxes = [...R.querySelectorAll('*')].filter((e) => vis(e) && framed(e) && !e.matches('button, .btn, input, select, textarea, a, kbd, .tl-close, img'));
    for (const e of boxes) {
      const r = e.getBoundingClientRect();
      // inset: the inner line drawn as an outline with a negative offset - iPhone Safari draws it shifted up-left and short (the bug
      // itself does not show in Chromium, so the way of drawing is what is checked). Draw it as an inset box-shadow instead.
      { const s = getComputedStyle(e); if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && parseFloat(s.outlineOffset) < 0) out.push({ kind: 'inset', sel: name(e), by: s.outlineOffset }); }
      // spill: content beyond a box that neither clips nor scrolls
      if (!clips(e) && (e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3)) out.push({ kind: 'spill', sel: name(e), by: [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight] });
      // escape: an inner framed box outside its framed panel (the panel's inner frame line, outline-offset included)
      for (let p = e.parentElement, sc = false; p && p !== document.body; p = p.parentElement) {
        if (scrolls(p)) sc = true;   // a box scrolled out of view inside a scrolling body is not outside the frame
        if (!framed(p) || !vis(p)) continue;
        if (sc) break;
        const q = p.getBoundingClientRect(), so = getComputedStyle(e), off = parseFloat(so.outlineOffset) || 0, ow = so.outlineStyle !== 'none' ? parseFloat(so.outlineWidth) || 0 : 0;
        const il = r.left - off - ow, it = r.top - off - ow, ir = r.right + off + ow, ib = r.bottom + off + ow;   // the inner frame of e (an outline inside: off < 0)
        if (il < q.left - 1 || it < q.top - 1 || ir > q.right + 1 || ib > q.bottom + 1) { if (!scrolls(p)) out.push({ kind: 'escape', sel: name(e), by: name(p) }); }
        break;
      }
    }
    // cross: a text line cut by a frame line (partly in, partly out of a framed ancestor that does not scroll it into view)
    const w = document.createTreeWalker(R, NodeFilter.SHOW_TEXT); let n = 0;
    while (w.nextNode() && n < 4000) {
      const t = w.currentNode; if (!t.nodeValue.trim() || !t.parentElement || !vis(t.parentElement)) continue; n++;
      let box = null; for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) { if (scrolls(p)) break; if (framed(p) && vis(p) && !p.matches('button, .btn')) { box = p; break; } }
      if (!box) continue;
      if (/hidden|clip/.test(getComputedStyle(box).overflowY)) {   // a pin or a room name on a map view (absolute, moved, or SVG), cut at its edge on purpose
        let panned = false;
        for (let q = t.parentElement; q && q !== box; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.position === 'absolute' || cs.transform !== 'none' || q instanceof SVGElement) { panned = true; break; } }
        if (panned) continue;
      }
      const q = box.getBoundingClientRect(), so = getComputedStyle(box), off = parseFloat(so.outlineOffset) || 0, ow = so.outlineStyle !== 'none' ? parseFloat(so.outlineWidth) || 0 : 0, inset = off < 0 ? -off : parseFloat(so.borderTopWidth) || 0;
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const L of rg.getClientRects()) {
        if (L.width < 2 || L.height < 2) continue;
        const inside = L.top >= q.top + inset - 1 && L.bottom <= q.bottom - inset + 1, touches = L.bottom > q.top && L.top < q.bottom;
        if (touches && !inside) { out.push({ kind: 'cross', sel: name(box), text: t.nodeValue.trim().slice(0, 16), by: [Math.round(L.top - q.top), Math.round(q.bottom - L.bottom)] }); break; }
      }
    }
    // squash: a picture drawn off its own shape
    for (const im of R.querySelectorAll('img')) {
      if (!vis(im) || !im.naturalWidth) continue; const s = getComputedStyle(im); if (/cover|contain|scale-down/.test(s.objectFit)) continue;
      const r = im.getBoundingClientRect(), a = (r.width / r.height) / (im.naturalWidth / im.naturalHeight);
      if (a > 1.08 || a < 0.92) out.push({ kind: 'squash', sel: name(im), by: +a.toFixed(2) });
    }
    const seen = new Set(); return out.filter((x) => { const k = x.kind + x.sel + (x.text || ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
  })()`;
}
