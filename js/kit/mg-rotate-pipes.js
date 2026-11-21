/* game-kit 10af67dd: js/mg-rotate-pipes.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "rotate-pipes" (standard 1.8.2: pipes, a water channel, a fuse line): every tile is a piece of pipe; tap it to turn it a
// quarter. Connect the inlet to the outlet with one unbroken run; lit tiles show what is already connected to the inlet. The board is made
// from a solved route and then turned at random, so it always has a solution. Click / tap, or Tab to a tile and Enter / Space.
//   cfg: title, help, w (4), h (3), seed (11), path ([[c, r], ...] the solved route; default a winding one), from / to ({ c, r, side }), ok
//   hooks: { sound(name, ctx) }  name = 'turn' | 'ok'
import { mgFrame } from './mg-frame.js';

// a tile is the set of its open sides as bits: N 1, E 2, S 4, W 8. A quarter turn clockwise moves every bit one step round
export const N = 1, E = 2, S = 4, W = 8;
export const turn = (t, k = 1) => { let v = t; for (let i = 0; i < ((k % 4) + 4) % 4; i++) v = ((v << 1) | (v >> 3)) & 15; return v; };
const OPP = { [N]: S, [S]: N, [E]: W, [W]: E }, STEP = { [N]: [0, -1], [S]: [0, 1], [E]: [1, 0], [W]: [-1, 0] };
const DEF = { w: 4, h: 3, path: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 1], [3, 2]], from: { c: 0, r: 0, side: W }, to: { c: 3, r: 2, side: S } };
const dirTo = (a, b) => (b[0] > a[0] ? E : b[0] < a[0] ? W : b[1] > a[1] ? S : N);

/** the tiles of the solved board (tiles off the route get a random straight or corner as decoys) */
export function solvedTiles({ w, h, path, from, to }, rnd = Math.random) {
  const g = Array.from({ length: h }, () => Array(w).fill(0));
  path.forEach((p, i) => { g[p[1]][p[0]] = (i ? dirTo(p, path[i - 1]) : from.side) | (i < path.length - 1 ? dirTo(p, path[i + 1]) : to.side); });
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (!g[r][c]) g[r][c] = rnd() < 0.5 ? N | S : N | E;
  return g;
}
/** the tiles connected to the inlet (keys r * w + c), through sides open on both tiles */
export function connected(g, from) {
  const h = g.length, w = g[0].length, seen = new Set();
  if (!(g[from.r][from.c] & from.side)) return seen;
  const q = [[from.c, from.r]]; seen.add(from.r * w + from.c);
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of [N, E, S, W]) {
      if (!(g[r][c] & d)) continue;
      const nc = c + STEP[d][0], nr = r + STEP[d][1];
      if (nc < 0 || nr < 0 || nc >= w || nr >= h || seen.has(nr * w + nc) || !(g[nr][nc] & OPP[d])) continue;
      seen.add(nr * w + nc); q.push([nc, nr]);
    }
  }
  return seen;
}
export const rotatePipesOk = (g, from, to) => connected(g, from).has(to.r * g[0].length + to.c) && !!(g[to.r][to.c] & to.side);

export default {
  type: 'rotate-pipes',
  about: '管の向きを回して、始めから終わりまで一本につなぐ',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const spec = { w: cfg.w || DEF.w, h: cfg.h || DEF.h, path: cfg.path || DEF.path, from: cfg.from || DEF.from, to: cfg.to || DEF.to };
      let s = (cfg.seed ?? 11) >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const g = solvedTiles(spec, rnd).map((row) => row.map((t) => turn(t, 1 + Math.floor(rnd() * 3))));
      if (rotatePipesOk(g, spec.from, spec.to)) { const [c, r] = spec.path[0]; g[r][c] = turn(g[r][c], 1); }
      const snd = (k) => hooks.sound && hooks.sound(k, ctx);
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '管をつなぐ', help: cfg.help || '管を押すと右へ四分の一回ります。入口（左上の印）から出口まで、一本につないでください。' }, done);
      f.body.innerHTML = `<div class="mgx-pipes" style="--w:${spec.w}"><div class="mgx-pipes-grid" role="grid" aria-label="管"></div></div>`;
      const el = f.body.querySelector('.mgx-pipes-grid');
      const seg = (t) => [[N, '50,50 50,0'], [E, '50,50 100,50'], [S, '50,50 50,100'], [W, '50,50 0,50']].filter(([d]) => t & d).map(([, p]) => `<polyline points="${p}"/>`).join('');
      const draw = () => {
        const on = connected(g, spec.from);
        el.innerHTML = g.map((row, r) => row.map((t, c) => {
          const io = (spec.from.c === c && spec.from.r === r ? ' in' : '') + (spec.to.c === c && spec.to.r === r ? ' out' : '');
          return `<button type="button" class="mgx-pipe${on.has(r * spec.w + c) ? ' on' : ''}${io}" data-c="${c}" data-r="${r}" aria-label="管 ${r + 1}行 ${c + 1}列"><svg viewBox="0 0 100 100" aria-hidden="true">${seg(t)}<circle cx="50" cy="50" r="9"/></svg></button>`;
        }).join('')).join('');
      };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]'); if (!b || f.done) return;
        const c = +b.dataset.c, r = +b.dataset.r; g[r][c] = turn(g[r][c], 1); snd('turn'); draw();
        el.querySelector(`[data-c="${c}"][data-r="${r}"]`).classList.add('spin');
        el.querySelector(`[data-c="${c}"][data-r="${r}"]`).focus();
        if (rotatePipesOk(g, spec.from, spec.to)) { snd('ok'); f.say(cfg.ok || '一本につながった。'); f.win(700); }
      });
      draw();
      if (ctx.qa) return f.end(true);
      el.querySelector('button').focus();
    });
  },
};
