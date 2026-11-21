/* game-kit 10af67dd: js/moments.js — edit in game-kit and run tools/kit-sync.js */
// Full-screen moments that are not windows (standard 1.12, from 五人分の朝). From an ext module: import { fade, showDeath, ... } from '../kit/moments.js'
// (node tools/kit-sync.js <game> moments). Every one waits for the player's button and honours calm mode / reduced motion / ?qa.
//   fade(ctx, fn)                    black out, run fn (move the player), come back
//   showDeath(ctx, cause, line, { retry, photo })   the death card; resolves on the button
//   playScene(ctx, { photo, seconds, lines, stamp, after, label, done, voice })   a photo, water rising, lines one by one, a stamp, the button (with 「すべて表示」)
//   dizzy, collapse, wake            the body's effects, from js/body-fx.js (also ctx.body.dizzy() ... without an import)
//   phoneCall(ctx, { who, clock, title, fail, down })   a call that does not get through: it rings, then 圏外; resolves on the button
export { dizzy, collapse, wake } from './body-fx.js';
const CSS = `
.gf-mo-cover{position:fixed;inset:0;z-index:1000;background:#000;opacity:0;transition:opacity .45s ease;pointer-events:auto}
.gf-mo-cover.on{opacity:1}
.gf-mo-card{position:fixed;inset:0;z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,4,5,.94);color:var(--gf-text,#e6ecec);font-family:var(--gf-font,inherit)}
.gf-mo-card-in{max-width:34rem;width:100%;text-align:center}
.gf-mo-card p{font-size:clamp(17px,4.4vw,21px);line-height:1.8;margin:0 0 14px}
.gf-mo-card .gf-mo-sub{color:var(--gf-text-dim,#a9b6b8);font-size:clamp(15px,3.8vw,17px)}
.gf-mo-card .btn{min-height:48px;min-width:12rem;margin-top:10px}
.gf-mo-scene{position:fixed;inset:0;z-index:1001;background:#000;overflow:hidden;color:#eef3f3}
.gf-mo-scene-photo{position:absolute;inset:0;background:#061012 center/cover no-repeat;opacity:0;transition:opacity 1.2s ease}
.gf-mo-scene.go .gf-mo-scene-photo{opacity:.9}
.gf-mo-scene-water{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(to top,rgba(4,16,20,.96),rgba(18,44,52,.72) 70%,rgba(120,160,170,.25));border-top:1px solid rgba(190,220,226,.45);transition:height 13s cubic-bezier(.4,.1,.6,1)}
.gf-mo-scene.go .gf-mo-scene-water{height:78%}
.gf-mo-scene-lines{position:absolute;left:16px;right:16px;top:12%;max-width:36rem;margin:0 auto;text-align:center}
.gf-mo-scene-lines p{font-size:clamp(18px,4.6vw,24px);line-height:1.8;margin:0 0 10px;opacity:0;transition:opacity .8s ease;text-shadow:0 1px 6px #000}
.gf-mo-scene-lines p.on{opacity:1}
.gf-mo-scene.done .gf-mo-scene-lines{opacity:.45;transition:opacity .6s ease}
.gf-mo-scene-black{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .8s ease}
.gf-mo-scene.dark .gf-mo-scene-black{opacity:1}
.gf-mo-scene-end{position:absolute;left:0;right:0;bottom:0;top:46%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:16px;padding:16px;opacity:0;transition:opacity .6s ease;pointer-events:none}
.gf-mo-scene.done .gf-mo-scene-end{opacity:1;pointer-events:auto}
.gf-mo-stamp{font-size:clamp(40px,12vw,64px);color:#c2453a;border:4px solid #c2453a;border-radius:8px;padding:2px 18px;letter-spacing:.2em;transform:rotate(-8deg);opacity:.9}
.gf-mo-scene-end p{font-size:clamp(17px,4.4vw,21px);margin:0}
.gf-mo-scene-end .btn{min-height:48px;min-width:12rem}
.gf-mo-skip{position:absolute;right:16px;bottom:16px;min-height:44px;z-index:2}
.gf-mo-scene.still *{transition:none!important}
.gf-mo-phone{position:fixed;inset:0;z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(1,3,4,.82)}
.gf-mo-phone-in{width:min(320px,100%);border-radius:22px;border:2px solid #39484b;background:linear-gradient(#0d1416,#05090a);padding:22px 18px 18px;color:#dfe9e9;text-align:center;box-shadow:0 10px 40px #000}
.gf-mo-phone-bar{display:flex;justify-content:space-between;font-size:14px;color:#9fb1b2;margin-bottom:26px}
.gf-mo-phone-bar b{font-weight:normal}
.gf-mo-phone-who{font-size:clamp(22px,6vw,28px);letter-spacing:.2em;margin:4px 0 6px}
.gf-mo-phone-st{font-size:16px;color:#9fb1b2;min-height:1.8em}
.gf-mo-phone-st.bad{color:#e08a7e}
.gf-mo-phone-dots{display:flex;gap:8px;justify-content:center;margin:18px 0 22px}
.gf-mo-phone-dots i{width:9px;height:9px;border-radius:50%;background:#4d6366}
.gf-mo-phone-dots i.on{background:#bfe0dc}
.gf-mo-phone .btn{min-height:48px;width:100%}
`;
export function injectCss() {
  if (document.getElementById('gf-moments-css')) return;
  const s = document.createElement('style'); s.id = 'gf-moments-css'; s.textContent = CSS; document.head.appendChild(s);
}
const still = (ctx) => !!(ctx && (ctx.calm || ctx.qa || (ctx.settings && ctx.settings.calm))) || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// black out, run fn (move the player), come back
export async function fade(ctx, fn) {
  injectCss();   // 1.17.0: every moment brings its own CSS (the death card had none unless phoneCall ran first: an invisible card held the game, 水無瀬病院 #23)
  const el = document.createElement('div'); el.className = 'gf-mo-cover'; document.body.appendChild(el);
  try { ctx.fp && ctx.fp.release && ctx.fp.release(); } catch { /* none */ }
  if (!ctx.qa) { await wait(20); el.classList.add('on'); await wait(500); }
  try { await fn(); } finally {
    if (!ctx.qa) { await wait(250); el.classList.remove('on'); await wait(480); }
    el.remove();
  }
}

function button(label, primary = true) { const b = document.createElement('button'); b.type = 'button'; b.className = `btn ${primary ? 'primary' : ''}`; b.textContent = label; return b; }

// the death card: resolves when the player presses 再開する
export function showDeath(ctx, cause, line, o = {}) {
  injectCss();
  return new Promise((done) => {
    try { ctx.fp && ctx.fp.release && ctx.fp.release(); } catch { /* none */ }
    try { ctx.audio && ctx.audio.dropout && ctx.audio.dropout(); } catch { /* no sound */ }
    try { const say = document.getElementById('say'); if (say) say.classList.remove('on'); } catch { /* no say band */ }   // 1.17.0: the thought line never sits over the card's button
    const el = document.createElement('div'); el.className = 'gf-mo-card'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="gf-mo-card-in"><p class="gf-mo-cause"></p><p class="gf-mo-sub"></p></div>';
    el.querySelector('.gf-mo-cause').textContent = cause; el.querySelector('.gf-mo-sub').textContent = line;
    if (o.photo) { const im = document.createElement('img'); im.src = o.photo; im.alt = ''; im.style.cssText = 'display:block;width:100%;max-height:44vh;object-fit:cover;border-radius:6px;margin:0 0 14px'; el.firstChild.insertBefore(im, el.firstChild.firstChild); }
    const b = button(o.retry || 'やり直す'); el.firstChild.appendChild(b);
    el.style.opacity = '0'; document.body.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .35s'; el.style.opacity = '1'; b.focus({ preventScroll: true }); }, still(ctx) ? 0 : 30);
    b.onclick = () => { el.remove(); done(); };
    if (ctx.qa) setTimeout(() => b.click(), 300);
  });
}

// o = { photo, seconds, lines[], stamp, after, label (aria), done (the button), voice(line) }
export function playScene(ctx, o) {
  injectCss();
  return new Promise((done) => {
    try { ctx.fp && ctx.fp.release && ctx.fp.release(); } catch { /* none */ }
    const calm = still(ctx);
    const el = document.createElement('div'); el.className = `gf-mo-scene ${calm ? 'still' : ''}`; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.label || '場面');
    el.innerHTML = `<div class="gf-mo-scene-photo"></div><div class="gf-mo-scene-water"></div><div class="gf-mo-scene-lines"></div><div class="gf-mo-scene-black"></div><div class="gf-mo-scene-end"><div class="gf-mo-stamp"></div><p></p></div>`;
    el.querySelector('.gf-mo-scene-photo').style.backgroundImage = `url('${o.photo}')`;
    const L = el.querySelector('.gf-mo-scene-lines');
    for (const t of o.lines) { const p = document.createElement('p'); p.textContent = t; L.appendChild(p); }
    el.querySelector('.gf-mo-stamp').textContent = o.stamp || '';
    el.querySelector('.gf-mo-scene-end p').textContent = o.after || '';
    const fin = button(o.done || '戻る'); el.querySelector('.gf-mo-scene-end').appendChild(fin);
    const skip = button('すべて表示', false); skip.classList.add('gf-mo-skip'); el.appendChild(skip);
    document.body.appendChild(el);
    const timers = [];
    const end = () => { timers.forEach(clearTimeout); el.classList.add('go', 'done'); L.querySelectorAll('p').forEach((p) => p.classList.add('on')); skip.remove(); try { ctx.audio && ctx.audio.stamp && ctx.audio.stamp(); } catch { /* no sound */ } fin.focus({ preventScroll: true }); };
    fin.onclick = () => { el.remove(); done(); };
    skip.onclick = end;
    if (calm) { end(); if (ctx.qa) setTimeout(() => fin.click(), 300); return; }
    const sec = o.seconds || 7, ps = [...L.querySelectorAll('p')], gap = (sec - 2.2) / ps.length;
    timers.push(setTimeout(() => el.classList.add('go'), 60));
    ps.forEach((p, i) => timers.push(setTimeout(() => { p.classList.add('on'); o.voice && o.voice(p.textContent); }, (0.5 + i * gap) * 1000)));
    try { ctx.audio && ctx.audio.noise && ctx.audio.noise('water'); } catch { /* no sound */ }
    timers.push(setTimeout(() => el.classList.add('dark'), (sec - 1.2) * 1000));
    timers.push(setTimeout(() => { el.classList.remove('dark'); el.querySelector('.gf-mo-scene-photo').style.opacity = '.25'; end(); }, (sec + 0.6) * 1000));
  });
}

// ---- a call that does not get through ----
const quiet = (f) => { try { f(); } catch { /* no sound */ } };
/** a call that does not get through: dial, ring, 圏外. Resolves when the player lowers the phone */
export function phoneCall(ctx, o = {}) {
  injectCss();
  return new Promise((done) => {
    quiet(() => ctx.fp && ctx.fp.release && ctx.fp.release());
    const el = document.createElement('div'); el.className = 'gf-mo-phone'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.title || '電話');
    el.innerHTML = '<div class="gf-mo-phone-in"><div class="gf-mo-phone-bar"><b></b><b class="gf-mo-clock"></b></div><div class="gf-mo-phone-who"></div><div class="gf-mo-phone-st">発信中</div><div class="gf-mo-phone-dots"><i></i><i></i><i></i></div></div>';
    el.querySelector('.gf-mo-phone-bar b').textContent = o.title || '電話'; el.querySelector('.gf-mo-clock').textContent = o.clock || ''; el.querySelector('.gf-mo-phone-who').textContent = o.who || '';
    const st = el.querySelector('.gf-mo-phone-st'), dots = [...el.querySelectorAll('.gf-mo-phone-dots i')], bar = el.querySelector('.gf-mo-phone-bar b');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary'; b.textContent = o.down || '電話を下ろす'; b.disabled = true;
    el.firstChild.appendChild(b); document.body.appendChild(el);
    const timers = []; const at = (ms, f) => timers.push(setTimeout(f, ms));
    const ring = () => quiet(() => { ctx.audio.tone({ dur: 0.4, freq: 425, type: 'sine', gain: 0.06, wet: 0.1 }); ctx.audio.tone({ at: 0.5, dur: 0.4, freq: 425, type: 'sine', gain: 0.06, wet: 0.1 }); });
    const fail = () => {
      st.textContent = o.fail || '圏外　つながりません'; st.classList.add('bad'); bar.textContent = '圏外';
      dots.forEach((d) => d.classList.remove('on'));
      quiet(() => { ctx.audio.tone({ dur: 0.18, freq: 480, type: 'square', gain: 0.03, wet: 0.05 }); ctx.audio.tone({ at: 0.25, dur: 0.18, freq: 480, type: 'square', gain: 0.03, wet: 0.05 }); ctx.audio.tone({ at: 0.5, dur: 0.18, freq: 480, type: 'square', gain: 0.03, wet: 0.05 }); });
      b.disabled = false; b.focus({ preventScroll: true });
      if (ctx.qa) setTimeout(() => b.click(), 200);
    };
    b.onclick = () => { timers.forEach(clearTimeout); el.remove(); done(); };
    if (ctx.qa) { fail(); return; }
    let k = 0; const tick = () => { dots.forEach((d, i) => d.classList.toggle('on', i === k % 3)); k++; };
    for (let i = 0; i < 12; i++) at(i * 350, tick);
    at(600, ring); at(2600, ring);
    at(4400, () => { st.textContent = '呼び出し中……'; });
    at(5200, () => quiet(() => ctx.audio.noiseBurst({ dur: 0.9, freq: 1800, q: 0.6, gain: 0.12, type: 'bandpass', wet: 0.2 })));   // a breath of static, nothing more
    at(6300, fail);
  });
}
