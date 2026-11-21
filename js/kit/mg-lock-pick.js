/* game-kit 10af67dd: js/mg-lock-pick.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "lock-pick" (standard 1.8.3: an old lock, a padlock, a cupboard): lift the pins one at a time. Hold to push the pin up;
// near the right height the tension wrench gives (the pin glows faintly) - let go there and it sets. Let go anywhere else and the pin only
// drops back. Every `misses` misses on a pin, its band widens a little. Hold the button / Space / E (mouse and touch the same).
//   cfg: title, help, pins (4), seed (3), tol (0.07: half the band), speed (0.55 of the travel per second), misses (3), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'lift' | 'set' | 'drop' | 'ok'
import { mgFrame } from './mg-frame.js';

/** a pin sets when it is let go inside its band */
export const lockPickOk = (h, sweet, tol = 0.07) => Math.abs(h - sweet) <= tol;
/** the sweet heights (0.3..0.85), seeded, never two equal in a row */
export function sweetSpots(n = 4, seed = 3) {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = []; while (out.length < n) { const v = Math.round((0.3 + rnd() * 0.55) * 100) / 100; if (!out.length || Math.abs(v - out[out.length - 1]) > 0.1) out.push(v); }
  return out;
}

export default {
  type: 'lock-pick',
  about: '錠のピンを一本ずつ、手応えのある高さで止めて開ける',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const n = cfg.pins ?? 4, sweet = sweetSpots(n, cfg.seed ?? 3), speed = cfg.speed ?? 0.55, snd = (k) => hooks.sound && hooks.sound(k, ctx);
      const tol = Array(n).fill(cfg.tol ?? 0.07), miss = Array(n).fill(0);
      let cur = 0, h = 0, holding = false, raf = 0, last = 0;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '錠を開ける', help: cfg.help || '押している間ピンが上がります。手応え（ピンがかすかに光る）を感じたところで離すと止まります。' }, (ok) => { cancelAnimationFrame(raf); done(ok); });
      f.body.innerHTML = `<div class="mgx-lock"><div class="mgx-lock-body"><div class="mgx-lock-shear"></div>${sweet.map((_, i) => `<div class="mgx-pin" data-i="${i}"><i></i></div>`).join('')}</div>
        <div class="mgx-lock-wrench" aria-hidden="true"></div><button type="button" class="btn primary mgx-lock-btn">押してピンを上げる</button></div>`;
      const pins = [...f.body.querySelectorAll('.mgx-pin')], btn = f.body.querySelector('.mgx-lock-btn'), wrench = f.body.querySelector('.mgx-lock-wrench');
      const draw = () => {
        pins.forEach((p, i) => { p.classList.toggle('cur', i === cur); p.style.setProperty('--h', String(i < cur ? sweet[i] : i === cur ? h : 0)); });
        const feel = holding && lockPickOk(h, sweet[cur], tol[cur]);
        pins[cur] && pins[cur].classList.toggle('feel', feel); wrench.classList.toggle('feel', feel);
      };
      const tick = (t) => {
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
        if (holding && !f.done) { h = Math.min(1, h + dt * speed); draw(); }
        raf = requestAnimationFrame(tick);
      };
      const press = () => { if (f.done || holding) return; holding = true; snd('lift'); };
      const release = () => {
        if (!holding || f.done) return; holding = false;
        if (lockPickOk(h, sweet[cur], tol[cur])) {
          pins[cur].classList.remove('feel'); pins[cur].classList.add('set'); snd('set'); cur++; h = 0; f.progress(cur, n);
          if (cur >= n) { draw(); snd('ok'); f.say(cfg.ok || 'かちり、と錠が回った。'); f.win(700); return; }
          f.say(`${cur} 本目が止まった。次のピン。`);
        } else {
          snd('drop'); f.miss(); f.say(h < sweet[cur] ? 'まだ低い。ピンが落ちた。' : '上げすぎた。ピンが落ちた。'); h = 0;
          if (++miss[cur] % (cfg.misses ?? 3) === 0 && tol[cur] < 0.14) { tol[cur] += 0.02; f.say('指先が慣れてきた。手応えが分かりやすくなった。'); }
        }
        draw();
      };
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, release);
      f.on('keydown', (e) => { if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); press(); } });
      f.on('keyup', (e) => { if (e.code === 'Space' || e.code === 'KeyE') release(); });
      f.progress(0, n); draw();
      if (ctx.qa) return f.end(true);
      btn.focus(); raf = requestAnimationFrame(tick);
    });
  },
};
