/* game-kit 10af67dd: js/mg-safe-listen.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "safe-listen" (金庫の聞き取り, standard 1.24.0: the director's safe, a pawnshop's strongbox, a temple's offering safe).
// Turn the dial with a stethoscope on the door. At the right number a faint click comes and the dial trembles; then turn the other way for
// the next number: right, left, right. Some numbers give a weaker false click. Sound is optional: the stethoscope's trace shows every click
// (a tall spike for the real one), and 「目で見る」 makes the trace and the tremble larger. A wrong pull resets the wheels; the numbers
// heard stay in the notebook. After two wrong pulls the dial's rim glows near the next number.
//   cfg: title, help, code ([n, n, n] 0..99; default from the seed), seed (8), dirs ([1, -1, 1]: 1 = right / clockwise), visual (false:
//        start in the look mode), ok, skin, stamp
//   hooks: { sound(name, ctx, v) }  name = 'tick' | 'click' | 'set' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() turns the dial through the three numbers and pulls the handle through the same rule
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, hold, loop, solved, solvable, clamp, rng, calmOf } from './mg-stage.js';

export const SIZE = 100;
const wrap = (v) => ((v % SIZE) + SIZE) % SIZE;
const near = (a, b, d = 1) => Math.min(wrap(a - b), wrap(b - a)) <= d;
/** the safe (pure): its code and the false gates */
export function makeSafe(seed = 8) {
  const r = rng(seed), code = [];
  while (code.length < 3) { const v = 5 + Math.floor(r() * 90); if (code.every((c) => !near(c, v, 12))) code.push(v); }
  const fakes = [];
  while (fakes.length < 4) { const v = Math.floor(r() * SIZE); if (code.every((c) => !near(c, v, 6)) && fakes.every((c) => !near(c, v, 6))) fakes.push(v); }
  return { code, fakes };
}
/** the rule (pure): one step of the dial (dir +1 / -1) at stage k -> what is heard and the new stage state */
export function dialStep(s, dir, safe, dirs = [1, -1, 1]) {
  const o = { ...s, heard: null };
  if (o.lastDir && dir !== o.lastDir && o.k < 2) {   // turning back sets the wheel - only where its click was heard
    if (o.armed === o.k && near(o.value, safe.code[o.k], 1)) { o.k++; o.armed = -1; o.heard = 'set'; }
    else o.armed = -1;
  }
  o.lastDir = dir; o.value = wrap(o.value + dir);
  if (dir === dirs[o.k] && o.value === safe.code[o.k]) { o.armed = o.k; o.heard = o.heard || 'click'; }
  else if (safe.fakes.includes(o.value)) o.heard = o.heard || 'fake';
  return o;
}
export const pullOk = (s, safe) => s.k === 2 && s.armed === 2 && near(s.value, safe.code[2], 1);

export default {
  type: 'safe-listen',
  about: '金庫のダイヤルを回し、聴診器のかすかな音（と揺れ）で三つの数を探して開ける',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), calm = calmOf(ctx);
      const safe = cfg.code ? { code: cfg.code.map(wrap), fakes: makeSafe(cfg.seed ?? 8).fakes.filter((v) => cfg.code.every((c) => !near(c, v, 5))) } : makeSafe(cfg.seed ?? 8);
      const dirs = cfg.dirs || [1, -1, 1];
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '金庫の音を聞く', help: cfg.help || '右に回してカチッと鳴った数で止め、左へ。次も鳴ったら右へ。三つ目で「開ける」。' }, done);
      const s = stageLayout(f, 'mgx-sf', {
        view: '<canvas class="mgx-sf-cv" tabindex="0" role="slider" aria-label="金庫のダイヤル。← → で回す（Shift で速く）、Space で開ける" aria-valuemin="0" aria-valuemax="99" aria-valuenow="0"></canvas>',
        side: `<p class="mgx-st-line mgx-sf-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-sf-l">← 左へ</button><button type="button" class="btn mgx-sf-r">右へ →</button></div><div class="mgx-st-row"><button type="button" class="btn mgx-sf-mode">目で見る</button><button type="button" class="btn primary mgx-sf-open">開ける</button></div>`,
      });
      const cv = s.q('canvas'), line = s.q('.mgx-sf-line'), modeB = s.q('.mgx-sf-mode');
      let S = { value: 0, k: 0, armed: -1, lastDir: 0 };
      const st = { visual: !!cfg.visual, trace: Array(120).fill(0), shake: 0, notes: [], pulls: 0, t: 0, open: 0, frac: 0, hint: 0 };
      const setMode = (v) => { st.visual = v; modeB.textContent = v ? '音で聞く' : '目で見る'; modeB.setAttribute('aria-pressed', v ? 'true' : 'false'); };
      setMode(st.visual);
      const note = () => { line.textContent = `${['一つ目', '二つ目', '三つ目'][S.k]}を探す（${dirs[S.k] > 0 ? '右' : '左'}へ）　手帳：${st.notes.length ? st.notes.map((n) => (n.real ? `${n.v}` : `(${n.v})`)).join(' ') : 'まだ'}`; };
      const step = (dir) => {
        if (f.done) return;
        S = dialStep(S, dir, safe, dirs);
        snd('tick', 0.2);
        if (S.heard === 'click') { st.trace[st.trace.length - 1] = st.visual ? 1 : 0.7; st.shake = st.visual ? 1 : 0.5; snd('click', 1); if (!st.notes.some((n) => n.v === S.value)) st.notes.push({ v: S.value, real: true }); }
        else if (S.heard === 'fake') { st.trace[st.trace.length - 1] = st.visual ? 0.38 : 0.25; st.shake = st.visual ? 0.3 : 0.12; snd('click', 0.3); if (!st.notes.some((n) => n.v === S.value)) st.notes.push({ v: S.value, real: false }); }
        else if (S.heard === 'set') { snd('set'); f.say(`${S.k} つ目の数が掛かった。`); f.progress(S.k, 3); }
        if (st.notes.length > 6) st.notes.shift();
        cv.setAttribute('aria-valuenow', S.value); note();
      };
      const pull = () => {
        if (f.done) return;
        if (pullOk(S, safe)) { st.open = 0.01; snd('ok'); f.say(cfg.ok || '重い扉が動いた。'); f.progress(3, 3); solved(f); f.win(1100); return; }
        st.pulls++; snd('wrong'); f.miss();
        S = { value: S.value, k: 0, armed: -1, lastDir: 0 }; f.progress(0, 3);
        f.say(`開かない。ダイヤルが戻った。手帳の数は残っている。${st.pulls >= 2 ? '縁の光るあたりを探す。' : ''}`);
        note();
      };
      // hold the buttons to turn (faster the longer), drag round the dial, or the arrow keys
      const holdTurn = (btn, dir) => hold(btn, { down: () => { st.acc = 0; st.held = 0; step(dir); }, tick: (dt) => { st.held += dt; st.acc += dt * (st.held > 1.2 ? 14 : 6); while (st.acc >= 1) { st.acc--; step(dir); } } });
      holdTurn(s.q('.mgx-sf-l'), -1); holdTurn(s.q('.mgx-sf-r'), 1);
      modeB.onclick = () => setMode(!st.visual);
      s.q('.mgx-sf-open').onclick = pull;
      let dragA = null;
      const angAt = (e) => { const R = cv.getBoundingClientRect(), G = geo(); return Math.atan2(e.clientY - R.top - G.cy, e.clientX - R.left - G.cx); };
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { if (f.done) return; e.preventDefault(); dragA = angAt(e); st.frac = 0; try { cv.setPointerCapture(e.pointerId); } catch {} });
      cv.addEventListener('pointermove', (e) => {
        if (dragA == null) return;
        const a = angAt(e); let d = a - dragA; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; dragA = a;
        st.frac += (d / (Math.PI * 2)) * SIZE; while (st.frac >= 1) { st.frac--; step(1); } while (st.frac <= -1) { st.frac++; step(-1); }
      });
      const up = () => (dragA = null); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      f.on('keydown', (e) => {
        if (f.done) return;
        const a = document.activeElement; if (a && a.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); const d = e.code === 'ArrowRight' ? 1 : -1; for (let k = 0; k < (e.shiftKey ? 5 : 1); k++) step(d); }
        if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); pull(); }
        if (e.code === 'KeyV' && !e.repeat) setMode(!st.visual);
      });
      const geo = () => { const w = ui.w, h = ui.h, scope = Math.max(34, h * 0.2), R = Math.min(w * 0.42, (h - scope - 18) / 2); return { w, h, R, cx: w / 2, cy: 8 + R, scope, sy: h - scope - 4 }; };
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, G = geo();
        g.fillStyle = '#1a1c1e'; g.fillRect(0, 0, G.w, G.h);
        // the door's steel with rivets
        g.fillStyle = '#2c3034'; g.fillRect(6, 4, G.w - 12, G.h - 8);
        g.fillStyle = '#4a5056'; for (const [x, y] of [[16, 14], [G.w - 16, 14], [16, G.h - 14], [G.w - 16, G.h - 14]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
        const sh = calm ? 0 : st.shake * 2.2, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
        g.save(); g.translate(G.cx + jx, G.cy + jy);
        // the hint: the rim glows near the next number
        if (st.pulls >= 2 && !st.open) { const c = safe.code[S.k], span = st.pulls >= 4 ? 3 : 7; g.strokeStyle = 'rgba(255,190,90,0.55)'; g.lineWidth = 8; g.beginPath(); const a0 = ((c - span - S.value) / SIZE) * Math.PI * 2 - Math.PI / 2, a1 = ((c + span - S.value) / SIZE) * Math.PI * 2 - Math.PI / 2; g.arc(0, 0, G.R - 4, a0, a1); g.stroke(); }
        g.fillStyle = '#0e1012'; g.beginPath(); g.arc(0, 0, G.R, 0, Math.PI * 2); g.fill();
        g.rotate((-S.value / SIZE) * Math.PI * 2);
        g.strokeStyle = '#c8ccd0'; g.fillStyle = '#d8dce0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.max(9, G.R * 0.13)}px sans-serif`;
        for (let k = 0; k < SIZE; k++) { const a = (k / SIZE) * Math.PI * 2, big = k % 10 === 0, l = big ? G.R * 0.16 : k % 5 === 0 ? G.R * 0.1 : G.R * 0.06; g.lineWidth = big ? 2 : 1; g.beginPath(); g.moveTo(Math.sin(a) * (G.R - 3), -Math.cos(a) * (G.R - 3)); g.lineTo(Math.sin(a) * (G.R - 3 - l), -Math.cos(a) * (G.R - 3 - l)); g.stroke(); if (big) g.fillText(String(k), Math.sin(a) * G.R * 0.68, -Math.cos(a) * G.R * 0.68); }
        g.fillStyle = '#3a3e42'; g.beginPath(); g.arc(0, 0, G.R * 0.42, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5a6066'; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.arc(Math.sin(a) * G.R * 0.42, -Math.cos(a) * G.R * 0.42, G.R * 0.05, 0, Math.PI * 2); g.fill(); }
        g.restore();
        // the index mark and the number under it
        g.fillStyle = '#ff6a3a'; g.beginPath(); g.moveTo(G.cx - 7, 2); g.lineTo(G.cx + 7, 2); g.lineTo(G.cx, 14); g.fill();
        g.fillStyle = '#f0f2f4'; g.font = `bold ${Math.max(14, G.R * 0.22)}px sans-serif`; g.fillText(String(S.value).padStart(2, '0'), G.cx + jx, G.cy + jy);
        // the stethoscope's trace
        g.fillStyle = '#081008'; g.fillRect(12, G.sy, G.w - 24, G.scope);
        g.strokeStyle = '#6aff9a'; g.lineWidth = 1.5; g.beginPath();
        st.trace.forEach((v, k) => { const x = 12 + (k / (st.trace.length - 1)) * (G.w - 24), y = G.sy + G.scope / 2 - (v + Math.sin(k * 1.7 + st.t * 9) * 0.04) * (G.scope / 2 - 3) * (k % 2 ? 1 : -1); k ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
        if (st.open) { g.fillStyle = `rgba(0,0,0,${0.6 * st.open})`; g.fillRect(0, 0, G.w * st.open * 0.5, G.h); }
      }
      loop(f, (dt) => {
        st.t += dt;
        st.trace.push(0); st.trace.shift();   // the trace scrolls
        st.shake = Math.max(0, st.shake - dt * 4);
        if (st.open) st.open = Math.min(1, st.open + dt * 0.8);
        draw();
      });
      solvable(host, () => {
        S = { value: S.value, k: 0, armed: -1, lastDir: 0 };
        for (let k = 0; k < 3; k++) { const d = dirs[k]; let n = 0; while (!(S.value === safe.code[k] && S.armed === k) && n++ < 250) step(d); if (k < 2) step(-d); }
        if (S.armed !== 2) { let n = 0; while (S.armed !== 2 && n++ < 250) step(dirs[2]); }
        pull();
      }, () => { const G = geo(), R = cv.getBoundingClientRect(); return { ...S, code: safe.code, fakes: safe.fakes, pulls: st.pulls, notes: st.notes.map((n) => n.v), visual: st.visual, centre: [R.left + G.cx, R.top + G.cy], r: G.R }; });
      note();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
