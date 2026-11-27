// 1.8.0 (2026-11-27 #3 「各ゾンビの設定とゾンビ化した経緯を作って、クリア後に確認できるように」): the 記録 - after any ending (on this
// browser), the title and the menu get a 記録 button. It opens the list of everyone the night turned, place by place: the name, the age and
// the work they had, how their body moves now (its kind and its moves, with the tell of each), and how they turned. The ones this run has
// laid down are marked. Before an ending the button is not there (the profiles tell what happens on the way).
import { SPAWNS } from './spawns.js';
import { KINDS, MOVES, PROFILES, profileOf } from './profiles.js';

const KEY = 'yakinake.records';
const PLACES = [
  { k: 'H', name: '灯ヶ浦市民病院' }, { k: 'S', name: '夜の街' }, { k: 'P', name: '灯ヶ浦警察署' }, { k: 'O', name: '臨港セントラルビル' }, { k: 'R', name: '屋上' },
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function installBestiary(ext, G) {
  let ctx = null;
  const open = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const unlock = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ } paintTitle(); };
  G.recordsOpen = open;
  // the list: every spawn with a profile (the roof's big one once), in the order of the night
  const people = () => {
    const out = [], seen = new Set();
    for (const d of SPAWNS) {
      if (d.state === 'corpse' || !PROFILES[d.id] || seen.has(d.id)) continue;
      seen.add(d.id); const block = d.room === 'O_ROOF' ? 'R' : d.room === 'O_PLAZA' ? 'P' : d.room.charAt(0);
      out.push({ ...profileOf(d), block });
    }
    out.push({ ...PROFILES.ROOF_GIANT, id: 'ROOF_GIANT', block: 'R' });
    return out;
  };
  const card = (P) => {
    const K = KINDS[P.kind] || KINDS.slow, down = G.killed && G.killed.has(P.id);
    const moves = (P.moves || []).map((m) => `<li><b>${esc(MOVES[m].name)}</b><span>予兆：${esc(MOVES[m].tell)}</span><span>${esc(MOVES[m].text)}</span></li>`).join('');
    const who = [P.age ? `${P.age} 歳` : '', P.job].filter(Boolean).join('・');
    return `<article class="yk-rec${down ? ' down' : ''}"><h4>${esc(P.n || '名前の分からない人')}${down ? '<em>倒した</em>' : ''}</h4><p class="yk-rec-who">${esc(who)}</p>
      <p class="yk-rec-kind"><b>${esc(K.name)}</b>${esc(K.text)}</p>${moves ? `<ul class="yk-rec-moves">${moves}</ul>` : '<p class="yk-rec-none">特別な動きはない。歩いて、噛む。</p>'}
      <p class="yk-rec-how">${esc(P.how)}</p></article>`;
  };
  const render = (el) => {
    const all = people();
    el.innerHTML = `<div class="yk-records"><p class="yk-rec-lead">この夜に変わってしまった人たちの記録。${all.length} 人。どう動くか、どうしてそうなったか。</p>
      <nav class="yk-rec-tabs">${PLACES.map((p, i) => `<button type="button" class="btn${i ? '' : ' on'}" data-place="${p.k}">${esc(p.name)}</button>`).join('')}</nav><div class="yk-rec-list"></div></div>`;
    const list = el.querySelector('.yk-rec-list');
    const show = (k) => { list.innerHTML = all.filter((P) => P.block === k).map(card).join(''); list.scrollTop = 0; el.querySelectorAll('[data-place]').forEach((b) => b.classList.toggle('on', b.dataset.place === k)); };
    el.querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => show(b.dataset.place)));
    show('H');
  };
  G.openRecords = () => { if (!ctx) return false; ctx.wm.open('yk-records', { title: '記録　変わってしまった人たち', size: 'l', render }); return true; };
  G.recordsCount = () => people().length;

  let tBtn = null;
  function paintTitle() {
    const host = document.getElementById('title-extra'); if (!host) return;
    if (!open()) { if (tBtn) tBtn.remove(); tBtn = null; return; }
    if (tBtn && tBtn.isConnected) return;
    tBtn = document.createElement('button'); tBtn.type = 'button'; tBtn.className = 'btn yk-rec-btn'; tBtn.textContent = '記録';
    tBtn.onclick = (e) => { e.stopPropagation(); G.openRecords(); };
    host.append(tBtn);
  }
  ext.on('game:ready', (c) => {
    ctx = c;
    if (!open() && c.foundEndings && c.foundEndings().length) unlock();   // a player who cleared before 1.8.0
    paintTitle();
  });
  ext.on('ending:reach', () => unlock());
  // the menu: a 記録 button under the case (js/ext/case.js calls this)
  G.recordsButton = (pm) => {
    if (!open()) return '';
    setTimeout(() => { const b = document.querySelector('[data-open-records]'); if (b) b.onclick = () => { pm.close(); setTimeout(() => G.openRecords(), 0); }; }, 0);
    return '<button type="button" class="pm-item yk-pm-rec" data-open-records>記録（変わってしまった人たち）</button>';
  };
}
