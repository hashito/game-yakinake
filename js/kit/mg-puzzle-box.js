/* game-kit 10af67dd: js/mg-puzzle-box.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "puzzle-box" (からくり箱・秘密箱, standard 1.24.0: a Hakone secret box left in a dead woman's drawer, an offering box, a box
// that holds a key). The box opens by sliding its panels in one fixed order: a panel moves only when the one before it has moved. Turn the box
// (and turn it over) to see its other faces; tap a panel or drag it the way it slides. A panel that will not move says so; after a few tries
// the box gives a hint (which side to look at, then the panel itself). Made from a seed, so it can always be opened.
//   cfg: title, help, steps (6: panels to slide, the last is the lid), seed (7), inside (what lies inside, '古い鍵'), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'slide' | 'bump' | 'turn' | 'ok'
//   play scripts: host.mgSolve() slides the panels in their order through the same rule
import { mgFrame, esc } from './mg-frame.js';
import { stageLayout, loop, solved, solvable, rng, shuffled, calmOf } from './mg-stage.js';

const W = 2.6, H = 1.7, D = 2;
const FACES = {
  top: { o: [0, H, 0], u: [W, 0, 0], v: [0, 0, D], n: [0, 1, 0], tone: 1 },
  bottom: { o: [0, 0, 0], u: [W, 0, 0], v: [0, 0, D], n: [0, -1, 0], tone: 0.62 },
  front: { o: [0, 0, D], u: [W, 0, 0], v: [0, H, 0], n: [0, 0, 1], tone: 0.82 },
  back: { o: [0, 0, 0], u: [W, 0, 0], v: [0, H, 0], n: [0, 0, -1], tone: 0.82 },
  right: { o: [W, 0, 0], u: [0, 0, D], v: [0, H, 0], n: [1, 0, 0], tone: 0.7 },
  left: { o: [0, 0, 0], u: [0, 0, D], v: [0, H, 0], n: [-1, 0, 0], tone: 0.7 },
};
/** the box (pure, seeded): its panels and the order they slide in (the lid last) */
export function makeBox(seed = 7, steps = 6) {
  const r = rng(seed), panels = [];
  for (const face of ['front', 'back']) for (const k of [0, 1]) panels.push({ face, u: [0.03, 0.97], v: k ? [0.51, 0.97] : [0.03, 0.49], axis: 'u' });
  for (const face of ['left', 'right']) for (const k of [0, 1]) panels.push({ face, u: k ? [0.51, 0.97] : [0.03, 0.49], v: [0.03, 0.97], axis: 'v' });
  for (const k of [0, 1]) panels.push({ face: 'bottom', u: [0.03, 0.97], v: k ? [0.51, 0.97] : [0.03, 0.49], axis: 'u' });
  panels.push({ face: 'top', u: [0.03, 0.97], v: [0.03, 0.97], axis: 'u', lid: true });
  panels.forEach((p) => { p.dir = r() < 0.5 ? -1 : 1; p.amt = 0.2; });
  const lid = panels.length - 1; panels[lid].dir = 1; panels[lid].amt = 0.78;
  const n = Math.max(1, Math.min(panels.length, steps));
  const order = [...shuffled([...Array(lid).keys()], r).slice(0, n - 1), lid];
  return { panels, order };
}
/** the rule (pure): panel i slides only when it is the next one in the order */
export const canSlide = (order, moved, i) => order[moved] === i;

export default {
  type: 'puzzle-box',
  about: '秘密箱の板を決まった順に滑らせて開ける。箱を回して全部の面を見る',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k) => hooks.sound && hooks.sound(k, ctx), calm = calmOf(ctx);
      const box = makeBox(cfg.seed ?? 7, cfg.steps ?? 6), P = box.panels, order = box.order;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '秘密箱を開ける', help: cfg.help || '動く板を探して、押すか滑らせる。板は決まった順にしか動かない。箱は回して裏も見られる。' }, done);
      const s = stageLayout(f, 'mgx-pb', {
        view: '<svg class="mgx-pb-svg" tabindex="-1" aria-label="秘密箱"></svg>',
        side: `<p class="mgx-st-line mgx-pb-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-pb-l" aria-label="箱を左へ回す">⟲ 回す</button><button type="button" class="btn mgx-pb-flip">裏返す</button><button type="button" class="btn mgx-pb-r" aria-label="箱を右へ回す">回す ⟳</button></div>`,
      });
      const svg = s.q('svg'), line = s.q('.mgx-pb-line');
      const st = { yaw: 0, flip: false, moved: 0, fails: 0, hint: 0, anim: P.map(() => 0), open: false, focus: -1, wig: -1 };
      const tf = ([x, y, z]) => { if (st.flip) { y = H - y; z = D - z; } const cx = x - W / 2, cz = z - D / 2, a = (st.yaw * Math.PI) / 2, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a)); return [cx * c - cz * sn, y - H / 2, cx * sn + cz * c]; };
      const tn = ([x, y, z]) => { if (st.flip) { y = -y; z = -z; } const a = (st.yaw * Math.PI) / 2, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a)); return [x * c - z * sn, y, x * sn + z * c]; };
      const pr = (p) => { const [x, y, z] = tf(p); return [(x - z) * 0.866, (x + z) * 0.5 - y]; };
      const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
      const seen = (face) => { const n = tn(FACES[face].n); return n[0] + n[1] + n[2] > 0.01; };
      const quad = (F, u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([a, b]) => pr(add(add(F.o, F.u, a), F.v, b)));
      const pts = (q) => q.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(' ');
      const shade = (tone, k = 0) => { const base = [[150, 104, 62], [120, 78, 44], [176, 132, 84]][k % 3]; return `rgb(${base.map((v) => Math.round(v * tone)).join(',')})`; };
      const panelQuad = (i) => {
        const p = P[i], F = FACES[p.face], sl = p.dir * p.amt * st.anim[i];
        return p.axis === 'u' ? quad(F, p.u[0] + sl, p.u[1] + sl, p.v[0], p.v[1]) : quad(F, p.u[0], p.u[1], p.v[0] + sl, p.v[1] + sl);
      };
      const render = () => {
        const faces = Object.keys(FACES).filter(seen);
        let out = '';
        for (const fn of faces) {
          const F = FACES[fn];
          out += `<polygon class="mgx-pb-face" points="${pts(quad(F, 0, 1, 0, 1))}" fill="${shade(F.tone * 0.45)}"/>`;
          for (const i of P.keys()) if (P[i].face === fn && st.anim[i] > 0) out += `<polygon class="mgx-pb-gap" points="${pts(quad(F, P[i].u[0], P[i].u[1], P[i].v[0], P[i].v[1]))}"/>`;
        }
        if (st.open) { const F = FACES.top; if (seen('top')) { const c = pr(add(add(F.o, F.u, 0.5), F.v, 0.5)); out += `<text class="mgx-pb-inside" x="${c[0].toFixed(2)}" y="${c[1].toFixed(2)}">${esc(cfg.inside || '古い鍵')}</text>`; } }
        for (const fn of faces) {
          const F = FACES[fn];
          for (const i of P.keys()) {
            if (P[i].face !== fn) continue;
            const q = panelQuad(i), p = P[i], hint = st.hint >= 2 && order[st.moved] === i;
            // yosegi: three wood tones in strips along the panel
            const grain = [0.25, 0.5, 0.75].map((t) => { const a = p.axis === 'u' ? quad(F, p.u[0] + p.dir * p.amt * st.anim[i], p.u[1] + p.dir * p.amt * st.anim[i], p.v[0] + (p.v[1] - p.v[0]) * t, p.v[0] + (p.v[1] - p.v[0]) * t) : quad(F, p.u[0] + (p.u[1] - p.u[0]) * t, p.u[0] + (p.u[1] - p.u[0]) * t, p.v[0] + p.dir * p.amt * st.anim[i], p.v[1] + p.dir * p.amt * st.anim[i]); return `<line x1="${a[0][0].toFixed(3)}" y1="${a[0][1].toFixed(3)}" x2="${a[2][0].toFixed(3)}" y2="${a[2][1].toFixed(3)}"/>`; }).join('');
            out += `<g class="mgx-pb-panel${hint ? ' hint' : ''}${st.wig === i ? ' wig' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${p.lid ? 'ふた' : '板'}"><polygon points="${pts(q)}" fill="${shade(F.tone, i)}"/><g class="mgx-pb-grain">${grain}</g></g>`;
          }
        }
        // the view box: the box with room for a slid panel
        const cs = []; for (const x of [-0.3, W + 0.3]) for (const y of [0, H]) for (const z of [-0.3, D + 0.3]) cs.push(pr([x, y, z]));
        const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]), m = 0.15;
        svg.setAttribute('viewBox', `${(Math.min(...xs) - m).toFixed(2)} ${(Math.min(...ys) - m - (st.open ? 0.3 : 0)).toFixed(2)} ${(Math.max(...xs) - Math.min(...xs) + m * 2).toFixed(2)} ${(Math.max(...ys) - Math.min(...ys) + m * 2 + (st.open ? 0.3 : 0)).toFixed(2)}`);
        svg.innerHTML = out;
        if (st.focus >= 0) { const g = svg.querySelector(`[data-i="${st.focus}"]`); if (g && document.activeElement !== g && f.root.contains(document.activeElement) && document.activeElement.closest('svg')) g.focus({ preventScroll: true }); }
      };
      const say = (t) => { line.textContent = t; };
      const attempt = (i, dirOk = true) => {
        if (f.done || st.open) return;
        if (canSlide(order, st.moved, i)) {
          if (!dirOk) { say('わずかに動いた。反対の向きへ滑らせる。'); snd('bump'); return; }
          const p = P[i]; p.moved = true; st.moved++; st.fails = 0; st.hint = 0; snd('slide');
          if (calm) st.anim[i] = 1; else st.anim[i] = 0.001;
          f.progress(st.moved, order.length);
          if (p.lid) { st.open = true; say(`ふたが開いた。中に${cfg.inside || '古い鍵'}。`); f.say(cfg.ok || '箱が開いた。'); snd('ok'); solved(f); f.win(1100); }
          else say(`動いた。（${st.moved} / ${order.length}）次の板を探す。`);
          render(); return;
        }
        st.fails++; st.wig = i; snd('bump'); setTimeout(() => { st.wig = -1; render(); }, 380);
        if (st.fails >= 4) st.hint = Math.max(st.hint, 1);
        if (st.fails >= 7) st.hint = 2;
        const next = P[order[st.moved]];
        if (st.hint === 0) say(P[i].lid ? 'ふたはまだ動かない。' : '動かない。かたい。');
        else if (!seen(next.face)) say('いま見えていない面のどこかが、少し浮いている。箱を回すか裏返す。');
        else say(st.hint >= 2 ? '光っている板を押してみる。' : 'いま見えている面のどこかが、少し浮いている。');
        render();
      };
      // tap = try the panel the way it slides; a drag = try it that way
      let down = null;
      svg.addEventListener('pointerdown', (e) => { const g = e.target.closest('[data-i]'); if (!g) return; down = { i: +g.dataset.i, x: e.clientX, y: e.clientY }; st.focus = down.i; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch {} });
      svg.addEventListener('pointerup', (e) => {
        if (!down) return; const d = down; down = null;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) < 10) return attempt(d.i, true);
        const p = P[d.i], F = FACES[p.face], o = add(add(F.o, F.u, 0.5), F.v, 0.5), to = add(o, p.axis === 'u' ? F.u : F.v, p.dir * 0.1), a = pr(o), b = pr(to);
        const ctm = svg.getScreenCTM(), sx = (b[0] - a[0]) * (ctm ? ctm.a : 1), sy = (b[1] - a[1]) * (ctm ? ctm.d : 1);
        attempt(d.i, dx * sx + dy * sy > 0);
      });
      svg.addEventListener('keydown', (e) => { const g = e.target.closest && e.target.closest('[data-i]'); if (g && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); st.focus = +g.dataset.i; attempt(st.focus); } });
      svg.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('[data-i]'); if (g) st.focus = +g.dataset.i; });
      const turn = (k) => { if (st.open) return; st.yaw = (st.yaw + k + 4) % 4; snd('turn'); render(); say(`箱を回した。${seen('bottom') ? '底が見えている。' : ''}`); };
      const flip = () => { if (st.open) return; st.flip = !st.flip; snd('turn'); render(); say(st.flip ? '裏返した。底が上になった。' : '表に戻した。'); };
      s.q('.mgx-pb-l').onclick = () => turn(-1); s.q('.mgx-pb-r').onclick = () => turn(1); s.q('.mgx-pb-flip').onclick = flip;
      f.on('keydown', (e) => {
        if (f.done) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); turn(-1); }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); turn(1); }
        else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); flip(); }
      });
      loop(f, (dt) => { let ch = false; P.forEach((p, i) => { if (st.anim[i] > 0 && st.anim[i] < 1) { st.anim[i] = Math.min(1, st.anim[i] + dt / 0.35); ch = true; } }); if (ch) render(); });
      solvable(host, () => { while (!st.open) { const i = order[st.moved]; st.anim[i] = 1; attempt(i, true); P.forEach((_, k) => { if (P[k].moved) st.anim[k] = 1; }); } render(); }, () => ({ next: order[st.moved], nextFace: P[order[st.moved]] && P[order[st.moved]].face, seen: Object.keys(FACES).filter(seen), moved: st.moved, fails: st.fails, hint: st.hint, open: st.open, yaw: st.yaw, flip: st.flip, faceOf: P.map((p) => p.face), dir: P.map((p) => p.dir), axis: P.map((p) => p.axis) }));
      f.progress(0, order.length);
      say('箱のどこかの板が動く。');
      render();
      if (ctx.qa) return f.end(true);
      const first = svg.querySelector('[data-i]'); if (first) first.focus({ preventScroll: true });
    });
  },
};
