/* game-kit e962dd12: js/mg-steam-letter.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "steam-letter" (封筒を湯気で開ける, standard 1.24.0: a sealed letter that must not look opened, a will, a letter to the dead).
// Hold the envelope over the kettle's steam and move it so the glue along the whole flap softens evenly (a heat map per section shows it);
// too much steam on one spot makes the sender's ink run. When the glue lets go, peel the flap slowly from its tip: pulling too fast tears it
// (a small tear, a word of warning, and you go on). Inside is a letter, shown in the reading panel.
//   cfg: title, help, letter ({ title, text, paper: 'note' }), sender (the name on the back), sections (6), peel (0.6: the fastest safe peel,
//        flap lengths per second), ok, skin, stamp, next (「読み終えた」)
//   hooks: { sound(name, ctx), read(letter) }  name = 'hiss' | 'tilt' | 'peel' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() steams every section and peels slowly through the same rules
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, drag, hold, loop, solved, solvable, clamp, calmOf } from './mg-stage.js';
import { readPanel } from './mg-read.js';

const LETTER = { title: '手紙', text: 'この手紙を開けたなら、もう遅いのでしょう。\n夜中に二階の廊下を歩くのは、私ではありません。\n戸を叩かれても、決して返事をしないで。\n―― 姉より' };
/** how much of the steam reaches a point dx away from the column (dx in parts of the envelope's width) */
export const steamHeat = (dx, spread = 0.13) => Math.exp(-((dx / spread) ** 2));
/** the rule of the peel (pure): safe while the flap moves no faster than vmax (flap lengths per second) */
export const peelOk = (dp, dt, vmax = 0.6) => dt <= 0 || dp / dt <= vmax;
export const HOT = 1.35, SOFT = 0.55;

export default {
  type: 'steam-letter',
  about: '封筒を湯気に当てて糊を均一に溶かし、破らないようにゆっくりめくって中の手紙を読む',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), calm = calmOf(ctx);
      const K = cfg.sections || 6, vmax = cfg.peel || 0.6, letter = cfg.letter || LETTER;
      const f = mgFrame(host, { cfg: { ...cfg, next: cfg.next || '読み終えた' }, ctx, title: cfg.title || '封筒を湯気で開ける', help: cfg.help || '封筒を左右に動かして、封の糊を湯気で全部溶かす。溶けたら先からゆっくりめくる。' }, done);
      const s = stageLayout(f, 'mgx-sl', {
        view: '<canvas class="mgx-sl-cv" tabindex="0" aria-label="やかんの湯気と封筒。← → で動かし、↑ でめくる"></canvas>',
        side: `<p class="mgx-st-line mgx-sl-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-sl-l" aria-label="封筒を左へ">←</button><button type="button" class="btn mgx-sl-fire">火：弱</button><button type="button" class="btn mgx-sl-r" aria-label="封筒を右へ">→</button></div><button type="button" class="btn primary mgx-sl-peel">ゆっくりめくる</button>`,
      });
      const cv = s.q('canvas'), line = s.q('.mgx-sl-line'), fireB = s.q('.mgx-sl-fire'), peelB = s.q('.mgx-sl-peel');
      const st = { x: -0.55, vx: 0, strong: false, heat: Array(K).fill(0), glue: Array(K).fill(1), cool: Array(K).fill(0), blur: 0, misses: 0, phase: 0, p: 0, tears: [], grab: false, lastY: 0, puffs: [], open: false, said: '' };
      const keys = new Set();
      const geo = () => {
        const w = ui.w, h = ui.h, ew = Math.min(w * 0.62, (h - 70) * 1.5), eh = ew * 0.56, cx = w / 2 + (st.x * ew) / 2, ex = cx - ew / 2, ey = Math.max(8, h * 0.06);   // at either end a corner is over the steam
        return { w, h, ew, eh, ex, ey, ax: cx, ay: ey + eh * 0.6, steamX: w / 2, spoutY: h - 18 };
      };
      // the seal's sections, from the left corner to the tip to the right corner
      const secPoint = (G, i) => { const t = (i + 0.5) / K; return t < 0.5 ? [G.ex + (G.ax - G.ex) * (t * 2), G.ey + (G.ay - G.ey) * (t * 2)] : [G.ax + (G.ex + G.ew - G.ax) * ((t - 0.5) * 2), G.ay + (G.ey - G.ay) * ((t - 0.5) * 2)]; };
      const setLine = (t) => { if (st.said !== t) { st.said = t; line.textContent = t; } };
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, G = geo();
        g.fillStyle = '#1e1a16'; g.fillRect(0, 0, G.w, G.h);
        g.fillStyle = '#2a241e'; g.fillRect(0, G.h - 34, G.w, 34);   // the table
        // the kettle and its steam
        g.fillStyle = '#3c3a38'; g.beginPath(); g.ellipse(G.steamX + 40, G.h - 8, 54, 26, 0, Math.PI, 0); g.fill();
        g.strokeStyle = '#3c3a38'; g.lineWidth = 9; g.beginPath(); g.moveTo(G.steamX + 6, G.h - 18); g.lineTo(G.steamX, G.spoutY - 10); g.stroke();
        for (const q of st.puffs) { g.fillStyle = `rgba(230,230,225,${0.16 * q.a})`; g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill(); }
        // the envelope's back with the flap
        g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 12; g.fillStyle = '#e6dcc6'; g.fillRect(G.ex, G.ey, G.ew, G.eh); g.restore();
        g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(G.ex, G.ey + G.eh); g.lineTo(G.ax, G.ey + G.eh * 0.45); g.lineTo(G.ex + G.ew, G.ey + G.eh); g.stroke();
        // the sender's name (runs when over-steamed)
        g.save(); g.fillStyle = '#1c1a2a'; g.font = `${Math.round(G.eh * 0.11)}px "Yu Mincho","Hiragino Mincho ProN",serif`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
        if (st.blur) { g.shadowColor = '#1c1a2a'; g.shadowBlur = st.blur * 2.5; g.globalAlpha = Math.max(0.35, 1 - st.blur * 0.12); }
        g.fillText(cfg.sender || '差出人　村瀬　澄', G.ex + G.ew - G.ew * 0.06, G.ey + G.eh * 0.9); g.restore();
        // the flap: its tip lifts and folds back as it is peeled
        const tipY = G.ay - st.p * (G.ay - G.ey) * 2;
        g.fillStyle = st.p > 0.5 ? '#d8ccb2' : '#ece2cc'; g.beginPath(); g.moveTo(G.ex, G.ey); g.lineTo(G.ax, tipY); g.lineTo(G.ex + G.ew, G.ey); g.closePath(); g.fill();
        g.strokeStyle = '#a8987a'; g.lineWidth = 1.5; g.stroke();
        if (st.p > 0.02) { g.fillStyle = '#2a2016'; g.beginPath(); g.moveTo(G.ex + 4, G.ey + 1); g.lineTo(G.ax, G.ey + Math.min(G.ay - G.ey, (G.ay - G.ey) * st.p * 2) - 2); g.lineTo(G.ex + G.ew - 4, G.ey + 1); g.closePath(); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; }
        for (const t of st.tears) { g.strokeStyle = '#6a5a40'; g.lineWidth = 2; g.beginPath(); const [x, y] = [G.ex + G.ew * t, G.ey + 2]; g.moveTo(x, y); g.lineTo(x + 5, y + 8); g.lineTo(x - 2, y + 14); g.stroke(); }
        // the heat map along the seal (glue: a dark band that thins as it softens)
        if (st.phase === 0) for (let i = 0; i < K; i++) {
          const [x, y] = secPoint(G, i), hv = st.heat[i], gl = st.glue[i];
          const col = hv > HOT * 0.92 ? '#ff3a2a' : hv > SOFT ? '#ffa040' : hv > 0.25 ? '#d8b060' : '#6a88a8';
          g.fillStyle = col; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, 6 + 3 * gl, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
          g.strokeStyle = gl > 0 ? '#3a2a1a' : '#f0e8d8'; g.lineWidth = gl > 0 ? 1.5 + 2 * gl : 1.5; g.beginPath(); g.arc(x, y, 8 + 3 * gl, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (gl > 0 ? gl : 1)); g.stroke();
        }
        // the hint: where the steam column is
        if (st.misses >= 2 && st.phase === 0) { g.strokeStyle = 'rgba(255,200,140,0.5)'; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(G.steamX, G.spoutY - 14); g.lineTo(G.steamX, G.ey); g.stroke(); g.setLineDash([]); }
        if (st.phase === 1 && st.p < 0.05) { g.strokeStyle = '#ffd890'; g.lineWidth = 2; g.beginPath(); g.arc(G.ax, G.ay, 18 + (calm ? 0 : 3 * Math.sin(performance.now() / 200)), 0, Math.PI * 2); g.stroke(); }
      }
      const miss = (t) => { st.misses++; snd('wrong'); f.miss(); f.say(t + (st.misses === 2 ? '（湯気の通り道に線を出した）' : '')); };
      const peelTo = (p, dt) => {
        if (st.phase !== 1 || st.open) return;
        const dp = p - st.p; if (dp <= 0) return;
        if (!peelOk(dp, dt, vmax)) { st.tears.push(0.2 + (st.tears.length * 0.27) % 0.6); st.grab = false; st.p = Math.min(1, st.p + Math.min(dp, 0.04)); miss('速すぎる。紙が少し破れた。もっとゆっくり。'); return; }
        st.p = Math.min(1, p); snd('peel');
        if (st.p >= 1) open();
      };
      const open = () => {
        st.open = true; snd('ok'); f.say(cfg.ok || '封が開いた。中に手紙が一通。'); solved(f); f.win(900);
        setTimeout(() => { if (f.root.isConnected) readPanel(f, letter, hooks); }, calm ? 200 : 900);
      };
      fireB.onclick = () => { st.strong = !st.strong; fireB.textContent = st.strong ? '火：強' : '火：弱'; snd('tilt'); };
      hold(s.q('.mgx-sl-l'), { tick: (dt) => (st.x = clamp(st.x - dt * 0.9, -1, 1)) });
      hold(s.q('.mgx-sl-r'), { tick: (dt) => (st.x = clamp(st.x + dt * 0.9, -1, 1)) });
      hold(peelB, { tick: (dt) => { if (st.phase === 1) peelTo(st.p + vmax * 0.55 * dt, dt); else setLine('まだ糊が固い。先に湯気で溶かす。'); } });
      let dragMode = null, lx = 0, lt = 0;
      drag(cv, {
        down: (p) => { const G = geo(), tipY = G.ay - st.p * (G.ay - G.ey) * 2; lx = p.x; lt = performance.now();
          // the flap: its tip, or (once it has started to lift) anywhere on the envelope's upper half; the finger travels one flap height
          if (st.phase === 1 && (Math.hypot(p.x - G.ax, p.y - Math.max(tipY, 10)) < 46 || (st.p > 0 && Math.abs(p.x - G.ax) < G.ew / 2 && p.y < G.ay + 30))) { dragMode = 'peel'; st.grab = true; st.t0 = lt; st.y0 = p.y; st.p0 = st.p; return; }
          if (st.phase === 0 && Math.hypot(p.x - G.ax, p.y - G.ay) < 40) setLine('まだ糊が固い。先に湯気で溶かす。');
          dragMode = 'move'; },
        move: (p) => {
          const G = geo(), now = performance.now();
          if (dragMode === 'move') { st.x = clamp(st.x + (p.x - lx) / (G.ew / 2), -1, 1); lx = p.x; }
          else if (dragMode === 'peel' && st.grab && now - st.t0 >= 80) { peelTo(clamp(st.p0 + (st.y0 - p.y) / (G.ay - G.ey)), (now - st.t0) / 1000); st.t0 = now; }   // the speed over the last 80 ms
        },
        up: () => { dragMode = null; st.grab = false; },
      });
      f.on('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
        if (e.code === 'KeyF' && !e.repeat) fireB.click();
      });
      f.on('keyup', (e) => keys.delete(e.code));
      let hissT = 0;
      loop(f, (dt) => {
        if (keys.has('ArrowLeft')) st.x = clamp(st.x - dt * 0.9, -1, 1);
        if (keys.has('ArrowRight')) st.x = clamp(st.x + dt * 0.9, -1, 1);
        if (keys.has('ArrowUp')) { if (st.phase === 1) peelTo(st.p + vmax * 0.55 * dt, dt); }
        const G = geo(), power = st.strong ? 1.5 : 0.75;
        if (st.phase === 0 && !f.done) {
          for (let i = 0; i < K; i++) {
            const [x, y] = secPoint(G, i), near = 0.65 + 0.35 * clamp((y - G.ey) / (G.ay - G.ey));
            st.heat[i] = Math.max(0, st.heat[i] + dt * (power * near * steamHeat((x - G.steamX) / G.ew) - 0.3 * st.heat[i]));
            if (st.heat[i] > SOFT) st.glue[i] = Math.max(0, st.glue[i] - dt * 0.5 * (st.heat[i] - 0.35));
            st.cool[i] = Math.max(0, st.cool[i] - dt);
            if (st.heat[i] > HOT && !st.cool[i]) { st.cool[i] = 2.5; st.blur = Math.min(6, st.blur + 1); st.heat[i] = 1.05; miss('湯気を当てすぎた。差出人の字がにじんだ。'); }
          }
          const left = st.glue.filter((v) => v > 0).length;
          setLine(left ? `糊が残っている所：${left} / ${K}　${st.strong ? '火が強い。当てすぎに気をつける。' : ''}` : '');
          if (!left) { st.phase = 1; setLine('糊が溶けた。先をつまんで、ゆっくりめくる。'); f.say('封の先が浮いた。'); }
        } else if (st.phase === 1 && !st.open) setLine(`めくった：${Math.round(st.p * 100)}%　速すぎると破れる。`);
        // the steam puffs
        hissT -= dt; if (hissT <= 0 && st.phase === 0) { hissT = 1.2; snd('hiss'); }
        if (st.puffs.length < (st.strong ? 40 : 22) && Math.random() < dt * (st.strong ? 30 : 16)) st.puffs.push({ x: G.steamX + (Math.random() - 0.5) * 6, y: G.spoutY - 12, r: 6, a: 1, v: 40 + Math.random() * 30 });
        for (const q of st.puffs) { q.y -= q.v * dt; q.r += dt * 14; q.a -= dt * 0.5; if (!calm) q.x += Math.sin(q.y / 20) * dt * 12; }
        st.puffs = st.puffs.filter((q) => q.a > 0);
        if (!st.open) draw();
      });
      solvable(host, () => { st.glue.fill(0); st.phase = 1; let p = st.p; while (!st.open) { p += 0.05; peelTo(Math.min(1, p), 0.1); } }, () => { const G = geo(), R = cv.getBoundingClientRect(); return { phase: st.phase, x: st.x, heat: [...st.heat], glue: [...st.glue], p: st.p, misses: st.misses, tears: st.tears.length, blur: st.blur, strong: st.strong, open: st.open, tip: [R.left + G.ax, R.top + G.ay - st.p * (G.ay - G.ey) * 2], top: R.top + G.ey, centre: [R.left + G.w / 2, R.top + G.h / 2], steamX: R.left + G.steamX, ax: R.left + G.ax, ew: G.ew }; });
      setLine('封筒を湯気の上へ。');
      draw();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
