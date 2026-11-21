// Page code for tools/check-playtest.mjs (standard 1.21.3, 鏡屋 play test 2026-11-21):
//   P37 menuPicturesSource(): every tab of the menu, every entry's detail opened (the 所持品 cells, the [data-open] entries of the
//       notebooks: 気になること・写真, 覚え書き・読んだもの ...). A picture box whose file does not load (naturalWidth 0), a no-picture box
//       taller than 100 px, or letters shown in a picture box (the name's first characters standing in for a picture) is an error.
//       (「画像がない場合におかしくないですか？」: ランドセル showed a huge empty box with 「ラン」 in its corner)
//   P38 headButtonsSource(): the window header's own buttons (ⓘ 説明, × 閉じる): the icon centred in its button (2 px), the button
//       inside the header and inside the window frame (「一時停止のインフォメーションマークやバツボタンがズレています」)
//   P39 pictureRoomSource() (standard 1.21.4, 「十分に画面が大きい場合は大きな画像で表示するべきです」): every panel fitted by
//       js/panel-fit.js (document window, reading panel, talk window) with a picture: grown one step it would still fit and get larger
//       = the picture is smaller than the room the text leaves (an error); its share of the free room (the box minus the text) is reported
//       (under 0.6 a warning).
// They return { bad: [[what, detail], ...], n } and run with window.__game as g.
export const menuPicturesSource = () => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), bad = [], seen = new Set();
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; };
  const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = u; setTimeout(() => res(-1), 4000); });
  const look = async (where) => {
    for (const b of document.querySelectorAll('.tm-content .iv-photo, .tm-content .iv-th, .tm-content .jn-th, .tm-content .jr-pic')) {
      if (!vis(b)) continue;
      const r = b.getBoundingClientRect(), txt = [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (txt) bad.push(['letters in a picture box', where + ' 「' + txt + '」']);
      if (b.classList.contains('iv-nopic') || b.classList.contains('jr-nopic')) { if (r.height > 100) bad.push(['empty picture box', where + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]); continue; }
      const m = /url\\(["']?([^"')]+)["']?\\)/.exec(getComputedStyle(b).backgroundImage || '');
      if (!m) { if (r.height > 100) bad.push(['empty picture box', where + ' (no picture, no mark) ' + Math.round(r.height) + ' px']); continue; }
      if (seen.has(m[1])) continue; seen.add(m[1]);
      if ((await load(m[1])) === 0) bad.push(['broken picture', where + ' ' + m[1]]);
    }
  };
  if (!g.tm) return { bad, n: 0, skip: 'no tab menu' };
  const tabs = [...document.querySelectorAll('.tm-tab[data-tm]')].map((t) => t.dataset.tm);
  let n = 0;
  for (const id of tabs.length ? tabs : ['items']) {
    g.tm.open(id); await sleep(350);
    await look(id);
    const cells = [...document.querySelectorAll('.tm-content .iv-cell')].slice(0, 40);
    for (let i = 0; i < cells.length; i++) { const c = document.querySelectorAll('.tm-content .iv-cell')[i]; if (!c) break; c.click(); await sleep(150); await look(id + ':' + (c.title || c.dataset.id)); n++; }
    const opens = [...document.querySelectorAll('.tm-content [data-open]')].map((b) => b.dataset.open).slice(0, 60);
    for (const k of opens) {
      const b = document.querySelector('.tm-content [data-open="' + CSS.escape(k) + '"]'); if (!b) continue;
      b.click(); await sleep(250); await look(id + ':' + k); n++;
      const back = document.querySelector('.tm-content [data-back]'); if (back) { back.click(); await sleep(200); }
    }
  }
  g.tm.close && g.tm.close();
  return { bad, n };
})()`;

export const headButtonsSource = () => `(() => {
  const bad = [];
  for (const head of document.querySelectorAll('.wm-head')) {
    const H = head.getBoundingClientRect(); if (H.width < 2) continue;
    const win = head.closest('.wm-win') || head.parentElement, W = win.getBoundingClientRect();
    for (const b of head.querySelectorAll('.wm-btn')) {
      if (b.hidden || getComputedStyle(b).display === 'none') continue;
      const R = b.getBoundingClientRect(), ic = b.querySelector('svg'), lb = b.getAttribute('aria-label') || b.className;
      if (R.top < H.top - 1 || R.bottom > H.bottom + 1) bad.push(['button outside its header', lb + ' ' + [R.top, R.bottom, H.top, H.bottom].map(Math.round)]);
      if (R.right > W.right - 1 || R.top < W.top) bad.push(['button over the window frame', lb + ' ' + [R.right, W.right, R.top, W.top].map(Math.round)]);
      if (ic) { const I = ic.getBoundingClientRect(), dx = (I.left + I.right) / 2 - (R.left + R.right) / 2, dy = (I.top + I.bottom) / 2 - (R.top + R.bottom) / 2; if (Math.abs(dx) > 2 || Math.abs(dy) > 2) bad.push(['icon off the middle of its button', lb + ' by ' + dx.toFixed(1) + ', ' + dy.toFixed(1) + ' px']); }
    }
  }
  return { bad, n: document.querySelectorAll('.wm-head .wm-btn').length };
})()`;

export const pictureRoomSource = () => `(async () => {
  const bad = [], info = [], raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (const box of document.querySelectorAll('.gf-doc-main, #gf-reader .tl-body, .gf-talk-body, .wm-body, .gf-talk *')) {
    const F = box._gfFit; if (!F || box.getBoundingClientRect().width < 4) continue;
    const s = F.steps.find((x) => /photo|img|pic|side/.test(x.prop)); if (!s) continue; const mx = s.max ?? (s.unit === "%" ? 75 : 1e9);
    const pic = [...box.querySelectorAll('.pd-photo img, .gf-doc-img, .iv-photo:not(.iv-nopic), .gf-talk-img, .gf-talk img, img')].find((e) => e.getBoundingClientRect().width > 8);
    if (!pic) continue;
    const area = () => { const r = pic.getBoundingClientRect(); if (pic.tagName !== 'IMG' || !pic.naturalWidth) return r.width * r.height; const k = Math.min(r.width / pic.naturalWidth, r.height / pic.naturalHeight); return pic.naturalWidth * k * pic.naturalHeight * k; };
    const over = () => box.scrollHeight > box.clientHeight + 1, a0 = area(), at = F.at[s.prop] ?? s.from;
    const text = [...box.querySelectorAll('p, .pd-body, .gf-doc-text, .tl-text, .gf-talk-text')].filter((e) => !e.contains(pic)).reduce((t, e) => { const r = e.getBoundingClientRect(); return t + r.width * r.height; }, 0);
    const B = box.getBoundingClientRect(), share = +(a0 / Math.max(1, B.width * B.height - text)).toFixed(2);
    const up = Math.min(mx, s.unit === '%' ? 100 : box.clientHeight, at + Math.abs(s.step));
    let grows = false;
    if (up > at && !over()) { s.el.style.setProperty(s.prop, up + s.unit); await raf(); grows = !over() && area() > a0 + 4; s.el.style.setProperty(s.prop, at + s.unit); await raf(); }
    const where = (box.className || box.id || 'panel').toString().slice(0, 30);
    if (grows) bad.push(['picture smaller than the room', where + ' ' + s.prop + ' ' + at + s.unit + ' (it fits at ' + up + s.unit + ')']);
    info.push({ where, share, at: at + s.unit });
  }
  return { bad, info, n: info.length };
})()`;
