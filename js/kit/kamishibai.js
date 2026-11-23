/* game-kit 795fc9be: js/kamishibai.js — edit in game-kit and run tools/kit-sync.js */
// The ending as a kamishibai (紙芝居) - standard 1.39.0, 札の家 play test 2026-11-23 #7 「最後は紙芝居風に各場面と言葉を見せてください。ここも喋るようにしてほしいです」.
// A wooden stage (butai) in the dark; in it one picture card at a time, its words under it (beside it on a low landscape screen), read
// aloud. The player turns the cards: つぎへ / もどる (and → ← Enter Space). Nothing turns by itself (rules: no auto-advance); the voice of a
// card stops when the card is pulled. After the last card the promise resolves and the game shows its ending card (title, buttons).
//
//   import { showKamishibai } from './kit/kamishibai.js';
//   await showKamishibai(ctx, { pages: e.pages, label: '札の家' });     // pages: [{ photo, text, voice?, title? }]
//   showEndingScene(ctx, { ...e, text: '', roll: [] , ... });             // then the title and the buttons
//
// endings.json: "pages": [{ "photo": "assets/photos/ks-01.webp", "text": "…", "voice": "assets/voice/ks-01.mp3" }] (check-playtest P64 and
// tools/kamishibai-check.mjs: every picture and voice exists, the words fit a phone - at most 90 characters a card).
// Pure parts (tested in test/kamishibai.test.mjs): kamishibaiPages(raw) cleans the list, cardLabel(i, n) the counter, KS_MAX_CHARS.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const KS_MAX_CHARS = 90;
/** the cards to show: those with a picture or words, text trimmed */
export function kamishibaiPages(raw) {
  return (Array.isArray(raw) ? raw : []).filter((p) => p && (p.photo || (p.text && String(p.text).trim()))).map((p) => ({ photo: p.photo || "", text: String(p.text || "").trim(), voice: p.voice || "", title: p.title || "" }));
}
/** the counter under the stage: 「3 / 11」 */
export const cardLabel = (i, n) => `${i + 1} / ${n}`;
/** the button that turns the card: the last one ends the show */
export const nextLabel = (i, n) => (i >= n - 1 ? "おわり" : "つぎへ");

const CSS = `
.gf-ks{position:fixed;inset:0;z-index:80;background:radial-gradient(ellipse at 50% 40%,#2a2018 0%,#0c0907 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;color:#f3e9d6;font-family:inherit;overflow:hidden}
.gf-ks-head{font-size:13px;letter-spacing:.3em;color:#c9b08a;opacity:.85}
.gf-ks-body{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:980px;flex:none}
.gf-ks-stage{position:relative;width:min(100%,calc((100dvh - 290px) * 1.29));aspect-ratio:1.29/1;padding:14px;box-sizing:border-box;border-radius:6px;background:linear-gradient(135deg,#6b4a2c,#3c2614 55%,#5a3d22);box-shadow:0 10px 40px rgba(0,0,0,.7),inset 0 0 0 3px #2a1a0c,inset 0 0 0 6px #7a5634}
.gf-ks-window{position:relative;width:100%;height:100%;overflow:hidden;background:#0a0806;box-shadow:inset 0 0 0 2px #1c120a}
.gf-ks-card{position:absolute;inset:0;background:#e9dfc8 center/cover no-repeat;transition:transform .55s cubic-bezier(.5,0,.2,1)}
.gf-ks-card.out{transform:translateX(-104%)} .gf-ks-card.in{transform:translateX(104%)} .gf-ks-card.back{transform:translateX(104%)}
.gf-ks-words{width:min(100%,860px);background:#efe4cb;color:#2a1d12;border-radius:4px;padding:14px 18px;box-sizing:border-box;font-size:clamp(16px,2.3vw,21px);line-height:1.75;min-height:4.2em;box-shadow:0 4px 18px rgba(0,0,0,.5)}
.gf-ks-words b{display:block;font-size:.8em;color:#7a4a22;letter-spacing:.12em;margin-bottom:2px}
.gf-ks-bar{display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap}
.gf-ks-count{font-size:14px;color:#c9b08a;min-width:4.5em;text-align:center}
.gf-ks .btn{min-width:7.5em;min-height:44px}
.gf-ks-skip{background:none;border:none;color:#9c8a70;font-size:13px;text-decoration:underline;cursor:pointer;min-height:44px;padding:0 6px}
@media (max-aspect-ratio:1/1){.gf-ks-stage{width:100%}}
@media (min-aspect-ratio:3/2) and (max-height:520px){.gf-ks{padding:8px 16px;gap:6px}.gf-ks-head{display:none}.gf-ks-body{flex-direction:row;align-items:stretch;max-width:none}
 .gf-ks-stage{width:auto;height:calc(100dvh - 76px);flex:0 0 auto;padding:8px}.gf-ks .btn{min-height:40px}.gf-ks-words{flex:1 1 auto;width:auto;font-size:15px;line-height:1.65;overflow:auto;padding:10px 14px}}
.gf-ks.still .gf-ks-card{transition:none}
`;

export function showKamishibai(ctx, o = {}) {
  const pages = kamishibaiPages(o.pages);
  if (!pages.length) return Promise.resolve();
  const still = !!(ctx && ctx.calm) || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  ctx && ctx.fp && ctx.fp.release && ctx.fp.release();
  if (!document.getElementById("gf-ks-css")) { const st = document.createElement("style"); st.id = "gf-ks-css"; st.textContent = CSS; document.head.appendChild(st); }
  const old = document.getElementById("gf-ks"); if (old) old.remove();
  const el = document.createElement("div");
  el.id = "gf-ks"; el.className = `gf-ks${still ? " still" : ""}`; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `${o.label || ""} 紙芝居`); el.tabIndex = -1;
  el.innerHTML = `<p class="gf-ks-head">${esc(o.label || "")}${o.label ? "　" : ""}紙芝居</p>
    <div class="gf-ks-body"><div class="gf-ks-stage"><div class="gf-ks-window"></div></div><div class="gf-ks-words" aria-live="polite"></div></div>
    <div class="gf-ks-bar"><button type="button" class="btn gf-ks-prev">もどる</button><span class="gf-ks-count"></span><button type="button" class="btn primary gf-ks-next">つぎへ</button><button type="button" class="gf-ks-skip">最後まで飛ばす</button></div>`;
  document.body.appendChild(el);
  const win = el.querySelector(".gf-ks-window"), words = el.querySelector(".gf-ks-words"), count = el.querySelector(".gf-ks-count"), prev = el.querySelector(".gf-ks-prev"), next = el.querySelector(".gf-ks-next");
  // the pictures load before the show turns to them (no blank card)
  for (const p of pages) if (p.photo) { const im = new Image(); im.src = p.photo; }
  let i = -1, card = null, voice = null, audio = null;
  const hush = () => { try { voice && voice.stop && voice.stop(); } catch { /* gone */ } voice = null; if (audio) { try { audio.pause(); } catch { /* gone */ } audio = null; } };
  const speak = (src) => {
    hush(); if (!src) return;
    if (ctx && ctx.voiceLine) { voice = ctx.voiceLine(src, null, { prio: "story", cut: true }); if (voice) return; }
    try { audio = new Audio(src); audio.volume = 0.9; audio.play().catch(() => {}); } catch { audio = null; }
  };
  const show = (k, dir = 1) => {
    if (k < 0 || k >= pages.length || k === i) return;
    const p = pages[k], c = document.createElement("div");
    c.className = `gf-ks-card ${dir > 0 ? "in" : "out"}`; if (p.photo) c.style.backgroundImage = `url('${p.photo.replace(/'/g, "%27")}')`; c.setAttribute("role", "img"); c.setAttribute("aria-label", p.title || p.text.slice(0, 30));
    win.appendChild(c);
    const was = card; card = c; i = k;
    requestAnimationFrame(() => requestAnimationFrame(() => { c.classList.remove("in", "out"); if (was) { was.classList.add(dir > 0 ? "out" : "back"); setTimeout(() => was.remove(), still ? 0 : 600); } }));
    words.innerHTML = `${p.title ? `<b>${esc(p.title)}</b>` : ""}${esc(p.text).replace(/\n/g, "<br>")}`;
    count.textContent = cardLabel(k, pages.length); prev.disabled = k === 0; next.textContent = nextLabel(k, pages.length);
    if (ctx && ctx.sound) try { ctx.sound("paper"); } catch { /* no such sound */ }
    speak(p.voice);
  };
  return new Promise((resolve) => {
    const end = () => { hush(); el.remove(); removeEventListener("keydown", key, true); resolve(); };
    const fwd = () => (i >= pages.length - 1 ? end() : show(i + 1, 1));
    const key = (e) => {
      if (!el.isConnected) return;
      if (e.code === "ArrowRight" || ((e.code === "Enter" || e.code === "Space") && !(e.target.closest && e.target.closest("button")))) { e.preventDefault(); e.stopPropagation(); fwd(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); show(i - 1, -1); }
    };
    next.addEventListener("click", fwd); prev.addEventListener("click", () => show(i - 1, -1));
    el.querySelector(".gf-ks-skip").addEventListener("click", () => show(pages.length - 1, 1));
    addEventListener("keydown", key, true);
    show(0, 1); el.focus({ preventScroll: true }); setTimeout(() => next.focus({ preventScroll: true }), 50);
  });
}
