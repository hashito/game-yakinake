// Page-side probes for check-playtest P35-P36 (standard 1.21.1, 水無瀬病院 ドット版 on an iPhone). Each *Source() returns an expression string
// that check-playtest evaluates in the game page (g = window.__game).
//   hudOverlapSource (a helper for a game's own phone scripts; check-playtest uses tools/phone-layout.mjs P31 since 1.21.0): message boxes overlapping.
//   P35 「閉じるで閉じられないです」: every close button on screen is the top element at its centre (nothing over it takes the finger);
//       check-playtest then taps it with a real touch and expects its box gone.
//   P36 「文字が改行されると回す位置が変わってハンチングする」: in each library mini game, a longer text in any caption / message moves none of
//       its controls (the knob, the buttons, the sliders).
export const MSG_BOXES = ['#say', '#prompt', '#gf-ch', '.tl-lane .tl-item', '#objective', '#hud-left', '.ph-goal', '#guide'];

export function hudOverlapSource(sel = MSG_BOXES) {
  return `(() => {
    const sel = ${JSON.stringify(sel)}, boxes = [];
    const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && (e.textContent || '').trim().length > 0; };
    for (const s of sel) for (const e of document.querySelectorAll(s)) { if (!vis(e) || e.closest('#gf-reader')) continue; let p = e.parentElement, inner = false; while (p) { if (p.style && getComputedStyle(p).visibility === 'hidden') { inner = true; break; } p = p.parentElement; } if (inner) continue; boxes.push({ s, e, r: e.getBoundingClientRect() }); }
    const ov = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ix > 2 && iy > 2 && ix * iy > 64) ov.push(a.s + ' x ' + b.s + ' (' + Math.round(ix) + 'x' + Math.round(iy) + ')');
    }
    const msgs = boxes.filter((b) => b.s !== '#prompt').map((b) => b.s);
    return { overlaps: [...new Set(ov)], messages: msgs };
  })()`;
}

export function closeTapSource() {
  return `(() => {
    const out = [];
    const all = [...document.querySelectorAll('button, [role=button]')].filter((b) => /閉じる|close/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')) || b.matches('.tl-close, .wm-x, .mgx-close'));
    for (const b of all) {
      const s = getComputedStyle(b), r = b.getBoundingClientRect();
      if (s.display === 'none' || s.visibility === 'hidden' || r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
      const box = b.closest('#gf-ch, .tl-item, .wm-layer, #gf-reader, .mgx, .gf-mo-card, .ph-sheet') || b;
      out.push({ id: (box.id ? '#' + box.id : '.' + String(box.className || box.tagName).split(' ')[0]), x: Math.round(x), y: Math.round(y), on: !!e && (e === b || b.contains(e)), top: e ? (e.id ? '#' + e.id : '.' + String(e.className || e.tagName).split(' ')[0]) : null });
    }
    return out;
  })()`;
}

// close the open mini game: the library's .mgx-close, or a game's own window in #mg-custom (its [data-close] / 閉じる button); 1.28.1:
// a custom window left open (札の家 keyring) stayed on screen and every later task measured it instead of its own
const mgCloseJs = (v) => `(${v}.querySelector('.mgx-close, [data-close]') || [...${v}.querySelectorAll('button')].find((b) => /閉じる|やめる|中断/.test(b.textContent || '')) || { click() {} }).click();`;

/** open the library mini game of task <id>, make every caption longer, and report the controls that moved (then close it) */
export function mgStableSource(id) {
  return `(async () => {
    const t = g.data.tasks.find((x) => x.id === ${JSON.stringify(id)}); if (!t || !g.runMinigame) return null;
    const run = g.runMinigame(t); await new Promise((r) => setTimeout(r, 700));
    const host = document.getElementById('mg-custom') || document.querySelector('.mgx'); if (!host) return { type: (t.minigame || {}).type, open: false };
    const ctl = [...host.querySelectorAll('[role=slider], button:not(.mgx-close), input, select, canvas, [draggable=true], [data-k]')].filter((e) => e.getBoundingClientRect().width > 2);
    const at = () => ctl.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top]; });
    const before = at(), moved = [];
    const texts = [...host.querySelectorAll('[aria-live], .mgx-msg, .mgx-body p, .mgx-body output, .mgx-body [class*=heard], .mgx-body [class*=cap]')];
    for (const el of texts) {
      const old = el.textContent, long = ('「……聞こえるか……」声だ。そのまま止める。' + (old || '')).slice(0, Math.max(30, (old || '').length * 2));
      el.textContent = long; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const now = at(); now.forEach((p, i) => { const d = Math.hypot(p[0] - before[i][0], p[1] - before[i][1]); if (d > 2) moved.push((el.className || el.tagName) + ' -> ' + (ctl[i].className || ctl[i].tagName) + ' ' + Math.round(d) + 'px'); });
      el.textContent = old; await new Promise((r) => requestAnimationFrame(r));
    }
    ${mgCloseJs('host')} await Promise.race([run, new Promise((r) => setTimeout(r, 800))]);
    return { type: (t.minigame || {}).type, open: true, controls: ctl.length, texts: texts.length, moved: [...new Set(moved)].slice(0, 6) };
  })()`;
}

/** P44 (1.26.0, 鏡屋 「横向きのスマホでスクロールなし」): a mini game open on a phone: the panel must not scroll, and every control
 *  (buttons, sliders, the stick) must be inside the screen. Returns { open, type, scroll: px, off: [control, px] } */
export function mgFitSource(id) {
  return `(async () => {
    const t = g.data.tasks.find((x) => x.id === ${JSON.stringify(id)}); if (!t || !g.runMinigame) return null;
    const run = g.runMinigame(t); await new Promise((r) => setTimeout(r, 900));
    const root = document.querySelector('.mgx') || document.getElementById('mg-custom'); if (!root) return { type: (t.minigame || {}).type, open: false };
    const H = innerHeight, W = innerWidth, off = [];
    let scroll = 0;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const cs = getComputedStyle(el); if (!/(auto|scroll)/.test(cs.overflowY) || el.classList.contains('mgx-msg')) continue;
      scroll = Math.max(scroll, el.scrollHeight - el.clientHeight);
    }
    for (const e of root.querySelectorAll('[role=slider], button, input, select, .mgx-photo-stick')) {
      const r = e.getBoundingClientRect(); if (r.width < 3 || r.height < 3) continue;
      const by = Math.max(0, r.bottom - H, -r.top, r.right - W, -r.left); if (by > 2) off.push([(e.className || e.tagName).toString().slice(0, 40) + ' ' + (e.textContent || '').trim().slice(0, 8), Math.round(by)]);
    }
    // 1.26.3: nothing of the HUD on top of the window (the phone's 目的 chip sat on the title)
    { const rr = root.getBoundingClientRect(); for (const e of document.querySelectorAll('#gf-goal-chip, #hud-left')) { const s = getComputedStyle(e), r = e.getBoundingClientRect(); if (s.display !== 'none' && s.visibility !== 'hidden' && r.width > 2 && r.left < rr.right && r.right > rr.left && r.top < rr.bottom && r.bottom > rr.top) off.push(['#' + e.id + ' over the window', Math.round(Math.min(r.right, rr.right) - Math.max(r.left, rr.left))]); } }
    // P46 (1.27.0): photo-focus cfg.full - how much of the screen the picture covers, and the floating controls that overlap each other
    let full = null;
    if (root.classList.contains('mgx--photo-full')) {
      const v = root.querySelector('.mgx-photo-view').getBoundingClientRect(), cover = Math.max(0, Math.min(v.right, W) - Math.max(v.left, 0)) * Math.max(0, Math.min(v.bottom, H) - Math.max(v.top, 0)) / (W * H);
      const parts = ['.mgx-close', '.mgx-help', '.mgx-photo-read', '.mgx-photo-meter', '.mgx-photo-left', '.mgx-photo-stick', '.mgx-photo-gauges', '.mgx-photo-shutter'].map((s) => [s, root.querySelector(s)])
        .filter(([, e]) => e && getComputedStyle(e).display !== 'none').map(([s, e]) => [s, e.getBoundingClientRect()]).filter(([, r]) => r.width > 2 && r.height > 2);
      const overlaps = [];
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i][1], b = parts[j][1], ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 2 && iy > 2) overlaps.push([parts[i][0], parts[j][0], Math.round(ix), Math.round(iy)]);
      }
      // 1.29.0: the help is a fixed box of two lines - cut text (「…」 or more than two lines) is a fault
      const h = root.querySelector('.mgx-help'), helpCut = !!h && getComputedStyle(h).display !== 'none' && (h.scrollHeight > h.clientHeight + 1 || h.scrollWidth > h.clientWidth + 1 || getComputedStyle(h).textOverflow === 'ellipsis');
      full = { cover: Math.round(cover * 1000) / 1000, overlaps, helpCut, help: h ? h.textContent.trim() : '' };
    }
    ${mgCloseJs('root')} await Promise.race([run, new Promise((r) => setTimeout(r, 800))]);
    return { type: (t.minigame || {}).type, open: true, scroll: Math.round(scroll), off: off.slice(0, 6), full };
  })()`;
}

/** P40 (1.21.5, 「十分に画面が大きい場合は大きな画像で表示するべきです」): every open reading panel / document / talk window with a picture:
 *  the text must fit (no overflow) and the picture must not be smaller than the room allows - an error when the panel has free space
 *  left (slack) of a quarter of the picture's height or more and the picture is narrower than the column it sits in (it could grow). */
export function picFitSource() {
  return `(() => {
    const out = [];
    const boxes = [...document.querySelectorAll('#gf-reader .tl-read .tl-body, .wm-win .wm-body')].filter((b) => b.getBoundingClientRect().height > 20);
    for (const body of boxes) {
      const pic = [...body.querySelectorAll('img, .iv-photo, .pd-photo, .gf-doc-img, .gf-talk-img')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && !e.closest('.gf-talk-row') && !e.classList.contains('gf-talk-face') && getComputedStyle(e).visibility !== 'hidden'; });
      if (!pic) continue;
      const scroller = body.querySelector('.gf-doc-main') || body;
      const over = scroller.scrollHeight > scroller.clientHeight + 2 && !scroller.hasAttribute('data-fit-scroll');
      const B = body.getBoundingClientRect(), P = pic.getBoundingClientRect();
      let bottom = B.top;
      for (const e of body.querySelectorAll('*')) { if (!e.children.length || e === pic || e.tagName === 'IMG') { const r = e.getBoundingClientRect(); if (r.height > 0 && r.width > 0 && getComputedStyle(e).visibility !== 'hidden') bottom = Math.max(bottom, r.bottom); } }
      const padB = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      const slack = Math.max(0, B.bottom - padB - bottom);
      const col = pic.parentElement.getBoundingClientRect().width;
      const innerH = B.height - (parseFloat(getComputedStyle(body).paddingTop) || 0) - padB;
      const beside = [...body.querySelectorAll('p, .gf-talk-text, .pd-body, .iv-info')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.left >= P.right - 2 && r.top < P.bottom && r.bottom > P.top; });
      // stacked: free room under the words and a picture narrower than its column; side by side: neither as tall as the panel nor half its width
      // (a picture the fit made smaller for the words - data-fit-shrunk on a box from js/panel-fit.js - is as large as the words allow)
      const shrunk = !!body.querySelector('[data-fit-shrunk]') || body.hasAttribute('data-fit-shrunk') || !!(body.closest('[data-fit-shrunk]'));
      // a picture box out of its own shape (cut by object-fit: a width cap against a set height) is not shown whole (1.21.5)
      const nat = pic.tagName === 'IMG' && pic.naturalWidth > 1 && pic.naturalHeight > 1 ? pic.naturalWidth / pic.naturalHeight : 0;
      const crop = !!nat && /cover|none/.test(getComputedStyle(pic).objectFit) && Math.abs(P.width / P.height - nat) / nat > 0.12;
      const grow = crop || !shrunk && (beside ? (P.height < innerH * 0.7 && P.width < B.width * 0.5) : (slack >= Math.max(24, P.height * 0.25) && P.width < col * 0.95 - 2));
      out.push({ where: (body.closest('#gf-reader') ? 'reader' : (body.closest('.wm-win') || {}).dataset ? 'window' : 'panel') + ':' + (body.closest('[data-id]') ? body.closest('[data-id]').dataset.id : ''), over, slack: Math.round(slack), pic: [Math.round(P.width), Math.round(P.height)], col: Math.round(col), crop, grow });
    }
    return out;
  })()`;
}
