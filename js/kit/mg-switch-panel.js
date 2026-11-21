/* game-kit 10af67dd: js/mg-switch-panel.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "switch-panel" (standard 1.8.4: a breaker panel, the lanterns of a shrine path, the lamps of a control board): every
// switch flips its own lamp and the lamps next to it; light them all. The panel is scrambled from all-on by real presses, so it can always be
// solved (pressing the same switches again). Click / tap, or Tab / Enter.
//   cfg: title, help, n (3), presses (4), seed (6), look: 'lamp' (default) | 'lantern', ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'click' | 'ok'
import { mgFrame, rng } from './mg-frame.js';

/** press switch i: it and its neighbours flip */
export function press(board, i, n) { const b = board.slice(), r = Math.floor(i / n), c = i % n; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < n && cc < n) b[rr * n + cc] = !b[rr * n + cc]; } return b; }
export const switchPanelOk = (board) => board.every(Boolean);
/** a scrambled board and the presses that made it (distinct switches, never already solved) */
export function scramble(n = 3, k = 4, seed = 6) {
  const r = rng(seed), picks = [];
  while (picks.length < k) { const i = Math.floor(r() * n * n); if (!picks.includes(i)) picks.push(i); }
  let b = Array(n * n).fill(true); for (const i of picks) b = press(b, i, n);
  return { board: b, presses: picks };
}

export default {
  type: 'switch-panel',
  about: 'となりの灯りも一緒に切り替わるスイッチで、すべての灯りをつける',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const n = cfg.n ?? 3, snd = (k) => hooks.sound && hooks.sound(k, ctx);
      let board = scramble(n, cfg.presses ?? 4, cfg.seed ?? 6).board, count = 0;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '灯りをつける', help: cfg.help || 'スイッチを押すと、その灯りと上下左右の灯りが切り替わります。すべての灯りをつけてください。' }, done);
      f.body.innerHTML = `<div class="mgx-switch mgx-switch--${cfg.look || 'lamp'}" style="--n:${n}">${board.map((_, i) => `<button type="button" class="mgx-sw" data-i="${i}"><i class="mgx-sw-lamp"></i><span class="mgx-sw-tog"></span></button>`).join('')}</div>`;
      const btns = [...f.body.querySelectorAll('.mgx-sw')];
      const draw = () => { btns.forEach((b, i) => { b.classList.toggle('lit', board[i]); b.setAttribute('aria-label', `スイッチ ${i + 1}（灯り${board[i] ? 'あり' : 'なし'}）`); }); f.progress(board.filter(Boolean).length, n * n); };
      f.body.querySelector('.mgx-switch').addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]'); if (!b || f.done) return;
        board = press(board, +b.dataset.i, n); count++; snd('click'); draw();
        b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip');
        if (switchPanelOk(board)) { snd('ok'); f.say(cfg.ok || 'すべての灯りがついた。'); f.win(800); }
        else if (count % 12 === 0) f.say('同じスイッチを二度押すと、元に戻ります。');
      });
      draw();
      if (ctx.qa) return f.end(true);
      btns[0].focus();
    });
  },
};
