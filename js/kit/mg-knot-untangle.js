/* game-kit 10af67dd: js/mg-knot-untangle.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "knot-untangle" (結び目・絡んだ紐, standard 1.24.0: the red threads of a curse, hair wound round nails, mizuhiki cords on an
// offering). Pins hold the cords; drag the pins until no cord crosses another. Crossed cords pull tight and darken; free ones go slack. Made
// from a seed out of an untangled board that was then thrown into a ring, so it can always be undone. When it takes long, the pin with the most
// crossings is shown, then a few pins go back to where they belong.
//   cfg: title, help, n (8 pins), seed (4), look ('thread' | 'hair' | 'mizuhiki'), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'pick' | 'put' | 'join' | 'ok'
//   play scripts: host.mgSolve() puts every pin where it belongs (the board's own untangled layout)
import { mgFrame } from './mg-frame.js';
import { stageLayout, loop, solved, solvable, clamp, rng, shuffled, calmOf } from './mg-stage.js';

const cross = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
/** the rule (pure): which edges cross (edges that share a pin do not count) */
export function crossings(pts, edges) {
  const out = [];
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const [a, b] = edges[i], [c, d] = edges[j];
    if (a === c || a === d || b === c || b === d) continue;
    if (cross(pts[a], pts[b], pts[c], pts[d])) out.push([i, j]);
  }
  return out;
}
/** a board (pure, seeded): pins in an untangled layout, cords that never cross there, and the tangled start */
export function makeKnot(seed = 4, n = 8) {
  const r = rng(seed), home = [];
  for (let k = 0; home.length < n && k < 4000; k++) { const p = { x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.8 }; if (home.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.22)) home.push(p); }
  while (home.length < n) home.push({ x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.8 });
  const pairs = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j, Math.hypot(home[i].x - home[j].x, home[i].y - home[j].y)]);
  pairs.sort((a, b) => a[2] - b[2]);
  const edges = [], deg = Array(n).fill(0), want = Math.round(n * 1.5);
  for (const [i, j] of pairs) { if (edges.length >= want) break; if (deg[i] >= 4 || deg[j] >= 4) continue; if (crossings(home, [...edges, [i, j]]).length) continue; edges.push([i, j]); deg[i]++; deg[j]++; }
  let start = null;
  for (let k = 0; k < 30; k++) {
    const ring = shuffled([...Array(n).keys()], r), pts = Array(n);
    ring.forEach((p, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts[p] = { x: 0.5 + Math.cos(a) * 0.38, y: 0.5 + Math.sin(a) * 0.38 }; });
    if (!start || crossings(pts, edges).length > crossings(start, edges).length) start = pts;
    if (crossings(start, edges).length >= Math.ceil(n * 0.75)) break;
  }
  return { home, edges, start };
}
const LOOK = {
  thread: { cord: '#c8282a', tight: '#ff4a3a', pin: '#d8d0c0', bg: '#1a1210' },
  hair: { cord: '#1a1614', tight: '#4a0e0c', pin: '#c8c0b0', bg: '#c8beaa' },
  mizuhiki: { cord: '#c8282a', tight: '#ff5a3a', pin: '#d8b44a', bg: '#1c1814', second: '#f0ece0' },
};

export default {
  type: 'knot-untangle',
  about: '釘に絡んだ紐を、釘を動かしてほどき、どの紐も交わらないようにする',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k) => hooks.sound && hooks.sound(k, ctx), calm = calmOf(ctx);
      const n = clamp(cfg.n || 8, 5, 12), K = makeKnot(cfg.seed ?? 4, n), look = LOOK[cfg.look] ? cfg.look : 'thread', L = LOOK[look];
      const pts = K.start.map((p) => ({ ...p })), E = K.edges;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '絡んだ糸をほどく', help: cfg.help || '釘をつかんで動かし、どの糸も交わらないようにする。' }, done);
      const s = stageLayout(f, `mgx-kn mgx-kn--${look}`, {
        view: '<svg class="mgx-kn-svg" viewBox="0 0 100 100" preserveAspectRatio="none" tabindex="0" aria-label="糸と釘。Space で釘を選び、矢印で動かす"></svg>',
        side: '<p class="mgx-st-line mgx-kn-line" aria-live="polite"></p><button type="button" class="btn mgx-kn-next">次の釘を選ぶ</button>',
      });
      const svg = s.q('svg'), line = s.q('.mgx-kn-line');
      const st = { sel: -1, grab: -1, t: 0, best: Infinity, sinceBest: 0, hint: 0, worst: -1, won: false, lastN: -1 };
      const asp = () => { const r = svg.getBoundingClientRect(); return r.height ? r.width / r.height : 1; };
      const cordPath = (a, b, tight, k) => {
        const A = pts[a], B = pts[b], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, len = Math.hypot(B.x - A.x, B.y - A.y), sag = tight ? 0 : Math.min(0.05, len * 0.12) * (calm ? 1 : 1 + 0.08 * Math.sin(st.t * 1.6 + k));
        if (look === 'hair') { let d = `M${A.x * 100} ${A.y * 100}`; for (let q = 1; q <= 8; q++) { const t = q / 8, w = tight ? 0 : Math.sin(t * Math.PI * 3 + k) * 0.8; d += ` L${(A.x + (B.x - A.x) * t) * 100 + w} ${(A.y + (B.y - A.y) * t + Math.sin(t * Math.PI) * sag) * 100}`; } return d; }
        return `M${A.x * 100} ${A.y * 100} Q${mx * 100} ${(my + sag * 2) * 100} ${B.x * 100} ${B.y * 100}`;
      };
      const render = () => {
        const X = crossings(pts, E), hot = new Set(X.flat()), a = asp(), rx = 2.6 / Math.max(0.6, a), ry = 2.6;
        let out = `<rect width="100" height="100" fill="${L.bg}"/>`;
        if (st.won) out += `<g class="mgx-kn-home"></g>`;
        E.forEach(([p, q], k) => {
          const tight = hot.has(k), d = cordPath(p, q, tight, k);
          out += `<path d="${d}" fill="none" stroke="${tight ? L.tight : L.cord}" stroke-width="${tight ? 1.1 : 0.8}" vector-effect="non-scaling-stroke" class="mgx-kn-cord${tight ? ' tight' : ''}" style="stroke-width:${tight ? 4 : 3}px"/>`;
          if (look === 'mizuhiki') out += `<path d="${d}" fill="none" stroke="${L.second}" vector-effect="non-scaling-stroke" style="stroke-width:1.2px;transform:translate(0.6px,0.6px)"/>`;
          if (look === 'hair') out += `<path d="${d}" fill="none" stroke="${L.cord}" vector-effect="non-scaling-stroke" style="stroke-width:1px;opacity:.6;transform:translate(0.5px,-0.4px)"/>`;
        });
        pts.forEach((p, i) => {
          const sel = i === st.sel, worst = st.hint >= 1 && i === st.worst;
          out += `<ellipse cx="${p.x * 100}" cy="${p.y * 100}" rx="${rx * (sel ? 1.35 : 1)}" ry="${ry * (sel ? 1.35 : 1)}" fill="${L.pin}" stroke="${sel ? '#ffd890' : worst ? '#ff8a5a' : '#2a2420'}" vector-effect="non-scaling-stroke" style="stroke-width:${sel || worst ? 3 : 1.5}px" class="mgx-kn-pin${worst ? ' worst' : ''}"/>`;
        });
        svg.innerHTML = out;
        if (X.length !== st.lastN) { st.lastN = X.length; line.textContent = X.length ? `交わっている所：${X.length}` : 'どの糸も交わっていない。'; }
        return X.length;
      };
      const check = () => {
        const c = render();
        if (c < st.best) { st.best = c; st.sinceBest = 0; }
        if (c === 0 && !st.won) {
          // a pin lying on another cord is still a tangle
          const onCord = pts.some((P, i) => E.some(([a, b]) => { if (a === i || b === i) return false; const A = pts[a], B = pts[b], t = clamp(((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / ((B.x - A.x) ** 2 + (B.y - A.y) ** 2 || 1)); return Math.hypot(A.x + (B.x - A.x) * t - P.x, A.y + (B.y - A.y) * t - P.y) < 0.02; }));
          if (onCord) { line.textContent = '釘が糸の上に乗っている。少しずらす。'; return; }
          st.won = true; st.sel = -1; render(); snd('ok'); f.say(cfg.ok || '糸がほどけた。'); solved(f); f.win(1000);
        }
      };
      const nearest = (x, y) => { let b = -1, bd = Infinity; const a = asp(); pts.forEach((p, i) => { const d = Math.hypot((p.x - x) * a, p.y - y); if (d < bd) { bd = d; b = i; } }); return bd < 0.09 ? b : -1; };
      const at = (e) => { const R = svg.getBoundingClientRect(); return { x: clamp((e.clientX - R.left) / R.width), y: clamp((e.clientY - R.top) / R.height) }; };
      svg.style.touchAction = 'none';
      svg.addEventListener('pointerdown', (e) => { if (st.won) return; const p = at(e), i = nearest(p.x, p.y); if (i < 0) return; e.preventDefault(); st.grab = i; st.sel = i; try { svg.setPointerCapture(e.pointerId); } catch {} snd('pick'); render(); });
      svg.addEventListener('pointermove', (e) => { if (st.grab < 0) return; const p = at(e); pts[st.grab].x = clamp(p.x, 0.04, 0.96); pts[st.grab].y = clamp(p.y, 0.04, 0.96); render(); });
      const drop = () => { if (st.grab < 0) return; st.grab = -1; snd('put'); check(); };
      svg.addEventListener('pointerup', drop); svg.addEventListener('pointercancel', drop);
      const nextPin = () => { if (st.won) return; st.sel = (st.sel + 1) % n; snd('pick'); render(); };
      s.q('.mgx-kn-next').onclick = nextPin;
      f.on('keydown', (e) => {
        if (st.won) return;
        if (e.code === 'Space' && document.activeElement === svg) { e.preventDefault(); nextPin(); return; }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
        if (d && st.sel >= 0) { e.preventDefault(); const k = e.shiftKey ? 0.01 : 0.03; pts[st.sel].x = clamp(pts[st.sel].x + d[0] * k, 0.04, 0.96); pts[st.sel].y = clamp(pts[st.sel].y + d[1] * k, 0.04, 0.96); render(); clearTimeout(st.kt); st.kt = setTimeout(check, 250); }
      });
      // the hints: after a while without progress the worst pin glows; later a few pins go home
      const homeSpot = (i) => K.home[i];
      loop(f, (dt) => {
        if (st.won) return;
        st.t += dt; st.sinceBest += dt;
        if (st.sinceBest > 35 && st.hint === 0) { st.hint = 1; const X = crossings(pts, E), cnt = Array(n).fill(0); for (const [a, b] of X) for (const k of [...E[a], ...E[b]]) cnt[k]++; st.worst = cnt.indexOf(Math.max(...cnt)); f.say('光っている釘が、いちばん多く絡んでいる。'); }
        if (st.sinceBest > 70) {
          st.sinceBest = 36; st.hint = 2;
          const X = crossings(pts, E), cnt = Array(n).fill(0); for (const [a, b] of X) for (const k of [...E[a], ...E[b]]) cnt[k]++;
          const worst = [...cnt.keys()].sort((a, b) => cnt[b] - cnt[a]).slice(0, Math.max(2, Math.ceil(n / 3)));
          // every pin back to the untangled layout keeps the board solvable; a few at a time
          for (const i of worst) Object.assign(pts[i], homeSpot(i));
          f.say('いくつかの釘を、元の場所へ戻した。'); check();
        }
        if (!calm && Math.floor(st.t * 8) !== Math.floor((st.t - dt) * 8)) render();
      });
      solvable(host, () => { pts.forEach((p, i) => Object.assign(p, K.home[i])); check(); }, () => { const R = svg.getBoundingClientRect(); return { pts: pts.map((p) => [R.left + p.x * R.width, R.top + p.y * R.height]), home: K.home.map((p) => [R.left + p.x * R.width, R.top + p.y * R.height]), crossings: crossings(pts, E).length, hint: st.hint, won: st.won, sel: st.sel }; });
      render();
      if (ctx.qa) return f.end(true);
      svg.focus();
    });
  },
};
