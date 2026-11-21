/* game-kit 1d2a49bf: js/reads-tab.js — edit in game-kit and run tools/kit-sync.js */
// 読んだもの (standard 1.20.3, 札の家 2026-11-21 「後半何故それをするかが分かりづらい…過去のドキュメントを読めるようにしてください」):
// one menu tab with
//   覚え書き   a running note: what I am doing now and WHY (the task the step guide is on: title + meaning), then what was done so far and why
//              (the done tasks' meanings, newest first) - the player keeps only the gist, so the reasons stay one tap away;
//   読んだもの  every document read and every item with "read" text (letters), newest first; a tap opens it again in the reading panel
//              (the menu closes, and comes back on this tab when the panel is closed). A NEW badge counts entries not opened from here yet.
// game.json "ui": { "reads": false } leaves it out. Entries come from ctx.state.docsRead / ctx.state.inv (the order they were got in).
import { viewItemHtml } from './inventory-ui.js';
import { paperDocHtml } from './paper-doc.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const em = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export const READS_CSS = `
.gf-reads h3{margin:14px 0 6px;font-size:1.05rem;color:var(--gf-text)}
.gf-reads h3:first-child{margin-top:0}
.gf-reads p{margin:0 0 8px;line-height:1.65;color:var(--gf-text)}
.gf-reads .gf-memo-now{padding:10px 12px;border:1px solid var(--gf-accent,#c9a25a);border-radius:6px;margin-bottom:10px}
.gf-reads .gf-memo-why{color:var(--gf-text-dim,#cbbd9e)}
.gf-reads ol.gf-memo-past{margin:0 0 6px;padding-left:1.3em}
.gf-reads ol.gf-memo-past li{margin:0 0 6px;line-height:1.55;color:var(--gf-text-dim,#cbbd9e)}
.gf-reads ul.gf-read-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.gf-reads .gf-read-open{width:100%;text-align:left;display:flex;gap:10px;align-items:center;min-height:48px;padding:8px 12px}
.gf-reads .gf-read-open img{width:44px;height:44px;object-fit:cover;border-radius:4px;flex:none}
.gf-reads .gf-read-open span{flex:1;line-height:1.4}
.gf-reads .gf-read-new{font-size:.75rem;padding:1px 6px;border-radius:9px;background:var(--gf-accent,#c9a25a);color:#1a1208;flex:none}
.gf-reads .gf-read-kind{display:block;font-size:.78rem;opacity:.75}
`;

export function readsTab(ctx, { items = [], docs = [], tasks = [], lane, tm, bus, manifest = {}, roomName = (x) => x } = {}) {
  const key = `gf-reads-seen:${manifest.id || 'game'}`;
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { /* private window: the badge just starts over */ }
  const keep = () => { try { localStorage.setItem(key, JSON.stringify([...seen])); } catch { /* ignore */ } };
  const paper = (d) => manifest.docStyle === 'paper' || d.paper;
  const entries = () => {
    const st = ctx.state, out = [];
    for (const id of st.docsRead) { const d = docs.find((x) => x.id === id); if (d) out.push({ id: `doc:${id}`, kind: '書きもの', title: d.title, img: d.photo, room: d.room, d }); }
    for (const id of st.inv) { const it = items.find((x) => x.id === id); if (it && it.read) out.push({ id: `item:${id}`, kind: '手紙・書きつけ', title: it.name, img: it.photo, room: it.room, it }); }
    return out.reverse();   // newest first (docs and letters each in the order they were got)
  };
  const open = (e) => {
    seen.add(e.id); keep();
    const html = e.d
      ? (paper(e.d) ? paperDocHtml(e.d, { feeling: false }) : viewItemHtml({ photo: e.d.photo, title: e.d.title, text: e.d.text }))
      : viewItemHtml({ photo: e.it.photo, title: e.it.name, text: e.it.read, feeling: e.it.feeling });
    if (tm && tm.isOpen) tm.close();
    const back = () => { setTimeout(() => { if (ctx.state.started && !ctx.state.ended && tm && !tm.isOpen && !(ctx.blockers || []).some((f) => f())) tm.open('reads'); }, 120); };
    if (bus && bus.once) bus.once('reader:close', back);
    lane.push({ kind: 'card', cls: `tl-lookcard tl-photocard tl-read${e.it ? ' tl-letter' : ' tl-docread'}`, key: `reread:${e.id}`, html });
  };
  const memo = () => {
    const now = ctx.nextTask ? ctx.nextTask() : null, done = ctx.state.tasks.map((id) => tasks.find((t) => t.id === id)).filter((t) => t && t.meaning && !t.optional);
    const past = done.slice(-10).reverse();
    return `${now ? `<div class="gf-memo-now"><p><b>いま：</b>${em(now.title)}</p>${now.meaning ? `<p class="gf-memo-why"><b>なぜ：</b>${em(now.meaning)}</p>` : ''}</div>` : ''}`
      + (past.length ? `<h3>ここまでにしたこと（なぜ、したか）</h3><ol class="gf-memo-past">${past.map((t) => `<li><b>${em(t.title)}</b> … ${em(t.meaning)}</li>`).join('')}</ol>` : '');
  };
  return {
    id: 'reads', label: '覚え書き・読んだもの', icon: 'book', after: 'tasks',
    badge: () => entries().filter((e) => !seen.has(e.id)).length,
    render: (host) => {
      const list = entries();
      host.innerHTML = `<div class="gf-reads"><h3>覚え書き</h3>${memo() || '<p>まだ、何もしていない。</p>'}<h3>読んだもの（押すと、もう一度読める）</h3>${list.length ? `<ul class="gf-read-list">${list.map((e, i) => `<li><button type="button" class="btn gf-read-open" data-i="${i}">${e.img ? `<img src="${esc(e.img)}" alt="">` : ''}<span>${esc(e.title)}<span class="gf-read-kind">${esc(e.kind)}${e.room ? `・${esc(roomName(e.room))}` : ''}</span></span>${seen.has(e.id) ? '' : '<i class="gf-read-new">NEW</i>'}</button></li>`).join('')}</ul>` : '<p>まだ、何も読んでいない。</p>'}</div>`;
      host.querySelectorAll('.gf-read-open').forEach((b) => b.addEventListener('click', () => open(list[+b.dataset.i])));
    },
    open: (id) => { const e = entries().find((x) => x.id === id); if (e) open(e); },
    entries,
  };
}
