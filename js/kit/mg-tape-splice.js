/* game-kit 10af67dd: js/mg-tape-splice.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "tape-splice" (テープの継ぎ合わせ, standard 1.24.0: a cut-up recording on an old reel, an answering machine tape, the last
// words someone taped over). The tape lies cut into strips; play each one, put them in order, turn the ones that run backwards, then play the
// joined tape. The wave of one strip runs on into the next, so the joints can be matched by eye as well as by ear. When it is right, the
// message is heard (the game's own voice line, else the strips themselves, always with the words on screen).
//   cfg: title, help, pieces ([{ text, from?, to? }]: the strips in their true order; from / to are seconds of cfg.src), src (url of the
//        recording; without it a voice-like murmur is made on the spot), voice (url of the whole line, played when solved), message (the line's
//        words; default the strips joined), seed (5), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'pick' | 'put' | 'flip' | 'click' | 'wrong' | 'ok'
//   play scripts: host.mgSolve() lays the strips right and plays them through the same check
import { mgFrame } from './mg-frame.js';
import { stageLayout, crisp, drag, loop, solved, solvable, clamp, noise2, rng, shuffled } from './mg-stage.js';

const DEF = [{ text: '……そこから' }, { text: '出て。' }, { text: 'あの子は、' }, { text: 'もう' }, { text: 'うしろにいる' }];
/** the rule (pure): the tape is right when every strip is in its place and runs forwards; else how many joints already fit */
export function tapeCheck(order) {
  const ok = order.every((s, i) => s.i === i && !s.flip);
  let joints = 0;
  for (let k = 0; k + 1 < order.length; k++) if (!order[k].flip && !order[k + 1].flip && order[k + 1].i === order[k].i + 1) joints++;
  return { ok, joints, flipped: order.filter((s) => s.flip).length, first: order[0].i === 0 && !order[0].flip };
}
/** what a strip says on screen (a backwards strip reads backwards) */
export const stripText = (text, flip) => (flip ? [...String(text)].reverse().join('') : String(text));

export default {
  type: 'tape-splice',
  about: '切られた録音テープを、聞きながら並べ替え・裏返してつなぎ直す',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k) => hooks.sound && hooks.sound(k, ctx);
      const pieces = cfg.pieces || DEF, N = pieces.length, r = rng(cfg.seed ?? 5);
      const message = cfg.message || pieces.map((p) => p.text).join('');
      // a scrambled deal that is never already right; about half the strips run backwards
      let order;
      for (let k = 0; k < 20; k++) { order = shuffled(pieces.map((_, i) => ({ i, flip: r() < 0.45 })), r); if (!tapeCheck(order).ok && tapeCheck(order).joints === 0) break; }
      if (!order.some((s) => s.flip)) order[Math.floor(r() * N)].flip = true;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || 'テープをつなぎ直す', help: cfg.help || '切れ端を聞いて並べ、逆に回るものは裏返す。そろったら「つないで聞く」。' }, done);
      const s = stageLayout(f, 'mgx-tp', {
        view: '<canvas class="mgx-tp-cv" tabindex="0" aria-label="切られたテープ。← → で選び、A D で動かす、F で裏返す、Space で聞く"></canvas>',
        side: `<p class="mgx-st-line mgx-tp-line" aria-live="polite"></p><div class="mgx-st-row"><button type="button" class="btn mgx-tp-l" aria-label="選んだ切れ端を左へ">←</button><button type="button" class="btn mgx-tp-flip">裏返す</button><button type="button" class="btn mgx-tp-r" aria-label="選んだ切れ端を右へ">→</button></div><div class="mgx-st-row"><button type="button" class="btn mgx-tp-play">一片を聞く</button><button type="button" class="btn primary mgx-tp-all">つないで聞く</button></div>`,
      });
      const cv = s.q('canvas'), line = s.q('.mgx-tp-line');
      const st = { sel: 0, head: -1, playing: false, misses: 0, glow: -1, lift: 0, dragX: null, dragFrom: -1, joined: false };
      // the envelope of the whole recording: one strip's end runs on into the next one's start
      const env = noise2((cfg.seed ?? 5) * 7 + 3, 24), samples = 48;
      // one bump per spoken character, under an envelope that runs on across the cuts (so a joint can be matched by eye)
      const wave = pieces.map((p, i) => { const c = Math.max(1, [...p.text].filter((ch) => !/[、。…\s]/.test(ch)).length); return Array.from({ length: samples }, (__, k) => { const t = (i + k / (samples - 1)) / N, a = 0.12 + 0.88 * env(t, 0.3) ** 2.2, syl = Math.abs(Math.sin((Math.PI * k * c) / (samples - 1))); return a * (0.3 + 0.7 * syl) * (0.85 + 0.15 * Math.abs(Math.sin(k * 2.7 + i))); }); });
      // the sound: the recording's own segment (reversed when the strip runs backwards), else a murmur made of tones
      let buf = null;
      const ac = () => ctx.audio && ctx.audio.ctx;
      if (cfg.src && typeof fetch !== 'undefined') fetch(cfg.src).then((x) => x.arrayBuffer()).then((ab) => { const a = ac(); return a ? a.decodeAudioData(ab) : null; }).then((b) => { buf = b; }).catch(() => {});
      const dur = (p) => (buf && p.to != null ? Math.max(0.2, p.to - p.from) : 0.32 + 0.16 * [...p.text].length);
      const voice = (p, flip) => {
        const a = ac(); if (!a) return;
        if (buf && p.to != null) {
          try {
            const sr = buf.sampleRate, from = Math.floor(p.from * sr), len = Math.max(1, Math.floor((p.to - p.from) * sr)), out = a.createBuffer(buf.numberOfChannels, len, sr);
            for (let c = 0; c < buf.numberOfChannels; c++) { const src = buf.getChannelData(c).subarray(from, from + len), d = out.getChannelData(c); for (let k = 0; k < len; k++) d[k] = flip ? src[len - 1 - k] || 0 : src[k] || 0; }
            const n = a.createBufferSource(); n.buffer = out; n.connect(a.destination); n.start();
          } catch {}
          return;
        }
        const chars = [...p.text].filter((c) => !/[、。…\s]/.test(c)), step = dur(p) / Math.max(1, chars.length);
        (flip ? [...chars].reverse() : chars).forEach((c, k) => {
          const f0 = 150 + (c.codePointAt(0) % 7) * 14;
          ctx.audio.tone({ at: k * step, dur: step * 0.9, freq: f0, type: 'sawtooth', gain: 0.025, slide: flip ? 1.25 : 0.82, attack: flip ? step * 0.7 : 0.01, wet: 0.3 });
          ctx.audio.tone({ at: k * step, dur: step * 0.8, freq: f0 * 3.1, type: 'sine', gain: 0.012, slide: flip ? 1.2 : 0.85, attack: flip ? step * 0.6 : 0.01, wet: 0.3 });
        });
        if (ctx.audio.noiseBurst) ctx.audio.noiseBurst({ dur: dur(p), freq: 3000, q: 0.4, gain: 0.02, wet: 0.05 });
      };
      const setLine = (t) => { line.textContent = t; };
      const slots = () => { const w = ui.w, pad = 10, gap = 6, sw = (w - pad * 2 - gap * (N - 1)) / N; return order.map((_, k) => ({ x: pad + k * (sw + gap), w: sw })); };
      const ui = crisp(cv, () => draw());
      function draw() {
        const g = ui.g, w = ui.w, h = ui.h;
        g.fillStyle = '#1b1714'; g.fillRect(0, 0, w, h);
        // the splicing block: a groove the tape lies in
        const ty = h * 0.2, th = h * 0.56;
        g.fillStyle = '#3a3530'; g.fillRect(0, ty - 8, w, th + 16);
        g.fillStyle = '#2a2622'; g.fillRect(0, ty - 2, w, th + 4);
        const sl = slots();
        order.forEach((p, k) => {
          const { x, w: sw } = sl[k], lift = k === st.sel ? 6 : 0, y = ty - lift + (st.dragFrom === k && st.dragX != null ? -4 : 0);
          const dx = st.dragFrom === k && st.dragX != null ? st.dragX - (x + sw / 2) : 0;
          g.save(); g.translate(dx, 0);
          g.fillStyle = k === st.glow ? '#6a4a26' : '#4a3424'; g.fillRect(x, y, sw, th);   // the tape (oxide side up)
          g.strokeStyle = 'rgba(255,220,180,0.08)'; g.lineWidth = 1; for (let yy = y + 4; yy < y + th; yy += 4) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + sw, yy); g.stroke(); }
          // the wave, as the strip lies now (a backwards strip shows its wave mirrored)
          const wv = wave[p.i], mid = y + th / 2;
          g.strokeStyle = '#e8c890'; g.lineWidth = 1.5; g.beginPath();
          for (let q = 0; q < samples; q++) { const v = wv[p.flip ? samples - 1 - q : q], xx = x + 3 + (q / (samples - 1)) * (sw - 6); g.moveTo(xx, mid - v * th * 0.42); g.lineTo(xx, mid + v * th * 0.42); }
          g.stroke();
          // the cut ends (diagonal, as a razor cut on the block)
          g.fillStyle = '#2a2622'; g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + 5, y); g.lineTo(x - 1, y + th); g.fill(); g.beginPath(); g.moveTo(x + sw + 1, y + th); g.lineTo(x + sw - 5, y + th); g.lineTo(x + sw + 1, y); g.fill();
          if (k === st.sel) { g.strokeStyle = '#ffd890'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, sw - 3, th - 3); }
          if (k === st.glow) { g.strokeStyle = '#ff9a5a'; g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeRect(x - 3, y - 3, sw + 6, th + 6); g.setLineDash([]); }
          g.restore();
          if (st.joined && k > 0) { g.fillStyle = 'rgba(240,240,230,0.55)'; g.fillRect(x - 6, ty + th * 0.1, 6, th * 0.8); }   // splicing tape over the joints
        });
        // the playback head
        if (st.head >= 0) { const hx = 10 + st.head * (w - 20); g.fillStyle = '#ff5a3a'; g.fillRect(hx - 1.5, ty - 14, 3, th + 28); }
        // the reels' edges, top corners
        g.fillStyle = '#0e0c0a'; g.beginPath(); g.arc(-h * 0.12, h * 0.06, h * 0.2, 0, Math.PI * 2); g.arc(w + h * 0.12, h * 0.06, h * 0.2, 0, Math.PI * 2); g.fill();
      }
      let anim = null;   // { t, total, parts, then }
      const play = (list, then) => {
        if (st.playing) return;
        st.playing = true; snd('click');
        const parts = list.map((p) => ({ p, d: dur(pieces[p.i]) })), total = parts.reduce((a, b) => a + b.d, 0);
        let t0 = 0; parts.forEach((x) => { x.at = t0; t0 += x.d; });
        anim = { t: 0, total, parts, then, said: -1, words: [] };
      };
      loop(f, (dt) => {
        if (anim) {
          anim.t += dt;
          const k = anim.parts.findIndex((x) => anim.t >= x.at && anim.t < x.at + x.d);
          if (k >= 0 && k !== anim.said) { anim.said = k; const x = anim.parts[k]; voice(pieces[x.p.i], x.p.flip); anim.words.push(stripText(pieces[x.p.i].text, x.p.flip)); setLine(`「${anim.words.join('｜')}」`); }
          const one = anim.parts.length === 1, slot = one ? order.indexOf(anim.parts[0].p) : -1;
          st.head = one ? (slot + clamp(anim.t / anim.total)) / N : clamp(anim.t / anim.total);
          if (anim.t >= anim.total + 0.25) { const a = anim; anim = null; st.playing = false; st.head = -1; if (a.then) a.then(); }
        }
        draw();
      });
      const select = (k) => { st.sel = (k + N) % N; draw(); };
      const move = (dir) => { if (st.playing || f.done) return; const k = st.sel, j = k + dir; if (j < 0 || j >= N) return; [order[k], order[j]] = [order[j], order[k]]; st.sel = j; st.joined = false; snd('put'); draw(); };
      const flip = () => { if (st.playing || f.done) return; order[st.sel].flip = !order[st.sel].flip; st.joined = false; snd('flip'); draw(); setLine('裏返した。'); };
      const playOne = () => { if (f.done) return; play([order[st.sel]]); };
      const playAll = () => {
        if (f.done || st.playing) return;
        st.joined = true;
        play([...order], judge);
      };
      const judge = () => {
          const c = tapeCheck(order);
          if (c.ok) {
            setLine(`「${message}」`); f.say(cfg.ok || '声がつながった。'); snd('ok');
            if (cfg.voice && typeof window !== 'undefined' && window.Audio) { try { new window.Audio(cfg.voice).play().catch(() => {}); } catch {} }
            solved(f); f.win(1000); return;
          }
          st.misses++; snd('wrong'); f.miss();
          f.say(`つなぎ目が ${c.joints} / ${N - 1} か所合っている。${c.flipped ? '逆に回る切れ端がある。' : ''}`);
          if (st.misses >= 2) { const k = order.findIndex((p, i) => p.i !== i || p.flip); st.glow = k; setLine(`${k + 1} 番目の置き場が違う。波の続きを見て。`); }
          if (st.misses >= 4) { const k = order.findIndex((p, i) => p.i !== i || p.flip), j = order.findIndex((p) => p.i === k); [order[k], order[j]] = [order[j], order[k]]; order[k].flip = false; st.glow = -1; setLine(`${k + 1} 番目を正しく置いた。`); }
          draw();
      };
      s.q('.mgx-tp-l').onclick = () => move(-1); s.q('.mgx-tp-r').onclick = () => move(1);
      s.q('.mgx-tp-flip').onclick = flip; s.q('.mgx-tp-play').onclick = playOne; s.q('.mgx-tp-all').onclick = playAll;
      // tap a strip to pick it, drag it sideways to move it
      const slotAt = (x) => { const sl = slots(); let best = 0; sl.forEach((q, k) => { if (Math.abs(q.x + q.w / 2 - x) < Math.abs(sl[best].x + sl[best].w / 2 - x)) best = k; }); return best; };
      drag(cv, {
        down: (p) => { if (st.playing || f.done) return false; const k = slotAt(p.x); select(k); st.dragFrom = k; st.dragX = null; st.x0 = p.x; snd('pick'); },
        move: (p) => { if (Math.abs(p.x - st.x0) > 8) st.dragX = p.x; draw(); },
        up: (p) => { const from = st.dragFrom; st.dragFrom = -1; if (st.dragX == null) { st.dragX = null; draw(); return; } st.dragX = null; const to = slotAt(p.x); if (to !== from) { const [x] = order.splice(from, 1); order.splice(to, 0, x); st.sel = to; st.joined = false; snd('put'); } draw(); },
      });
      f.on('keydown', (e) => {
        if (f.done) return;
        const a = document.activeElement; if (a && a.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
        const m = { ArrowLeft: () => select(st.sel - 1), ArrowRight: () => select(st.sel + 1), KeyA: () => move(-1), KeyD: () => move(1), KeyF: flip, Space: playOne, KeyE: playOne, Enter: playAll }[e.code];
        if (m) { e.preventDefault(); if (e.shiftKey && e.code === 'ArrowLeft') move(-1); else if (e.shiftKey && e.code === 'ArrowRight') move(1); else m(); }
      });
      solvable(host, () => { order.sort((a, b) => a.i - b.i); order.forEach((p) => (p.flip = false)); anim = null; st.playing = false; st.head = -1; st.joined = true; judge(); }, () => ({ order: order.map((p) => ({ ...p })), sel: st.sel, misses: st.misses, playing: st.playing, glow: st.glow, slots: slots().map((q) => { const R = cv.getBoundingClientRect(); return [R.left + q.x + q.w / 2, R.top + R.height / 2]; }) }));
      setLine('切れ端を押して選び、「一片を聞く」。');
      draw();
      if (ctx.qa) return f.end(true);
      cv.focus();
    });
  },
};
