/* game-kit 1d2a49bf: js/paper-doc.js — edit in game-kit and run tools/kit-sync.js */
// Documents as paper (standard 1.17.0, from 水無瀬病院 #1: 「紙類について、みる風車を真似た雰囲気に」「書類系は書類の形状で見せる」).
// The feel of みる風車's documents (its js/paper.js: aged, stained, creased paper drawn on a canvas, ink that wavers, a photo pinned on):
// a docs.json entry opens as a sheet of the kind it is, not as a plain window of paragraphs.
//   game.json "docStyle": "paper"          every document is drawn as paper (the kind is guessed from the title, or docs.json "paper")
//   docs.json { ..., "paper": "chart" }    the kind: notice (張り紙・掲示) | chart (カルテ・診療録) | news (新聞) | log (日誌・記録) | ledger (台帳・名簿)
//                                          | note (メモ・手紙・手書き) | typed (報告・お知らせ) | map (案内図)
// renderPaperDoc(el, doc) fills a window body; paperURL(kind, seed) is the sheet alone (a data URL) for a game's own use.
import { esc } from './ui.js';
import { fitPanel, keepFitted } from './panel-fit.js';

const KINDS = {
  notice: { base: [228, 220, 196], ink: '#1f1d1a', font: '"Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif', size: 17, jitter: 0.15, ruled: false, tape: true },
  chart: { base: [232, 226, 206], ink: '#1d2230', font: '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif', size: 16, jitter: 0.3, ruled: true, form: true, holes: true },
  news: { base: [214, 204, 178], ink: '#151412', font: '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif', size: 15, jitter: 0.1, ruled: false, columns: true },
  log: { base: [222, 212, 182], ink: '#20283e', font: '"Yu Gothic","Hiragino Sans",sans-serif', size: 16, jitter: 0.7, ruled: true, holes: true },
  ledger: { base: [216, 204, 168], ink: '#2a1a12', font: '"Yu Mincho","Hiragino Mincho ProN",serif', size: 16, jitter: 0.35, ruled: true, grid: true },
  note: { base: [226, 216, 186], ink: '#2b2a35', font: '"Klee","Yu Gothic","Hiragino Sans",sans-serif', size: 18, jitter: 1.0, ruled: true },
  typed: { base: [224, 214, 182], ink: '#1c1a17', font: '"Yu Mincho","Hiragino Mincho ProN",serif', size: 16, jitter: 0.2, ruled: false },
  map: { base: [230, 224, 204], ink: '#1d2a26', font: '"Yu Gothic","Hiragino Sans",sans-serif', size: 16, jitter: 0.1, ruled: false, tape: true },
};
/** the kind of paper a document is (pure): docs.json "paper", else a guess from its title */
export function paperKind(d = {}) {
  if (d.paper && KINDS[d.paper]) return d.paper;
  const t = `${d.title || ''}`;
  if (/カルテ|診療録|検査票|問診/.test(t)) return 'chart';
  if (/新聞|切り抜き|記事/.test(t)) return 'news';
  if (/日誌|記録|ログ|当直/.test(t)) return 'log';
  if (/台帳|名簿|一覧|帳簿/.test(t)) return 'ledger';
  if (/案内図|地図|見取り図/.test(t)) return 'map';
  if (/掲示|お知らせ|張り紙|貼り紙|告知|注意/.test(t)) return 'notice';
  if (/メモ|手紙|日記|走り書き|ノート|手帳/.test(t)) return 'note';
  return 'typed';
}
const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
export const hashStr = (str) => { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };

const cache = new Map();
/** an aged sheet (data URL): uneven yellowing, fibres, rules, creases, water stains, darker edges, punch holes */
export function paperURL(kind, seed, w = 560, h = 760) {
  const key = `${kind}:${seed}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  if (typeof document === 'undefined') return '';
  const st = KINDS[kind] || KINDS.typed, r = rng(seed);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), [R, G, B] = st.base;
  const grad = g.createRadialGradient(w * (0.3 + r() * 0.4), h * (0.3 + r() * 0.4), 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, `rgb(${R + 8},${G + 8},${B + 6})`); grad.addColorStop(1, `rgb(${R - 38},${G - 42},${B - 50})`);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7000; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.025 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  if (st.ruled) { g.strokeStyle = 'rgba(70,90,140,0.25)'; g.lineWidth = 1; for (let y = 96; y < h - 30; y += 34) { g.beginPath(); g.moveTo(0, y + r()); g.lineTo(w, y + r()); g.stroke(); } }
  if (st.grid) { g.strokeStyle = 'rgba(120,40,30,0.25)'; for (const x of [70, 170, w - 120]) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, h - 30); g.stroke(); } }
  if (st.form) { g.strokeStyle = 'rgba(30,50,90,0.45)'; g.lineWidth = 2; g.strokeRect(24, 24, w - 48, 62); g.beginPath(); g.moveTo(24, 55); g.lineTo(w - 24, 55); g.moveTo(w * 0.62, 24); g.lineTo(w * 0.62, 86); g.stroke(); }
  if (st.columns) { g.strokeStyle = 'rgba(20,20,20,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(20, 74); g.lineTo(w - 20, 74); g.moveTo(20, 78); g.lineTo(w - 20, 78); g.stroke(); }
  const crease = (x0, y0, x1, y1) => { g.strokeStyle = 'rgba(60,40,20,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = 'rgba(255,255,240,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 2, y0 + 2); g.lineTo(x1 + 2, y1 + 2); g.stroke(); };
  const cy = h * (0.45 + r() * 0.1); crease(0, cy, w, cy + (r() - 0.5) * 8);
  if (r() < 0.6) { const cx = w * (0.45 + r() * 0.1); crease(cx, 0, cx + (r() - 0.5) * 8, h); }
  const blot = (x, y, rad, col, a) => { const bg = g.createRadialGradient(x, y, rad * 0.2, x, y, rad); bg.addColorStop(0, `rgba(${col},${a * 0.5})`); bg.addColorStop(0.8, `rgba(${col},${a})`); bg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = bg; g.beginPath(); g.ellipse(x, y, rad, rad * (0.7 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill(); };
  for (let i = 0; i < 4 + r() * 5; i++) blot(r() * w, r() * h, 20 + r() * 90, '110,80,40', 0.06 + r() * 0.08);
  for (let i = 0; i < 2; i++) blot(r() * w, h * (0.7 + r() * 0.3), 60 + r() * 80, '70,80,70', 0.08);   // the water came up to it
  const edge = (horiz) => { const e = horiz ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(60,40,20,0.35)'); e.addColorStop(0.06, 'rgba(60,40,20,0)'); e.addColorStop(0.94, 'rgba(60,40,20,0)'); e.addColorStop(1, 'rgba(60,40,20,0.4)'); g.fillStyle = e; g.fillRect(0, 0, w, h); };
  edge(true); edge(false);
  if (st.holes) { g.fillStyle = 'rgba(20,15,10,0.85)'; for (const y of [h * 0.25, h * 0.75]) { g.beginPath(); g.arc(24, y, 8, 0, Math.PI * 2); g.fill(); } }
  const url = c.toDataURL('image/jpeg', 0.85); cache.set(key, url); return url;
}
/** a torn, uneven outline for the sheet (CSS clip-path) */
export function tornClip(seed) {
  const r = rng(seed + 7), p = [], n = 24;
  for (let i = 0; i <= n; i++) p.push(`${(i / n) * 100}% ${r() * 0.7}%`);
  for (let i = 1; i <= 10; i++) p.push(`${100 - r() * 0.8}% ${(i / 10) * 100}%`);
  for (let i = n; i >= 0; i--) p.push(`${(i / n) * 100}% ${99.3 + r() * 0.7}%`);
  for (let i = 9; i >= 1; i--) p.push(`${r() * 0.8}% ${(i / 10) * 100}%`);
  return `polygon(${p.join(',')})`;
}
/** ink that wavers a little, character by character (handwriting and old typewriters) */
export function inkHTML(text, jitter, seed) {
  const r = rng(seed + 3); let out = '';
  for (const ch of String(text)) {
    if (ch === ' ' || ch === '　') { out += ch; continue; }
    const rot = (r() - 0.5) * 5 * jitter, dy = (r() - 0.5) * 2 * jitter, op = 1 - r() * 0.3 * Math.min(1, jitter);
    out += jitter < 0.2 ? esc(ch) : `<span style="display:inline-block;transform:translateY(${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg);opacity:${op.toFixed(2)}">${esc(ch)}</span>`;
  }
  return out;
}
const CSS = `
.pd-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0 6px}
.pd-sheet{position:relative;width:min(540px,100%);box-sizing:border-box;padding:30px 30px 26px;background-size:cover;box-shadow:0 6px 22px rgba(0,0,0,.55);transform:rotate(-.6deg)}
.pd-sheet{font-size:calc(var(--pd-size,16px) * var(--pd-scale,1))}
.pd-sheet p{margin:0 0 .55em;line-height:calc(1.95 - (1 - var(--pd-scale,1)) * 2)}
.pd-sheet .pd-title{font-weight:700;margin:0 0 14px;letter-spacing:.06em}
.pd-notice .pd-title{text-align:center;font-size:1.35em;border-bottom:2px solid currentColor;padding-bottom:8px}
.pd-notice{border:6px double rgba(30,30,30,.35)}
.pd-chart .pd-title{font-size:1.05em;padding:0 0 0 4px;margin:-6px 0 26px;min-height:56px;display:flex;align-items:center}
.pd-chart .pd-title::before{content:"診療録";font-size:.8em;opacity:.65;margin-right:12px;letter-spacing:.3em}
.pd-news{column-gap:22px}
.pd-news .pd-title{font-size:1.45em;line-height:1.35;column-span:all;margin-bottom:20px;font-weight:900}
@media (min-width:520px){.pd-news .pd-body{columns:2}}
.pd-log .pd-title,.pd-ledger .pd-title{font-size:1.1em;margin-bottom:22px}
.pd-ledger .pd-body p{border-bottom:1px solid rgba(120,40,30,.25);padding-bottom:2px}
.pd-note{transform:rotate(1.2deg)}
.pd-photo{position:relative;margin:2px auto 14px;width:fit-content;max-width:86%;transform:rotate(-2deg);box-shadow:2px 3px 10px rgba(0,0,0,.45);background:#eee;padding:6px 6px 16px}
.pd-photo img{display:block;width:100%;max-width:100%;max-height:var(--pd-photo-h,70vh);height:auto;object-fit:contain}
.pd-photo::before,.pd-photo::after{content:"";position:absolute;top:-9px;width:62px;height:20px;background:rgba(236,230,200,.72);box-shadow:0 1px 2px rgba(0,0,0,.2)}
.pd-photo::before{left:-12px;transform:rotate(-24deg)}.pd-photo::after{right:-12px;transform:rotate(22deg)}
.pd-tape::before{content:"";position:absolute;top:-10px;left:50%;width:90px;height:22px;margin-left:-45px;background:rgba(236,230,200,.7);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.2)}
.pd-feel{max-width:540px;width:100%}
.pd-stamp{position:absolute;right:18px;top:16px;transform:rotate(-12deg);border:3px double rgba(150,20,20,.7);color:#7a0c0c;padding:4px 12px;font-weight:700;letter-spacing:.2em;opacity:.8}
@media (max-width:500px){.pd-sheet{padding:22px 18px 18px}}
html[data-gf-calm="1"] .pd-sheet,html[data-gf-calm="1"] .pd-photo{transform:none}
/* 1.21.1 a low landscape screen (a phone held sideways, 水無瀬病院 ドット版): the picture LEFT of the text (about a third), the text on the right;
   renderDocWindow shrinks the picture (--pd-photo-w) before the text (--pd-scale) until the whole text shows without scrolling */
@media (orientation:landscape) and (max-height:820px) and (min-aspect-ratio:4/3){
.pd-wrap{padding:2px 0}
.pd-sheet:has(>.pd-photo){width:100%;box-sizing:border-box;display:grid;grid-template-columns:var(--pd-photo-w,34%) minmax(0,1fr);column-gap:20px;align-items:start;padding:16px 22px 14px}
.pd-sheet:has(>.pd-photo)>.pd-photo{grid-column:1;grid-row:1 / span 8;margin:6px 0 0;max-width:100%;width:auto;justify-self:center}
.pd-sheet:has(>.pd-photo)>.pd-photo img{width:100%;max-height:none}
.pd-sheet:has(>.pd-photo)>:not(.pd-photo):not(.pd-stamp){grid-column:2}
.pd-sheet:has(>.pd-photo) .pd-body{columns:auto}
.pd-sheet .pd-title{margin-bottom:8px}
.pd-chart .pd-title{margin:0 0 10px;min-height:0}
.pd-news .pd-title,.pd-log .pd-title,.pd-ledger .pd-title{margin-bottom:10px}
}
/* the document window (renderDocWindow): the text scrolls in its own box (only as the fallback), 読んだ stays under it and never covers it */
.wm-body.gf-doc{overflow:hidden}
.gf-doc-main{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.wm-body.gf-doc>.gf-doc-done{position:static!important;box-shadow:none!important;background:none!important;flex:none;margin:10px 0 0}
.gf-doc-plain .gf-doc-img{display:block;width:100%;max-width:100%;max-height:var(--pd-photo-h,70vh);object-fit:contain;margin:0 auto 12px}
.gf-doc-plain{font-size:calc(1em * var(--pd-scale,1))}
@media (orientation:landscape) and (max-height:820px) and (min-aspect-ratio:4/3){
.gf-doc-plain:has(>.gf-doc-img){display:grid;grid-template-columns:var(--pd-photo-w,34%) minmax(0,1fr);column-gap:18px;align-items:start}
.gf-doc-plain>.gf-doc-img{width:100%;max-height:none;margin:4px 0 0}
.wm-body.gf-doc>.gf-doc-done{margin-top:6px}
.wm-body.gf-doc>.gf-doc-done .gf-doc-read{min-height:44px}
}
@media (orientation:landscape) and (max-height:430px){
.wm-body.gf-doc{flex-direction:row;align-items:stretch;gap:14px}
.wm-body.gf-doc>.gf-doc-done{margin:0;display:flex;align-items:flex-end}
.wm-body.gf-doc>.gf-doc-done .gf-doc-read{min-width:0;width:auto;writing-mode:horizontal-tb;padding:0 14px}
.pd-sheet:has(>.pd-photo){padding:12px 18px 10px}
.pd-sheet p{margin:0 0 .3em}
.pd-notice .pd-title{font-size:1.2em;padding-bottom:4px}
.pd-wrap{padding:0}
}
`;
function injectCss() { if (typeof document === 'undefined' || document.getElementById('gf-paper-css')) return; const s = document.createElement('style'); s.id = 'gf-paper-css'; s.textContent = CSS; document.head.appendChild(s); }

/** the document drawn as paper, as HTML (the journal's reader uses it): d = docs.json entry { id, title, text, photo, feeling, paper?, stamp? } */
export function paperDocHtml(d, o = {}) {
  injectCss();
  const kind = paperKind(d), st = KINDS[kind], seed = hashStr(d.id || d.title || 'doc');
  const lines = String(d.text || '').split(String.fromCharCode(10));
  // a first line that repeats the title is the sheet's own heading (閉院のお知らせ / 院内案内図)
  const head = lines[0] && lines[0].replace(/\s/g, '') === String(d.title || '').replace(/[（(].*$/, '').replace(/\s/g, '') ? lines.shift() : null;
  const title = head || (kind === 'chart' || kind === 'news' || kind === 'log' || kind === 'ledger' ? d.title : null);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const style = `background-image:url(${paperURL(kind, seed)});color:${st.ink};font-family:${st.font.replace(/"/g, "'")};--pd-size:${st.size}px;${still ? '' : `clip-path:${tornClip(seed)};`}`;
  const sheet = `<div class="pd-sheet pd-${kind}${st.tape ? ' pd-tape' : ''}" style="${style}">${d.photo ? `<figure class="pd-photo"><img src="${esc(d.photo)}" alt=""></figure>` : ''}${title ? `<p class="pd-title">${inkHTML(title, st.jitter * 0.5, seed)}</p>` : ''}<div class="pd-body">${lines.map((p, i) => `<p>${inkHTML(p, st.jitter, seed + i)}</p>`).join('')}</div>${d.stamp ? `<span class="pd-stamp">${esc(d.stamp)}</span>` : ''}</div>`;
  return `<div class="pd-wrap">${sheet}${d.feeling && o.feeling !== false ? `<p class="iv-feel pd-feel">${esc(d.feeling)}</p>` : ''}</div>`;
}
/** 1.21.1: the document window's body: the document (paper or plain) in a scroller .gf-doc-main, 読んだ under it, fitted so the whole text
 * shows without scrolling (picture first, then the text: js/panel-fit.js). o = { paper, onDone, label } */
export function renderDocWindow(el, d, o = {}) {
  injectCss();
  el.classList.add('gf-doc');
  el.innerHTML = '';
  const main = document.createElement('div'); main.className = 'gf-doc-main'; el.appendChild(main);
  if (o.paper) renderPaperDoc(main, d, { feeling: false });
  else main.innerHTML = `<div class="gf-doc-plain">${d.photo ? `<img class="gf-doc-img" src="${esc(d.photo)}" alt="">` : ''}<div class="gf-doc-text">${String(d.text || '').split(String.fromCharCode(10)).map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
  el.insertAdjacentHTML('beforeend', `<p class="gf-doc-done"><button type="button" class="btn primary gf-doc-read">${esc(o.label || '読んだ')}</button></p>`);
  el.querySelector('.gf-doc-read').addEventListener('click', () => { if (o.onDone) o.onDone(); });
  const fit = () => fitDoc(main);
  el._gfFitStop = keepFitted(main, fit);
  return { kind: o.paper ? paperKind(d) : 'plain', fit };
}
/** shrink the picture, then the text, until the document fits its box (pure layout; returns fitPanel's result) */
export function fitDoc(main) {
  const sheet = main.querySelector('.pd-sheet, .gf-doc-plain');
  if (!sheet) return null;
  const pic = sheet.querySelector(':scope > .pd-photo, :scope > .gf-doc-img');
  const split = !!pic && typeof getComputedStyle !== 'undefined' && getComputedStyle(sheet).display === 'grid';
  const h0 = Math.max(60, Math.round(main.clientHeight * 0.62));   // 1.21.4: the picture starts large (「十分に画面が大きい場合は大きな画像で」)
  const steps = [];
  if (pic) steps.push(split ? { el: sheet, prop: '--pd-photo-w', from: 60, to: 16, step: -2, unit: '%', max: 75 } : { el: sheet, prop: '--pd-photo-h', from: h0, to: 56, step: -12, unit: 'px', max: Math.max(h0, main.clientHeight) });
  steps.push({ el: sheet, prop: '--pd-scale', from: 1, to: 0.8, step: -0.04, unit: '' });
  return fitPanel(main, steps);
}
/** fill a window body with the document drawn as paper */
export function renderPaperDoc(el, d, o = {}) { el.innerHTML = paperDocHtml(d, o); return { kind: paperKind(d) }; }
