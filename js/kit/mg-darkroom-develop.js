/* game-kit e962dd12: js/mg-darkroom-develop.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "darkroom-develop" (現像, standard 1.24.0: a darkroom under a safelight, an old camera's last roll, a photo of a place that
// shows one more person than was there). Move the paper through the developer, the stop bath and the fixer; rock the tray so it develops
// evenly while the picture rises; pull it out at the right moment (too soon is pale, too late is black). Something that was not in the
// picture slowly comes up in the print, clearest in the fixer. A spoiled sheet only costs a new sheet; after two, the timer shows the band.
//   cfg: title, help, image (url of the photo; default a drawn corridor), reveal (url of the hidden layer, drawn over it; default a figure at
//        the end of the corridor; false = none), speed (10: seconds until fully developed), window ([0.68, 0.88]: the part of full when to
//        pull), stop (2: seconds in the stop bath), fix (4: seconds in the fixer), trays (['現像液', '停止液', '定着液']), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'slosh' | 'pull' | 'tick' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() develops a good print through the same rule (js/mg-stage.js solvable)
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, drag, hold, loop, solved, solvable, clamp, noise2, calmOf, rng } from './mg-stage.js';

/** the rule (pure): how a print pulled from the developer at development d with an agitated share came out */
export function printResult(d, agit, win = [0.68, 0.88]) {
  if (d < win[0]) return 'pale';
  if (d > win[1]) return 'dark';
  if (agit < 0.3) return 'uneven';
  return 'ok';
}
const WHY = { pale: '薄い。上げるのが早すぎた。新しい紙でもう一度。', dark: '黒くなりすぎた。もう少し早く上げる。新しい紙で。', uneven: 'むらになった。揺らしながら浸ける。新しい紙で。' };

/** the default photo: a hospital corridor, drawn in greys (w x h) */
function drawCorridor(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#6a6a68'); grd.addColorStop(0.5, '#9a9894'); grd.addColorStop(1, '#3a3836');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const vx = w * 0.52, vy = h * 0.46;   // the vanishing point
  g.fillStyle = '#d8d6d0'; g.fillRect(vx - w * 0.07, vy - h * 0.12, w * 0.14, h * 0.2);   // the far window
  g.fillStyle = '#2a2826';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(vx - w * 0.07, vy - h * 0.12); g.lineTo(vx - w * 0.07, vy + h * 0.08); g.lineTo(0, h); g.closePath(); g.globalAlpha = 0.55; g.fill();
  g.beginPath(); g.moveTo(w, 0); g.lineTo(vx + w * 0.07, vy - h * 0.12); g.lineTo(vx + w * 0.07, vy + h * 0.08); g.lineTo(w, h); g.closePath(); g.globalAlpha = 0.4; g.fill();
  g.globalAlpha = 1; g.fillStyle = '#4a4844';
  g.beginPath(); g.moveTo(0, h); g.lineTo(vx - w * 0.07, vy + h * 0.08); g.lineTo(vx + w * 0.07, vy + h * 0.08); g.lineTo(w, h); g.closePath(); g.fill();   // the floor
  g.strokeStyle = '#1a1816'; g.lineWidth = 2;
  for (const t of [0.18, 0.42, 0.64]) {   // door frames on both walls
    const x = t * (vx - w * 0.07), yt = (t * (vy - h * 0.12)), yb = h - t * (h - vy - h * 0.08);
    g.strokeRect(x, yt + (yb - yt) * 0.25, (1 - t) * w * 0.06, (yb - yt) * 0.7);
    const xr = w - x - (1 - t) * w * 0.06; g.strokeRect(xr, yt + (yb - yt) * 0.25, (1 - t) * w * 0.06, (yb - yt) * 0.7);
  }
  g.fillStyle = 'rgba(240,238,230,0.5)'; for (const t of [0.15, 0.4, 0.62]) g.fillRect(vx - w * 0.05 * (1 - t) - w * 0.02, t * vy * 0.6, w * 0.1 * (1 - t) + w * 0.04, 6 * (1 - t) + 2);   // ceiling lights
}
/** the default hidden layer: someone standing at the end of the corridor */
function drawFigure(g, w, h) {
  const x = w * 0.55, y = h * 0.5, s = h * 0.32;
  g.fillStyle = '#0c0b0a';
  g.beginPath(); g.ellipse(x, y - s * 0.38, s * 0.09, s * 0.11, 0, 0, Math.PI * 2); g.fill();   // the head
  g.beginPath(); g.moveTo(x - s * 0.11, y - s * 0.4); g.quadraticCurveTo(x - s * 0.16, y - s * 0.05, x - s * 0.13, y + s * 0.1); g.lineTo(x + s * 0.13, y + s * 0.1); g.quadraticCurveTo(x + s * 0.16, y - s * 0.05, x + s * 0.11, y - s * 0.4); g.fill();   // long hair
  g.fillRect(x - s * 0.1, y - s * 0.22, s * 0.2, s * 0.62);   // the body
  g.fillRect(x - s * 0.07, y + s * 0.38, s * 0.05, s * 0.2); g.fillRect(x + s * 0.02, y + s * 0.38, s * 0.05, s * 0.2);
  g.fillStyle = '#d0ccc4'; g.beginPath(); g.ellipse(x, y - s * 0.36, s * 0.045, s * 0.06, 0, 0, Math.PI * 2); g.fill();   // a pale face
}
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export default {
  type: 'darkroom-develop',
  about: '印画紙を現像・停止・定着の液に移し、揺らしながら、ちょうどの濃さで引き上げる',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), calm = calmOf(ctx);
      const speed = cfg.speed || 10, base = cfg.window || [0.68, 0.88], stopSec = cfg.stop ?? 2, fixSec = cfg.fix ?? 4;
      const trays = cfg.trays || ['現像液', '停止液', '定着液'];
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '写真を現像する', help: cfg.help || '揺らしながら浸けて、絵が浮かんだら黒くなる前に「引き上げる」。' }, done);
      const s = stageLayout(f, 'mgx-dr', { view: '<canvas class="mgx-dr-cv" aria-hidden="true"></canvas>', side: `<p class="mgx-st-line mgx-dr-line"></p><button type="button" class="btn mgx-dr-rock">揺らす</button><button type="button" class="btn primary mgx-dr-pull">引き上げる</button>`, label: '暗室の皿と印画紙' });
      const cv = s.q('canvas'), line = s.q('.mgx-dr-line'), rockB = s.q('.mgx-dr-rock'), pullB = s.q('.mgx-dr-pull');
      const st = { phase: 0, d: 0, agT: 0, devT: 0, stop: 0, fix: 0, rock: 0, tilt: 0, wave: 0, sheets: 1, misses: 0, flick: 0, lift: 0, out: false };
      const keys = new Set();
      // the photo and its hidden layer, drawn once in greys
      const PW = 320, PH = 220, photo = document.createElement('canvas'), ghost = document.createElement('canvas');
      photo.width = ghost.width = PW; photo.height = ghost.height = PH;
      const pg = photo.getContext('2d'), gg = ghost.getContext('2d');
      drawCorridor(pg, PW, PH); if (cfg.reveal !== false) drawFigure(gg, PW, PH);
      Promise.all([loadImg(cfg.image), loadImg(cfg.reveal || null)]).then(([im, rv]) => {
        if (im) { pg.filter = 'grayscale(1)'; pg.drawImage(im, 0, 0, PW, PH); pg.filter = 'none'; }
        if (rv) { gg.clearRect(0, 0, PW, PH); gg.filter = 'grayscale(1)'; gg.drawImage(rv, 0, 0, PW, PH); gg.filter = 'none'; }
      });
      const blot = noise2((cfg.seed ?? 5) + 11, 6), r = rng(cfg.seed ?? 5);
      const win = () => (st.misses >= 2 ? [base[0] - 0.03, base[1] + 0.03] : base);
      const say = (t) => f.say(t);
      const setLine = () => {
        const sec = st.phase === 0 ? st.devT : st.phase === 1 ? st.stop : st.fix;
        line.textContent = `${trays[Math.min(2, st.phase)]}　${sec.toFixed(1)} 秒${st.phase === 1 ? ` / ${stopSec} 秒` : st.phase === 2 ? ` / ${fixSec} 秒` : ''}　紙 ${st.sheets} 枚目`;
      };
      const newSheet = (why) => { st.misses++; st.sheets++; st.d = 0; st.agT = 0; st.devT = 0; st.lift = 0; snd('wrong'); f.miss(); say(WHY[why] + (st.misses === 2 ? '　時計に上げる帯を出した。' : '')); };
      const pull = () => {
        if (f.done || st.out) return;
        if (st.phase === 0) {
          const res = printResult(st.d, st.devT ? st.agT / st.devT : 0, win());
          if (res !== 'ok') return newSheet(res);
          st.phase = 1; st.lift = 1; snd('pull'); say(`${trays[1]}へ。現像が止まるまで浸ける。`);
        } else if (st.phase === 1) {
          if (st.stop < stopSec) { say('まだ止まりきっていない。もう少し浸ける。'); snd('wrong'); return; }
          st.phase = 2; st.lift = 1; snd('pull'); say(`${trays[2]}へ。絵が落ち着くまで浸ける。`);
        } else if (st.phase === 2) {
          if (st.fix < fixSec) { st.misses++; say('定着が足りない。光で曇ってしまう。液に戻す。'); snd('wrong'); f.miss(); return; }
          st.phase = 3; st.out = true; snd('pull'); snd('ok'); say(cfg.ok || '焼き付いた。……奥に、誰か立っている。'); solved(f); f.win(1100);
        }
      };
      pullB.onclick = pull;
      hold(rockB, { tick: (dt) => { st.rock = Math.min(1, st.rock + dt * 6); } });
      let lastX = null;
      drag(cv, { down: (p) => { lastX = p.x; }, move: (p) => { const dx = p.x - (lastX ?? p.x); lastX = p.x; st.rock = Math.min(1, st.rock + Math.abs(dx) / 40); st.tilt = clamp(st.tilt + dx / 120, -1, 1); }, up: () => { lastX = null; } });
      f.on('keydown', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); keys.add(e.code); }
        if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat && document.activeElement !== rockB && document.activeElement !== pullB) { e.preventDefault(); pull(); }
      });
      f.on('keyup', (e) => keys.delete(e.code));
      let tickAt = 0;
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, w = ui.w, h = ui.h;
        g.fillStyle = '#120605'; g.fillRect(0, 0, w, h);
        // three trays along the top, the current one lit
        const tw = Math.min(110, (w - 40) / 3);
        trays.forEach((t, i) => {
          const x = 12 + i * (tw + 8), on = i === Math.min(2, st.phase);
          g.fillStyle = on ? '#5a1810' : '#2a0c08'; g.fillRect(x, 8, tw, 26);
          g.fillStyle = on ? '#ffd8c8' : '#b08070'; g.font = `${Math.max(11, Math.min(14, tw / 6))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(t, x + tw / 2, 21);
        });
        // the tray seen from above, tilted while rocking
        const top = 44, th = h - top - 34, tx = w * 0.08, tww = w * 0.84;
        g.save(); g.translate(w / 2, top + th / 2); g.rotate(calm ? 0 : st.tilt * 0.05); g.translate(-w / 2, -(top + th / 2));
        g.fillStyle = '#1c0a08'; g.fillRect(tx, top, tww, th);
        g.fillStyle = st.phase === 0 ? '#3a1410' : st.phase === 1 ? '#301a12' : '#2a1416'; g.fillRect(tx + 6, top + 6, tww - 12, th - 12);
        // the paper with the picture rising
        const ar = PW / PH, ph = Math.min(th - 30, (tww - 40) / ar), pw = ph * ar, px = w / 2 - pw / 2, py = top + th / 2 - ph / 2 - st.lift * 10;
        g.fillStyle = '#efe8dc'; g.fillRect(px, py, pw, ph);
        const dev = clamp(st.d / 0.82), over = clamp((st.d - 0.9) * 2.4);
        g.globalAlpha = dev; g.drawImage(photo, px, py, pw, ph);
        const ga = cfg.reveal === false ? 0 : st.phase === 0 ? clamp((st.d - 0.35) / 0.6) * 0.3 : st.phase === 1 ? 0.35 : 0.35 + 0.65 * clamp(st.fix / fixSec);
        g.globalAlpha = dev * ga; g.drawImage(ghost, px, py, pw, ph);
        g.globalAlpha = over; g.fillStyle = '#0a0606'; g.fillRect(px, py, pw, ph);
        const unev = st.phase === 0 && st.devT > 1 ? clamp(0.5 - st.agT / st.devT) * dev : 0;
        if (unev > 0.02) for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const n = blot(i / 6, j / 4); if (n > 0.55) { g.globalAlpha = unev * (n - 0.4); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(px + (i + 0.5) * pw / 6, py + (j + 0.5) * ph / 4, pw / 9, ph / 7, n * 3, 0, Math.PI * 2); g.fill(); } }
        g.globalAlpha = 1;
        // the liquid's ripples over the paper
        if (st.phase < 3) { g.strokeStyle = `rgba(255,140,110,${0.08 + 0.2 * st.rock})`; g.lineWidth = 2; for (let k = 0; k < 5; k++) { const yy = top + 14 + ((k * th) / 5 + st.wave * 40) % (th - 20); g.beginPath(); for (let x = tx + 8; x < tx + tww - 8; x += 8) g.lineTo(x, yy + Math.sin(x / 22 + st.wave * 3 + k) * (2 + 5 * st.rock)); g.stroke(); } }
        g.restore();
        // the darkroom timer along the bottom (the band only after two spoiled sheets)
        const by = h - 22, bx = 14, bw = w - 28;
        g.fillStyle = '#2a0c08'; g.fillRect(bx, by, bw, 10);
        if (st.misses >= 2 && st.phase === 0) { const W2 = win(); g.fillStyle = '#7a3a20'; g.fillRect(bx + bw * W2[0] / 1.3, by, bw * (W2[1] - W2[0]) / 1.3, 10); }
        const prog = st.phase === 0 ? st.d / 1.3 : st.phase === 1 ? st.stop / stopSec : clamp(st.fix / fixSec);
        g.fillStyle = '#ff6a4a'; g.fillRect(bx + bw * clamp(prog) - 2, by - 4, 4, 18);
        // the safelight: red over everything, a flicker now and then
        g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ff5a40'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
        if (st.flick > 0) { g.fillStyle = `rgba(0,0,0,${0.55 * st.flick})`; g.fillRect(0, 0, w, h); }
      }
      loop(f, (dt) => {
        if (keys.size) st.rock = Math.min(1, st.rock + dt * 6), st.tilt = clamp(st.tilt + (keys.has('ArrowRight') ? 1 : -1) * dt * 4, -1, 1);
        const rocking = st.rock > 0.25;
        if (!st.out) {
          if (st.phase === 0) { st.d += dt / speed; st.devT += dt; if (rocking) st.agT += dt; if (st.d > 1.3) newSheet('dark'); }
          else if (st.phase === 1) st.stop += dt * (rocking ? 1.25 : 1);
          else if (st.phase === 2) st.fix += dt * (rocking ? 1.25 : 1);
          if (rocking && Math.random() < dt * 3) snd('slosh');
          tickAt += dt; if (tickAt > 1) { tickAt = 0; snd('tick'); }
        }
        st.rock = Math.max(0, st.rock - dt * 2.2); st.tilt *= 1 - dt * 3; st.wave += dt * (0.2 + st.rock); st.lift = Math.max(0, st.lift - dt * 2);
        if (!calm) { if (st.flick > 0) st.flick = Math.max(0, st.flick - dt * 6); else if (r() < dt * 0.12) st.flick = 1; }
        rockB.classList.toggle('on', rocking); setLine(); draw();
      });
      solvable(host, () => { st.phase = 0; st.d = (base[0] + base[1]) / 2; st.devT = 4; st.agT = 4; pull(); st.stop = stopSec; pull(); st.fix = fixSec; pull(); }, () => ({ phase: st.phase, d: st.d, win: win(), sheets: st.sheets, misses: st.misses, stop: st.stop, fix: st.fix, agit: st.devT ? st.agT / st.devT : 0 }));
      setLine();
      if (ctx.qa) return f.end(true);
      pullB.focus();
    });
  },
};
