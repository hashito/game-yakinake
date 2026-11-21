/* game-kit 10af67dd: js/mg-torn-paper.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "torn-paper" (破れた紙の復元, standard 1.24.0: a note torn up and thrown in the stove, a page ripped from a diary, a
// charm torn in four). The pieces have ragged edges; drag them onto the outline, turn them, and a piece that sits right (its edges meet the
// others) snaps in. Two pieces belong to another paper and never fit (a different colour and ruling). When it is whole, the note is read in
// the reading panel.
//   cfg: title, help, text (the note, '\n' between lines), cols (3) x rows (2) pieces, decoys (2), seed (6), paper ({ title }: the reading
//        panel's heading), ok, skin, stamp, next (「読み終えた」)
//   hooks: { sound(name, ctx), read(doc) }  name = 'pick' | 'put' | 'turn' | 'join' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() lays every piece on its place through the same snap rule
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, drag, hold, loop, solved, solvable, clamp, rng } from './mg-stage.js';
import { readPanel } from './mg-read.js';

const TEXT = '三日目の夜。\n戸を開けても、誰もいない。\nでも靴が一足ふえている。\n台所の、いちばん奥の戸棚は開けないで。';
/** the snap rule (pure): a piece is in place when it is near its spot and turned nearly right (degrees) */
export const snapOk = (dx, dy, ang, tol = 22, atol = 14) => Math.hypot(dx, dy) <= tol && Math.abs(((ang % 360) + 540) % 360 - 180) <= atol;
const PW = 360, PH = 250;
/** ragged edge between two points (seeded, shared by both neighbours) */
function rag(a, b, r, amp) {
  const out = [a]; const n = 7;
  for (let k = 1; k < n; k++) { const t = k / n, nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1, o = (r() - 0.5) * amp * 2; out.push([a[0] + (b[0] - a[0]) * t + (nx / l) * o, a[1] + (b[1] - a[1]) * t + (ny / l) * o]); }
  out.push(b); return out;
}
/** cut the sheet (pure, seeded): one polygon per piece in sheet coordinates */
export function tearSheet(seed = 6, cols = 3, rows = 2) {
  const r = rng(seed), V = [];
  for (let j = 0; j <= rows; j++) { V.push([]); for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; V[j].push([(i / cols) * PW + (edge ? 0 : (r() - 0.5) * 0.3 * (PW / cols)), (j / rows) * PH + (edge ? 0 : (r() - 0.5) * 0.3 * (PH / rows))]); } }
  const H = [], Vt = [];   // horizontal edges (j, i) -> (j, i+1), vertical (j, i) -> (j+1, i)
  for (let j = 0; j <= rows; j++) { H.push([]); for (let i = 0; i < cols; i++) H[j].push(j === 0 || j === rows ? [V[j][i], V[j][i + 1]] : rag(V[j][i], V[j][i + 1], r, 7)); }
  for (let j = 0; j < rows; j++) { Vt.push([]); for (let i = 0; i <= cols; i++) Vt[j].push(i === 0 || i === cols ? [V[j][i], V[j + 1][i]] : rag(V[j][i], V[j + 1][i], r, 7)); }
  const pieces = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const poly = [...H[j][i], ...Vt[j][i + 1].slice(1), ...[...H[j + 1][i]].reverse().slice(1), ...[...Vt[j][i]].reverse().slice(1, -1)];
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    pieces.push({ poly: poly.map(([x, y]) => [x - cx, y - cy]), home: [cx, cy] });
  }
  return pieces;
}
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

export default {
  type: 'torn-paper',
  about: '破れた紙片を回して合わせ、元の一枚に戻して読む（別の紙の切れ端がまざっている）',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k) => hooks.sound && hooks.sound(k, ctx), r = rng((cfg.seed ?? 6) + 100);
      const text = cfg.text || TEXT, cols = cfg.cols || 3, rows = cfg.rows || 2, decoys = cfg.decoys ?? 2;
      const f = mgFrame(host, { cfg: { ...cfg, next: cfg.next || '読み終えた' }, ctx, title: cfg.title || '破れた紙を戻す', help: cfg.help || '紙片を枠へ運び、回して向きを合わせる。合うとくっつく。違う紙もまざっている。' }, done);
      const s = stageLayout(f, 'mgx-tn', {
        view: '<canvas class="mgx-tn-cv" tabindex="0" aria-label="紙片と台紙。Space で紙片を選び、矢印で動かし、Z X で回す"></canvas>',
        side: '<p class="mgx-st-line mgx-tn-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-tn-l" aria-label="左へ回す">⟲ 回す</button><button type="button" class="btn mgx-tn-r" aria-label="右へ回す">回す ⟳</button></div><button type="button" class="btn mgx-tn-next">次の紙片</button>',
      });
      const cv = s.q('canvas'), line = s.q('.mgx-tn-line');
      // the sheet (and the other paper the decoys come from), drawn once
      const sheet = document.createElement('canvas'); sheet.width = PW; sheet.height = PH;
      const sg = sheet.getContext('2d');
      sg.fillStyle = '#e8dfc8'; sg.fillRect(0, 0, PW, PH);
      for (let k = 0; k < 120; k++) { sg.fillStyle = `rgba(140,110,60,${0.03 + r() * 0.05})`; sg.beginPath(); sg.arc(r() * PW, r() * PH, 1 + r() * 10, 0, Math.PI * 2); sg.fill(); }
      sg.strokeStyle = 'rgba(80,100,150,0.35)'; sg.lineWidth = 1; for (let y = 40; y < PH; y += 34) { sg.beginPath(); sg.moveTo(12, y); sg.lineTo(PW - 12, y); sg.stroke(); }
      sg.fillStyle = '#22202e'; sg.font = '19px "Klee","Yu Gothic","Hiragino Sans",sans-serif'; sg.textBaseline = 'alphabetic';
      String(text).split('\n').forEach((t, k) => sg.fillText(t, 18 + (k % 2) * 6, 34 + k * 34 + 4, PW - 30));
      sg.fillStyle = 'rgba(90,40,30,0.18)'; sg.beginPath(); sg.ellipse(PW * 0.78, PH * 0.72, 34, 22, 0.4, 0, Math.PI * 2); sg.fill();   // a stain
      const other = document.createElement('canvas'); other.width = PW; other.height = PH; const og = other.getContext('2d');
      og.fillStyle = '#d4dcd8'; og.fillRect(0, 0, PW, PH); og.strokeStyle = 'rgba(160,40,40,0.4)'; for (let x = 0; x < PW; x += 22) { og.beginPath(); og.moveTo(x, 0); og.lineTo(x, PH); og.stroke(); }
      og.fillStyle = '#2a2a2a'; og.font = '15px "Yu Mincho",serif'; ['昭和四十年　台帳', '一、米　二升', '二、灯油　一缶', '三、線香'].forEach((t, k) => og.fillText(t, 20, 40 + k * 44));
      const pieces = tearSheet(cfg.seed ?? 6, cols, rows).map((p, i) => ({ ...p, id: i, src: sheet, decoy: false }));
      for (let d = 0; d < decoys; d++) { const w = PW / cols, h = PH / rows, poly = rag([-w / 2, -h / 2], [w / 2, -h / 2], r, 6).concat(rag([w / 2, -h / 2], [w / 2, h / 2], r, 6).slice(1), rag([w / 2, h / 2], [-w / 2, h / 2], r, 6).slice(1), rag([-w / 2, h / 2], [-w / 2, -h / 2], r, 6).slice(1, -1)); pieces.push({ poly, home: [PW * (0.3 + 0.4 * r()), PH * (0.3 + 0.4 * r())], id: 100 + d, src: other, decoy: true }); }
      const st = { sel: -1, grab: -1, misses: 0, hint: 0, t: 0, done: false, off: [0, 0] };
      // the starting pile: shuffled into the tray, turned at random (never right)
      const order = [...pieces.keys()].sort(() => r() - 0.5);
      const half = Math.ceil(pieces.length / 2);   // two loose rows (a wide tray: two columns), a little jitter, never on top of each other's middle
      order.forEach((k, q) => { const p = pieces[k]; p.slot = q; p.jx = (r() - 0.5) * 0.25; p.jy = (r() - 0.5) * 0.2; p.ang = (r() < 0.5 ? -1 : 1) * (30 + r() * 140); p.placed = false; p.z = q; });
      const trayAt = (p, Lb) => { const n = pieces.length, wide = Lb.wide, cols = wide ? 2 : half, rows = wide ? Math.ceil(n / 2) : 2, c = p.slot % cols, rr = Math.floor(p.slot / cols); return [Lb.tray.x + ((c + 0.5 + p.jx) / cols) * Lb.tray.w, Lb.tray.y + ((rr + 0.5 + p.jy) / rows) * Lb.tray.h]; };
      const lay = () => {   // board (the outline) and the tray, in canvas px; portrait: tray below; wide: tray right
        const w = ui.w, h = ui.h, wide = w / h > 1.5;
        const bw = wide ? w * 0.56 : w - 20, bh = wide ? h - 20 : h * 0.56, sc = Math.min(bw / PW, bh / PH);
        const bx = wide ? 10 + (bw - PW * sc) / 2 : (w - PW * sc) / 2, by = wide ? (h - PH * sc) / 2 : 10;
        const tray = wide ? { x: w * 0.58, y: 8, w: w * 0.42 - 8, h: h - 16 } : { x: 8, y: by + PH * sc + 12, w: w - 16, h: h - (by + PH * sc + 12) - 6 };
        return { sc, bx, by, tray, wide };
      };
      const pos = (p, Lb) => (p.placed ? [Lb.bx + p.home[0] * Lb.sc, Lb.by + p.home[1] * Lb.sc] : p.px != null ? [p.px, p.py] : trayAt(p, Lb));
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, Lb = lay();
        g.fillStyle = '#2a2420'; g.fillRect(0, 0, ui.w, ui.h);
        g.fillStyle = '#3a3029'; g.fillRect(Lb.bx, Lb.by, PW * Lb.sc, PH * Lb.sc);
        g.strokeStyle = 'rgba(240,220,180,0.35)'; g.setLineDash([6, 5]); g.strokeRect(Lb.bx, Lb.by, PW * Lb.sc, PH * Lb.sc); g.setLineDash([]);
        if (st.hint && st.sel >= 0 && !pieces[st.sel].decoy && !pieces[st.sel].placed) {   // the hint: where the chosen piece belongs
          const p = pieces[st.sel]; g.save(); g.translate(Lb.bx + p.home[0] * Lb.sc, Lb.by + p.home[1] * Lb.sc); g.scale(Lb.sc, Lb.sc); g.beginPath(); p.poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.strokeStyle = '#ffd890'; g.lineWidth = 2 / Lb.sc; g.stroke(); g.restore();
        }
        const list = [...pieces].sort((a, b) => (a.placed === b.placed ? a.z - b.z : a.placed ? -1 : 1));
        for (const p of list) {
          const [x, y] = pos(p, Lb);
          g.save(); g.translate(x, y); g.rotate(((p.placed ? 0 : p.ang) * Math.PI) / 180); g.scale(Lb.sc, Lb.sc);
          g.beginPath(); p.poly.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
          g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = p.placed ? 0 : 6 / Lb.sc; g.fillStyle = '#000'; g.fill(); g.restore();
          g.save(); g.clip(); g.drawImage(p.src, -p.home[0], -p.home[1]); g.restore();
          g.strokeStyle = 'rgba(255,250,236,0.85)'; g.lineWidth = 1.6 / Lb.sc; g.stroke();   // the torn fibres
          if (pieces.indexOf(p) === st.sel && !p.placed) { g.strokeStyle = '#ffd890'; g.lineWidth = 3 / Lb.sc; g.stroke(); }
          g.restore();
        }
      }
      const placedN = () => pieces.filter((p) => p.placed).length, need = cols * rows;
      const say = (t) => { line.textContent = t; };
      const tryDrop = (i) => {
        const p = pieces[i], Lb = lay(); if (p.placed) return;
        const [x, y] = pos(p, Lb), onBoard = x > Lb.bx && x < Lb.bx + PW * Lb.sc && y > Lb.by && y < Lb.by + PH * Lb.sc;
        if (p.decoy) { if (onBoard) { st.misses++; snd('wrong'); f.miss(); f.say('これは別の紙だ。色も罫線も違う。'); p.px = null; } else snd('put'); return; }
        const dx = (x - (Lb.bx + p.home[0] * Lb.sc)) / Lb.sc, dy = (y - (Lb.by + p.home[1] * Lb.sc)) / Lb.sc;
        if (snapOk(dx, dy, p.ang)) {
          p.placed = true; p.ang = 0; p.px = null; st.sel = -1; snd('join'); f.progress(placedN(), need);
          say(`つながった。（${placedN()} / ${need}）`);
          if (placedN() >= need) finish();
          return;
        }
        snd('put');
        if (onBoard && Math.hypot(dx, dy) <= 40) say(Math.abs(((p.ang % 360) + 540) % 360 - 180) > 14 ? '場所は近い。向きを回して合わせる。' : 'もう少しずらすと合う。');
      };
      const finish = () => { st.done = true; snd('ok'); f.say(cfg.ok || '一枚の紙に戻った。'); solved(f); f.win(900); setTimeout(() => { if (f.root.isConnected) readPanel(f, { title: (cfg.paper && cfg.paper.title) || '破れていた紙', text, paper: 'note' }, hooks); }, 900); };
      const hit = (x, y) => {
        const Lb = lay(); let best = -1, bz = -1;
        pieces.forEach((p, i) => { if (p.placed) return; const [px, py] = pos(p, Lb), a = (-p.ang * Math.PI) / 180, lx = ((x - px) * Math.cos(a) - (y - py) * Math.sin(a)) / Lb.sc, ly = ((x - px) * Math.sin(a) + (y - py) * Math.cos(a)) / Lb.sc; if (inPoly(lx, ly, p.poly)) { const sc = Math.hypot(x - px, y - py) - p.z * 0.01; if (best < 0 || sc < bz) { bz = sc; best = i; } } });   // of the pieces under the finger, the one whose middle is nearest (a pile: tapping a piece's middle takes that piece)
        return best;
      };
      let zTop = pieces.length;
      drag(cv, {
        down: (p) => { if (st.done) return false; const i = hit(p.x, p.y); if (i < 0) return false; const Lb = lay(), [px, py] = pos(pieces[i], Lb); st.grab = i; st.sel = i; pieces[i].z = ++zTop; st.off = [px - p.x, py - p.y]; snd('pick'); draw(); },
        move: (p) => { if (st.grab < 0) return; const q = pieces[st.grab]; q.px = clamp(p.x + st.off[0], 6, ui.w - 6); q.py = clamp(p.y + st.off[1], 6, ui.h - 6); draw(); },
        up: () => { if (st.grab < 0) return; const i = st.grab; st.grab = -1; tryDrop(i); draw(); },
      });
      cv.addEventListener('wheel', (e) => { if (st.sel < 0 || pieces[st.sel].placed) return; e.preventDefault(); turn(e.deltaY > 0 ? 15 : -15); }, { passive: false });
      const turn = (d) => { if (st.sel < 0 || pieces[st.sel].placed || st.done) { say('先に紙片を選ぶ。'); return; } pieces[st.sel].ang = (pieces[st.sel].ang + d) % 360; snd('turn'); draw(); clearTimeout(st.tt); st.tt = setTimeout(() => { if (st.sel >= 0) { const i = st.sel; tryDrop(i); draw(); } }, 350); };
      hold(s.q('.mgx-tn-l'), { down: () => turn(-15), tick: (dt) => { st.ht = (st.ht || 0) + dt; if (st.ht > 0.22) { st.ht = 0; turn(-15); } }, up: () => (st.ht = 0) });
      hold(s.q('.mgx-tn-r'), { down: () => turn(15), tick: (dt) => { st.ht = (st.ht || 0) + dt; if (st.ht > 0.22) { st.ht = 0; turn(15); } }, up: () => (st.ht = 0) });
      const nextPiece = () => { if (st.done) return; const free = pieces.map((p, i) => (p.placed ? -1 : i)).filter((i) => i >= 0); if (!free.length) return; st.sel = free[(free.indexOf(st.sel) + 1) % free.length]; pieces[st.sel].z = ++zTop; snd('pick'); draw(); say(pieces[st.sel].decoy ? '紙片を選んだ。……色が少し違う？' : '紙片を選んだ。'); };
      s.q('.mgx-tn-next').onclick = nextPiece;
      f.on('keydown', (e) => {
        if (st.done) return;
        if (e.code === 'Space' && document.activeElement === cv) { e.preventDefault(); nextPiece(); return; }
        if (e.code === 'KeyZ') { e.preventDefault(); turn(-15); return; }
        if (e.code === 'KeyX') { e.preventDefault(); turn(15); return; }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
        if (d && st.sel >= 0) { e.preventDefault(); const p = pieces[st.sel], Lb = lay(), [x, y] = pos(p, Lb), k = e.shiftKey ? 2 : 8; p.px = clamp(x + d[0] * k, 6, ui.w - 6); p.py = clamp(y + d[1] * k, 6, ui.h - 6); draw(); clearTimeout(st.kt); st.kt = setTimeout(() => { if (st.sel >= 0) { tryDrop(st.sel); draw(); } }, 300); }
      });
      loop(f, (dt) => {
        if (st.done) return;
        st.t += dt;
        if (!st.hint && (st.misses >= 2 || st.t > 60)) { st.hint = 1; f.say('選んだ紙片の場所を、台紙に光らせた。'); }
        if (st.hint === 1 && (st.misses >= 4 || st.t > 120)) { st.hint = 2; const p = pieces.find((q) => !q.decoy && !q.placed); if (p) { p.placed = true; p.ang = 0; f.progress(placedN(), need); say('一枚、元の場所に置いた。'); if (placedN() >= need) finish(); } }
        draw();
      });
      solvable(host, () => { const Lb = lay(); for (const [i, p] of pieces.entries()) { if (p.decoy || p.placed) continue; p.px = Lb.bx + p.home[0] * Lb.sc; p.py = Lb.by + p.home[1] * Lb.sc; p.ang = 0; tryDrop(i); } }, () => { const Lb = lay(), C = cv.getBoundingClientRect(); return { pieces: pieces.map((p) => { const [x, y] = pos(p, Lb); return { at: [C.left + x, C.top + y], home: [C.left + Lb.bx + p.home[0] * Lb.sc, C.top + Lb.by + p.home[1] * Lb.sc], ang: p.ang, placed: !!p.placed, decoy: p.decoy }; }), sel: st.sel, misses: st.misses, hint: st.hint, board: [C.left + Lb.bx, C.top + Lb.by, PW * Lb.sc, PH * Lb.sc] }; });
      f.progress(0, need);
      say('紙片をつかんで、枠の中へ。');
      draw();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
