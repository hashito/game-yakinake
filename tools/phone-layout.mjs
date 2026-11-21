// Phone layout (standard 1.21.0, 札の家 ドット版: 「メッセージや通知で領域を使いすぎている」「横でのプレイを推奨」).
// phoneLayoutSource() is page code (a string for page.evaluate) over a running kit game: the share of the screen the HUD covers (every
// visible part of #hud, the touch controls, the notification lane, the say band, the 目的 chip: their rectangles unioned on a 4 px grid),
// the pairs of panels that overlap, and whether the portrait notice (#gf-rotate) is shown.
//   const r = await page.evaluate(phoneLayoutSource());   // -> { cover, overlaps: [[a, b]], rotate, phone, portrait }
// check-playtest P31: at 844x390 and 667x375 (landscape) and 390x844 (portrait): cover <= PHONE_HUD_MAX, no overlaps, the notice in portrait,
// and msgs (the message boxes up at once) at most one on a phone (1.21.0, 「通知が多すぎます」).
export const PHONE_HUD_MAX = { landscape: 0.32, portrait: 0.3 };   // with a thought line and a notice on screen (the worst ordinary moment)
export function phoneLayoutSource() {
  return `(() => {
    const vis = (e) => { if (!e) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight; };
    // a part that draws something: text, a picture, or a background / border of its own (an invisible touch zone such as #t-look does not count)
    const paint = (e) => { const s = getComputedStyle(e), bg = s.backgroundColor, a = (bg.match(/rgba?\(([^)]+)\)/) || [0, '0,0,0,0'])[1].split(',').map(Number); return (a.length < 4 || a[3] > 0.05) && bg !== 'transparent' || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0; };
    const drawn = (e) => !!e.textContent.trim() || !!e.querySelector('img, svg, canvas') || paint(e) || [...e.querySelectorAll('*')].slice(0, 40).some((c) => vis(c) && paint(c));
    const name = (e) => (e.id ? '#' + e.id : (e.className && String(e.className).split(' ')[0]) || e.tagName).slice(0, 32);
    // the panels: the top-level parts of each HUD region (a card, a button), not every span inside them
    const sel = ['#hud-left', '#hud-right > *', '#hs-tc > *', '#prompt', '#say', '.tl-lane > .tl-item', '#touch > *', '#gf-goal-chip', '#ga-wait'];
    const parts = [...new Set(sel.flatMap((q) => [...document.querySelectorAll(q)]))].filter(vis).filter((e) => !(e.id === 'hud-left' && !e.textContent.trim())).filter(drawn);
    const rects = parts.map((e) => { const r = e.getBoundingClientRect(); return { n: name(e), l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(innerWidth, r.right), b: Math.min(innerHeight, r.bottom), e }; });
    let hit = 0, n = 0;
    for (let y = 2; y < innerHeight; y += 4) for (let x = 2; x < innerWidth; x += 4) { n++; if (rects.some((q) => x >= q.l && x < q.r && y >= q.t && y < q.b)) hit++; }
    const overlaps = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w > 2 && h > 2) overlaps.push([a.n, b.n, Math.round(w), Math.round(h)]);
    }
    // the message boxes up at once (a phone shows one: the thought line, a notice / hint card, the tap label, the goal flash)
    const shown = (e) => vis(e) && !!e.textContent.trim();
    const msgs = [document.getElementById('say'), ...document.querySelectorAll('.tl-lane > .tl-item:not(.tl-read)'), document.querySelector('.gf-ch'), document.getElementById('prompt'), document.body.classList.contains('gf-goal-open') ? null : document.getElementById('hud-left')].filter(shown).map(name);
    const B = document.body;
    return { msgs, cover: +(hit / Math.max(1, n)).toFixed(3), overlaps: overlaps.slice(0, 8), rotate: vis(document.getElementById('gf-rotate')), phone: B.classList.contains('gf-phone'), portrait: innerHeight > innerWidth, parts: rects.map((q) => q.n) };
  })()`;
}
