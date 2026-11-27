/* game-kit 33762870: js/mg-safe-listen.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "safe-listen" (金庫の聞き取り, standard 1.24.0: the director's safe, a pawnshop's strongbox, a temple's offering safe).
// Turn the dial with a stethoscope on the door. At the right number a faint click comes and the dial trembles; then turn the other way for
// the next number: right, left, right. Some numbers give a weaker false click. Sound is optional: the stethoscope's trace shows every click
// (a tall spike for the real one), and 「目で見る」 makes the trace and the tremble larger. A wrong pull resets the wheels; the numbers
// heard stay in the notebook. After a few tries that went wrong the dial's rim glows near the next number.
// 1.28.0 (夜勤明けの街 #8 「金庫のゲームが分かりづらい」, #9 「ドラッグした時に逆方向に回る」):
//   - the goal in one line and the step in the status line (「1つ目：右へ回して、カチッと鳴る数を探す」 / 「カチッ！ 32。ここで止めて、左へ」)
//   - three slots (1つ目 右→ / 2つ目 ←左 / 3つ目 右→) filled with each number as it catches; an arrow round the hub shows the way to turn
//   - a click you can see: a ring out of the rim, カチッ！ beside the dial, the dial face goes green, a level meter in the stethoscope strip
//   - a hint after a few tries that went wrong (turning back before a click, passing it, a wrong pull): the line says what to do, the rim glows
//   - the dial turns clockwise on screen when the value goes up (right), and the drag uses the angle round the centre: it follows the pointer
//   cfg: title, help, code ([n, n, n] 0..99; default from the seed), seed (8), dirs ([1, -1, 1]: 1 = right / clockwise), catch (0: the click
//        comes within this many of the number), slack (2: it holds within this), near (10: the steps before the number where the ticks grow
//        louder and the door warms; 0 = off), visual (false:
//        start in the look mode), ok, skin, stamp
//   hooks: { sound(name, ctx, v) }  name = 'tick' | 'click' | 'set' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() turns the dial through the three numbers and pulls the handle through the same rule;
//   host.mgPeek().dial = { centre: [x, y] (client px), r, turn (rad, clockwise), value } (tools/check-minigames.mjs drags round it)
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, hold, loop, solved, solvable, rng, calmOf } from './mg-stage.js';

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
// the click holds while the dial stays within SLACK of its number; turned further the same way it is lost ('passed': 通り過ぎた), and a
// turn back after 3+ steps with no click is counted ('back') so the game can hint after a few
export const SLACK = 2;
// 1.37.10 (夜勤明けの街 play test 2026-11-23 「金庫のクエストで問題ない範囲を増やしてやりやすく」): tol = { catch, slack } - the click comes
// when the dial is within `catch` of the number (0: on it, as before) and holds within `slack` (at least catch + 1); cfg.catch / cfg.slack
const tolOf = (t) => { const c = Math.max(0, (t && t.catch) || 0); return { catch: c, hold: Math.max(c + 1, (t && t.slack) ?? SLACK) }; };
/** the rule (pure): one step of the dial (dir +1 / -1) at stage k -> what is heard and the new stage state */
export function dialStep(s, dir, safe, dirs = [1, -1, 1], tol = null) {
  const o = { ...s, heard: null }, T = tolOf(tol);
  if (o.lastDir && dir !== o.lastDir) {
    if (o.k < 2) {   // turning back sets the wheel - only where its click was heard
      if (o.armed === o.k && near(o.value, safe.code[o.k], T.hold)) { o.k++; o.armed = -1; o.heard = 'set'; }
      else { o.armed = -1; if ((o.run || 0) >= 3) o.heard = 'back'; }
    }
    o.run = 0;
  }
  o.lastDir = dir; o.value = wrap(o.value + dir); o.run = (o.run || 0) + 1;
  if (dir === dirs[o.k] && o.armed !== o.k && near(o.value, safe.code[o.k], T.catch)) { o.armed = o.k; o.heard = o.heard || 'click'; }
  else if (o.armed === o.k && !near(o.value, safe.code[o.k], T.hold)) { o.armed = -1; o.heard = o.heard || 'passed'; }
  else if (safe.fakes.includes(o.value)) o.heard = o.heard || 'fake';
  return o;
}
export const pullOk = (s, safe, tol = null) => s.k === 2 && s.armed === 2 && near(s.value, safe.code[2], tolOf(tol).hold);
/** 1.37.10 (the same play test 「対象の範囲の前に雰囲気が変わるように（音や色？）」, pure): how close the dial is to the next number, 0..1,
 *  turning the right way and within `span` steps before it (cfg.near, default 10; 0 = off) - the ticks grow louder and the door warms */
export function closeness(s, safe, dirs = [1, -1, 1], span = 10) {
  if (!span || s.k > 2 || s.armed === s.k) return 0;
  const d = dirs[s.k], ahead = wrap((safe.code[s.k] - s.value) * d);   // steps still to go the right way
  return ahead > span ? 0 : 1 - ahead / (span + 1);
}
/** the dial on screen (pure): its turn in radians, clockwise on the screen as the value goes up (right = clockwise), so a drag round the
 *  centre and the dial turn the same way. The numbers run anticlockwise round the face; the one under the index is the value. */
export const dialTurn = (value) => (value / SIZE) * Math.PI * 2;
/** a drag round the centre (pure): the steps for a move of the pointer from angle a0 to a1 (atan2 of the pointer about the centre, screen
 *  y down, so clockwise = the angle goes up), with the fraction carried to the next move */
export function dragSteps(a0, a1, frac = 0) {
  let d = a1 - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  let f = frac + (d / (Math.PI * 2)) * SIZE, n = 0;
  while (f >= 1) { f--; n++; }
  while (f <= -1) { f++; n--; }
  return { steps: n, frac: f };
}

export default {
  type: 'safe-listen',
  about: '金庫のダイヤルを回し、聴診器のかすかな音（と揺れ）で三つの数を探して開ける',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), calm = calmOf(ctx);
      const safe = cfg.code ? { code: cfg.code.map(wrap), fakes: makeSafe(cfg.seed ?? 8).fakes.filter((v) => cfg.code.every((c) => !near(c, v, 5))) } : makeSafe(cfg.seed ?? 8);
      const dirs = cfg.dirs || [1, -1, 1], tol = { catch: cfg.catch || 0, slack: cfg.slack ?? SLACK }, span = cfg.near ?? 10;
      const side = (d) => (d > 0 ? '右' : '左');
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '金庫の音を聞く', help: cfg.help || `ダイヤルを回して、カチッと鳴る数を三つ探す。鳴ったら止めて、逆へ回す（${side(dirs[0])}・${side(dirs[1])}・${side(dirs[2])}）。三つ目で「開ける」。` }, done);
      const slot = (k) => `<span class="mgx-sf-slot" data-k="${k}"><small>${k + 1}つ目 ${dirs[k] > 0 ? '右→' : '←左'}</small><b>--</b></span>`;
      const s = stageLayout(f, 'mgx-sf', {
        view: '<canvas class="mgx-sf-cv" tabindex="0" role="slider" aria-label="金庫のダイヤル。円を描くようにドラッグするか、← → で回す（Shift で速く）、Space で開ける" aria-valuemin="0" aria-valuemax="99" aria-valuenow="0"></canvas>',
        side: `<div class="mgx-sf-slots">${[0, 1, 2].map(slot).join('')}</div><p class="mgx-st-line mgx-sf-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-sf-l">← 左へ</button><button type="button" class="btn mgx-sf-r">右へ →</button></div><div class="mgx-st-row"><button type="button" class="btn mgx-sf-mode">目で見る</button><button type="button" class="btn primary mgx-sf-open">開ける</button></div>`,
      });
      const cv = s.q('canvas'), line = s.q('.mgx-sf-line'), modeB = s.q('.mgx-sf-mode'), slots = s.qa('.mgx-sf-slot');
      let S = { value: 0, k: 0, armed: -1, lastDir: 0, run: 0 };
      const st = { visual: !!cfg.visual, trace: Array(120).fill(0), shake: 0, pulse: 0, level: 0, notes: [], pulls: 0, backs: 0, passes: 0, t: 0, open: 0, frac: 0, set: [null, null, null], say: '' };
      const tries = () => st.pulls * 2 + st.backs + st.passes;   // what went wrong so far: the hints grow with it
      const setMode = (v) => { st.visual = v; modeB.textContent = v ? '音で聞く' : '目で見る'; modeB.setAttribute('aria-pressed', v ? 'true' : 'false'); };
      setMode(st.visual);
      const two = (v) => String(v).padStart(2, '0');
      const note = () => {
        const k = S.k, armed = S.armed === k && !st.open;
        let t;
        if (st.open) t = '開いた。';
        else if (armed) t = k < 2 ? `カチッ！ ${two(S.value)}。ここで止めて、${side(-dirs[k])}へ回すと掛かる。` : `カチッ！ ${two(S.value)}。三つ目が鳴った。「開ける」を押す。`;
        else if (st.say) t = st.say;
        else t = `${k + 1}つ目：${side(dirs[k])}へ回して、カチッと鳴る数を探す。`;
        if (!armed && !st.open && tries() >= 3) t += '（縁の光る所の近く）';
        line.textContent = t;
        // 1.39.17 (夜勤明けの街 2026-11-27 #8 「開けられるようになったら開けるボタンが強調されるように」): the moment the third number clicks the
        // 開ける button lights up and pulses (and reads 開ける！); before that it is quiet. Nothing opens by itself - the player presses it.
        { const ready = armed && k === 2, ob = s.q('.mgx-sf-open'); if (ob) { ob.classList.toggle('mgx-ready', ready); ob.classList.toggle('mgx-quiet', !ready && !st.open); ob.textContent = ready ? '開ける！' : '開ける'; } }
        slots.forEach((el, i) => {
          el.classList.toggle('now', i === k && !st.open); el.classList.toggle('done', st.set[i] != null); el.classList.toggle('heard', i === k && armed);
          el.querySelector('b').textContent = st.set[i] != null ? two(st.set[i]) : i === k && armed ? two(S.value) : '--';
        });
      };
      const step = (dir) => {
        if (f.done) return;
        const k0 = S.k;
        S = dialStep(S, dir, safe, dirs, tol);
        st.near = closeness(S, safe, dirs, span);
        snd('tick', 0.2 + st.near * 0.6);
        if (st.near > 0 && !S.heard) { st.level = Math.max(st.level, st.near * 0.45); st.trace[st.trace.length - 1] = st.near * 0.22; }
        if (S.heard === 'click') { st.trace[st.trace.length - 1] = st.visual ? 1 : 0.7; st.shake = st.visual ? 1 : 0.5; st.pulse = 1; st.level = 1; st.say = ''; snd('click', 1); if (!st.notes.some((n) => n.v === S.value)) st.notes.push({ v: S.value, real: true }); }
        else if (S.heard === 'fake') { st.trace[st.trace.length - 1] = st.visual ? 0.38 : 0.25; st.shake = st.visual ? 0.3 : 0.12; st.level = Math.max(st.level, 0.35); snd('click', 0.3); if (!st.notes.some((n) => n.v === S.value)) st.notes.push({ v: S.value, real: false }); }
        else if (S.heard === 'set') { st.set[k0] = safe.code[k0]; snd('set'); st.say = `${k0 + 1}つ目が掛かった。次は${side(dirs[S.k])}へ回して、カチッを探す。`; f.say(`${S.k} つ目の数が掛かった。`); f.progress(S.k, 3); }
        else if (S.heard === 'passed') { st.passes++; st.say = `通り過ぎた。少し${side(-dirs[S.k])}へ戻してから、もう一度${side(dirs[S.k])}へ。`; }
        else if (S.heard === 'back') { st.backs++; st.say = `まだカチッと鳴っていない。${side(dirs[S.k])}へ回して、鳴ったら止める。`; }
        if (st.notes.length > 6) st.notes.shift();
        cv.setAttribute('aria-valuenow', S.value); note();
      };
      const pull = () => {
        if (f.done) return;
        if (pullOk(S, safe, tol)) { st.set[2] = safe.code[2]; st.open = 0.01; snd('ok'); f.say(cfg.ok || '重い扉が動いた。'); f.progress(3, 3); note(); solved(f); f.win(1100); return; }
        st.pulls++; snd('wrong'); f.miss();
        S = { value: S.value, k: 0, armed: -1, lastDir: 0, run: 0 }; st.set = [null, null, null]; f.progress(0, 3);
        st.say = `開かない。ダイヤルが戻った。一つ目から：${side(dirs[0])}へ回してカチッを探す。`;
        f.say('開かない。ダイヤルが戻った。手帳の数は残っている。');
        note();
      };
      // hold the buttons to turn (faster the longer), drag round the dial, or the arrow keys
      const holdTurn = (btn, dir) => hold(btn, { down: () => { st.acc = 0; st.held = 0; step(dir); }, tick: (dt) => { st.held += dt; st.acc += dt * (st.held > 1.2 ? 14 : 6); while (st.acc >= 1) { st.acc--; step(dir); } } });
      holdTurn(s.q('.mgx-sf-l'), -1); holdTurn(s.q('.mgx-sf-r'), 1);
      modeB.onclick = () => setMode(!st.visual);
      s.q('.mgx-sf-open').onclick = pull;
      // the drag: the angle of the pointer round the dial's centre, so the dial follows the finger wherever it is grabbed (#9)
      let dragA = null;
      const angAt = (e) => { const R = cv.getBoundingClientRect(), G = geo(); return Math.atan2(e.clientY - R.top - G.cy, e.clientX - R.left - G.cx); };
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { if (f.done) return; e.preventDefault(); dragA = angAt(e); st.frac = 0; try { cv.setPointerCapture(e.pointerId); } catch {} });
      cv.addEventListener('pointermove', (e) => {
        if (dragA == null) return;
        const a = angAt(e), r = dragSteps(dragA, a, st.frac); dragA = a; st.frac = r.frac;
        for (let n = 0; n < Math.abs(r.steps); n++) step(Math.sign(r.steps));
      });
      const up = () => (dragA = null); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      f.on('keydown', (e) => {
        if (f.done) return;
        const a = document.activeElement; if (a && a.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); const d = e.code === 'ArrowRight' ? 1 : -1; for (let k = 0; k < (e.shiftKey ? 5 : 1); k++) step(d); }
        if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); pull(); }
        if (e.code === 'KeyV' && !e.repeat) setMode(!st.visual);
      });
      const geo = () => { const w = ui.w, h = ui.h, scope = Math.max(30, h * 0.18), R = Math.min(w * 0.42, (h - scope - 24) / 2); return { w, h, R, cx: w / 2, cy: 16 + R, scope, sy: h - scope - 4 }; };
      const ui = crisp(cv, () => draw());
      function arrow(g, r, a0, a1, col, w) {   // an arc from a0 to a1 (canvas angles) with a head at a1
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
        const dir = a1 > a0 ? 1 : -1, hx = Math.cos(a1) * r, hy = Math.sin(a1) * r, tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1), L = w * 2.4;
        g.beginPath(); g.moveTo(hx + tx * L, hy + ty * L); g.lineTo(hx + nx * L * 0.8, hy + ny * L * 0.8); g.lineTo(hx - nx * L * 0.8, hy - ny * L * 0.8); g.closePath(); g.fill();
      }
      function draw() {
        const g = ui.g, G = geo(), armed = S.armed === S.k && !st.open, TOP = -Math.PI / 2;
        g.fillStyle = '#1a1c1e'; g.fillRect(0, 0, G.w, G.h);
        // the door's steel with rivets
        g.fillStyle = '#2c3034'; g.fillRect(6, 4, G.w - 12, G.h - 8);
        // getting close (1.37.10): the door warms towards amber and its edge glows, before the click
        const nr = st.nearShow || 0; if (nr > 0.01 && !st.open) { const pu = 0.85 + 0.15 * Math.sin(performance.now() / (260 - nr * 140)); g.fillStyle = `rgba(210,120,30,${(nr * 0.5 * pu).toFixed(3)})`; g.fillRect(6, 4, G.w - 12, G.h - 8); g.strokeStyle = `rgba(255,190,90,${Math.min(1, nr * 1.1).toFixed(3)})`; g.lineWidth = 3 + nr * 9; g.strokeRect(8, 6, G.w - 16, G.h - 12); }   // the door warms and throbs faster the nearer (a first look at it read as nothing)
        g.fillStyle = '#4a5056'; for (const [x, y] of [[16, 14], [G.w - 16, 14], [16, G.h - 14], [G.w - 16, G.h - 14]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
        const sh = calm ? 0 : st.shake * 2.2, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
        g.save(); g.translate(G.cx + jx, G.cy + jy);
        // the hint: the rim glows near the next number (number c sits at -c on the face, turned by +value)
        if (tries() >= 3 && !st.open && !armed) { const c = safe.code[S.k], span = tries() >= 6 ? 3 : 7; g.strokeStyle = 'rgba(255,190,90,0.6)'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, G.R - 4, TOP + ((S.value - c - span) / SIZE) * Math.PI * 2, TOP + ((S.value - c + span) / SIZE) * Math.PI * 2); g.stroke(); }
        // the click: a ring growing out of the rim
        if (st.pulse > 0 && !calm) { g.strokeStyle = `rgba(255,214,120,${st.pulse.toFixed(2)})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, G.R + (1 - st.pulse) * 12, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = armed ? '#16281c' : '#0e1012'; g.beginPath(); g.arc(0, 0, G.R, 0, Math.PI * 2); g.fill();
        g.save(); g.rotate(dialTurn(S.value));   // clockwise as the value goes up, the same way as the drag (#9)
        g.strokeStyle = '#c8ccd0'; g.fillStyle = '#d8dce0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.max(9, G.R * 0.13)}px sans-serif`;
        for (let k = 0; k < SIZE; k++) { const a = -(k / SIZE) * Math.PI * 2, big = k % 10 === 0, l = big ? G.R * 0.16 : k % 5 === 0 ? G.R * 0.1 : G.R * 0.06; g.lineWidth = big ? 2 : 1; g.beginPath(); g.moveTo(Math.sin(a) * (G.R - 3), -Math.cos(a) * (G.R - 3)); g.lineTo(Math.sin(a) * (G.R - 3 - l), -Math.cos(a) * (G.R - 3 - l)); g.stroke(); if (big) g.fillText(String(k), Math.sin(a) * G.R * 0.7, -Math.cos(a) * G.R * 0.7); }
        g.fillStyle = '#3a3e42'; g.beginPath(); g.arc(0, 0, G.R * 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5a6066'; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.arc(Math.sin(a) * G.R * 0.5, -Math.cos(a) * G.R * 0.5, G.R * 0.05, 0, Math.PI * 2); g.fill(); }
        g.restore();
        // the way to turn now: a green arrow round the hub, or the turn-back arrow (yellow) while the click holds
        if (!st.open && !(armed && S.k === 2)) { const d = armed ? -dirs[S.k] : dirs[S.k]; arrow(g, G.R * 0.38, TOP - d * 1.1, TOP + d * 1.1, armed ? '#ffd078' : '#6ae0a0', Math.max(3, G.R * 0.05)); }
        g.restore();
        // the index mark and the number under it
        g.fillStyle = armed ? '#ffd078' : '#ff6a3a'; g.beginPath(); g.moveTo(G.cx - 8, 2); g.lineTo(G.cx + 8, 2); g.lineTo(G.cx, 15); g.fill();
        g.fillStyle = '#f0f2f4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.max(14, G.R * 0.24)}px sans-serif`; g.fillText(two(S.value), G.cx + jx, G.cy + jy + G.R * 0.05);
        // カチッ！ beside the dial while the click holds (under the number, inside the hub, where there is no room beside it)
        if (armed) {
          g.fillStyle = '#ffd078'; g.font = `bold ${Math.max(14, Math.min(26, G.R * 0.22))}px sans-serif`;
          if (G.w - 14 - (G.cx + G.R + 12) > g.measureText('カチッ！').width) { g.textAlign = 'left'; g.fillText('カチッ！', G.cx + G.R + 12, G.cy - G.R * 0.55); }
          else { g.font = `bold ${Math.max(11, G.R * 0.12)}px sans-serif`; g.textAlign = 'center'; g.fillText('カチッ！', G.cx, G.cy + G.R * 0.3); }
        }
        // the stethoscope: a level meter (how loud the last sound was) and the trace
        const mw = 24, x0 = 14 + mw + 6;
        g.fillStyle = '#081008'; g.fillRect(12, G.sy, G.w - 24, G.scope);
        g.fillStyle = '#163018'; g.fillRect(14, G.sy + 2, mw, G.scope - 4);
        const lv = Math.round((G.scope - 6) * st.level); g.fillStyle = st.level > 0.7 ? '#ffd078' : '#6aff9a'; g.fillRect(16, G.sy + G.scope - 3 - lv, mw - 4, lv);
        g.strokeStyle = '#6aff9a'; g.lineWidth = 1.5; g.beginPath();
        st.trace.forEach((v, k) => { const x = x0 + (k / (st.trace.length - 1)) * (G.w - 14 - x0), y = G.sy + G.scope / 2 - (v + Math.sin(k * 1.7 + st.t * 9) * 0.04) * (G.scope / 2 - 3) * (k % 2 ? 1 : -1); k ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
        if (st.notes.length) { g.fillStyle = '#9adfb0'; g.textAlign = 'right'; g.textBaseline = 'top'; g.font = `${Math.max(10, Math.min(13, G.scope * 0.3))}px sans-serif`; g.fillText(`手帳 ${st.notes.map((n) => (n.real ? two(n.v) : `(${two(n.v)})`)).join(' ')}`, G.w - 16, G.sy + 3); }
        if (st.open) { g.fillStyle = `rgba(0,0,0,${(0.6 * st.open).toFixed(2)})`; g.fillRect(0, 0, G.w * st.open * 0.5, G.h); }
      }
      loop(f, (dt) => {
        st.t += dt;
        st.trace.push(0); st.trace.shift();   // the trace scrolls
        st.nearShow = (st.nearShow || 0) + (((S.armed === S.k && !st.open) ? 0 : (st.near || 0)) - (st.nearShow || 0)) * Math.min(1, dt * 6);
        st.shake = Math.max(0, st.shake - dt * 4); st.pulse = Math.max(0, st.pulse - dt * 1.6); st.level = Math.max(0, st.level - dt * 0.9);
        if (st.open) st.open = Math.min(1, st.open + dt * 0.8);
        draw();
      });
      solvable(host, () => {
        S = { value: S.value, k: 0, armed: -1, lastDir: 0, run: 0 }; st.set = [null, null, null];
        for (let k = 0; k < 3; k++) { const d = dirs[k]; let n = 0; while (!(S.value === safe.code[k] && S.armed === k) && n++ < 250) step(d); if (k < 2) step(-d); }
        if (S.armed !== 2) { let n = 0; while (S.armed !== 2 && n++ < 250) step(dirs[2]); }
        pull();
      }, () => { const G = geo(), R = cv.getBoundingClientRect(), centre = [R.left + G.cx, R.top + G.cy]; return { ...S, code: safe.code, fakes: safe.fakes, pulls: st.pulls, backs: st.backs, passes: st.passes, set: st.set, line: line.textContent, notes: st.notes.map((n) => n.v), visual: st.visual, centre, r: G.R, dial: { centre, r: G.R, turn: dialTurn(S.value), value: S.value } }; });
      note();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
