/* game-kit 10af67dd: js/mg-rubbing.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "rubbing" (拓本・こすり出し, standard 1.24.0: a worn gravestone, a shrine's votive board, a plate screwed to a door). Paper
// lies over a carved surface; rub the charcoal over it and the raised surface turns dark while the carved letters stay pale. Rubbing too hard
// pushes the charcoal into the grooves and the letters smudge (a new sheet costs nothing). When the words can be read, say what they are.
//   cfg: title, help, text (the carving; '\n' = the next column, read top to bottom, right to left), vertical (true), surface ('stone' | 'wood'
//        | 'metal'), choices (['…', …]: what the player picks from; default none = the reveal is the end), answer (the right choice, default the
//        first), seed (9), ok, skin, stamp
//   hooks: { sound(name, ctx, v) }  name = 'draw' | 'flip' | 'wrong' | 'found' | 'ok'
//   play scripts: host.mgSolve() rubs the whole sheet at the right strength and answers through the same rules
import { mgFrame, esc } from './mg-frame.js';
import { stageLayout, crisp, drag, loop, solved, solvable, clamp, noise2, rng, shuffled } from './mg-stage.js';

const GW = 96, GH = 64;
/** the rule (pure): how readable the rubbing is - coverage of the raised surface near the letters and the gap to the grooves */
export function legibility(dark, mask, near) {
  let r = 0, rn = 0, gsum = 0, gn = 0;
  for (let i = 0; i < mask.length; i++) { if (!near[i]) continue; if (mask[i]) { gsum += dark[i]; gn++; } else { r += dark[i]; rn++; } }
  const raised = rn ? r / rn : 0, groove = gn ? gsum / gn : 0;
  return { raised, groove, readable: raised >= 0.55 && raised - groove >= 0.32, smudged: groove >= 0.34 };
}
const PRESS = [{ k: 0.35, name: '軽く' }, { k: 0.65, name: 'ふつう' }, { k: 1, name: '強く' }];
const TONE = { stone: ['#8a8a86', '#5a5a56'], wood: ['#8a6a48', '#5a4028'], metal: ['#7a8288', '#4a5258'] };

export default {
  type: 'rubbing',
  about: '紙の上から炭でこすり、彫られた字を浮かび上がらせて読む',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k, v) => hooks.sound && hooks.sound(k, ctx, v), r = rng(cfg.seed ?? 9);
      const text = cfg.text || '昭和十二年\n千代　七歳', surf = TONE[cfg.surface] ? cfg.surface : 'stone';
      const answer = cfg.answer || (cfg.choices ? cfg.choices[0] : null);
      const choices = cfg.choices ? shuffled(cfg.choices, r) : (cfg.choices === undefined && !cfg.text ? shuffled(['千代　七歳', '千代　九歳', '千枝　七歳'], r) : null);
      const want = cfg.choices ? answer : '千代　七歳';
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '石の字をこすり出す', help: cfg.help || '紙の上を炭でこすって、彫られた字を浮かせる。強すぎると溝まで黒くなる。' }, done);
      const s = stageLayout(f, 'mgx-rb', {
        view: '<canvas class="mgx-rb-cv" tabindex="0" aria-label="石に当てた紙。矢印で炭を動かし、Space を押している間こする"></canvas>',
        side: `<p class="mgx-st-line mgx-rb-line" aria-live="polite"></p><div class="mgx-st-row mgx-rb-tools"><button type="button" class="btn mgx-rb-press">力：ふつう</button><button type="button" class="btn mgx-rb-new">紙を替える</button></div><div class="mgx-st-row mgx-rb-pick" hidden>${(choices || []).map((c, i) => `<button type="button" class="btn mgx-rb-c" data-c="${i}">${esc(c)}</button>`).join('')}</div>`,
      });
      const cv = s.q('canvas'), line = s.q('.mgx-rb-line'), pressB = s.q('.mgx-rb-press'), pick = s.q('.mgx-rb-pick');
      // the carving as a mask of cells (1 = groove), and the cells near the letters
      const mask = new Uint8Array(GW * GH), near = new Uint8Array(GW * GH), dark = new Float32Array(GW * GH);
      const mc = document.createElement('canvas'); mc.width = GW * 4; mc.height = GH * 4; const mg = mc.getContext('2d');
      mg.fillStyle = '#000'; mg.fillRect(0, 0, mc.width, mc.height); mg.fillStyle = '#fff'; mg.strokeStyle = '#fff'; mg.lineWidth = 6;
      const cols = String(text).split('\n'), vertical = cfg.vertical !== false;
      if (vertical) {
        const n = cols.length, cw = mc.width / (n + 1), longest = Math.max(...cols.map((c) => [...c].length)), size = Math.min(cw * 0.8, (mc.height * 0.86) / longest);
        mg.font = `900 ${size}px "Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle';
        cols.forEach((c, k) => { const x = mc.width - cw * (k + 1), chars = [...c], y0 = mc.height / 2 - ((chars.length - 1) * size) / 2; chars.forEach((ch, j) => { mg.fillText(ch, x, y0 + j * size); mg.strokeText(ch, x, y0 + j * size); }); });
      } else {
        const size = Math.min((mc.height * 0.8) / cols.length, (mc.width * 0.9) / Math.max(...cols.map((c) => [...c].length)));
        mg.font = `900 ${size}px "Yu Mincho","Hiragino Mincho ProN",serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle';
        cols.forEach((c, k) => { const y = mc.height / 2 + (k - (cols.length - 1) / 2) * size; mg.fillText(c, mc.width / 2, y); mg.strokeText(c, mc.width / 2, y); });
      }
      const md = mg.getImageData(0, 0, mc.width, mc.height).data;
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let v = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) v += md[((j * 4 + y) * mc.width + i * 4 + x) * 4]; mask[j * GW + i] = v > 255 * 6 ? 1 : 0; }
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (mask[j * GW + i]) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const a = i + x, b = j + y; if (a >= 0 && b >= 0 && a < GW && b < GH) near[b * GW + a] = 1; }
      const grain = noise2((cfg.seed ?? 9) + 1, 12), grain2 = noise2((cfg.seed ?? 9) + 2, 40);
      const st = { press: 1, x: 0.5, y: 0.5, rubbing: false, misses: 0, smudged: false, readable: false, rubT: 0, hint: false, over: false, last: null, answered: false };
      // the surface texture under the paper (drawn once)
      const tex = document.createElement('canvas'); tex.width = GW * 4; tex.height = GH * 4; const tg = tex.getContext('2d'), [c1, c2] = TONE[surf];
      tg.fillStyle = c1; tg.fillRect(0, 0, tex.width, tex.height);
      const id = tg.getImageData(0, 0, tex.width, tex.height);
      for (let y = 0; y < tex.height; y++) for (let x = 0; x < tex.width; x++) { const n = grain(x / tex.width, y / tex.height) * 0.6 + grain2(x / tex.width, y / tex.height) * 0.4, o = (y * tex.width + x) * 4, k = surf === 'wood' ? 0.7 + 0.3 * Math.sin(y / 6 + n * 8) : 0.75 + 0.35 * n; id.data[o] *= k; id.data[o + 1] *= k; id.data[o + 2] *= k; }
      tg.putImageData(id, 0, 0);
      tg.globalAlpha = 0.35; tg.drawImage(mc, 0, 0); tg.globalAlpha = 1;   // the carving, faint on the bare surface
      const img = document.createElement('canvas'); img.width = GW; img.height = GH; const ig = img.getContext('2d'), idata = ig.createImageData(GW, GH);
      const paperRect = () => { const w = ui.w, h = ui.h, ar = GW / GH, pw = Math.min(w - 56, (h - 44) * ar), ph = pw / ar; return { x: (w - pw) / 2, y: (h - ph) / 2 + 6, w: pw, h: ph }; };
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, R = paperRect();
        g.fillStyle = '#141210'; g.fillRect(0, 0, ui.w, ui.h);
        // the carved surface: a stone with a rounded top (a board / a plate for wood / metal), larger than the paper
        const sx = R.x - 22, sy = R.y - 30, sw = R.w + 44, sh = R.h + 60;
        g.save(); g.beginPath(); if (surf === 'stone') { g.moveTo(sx, sy + sh); g.lineTo(sx, sy + 24); g.quadraticCurveTo(sx + sw / 2, sy - 10, sx + sw, sy + 24); g.lineTo(sx + sw, sy + sh); } else g.rect(sx, sy, sw, sh); g.closePath(); g.clip();
        g.drawImage(tex, sx, sy, sw, sh); g.restore();
        if (surf === 'metal') { g.fillStyle = '#c8ccd0'; for (const [x, y] of [[sx + 8, sy + 8], [sx + sw - 8, sy + 8], [sx + 8, sy + sh - 8], [sx + sw - 8, sy + sh - 8]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); } }
        for (let i = 0; i < GW * GH; i++) { const d = dark[i], o = i * 4, v = Math.round(236 - d * 214); idata.data[o] = v; idata.data[o + 1] = v - 4; idata.data[o + 2] = v - 10; idata.data[o + 3] = 255; }
        ig.putImageData(idata, 0, 0);
        g.imageSmoothingEnabled = true; g.drawImage(img, R.x, R.y, R.w, R.h);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
        if (st.hint) { const b = bbox(); g.strokeStyle = 'rgba(180,60,40,0.55)'; g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeRect(R.x + (b[0] / GW) * R.w, R.y + (b[1] / GH) * R.h, ((b[2] - b[0]) / GW) * R.w, ((b[3] - b[1]) / GH) * R.h); g.setLineDash([]); }
        // the charcoal block
        if (!st.readable || !st.answered) { const x = R.x + st.x * R.w, y = R.y + st.y * R.h; g.save(); g.translate(x, y); g.rotate(-0.35); g.fillStyle = '#1a1816'; g.fillRect(-16, -8, 32, 16); g.fillStyle = '#3a3634'; g.fillRect(-16, -8, 32, 4); g.restore(); }
      }
      let bb = null; const bbox = () => { if (bb) return bb; let x0 = GW, y0 = GH, x1 = 0, y1 = 0; for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (mask[j * GW + i]) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); } return (bb = [x0 - 3, y0 - 3, x1 + 4, y1 + 4]); };
      // rub at a point of the paper (0..1): the raised cells darken, the grooves only when pressed hard
      const rub = (x, y, amt) => {
        const p = PRESS[st.press].k, rad = 5.5, cx = x * GW, cy = y * GH;
        for (let j = Math.max(0, Math.floor(cy - rad)); j < Math.min(GH, cy + rad); j++) for (let i = Math.max(0, Math.floor(cx - rad * 1.6)); i < Math.min(GW, cx + rad * 1.6); i++) {
          const d = Math.hypot((i - cx) / 1.6, j - cy); if (d > rad) continue;
          const k = i + j * GW, w = (1 - d / rad) * amt;
          if (mask[k]) { const cap = p > 0.8 ? 0.85 : 0.12; dark[k] += (cap - dark[k]) * Math.min(1, w * p * 0.55); }
          else { const cap = 0.55 + 0.42 * grain((i / GW) * 0.999, (j / GH) * 0.999); dark[k] += Math.max(0, cap - dark[k]) * Math.min(1, w * p * 0.6); }
        }
      };
      const judge = () => {
        const L = legibility(dark, mask, near);
        if (L.smudged && !st.smudged) { st.smudged = true; st.misses++; snd('wrong'); f.miss(); f.say('強すぎて、溝まで黒くなった。紙を替えて、ふつうの力で。'); }
        if (!st.readable && L.readable && !L.smudged) {
          st.readable = true; snd('found');
          if (choices) { line.textContent = '字が読めた。何と刻まれている？'; s.q('.mgx-rb-tools').hidden = true; pick.hidden = false; pick.querySelector('button').focus(); }
          else { st.answered = true; line.textContent = `「${text.replace(/\n/g, '　')}」`; f.say(cfg.ok || '字が浮かび上がった。'); snd('ok'); solved(f); f.win(1000); }
        }
        if (!st.readable) line.textContent = `浮いた字：${Math.round(clamp(L.raised / 0.55) * 100)}%　${PRESS[st.press].name}${st.smudged ? '　溝が黒い' : ''}`;
      };
      const setPress = (k) => { st.press = (k + 3) % 3; pressB.textContent = `力：${PRESS[st.press].name}`; };
      pressB.onclick = () => setPress(st.press + 1);
      s.q('.mgx-rb-new').onclick = () => { dark.fill(0); st.smudged = false; st.readable = false; snd('flip'); f.say('新しい紙を当てた。'); judge(); draw(); };
      pick.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]'); if (!b || f.done) return;
        if (choices[+b.dataset.c] === want) { st.answered = true; line.textContent = `「${text.replace(/\n/g, '　')}」`; f.say(cfg.ok || `刻まれていたのは「${want}」。`); snd('ok'); solved(f); f.win(1000); }
        else { st.misses++; snd('wrong'); f.miss(); f.say('よく見て。字の形が違う。'); b.disabled = true; }
      });
      const toPaper = (p) => { const R = paperRect(); return { x: clamp((p.x - R.x) / R.w), y: clamp((p.y - R.y) / R.h), inside: p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h }; };
      drag(cv, {
        down: (p, e) => { if (st.readable) return false; const q = toPaper(p); st.x = q.x; st.y = q.y; st.last = q; if (e.pointerType === 'pen' && e.pressure) setPress(e.pressure > 0.8 ? 2 : e.pressure > 0.35 ? 1 : 0); },
        move: (p) => { const q = toPaper(p), d = st.last ? Math.hypot((q.x - st.last.x) * GW, (q.y - st.last.y) * GH) : 0; st.x = q.x; st.y = q.y; if (q.inside) { const n = Math.ceil(d / 2) || 1; for (let k = 1; k <= n; k++) rub(st.last.x + ((q.x - st.last.x) * k) / n, st.last.y + ((q.y - st.last.y) * k) / n, 0.5); snd('draw'); st.rubT += 0.02; } st.last = q; },
        up: () => { st.last = null; judge(); },
      });
      cv.addEventListener('pointermove', (e) => { if (e.buttons) return; const R = cv.getBoundingClientRect(), q = toPaper({ x: e.clientX - R.left, y: e.clientY - R.top }); st.x = q.x; st.y = q.y; });
      const keys = new Set();
      f.on('keydown', (e) => {
        if (st.readable) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); keys.add(e.code); }
        if (e.code === 'KeyF' && !e.repeat) setPress(st.press + 1);
      });
      f.on('keyup', (e) => { keys.delete(e.code); if (e.code === 'Space') judge(); });
      let jt = 0, wob = 0;
      loop(f, (dt) => {
        if (keys.size && !st.readable) {
          const v = dt * 0.35; if (keys.has('ArrowLeft')) st.x = clamp(st.x - v); if (keys.has('ArrowRight')) st.x = clamp(st.x + v); if (keys.has('ArrowUp')) st.y = clamp(st.y - v * 1.4); if (keys.has('ArrowDown')) st.y = clamp(st.y + v * 1.4);
          if (keys.has('Space')) { wob += dt * 18; rub(clamp(st.x + Math.sin(wob) * 0.05), clamp(st.y + Math.cos(wob * 0.7) * 0.05), dt * 9); snd('draw'); st.rubT += dt; }
        }
        jt += dt; if (jt > 0.4) { jt = 0; if (!st.readable) judge(); }
        if (!st.hint && (st.rubT > 14 || st.misses >= 2)) { st.hint = true; f.say('字のあるあたりに印を出した。その中を、ふつうの力で。'); }
        draw();
      });
      solvable(host, () => { dark.fill(0); setPress(1); for (let y = 0; y <= 1; y += 0.04) for (let x = 0; x <= 1; x += 0.02) for (let k = 0; k < 4; k++) rub(x, y, 1); judge(); if (choices && !f.done) { const i = choices.indexOf(want); pick.querySelector(`[data-c="${i}"]`).click(); } }, () => { const R = paperRect(), C = cv.getBoundingClientRect(), L = legibility(dark, mask, near), b = bbox(); return { ...L, readableNow: st.readable, smudgedSeen: st.smudged, misses: st.misses, press: st.press, hint: st.hint, paper: [C.left + R.x, C.top + R.y, R.w, R.h], text: [C.left + R.x + (b[0] / GW) * R.w, C.top + R.y + (b[1] / GH) * R.h, ((b[2] - b[0]) / GW) * R.w, ((b[3] - b[1]) / GH) * R.h], want }; });
      judge();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
