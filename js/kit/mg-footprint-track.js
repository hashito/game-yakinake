/* game-kit e962dd12: js/mg-footprint-track.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "footprint-track" (足跡を追う, standard 1.24.0: dust on the floor of a closed ward, snow round a mountain hut, ash in a
// burnt house). A flashlight shows a little of the floor at a time. Follow the prints whose sole matches the clue (a heel worn away, a bare
// foot, a child's foot). Where the tracks part, light them, compare the soles and follow one: a wrong track runs out and loops back to the
// fork (nothing is lost). The last print stops at a wall - or turns round to face the one following it.
//   cfg: title, help, clue ('worn' | 'shoe' | 'bare' | 'child' | 'geta' | 'slipper'), clueText (the line on the clue card), branches (3),
//        seed (12), floor ('dust' | 'snow'), end ('wall' | 'back'), ok, skin, stamp
//   hooks: { sound(name, ctx, v) }  name = 'step' | 'wrong' | 'found' | 'heard' | 'ok'
//   play scripts: host.mgSolve() follows the matching track at every fork through the same rule
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, drag, loop, solved, solvable, clamp, rng, shuffled, calmOf } from './mg-stage.js';

export const SOLES = ['shoe', 'worn', 'bare', 'child', 'geta', 'slipper'];
const CLUE = { worn: 'かかとの欠けた靴', shoe: '大きな革靴', bare: '大人の素足', child: '子どもの素足', geta: '下駄', slipper: '病院のスリッパ' };
/** the rule (pure): a track is the one to follow when its sole is the clue's */
export const trackOk = (sole, clue) => sole === clue;
const bez = (a, b, c, n = 24) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; });
/** the floor's tracks (pure, seeded): forks, the right way and the dead ends that loop back */
export function makeTracks(seed = 12, branches = 3, clue = 'worn') {
  const r = rng(seed), others = SOLES.filter((s) => s !== clue), forks = [];
  let at = [0, 0];
  const lead = bez(at, [0.02, -0.35], [0, -0.7]); at = [0, -0.7];
  for (let j = 0; j < branches; j++) {
    const m = r() < 0.5 ? 2 : 3, fan = m === 2 ? [-38, 38] : [-55, 0, 55], right = Math.floor(r() * m), soles = shuffled(others, r);
    const opts = fan.map((deg, o) => {
      const a = (deg * Math.PI) / 180, d = [Math.sin(a), -Math.cos(a)], b1 = [at[0] + d[0] * 0.42, at[1] + d[1] * 0.42];
      if (o === right) { const next = [clamp(b1[0] + d[0] * 0.25, -0.9, 0.9), b1[1] - 0.5]; return { sole: clue, ok: true, path: bez(at, b1, next), to: next }; }
      const e = [b1[0] + d[0] * 0.28, b1[1] + d[1] * 0.28], side = [-d[1], d[0]];
      const back = bez(e, [e[0] + side[0] * 0.3 - d[0] * 0.1, e[1] + side[1] * 0.3 - d[1] * 0.1], [at[0] + side[0] * 0.08, at[1] + side[1] * 0.08 + 0.04]);
      return { sole: soles[o % soles.length], ok: false, path: bez(at, b1, e, 16), back, end: e };
    });
    forks.push({ at, opts });
    at = opts[right].to;
  }
  const last = bez(at, [at[0] - 0.1, at[1] - 0.3], [at[0], at[1] - 0.55]);
  return { lead, forks, last, end: [at[0], at[1] - 0.55] };
}
/** footprints along a path: [x, y, angle, left?] every `gap` units */
function prints(path, gap = 0.085) {
  const out = []; let pos = 0, next = gap * 0.4, side = 1;
  for (let k = 1; k < path.length; k++) {
    const [x0, y0] = path[k - 1], [x1, y1] = path[k], L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
    while (next <= pos + L) { const t = (next - pos) / (L || 1); out.push([x0 + (x1 - x0) * t + nx * 0.022 * side, y0 + (y1 - y0) * t + ny * 0.022 * side, a, side > 0]); side = -side; next += gap; }
    pos += L;
  }
  return out;
}
/** one sole, drawn at the origin pointing along +x, length s px */
export function drawSole(g, sole, s, left, tread = 'rgba(170,160,150,0.6)') {
  const m = left ? -1 : 1;
  g.beginPath();
  if (sole === 'shoe' || sole === 'worn') {
    g.ellipse(s * 0.16, 0, s * 0.34, s * 0.17, 0, 0, Math.PI * 2); g.fill();
    if (sole === 'shoe') { g.beginPath(); g.ellipse(-s * 0.36, 0, s * 0.13, s * 0.14, 0, 0, Math.PI * 2); g.fill(); }
    g.save(); g.strokeStyle = tread; g.lineWidth = Math.max(1, s * 0.04); for (let k = -1; k <= 2; k++) { g.beginPath(); g.moveTo(s * (0.05 + k * 0.1), -s * 0.12); g.lineTo(s * (0.05 + k * 0.1), s * 0.12); g.stroke(); } g.restore();
  } else if (sole === 'bare' || sole === 'child') {
    const k = sole === 'child' ? 0.68 : 1;
    g.ellipse(0, 0, s * 0.34 * k, s * 0.13 * k, 0, 0, Math.PI * 2); g.fill();
    for (let t = 0; t < 5; t++) { g.beginPath(); g.arc(s * 0.38 * k, m * (t - 1.6) * s * 0.055 * k, s * (t === 0 ? 0.05 : 0.035) * k, 0, Math.PI * 2); g.fill(); }
  } else if (sole === 'geta') {
    g.rect(s * 0.12, -s * 0.15, s * 0.1, s * 0.3); g.rect(-s * 0.3, -s * 0.15, s * 0.1, s * 0.3); g.fill();
  } else {
    g.ellipse(0, 0, s * 0.42, s * 0.16, 0, 0, Math.PI * 2); g.fill();
  }
}

export default {
  type: 'footprint-track',
  about: '懐中電灯で床の足跡を照らし、手がかりと同じ靴底の跡を分かれ道ごとに選んで追う',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), calm = calmOf(ctx);
      const clue = SOLES.includes(cfg.clue) ? cfg.clue : 'worn', T = makeTracks(cfg.seed ?? 12, cfg.branches ?? 3, clue), snow = cfg.floor === 'snow';
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '足跡を追う', help: cfg.help || `灯りで床を照らし、${cfg.clueText || CLUE[clue]}の跡を選んで追う。分かれ道では靴底を見比べる。` }, done);
      const s = stageLayout(f, 'mgx-fp', {
        view: '<canvas class="mgx-fp-cv" tabindex="0" aria-label="暗い床。矢印で灯りを動かし、Enter で照らした足跡を追う"></canvas>',
        side: `<div class="mgx-fp-clue"><canvas width="96" height="48" aria-hidden="true"></canvas><span>探す跡：${cfg.clueText || CLUE[clue]}</span></div><p class="mgx-st-line mgx-fp-line" aria-live="polite"></p><button type="button" class="btn primary mgx-fp-go">照らした跡を追う</button>`,
      });
      const cv = s.q('.mgx-fp-cv'), line = s.q('.mgx-fp-line');
      { const c = s.q('.mgx-fp-clue canvas').getContext('2d'); c.fillStyle = '#e8e0d0'; c.fillRect(0, 0, 96, 48); c.fillStyle = '#2a2420'; c.save(); c.translate(48, 24); drawSole(c, clue, 70, false, '#e8e0d0'); c.restore(); }
      // every track's prints, once
      const P = (path, sole, tag) => prints(path).map(([x, y, a, l]) => ({ x, y, a, l, sole, tag }));
      const all = [...P(T.lead, clue, 'lead')];
      T.forks.forEach((fk, j) => fk.opts.forEach((o, k) => { o.prints = P(o.path, o.sole, `f${j}o${k}`); all.push(...o.prints); if (o.back) all.push(...P(o.back, o.sole, `f${j}b${k}`)); }));
      const lastPr = P(T.last, clue, 'last'); all.push(...lastPr);
      if ((cfg.end || 'back') === 'back') { const q = lastPr[lastPr.length - 1], q2 = lastPr[lastPr.length - 2]; if (q && q2) { q.a += Math.PI; q2.a += Math.PI; q.turned = q2.turned = true; } }
      const st = { pos: [0, 0], node: -1, walk: null, light: [0, -0.32], cam: [0, -0.25], misses: 0, seen: new Set(), done: false, t: 0, stepT: 0, said: '' };
      const say = (t) => { if (st.said !== t) { st.said = t; line.textContent = t; } };
      const scale = () => ui.h / 1.15;
      const toWorld = (x, y) => { const k = scale(); return [st.cam[0] + (x - ui.w / 2) / k, st.cam[1] + (y - ui.h / 2) / k]; };
      const options = () => (st.node < 0 ? [{ path: T.lead, prints: all.filter((p) => p.tag === 'lead'), sole: clue, ok: true, lead: true }] : st.node < T.forks.length ? T.forks[st.node].opts : [{ path: T.last, prints: lastPr, sole: clue, ok: true, last: true }]);
      const lightW = () => [st.pos[0] + st.light[0], st.pos[1] + st.light[1]];
      const R = 0.3;
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, k = scale(), w = ui.w, h = ui.h, L = lightW();
        const sx = (x) => w / 2 + (x - st.cam[0]) * k, sy = (y) => h / 2 + (y - st.cam[1]) * k;
        g.fillStyle = snow ? '#c8ccd4' : '#6a5e50'; g.fillRect(0, 0, w, h);
        if (!snow) { g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = 1; const y0 = Math.floor((st.cam[1] - 1) / 0.12) * 0.12; for (let y = y0; y < st.cam[1] + 1; y += 0.12) { g.beginPath(); g.moveTo(0, sy(y)); g.lineTo(w, sy(y)); g.stroke(); } }
        // the end: a wall across the corridor beyond the last print
        const E = T.end; g.fillStyle = snow ? '#3a3e48' : '#2a2420'; g.fillRect(0, 0, w, Math.max(0, sy(E[1] - 0.16)));
        // the prints, seen only in the light
        const hint = st.misses >= 2 && st.node >= 0 && st.node < T.forks.length && !st.walk;
        for (const p of all) {
          const d = Math.hypot(p.x - L[0], p.y - L[1]); if (d > R * 1.05) continue;
          const a = clamp(1 - d / R) ** 0.7;
          g.save(); g.translate(sx(p.x), sy(p.y)); g.rotate(p.a);
          g.fillStyle = snow ? `rgba(70,90,130,${0.75 * a})` : `rgba(28,22,16,${0.8 * a})`;
          drawSole(g, p.sole, 0.075 * k, p.l, snow ? 'rgba(200,205,215,0.7)' : 'rgba(110,98,84,0.75)');
          g.restore();
        }
        if (hint) { const o = T.forks[st.node].opts.find((q) => q.ok); g.strokeStyle = 'rgba(255,210,140,0.7)'; g.lineWidth = 2; for (const p of o.prints.slice(0, 3)) { g.beginPath(); g.arc(sx(p.x), sy(p.y), 0.06 * k, 0, Math.PI * 2); g.stroke(); } }
        // the dark, with the light's circle cut in it
        const grd = g.createRadialGradient(sx(L[0]), sy(L[1]), R * k * 0.15, sx(L[0]), sy(L[1]), R * k);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(4,3,2,0.96)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        // the one following (you), a small figure at the bottom of the light's beam
        g.fillStyle = '#e8d8a8'; g.beginPath(); g.arc(sx(st.pos[0]), sy(st.pos[1]), 5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,240,190,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx(st.pos[0]), sy(st.pos[1])); g.lineTo(sx(L[0]), sy(L[1])); g.stroke();
      }
      const walk = (path, then) => { st.walk = { path, k: 0, then }; };
      const follow = (o) => {
        if (st.walk || st.done) return;
        snd('step', 0.3);
        if (o.lead) { say('足跡をたどる。'); walk(o.path, () => { st.node = 0; arrive(); }); return; }
        if (o.last) { say('最後の足跡をたどる。'); walk(o.path, () => finish()); return; }
        if (trackOk(o.sole, clue)) { say('この跡だ。たどる。'); walk(o.path, () => { st.node++; arrive(); }); return; }
        walk(o.path, () => {
          st.misses++; snd('wrong'); f.miss(); say('跡が途切れた……と思ったら、ぐるりと元へ戻っている。');
          f.say(`違う跡だった。${st.misses >= 2 ? '分かれ道で、合う跡の始まりを光らせる。' : '靴底の形を見比べる。'}`);
          walk(o.back, () => { st.pos = [...T.forks[st.node].at]; st.light = [0, -0.32]; say('分かれ道に戻った。'); });
        });
      };
      const arrive = () => {
        st.light = [0, -0.32]; f.progress(Math.min(st.node, T.forks.length), T.forks.length);
        if (st.node < T.forks.length) { const m = T.forks[st.node].opts.length; say(`分かれ道。跡が ${m} 本ある。照らして見比べる。`); snd('found'); }
        else say('分かれ道を抜けた。跡はまだ続く。');
      };
      const finish = () => {
        st.done = true; snd('heard'); f.progress(T.forks.length, T.forks.length);
        const back = (cfg.end || 'back') === 'back';
        say(back ? '最後の足跡だけ、こちらを向いている。' : '足跡は壁の前で終わっている。');
        f.say(cfg.ok || (back ? '……ここで、振り返ったのだ。' : '壁の向こうへ、消えている。')); snd('ok'); solved(f); f.win(1200);
      };
      const nearestOpt = (W) => { let best = null, bd = Infinity; for (const o of options()) for (const p of o.prints.slice(0, 8)) { const d = Math.hypot(p.x - W[0], p.y - W[1]); if (d < bd) { bd = d; best = o; } } return bd < 0.24 ? best : null; };
      const go = () => { const o = nearestOpt(lightW()); if (!o) { say('灯りの中に、たどれる跡がない。跡の上を照らす。'); return; } follow(o); };
      s.q('.mgx-fp-go').onclick = go;
      const setLight = (W) => { let dx = W[0] - st.pos[0], dy = W[1] - st.pos[1]; const d = Math.hypot(dx, dy), m = 0.6; if (d > m) { dx *= m / d; dy *= m / d; } st.light = [dx, dy]; };
      let tap = null;
      drag(cv, {
        down: (p) => { if (st.done) return false; tap = { x: p.x, y: p.y, t: performance.now() }; setLight(toWorld(p.x, p.y)); },
        move: (p) => setLight(toWorld(p.x, p.y)),
        up: (p) => { if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) < 8 && performance.now() - tap.t < 400) { const W = toWorld(p.x, p.y), o = nearestOpt(W); if (o && o.prints.some((q) => Math.hypot(q.x - W[0], q.y - W[1]) < 0.07)) follow(o); } tap = null; },
      });
      const keys = new Set();
      f.on('keydown', (e) => {
        if (st.done) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
        if ((e.code === 'Enter' || e.code === 'KeyE' || (e.code === 'Space' && document.activeElement === cv)) && !e.repeat) { e.preventDefault(); go(); }
      });
      f.on('keyup', (e) => keys.delete(e.code));
      loop(f, (dt) => {
        st.t += dt;
        if (keys.size) { const v = dt * 0.7, W = lightW(); setLight([W[0] + (keys.has('ArrowRight') ? v : keys.has('ArrowLeft') ? -v : 0), W[1] + (keys.has('ArrowDown') ? v : keys.has('ArrowUp') ? -v : 0)]); }
        if (st.walk) {
          const w = st.walk, sp = (calm ? 0.9 : 0.6) * dt;
          let left = sp;
          while (left > 0 && w.k < w.path.length - 1) { const a = w.path[w.k], b = w.path[w.k + 1], d = Math.hypot(b[0] - st.pos[0], b[1] - st.pos[1]); if (d <= left) { st.pos = [...b]; w.k++; left -= d; } else { st.pos = [st.pos[0] + ((b[0] - st.pos[0]) * left) / d, st.pos[1] + ((b[1] - st.pos[1]) * left) / d]; left = 0; } void a; }
          const nb = w.path[Math.min(w.path.length - 1, w.k + 3)], dir = [nb[0] - st.pos[0], nb[1] - st.pos[1]], dl = Math.hypot(...dir) || 1;
          st.light = [(dir[0] / dl) * 0.3, (dir[1] / dl) * 0.3];
          st.stepT += dt; if (st.stepT > 0.45) { st.stepT = 0; snd('step', 0.15); }
          if (w.k >= w.path.length - 1) { st.walk = null; w.then(); }
        }
        const tgt = [st.pos[0] + st.light[0] * 0.5, st.pos[1] + st.light[1] * 0.5 - 0.05], c = calm ? 1 : Math.min(1, dt * 4);
        st.cam = [st.cam[0] + (tgt[0] - st.cam[0]) * c, st.cam[1] + (tgt[1] - st.cam[1]) * c];
        draw();
      });
      solvable(host, () => {
        const jump = (path) => { st.pos = [...path[path.length - 1]]; };
        st.walk = null; jump(T.lead); st.node = 0;
        for (const fk of T.forks) { const o = fk.opts.find((q) => trackOk(q.sole, clue)); jump(o.path); st.node++; }
        jump(T.last); finish();
      }, () => { const k = scale(), R = cv.getBoundingClientRect(), sc = (p) => [R.left + ui.w / 2 + (p.x - st.cam[0]) * k, R.top + ui.h / 2 + (p.y - st.cam[1]) * k];
        return { node: st.node, walking: !!st.walk, misses: st.misses, done: st.done, options: options().map((o) => ({ ok: !!o.ok, sole: o.sole, first: o.prints.slice(1, 4).map(sc) })) }; });
      say('足跡の始まり。「照らした跡を追う」で進む。');
      draw();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
