/* game-kit d9e67113: js/ending-scene.js — edit in game-kit and run tools/kit-sync.js */
// The ending as a scene (standard 1.8.1, feedback 2026-11-01 "最後にも写真を置いて手前に文字をつけるなど雰囲気を出して"): the picture fills the
// screen and slowly comes closer, the kicker and the title stand in front of it, the epilogue appears a line at a time, and the stats and
// the buttons come last. A click / Enter / Space shows the rest at once; reduced motion (ctx.calm or the OS setting) shows it all still.
//
//   import { showEndingScene } from './kit/ending-scene.js';
//   ext.registerScreen('ending', { keepSave: false, open: (c, e) => showEndingScene(c, {
//     photo: e.photo, kicker: e.kicker, title: e.title, text: e.text,           // text: paragraphs split by \n
//     stats: '5 / 5 段階 ・ 12分03秒', buttons: [{ label: 'タイトルに戻る', primary: true, fn: () => location.reload() }],
//     endings: { all: c.data.endings, current: e.id } }) });                    // standard 1.8.2: the endings found so far, the rest as ？？？
//
// The core records every ending reached (game-core: Store `<id>.endings.v1`); foundEndings(gameId) reads it (ctx.foundEndings() in the core).
// game-core's own ending (a game that registers no 'ending' screen) is this scene too (standard 1.8.2).
// Pure parts: endingTimeline(paragraphs, o) gives when each part appears (seconds); endingsList(all, found, current) the list with the unfound
// ones masked; both tested in test/ending-scene.test.mjs.
// Kit 1.16 (all-games rule A21): below the buttons, the share row (js/share-bar.js: X で共有 / 共有 / リンクをコピー / 他のゲームを遊ぶ).
// 1.37.0 (水無瀬病院 2026-11-22 #19 「エンディングが短い」): a long epilogue changes its picture as it goes: scenes [{ at, photo }] (at = the
// index of the line from which that picture shows; data/endings.json "scenes"), each fading in over the one before when its line appears.
// share: false leaves it out (a game that puts its own row there); share: { ending: '名前', tags, line } overrides; game.json "share": false
// or { "ending": false } turns it off for the game, { "endingName": true } puts the ending's title in the text (only when that gives nothing away).
import { Store } from "./store.js";
import { mountShareBar } from "./share-bar.js";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 1.36.0 (札の家 2026-11-22 #12 「もう少しエンドロールのテキストを増やして他のことも具体的に教えてください、画像も増やしてください」):
// `roll` - after the epilogue, sections of the end roll, each its own picture and lines (what became of each person and thing):
//   roll: [{ photo: 'assets/photos/roll-police.webp', title: '櫛田千草', text: 'line\nline' }]   (title optional)
// Each picture appears, then its lines one by one; the stats and the buttons come after the last section (no timer closes anything).
export function endingTimeline(paras, o = {}, roll = []) {
  const first = o.first ?? 1.6, per = o.perChar ?? 0.075, min = o.min ?? 1.8;
  let t = first + 1.2;   // the kicker at `first`, the title a little after
  const lines = paras.map((p) => { const at = t; t += Math.max(min, String(p).length * per); return at; });
  const rollAt = (roll || []).map((r) => { const pic = t + 0.6; t = pic + 1.4; const ls = rollLines(r).map((p) => { const at = t; t += Math.max(min, String(p).length * per); return at; }); return { pic, lines: ls }; });
  return { kicker: first, title: first + 0.6, lines, roll: rollAt, stats: t + 0.4, buttons: t + 0.9 };
}
/** the lines of one end-roll section (its text split by \n) */
export const rollLines = (r) => String((r && r.text) || "").split("\n").filter((p) => p.trim());

/** the endings for the list: found (or the current one) by title, the rest as mask; all = [{ id, title }] */
export function endingsList(all = [], found = [], current = null, mask = "？？？") {
  return all.map((e) => ({ id: e.id, title: found.includes(e.id) || e.id === current ? e.title : mask, found: found.includes(e.id) || e.id === current, current: e.id === current }));
}
/** the endings this player has reached (the core's record) */
export function foundEndings(gameId) {
  try { return [...(Store.read(`${gameId}.endings.v1`) || [])]; } catch { return []; }
}

// what the share row of an ending gets (null: no row). Pure: tested in test/share-bar.test.mjs
export function endingShareOptions(manifest, o = {}) {
  const m = manifest ? manifest.share : undefined;
  if (o.share === false || m === false || (m && m.ending === false)) return null;
  const s = { ...(m && typeof m === "object" ? m : {}), ...(o.share && typeof o.share === "object" ? o.share : {}) };
  const ending = s.ending != null ? s.ending : s.endingName && o.title ? o.title : "";
  return { place: "ending", tags: s.tags, line: s.line, ending: typeof ending === "string" ? ending : "", fallbackName: manifest && manifest.title };
}

/** which later pictures of a read-at-once epilogue show (1.37.4): the one whose line (index ats[i]) has its top above 60% of the view
 *  height; pure (test/ending-scene.test.mjs) */
export function laterOn(tops, ats, viewH) {
  return ats.map((at) => tops[at] != null && tops[at] < viewH * 0.6);
}

export function showEndingScene(ctx, o = {}) {
  const paras = String(o.text || "").split("\n").filter((p) => p.trim());
  const still = !!(ctx && ctx.calm) || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!(ctx && ctx.qa);
  const roll = Array.isArray(o.roll) ? o.roll.filter((r) => r && (r.photo || r.text)) : [];
  const tl = endingTimeline(paras, o.timing, roll);
  const en = o.endings && o.endings.all ? endingsList(o.endings.all, o.endings.found || foundEndings(ctx && ctx.manifest && ctx.manifest.id), o.endings.current) : null;
  ctx && ctx.fp && ctx.fp.release && ctx.fp.release();
  const old = document.getElementById("gf-ending"); if (old) old.remove();
  const el = document.createElement("div");
  el.id = "gf-ending"; el.className = `gf-ending ${still ? "still" : ""}`; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", o.title || "エンディング");
  const d = (s) => `style="--d:${s.toFixed(2)}s"`;
  const later = (o.scenes || []).filter((s) => s && s.photo && tl.lines[s.at] != null).map((s) => `<div class="gf-ending-photo gf-ending-later" data-at="${s.at}" style="background-image:url('${esc(s.photo)}');--d:${tl.lines[s.at].toFixed(2)}s"></div>`).join("");
  el.innerHTML = `${o.photo ? `<div class="gf-ending-photo" style="background-image:url('${esc(o.photo)}')"></div>` : ""}${later}<div class="gf-ending-shade"></div>
    <div class="gf-ending-text">
      ${o.kicker ? `<p class="gf-ending-kicker" ${d(tl.kicker)}>${esc(o.kicker)}</p>` : ""}
      ${o.title ? `<h2 class="gf-ending-title" ${d(tl.title)}>${esc(o.title)}</h2>` : ""}
      ${paras.map((p, i) => `<p class="gf-ending-line" ${d(tl.lines[i])}>${esc(p)}</p>`).join("")}
      ${roll.map((r, k) => `${r.photo ? `<figure class="gf-ending-roll" ${d(tl.roll[k].pic)}><img src="${esc(r.photo)}" alt="${esc(r.title || "")}" loading="eager"></figure>` : ""}${r.title ? `<p class="gf-ending-roll-title" ${d(tl.roll[k].pic + 0.4)}>${esc(r.title)}</p>` : ""}${rollLines(r).map((p, i) => `<p class="gf-ending-line" ${d(tl.roll[k].lines[i])}>${esc(p)}</p>`).join("")}`).join("")}
      ${o.stats ? `<p class="gf-ending-stats" ${d(tl.stats)}>${esc(o.stats)}</p>` : ""}
      ${en && en.length > 1 ? `<p class="gf-ending-found" ${d(tl.stats)}>見つけた結末 ${en.filter((x) => x.found).length} / ${en.length}：${en.map((x) => (x.current ? `<b>${esc(x.title)}</b>` : esc(x.title))).join("　／　")}</p>` : ""}
      <div class="gf-ending-buttons" ${d(tl.buttons)}>${(o.buttons || []).map((b, i) => `<button type="button" class="btn ${b.primary ? "primary" : ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>
    </div>`;
  const so = endingShareOptions(ctx && ctx.manifest, o);
  if (so) { const sh = document.createElement("div"); sh.className = "gf-ending-share"; sh.setAttribute("style", `--d:${tl.buttons.toFixed(2)}s`); el.querySelector(".gf-ending-text").appendChild(sh); mountShareBar(sh, so); }
  document.body.appendChild(el);
  // 1.37.4 (水無瀬病院 1.5.1): read at once (calm / reduced motion / a click shows all), the later pictures follow the reading: each shows
  // once its line has come up into the upper part of the screen (before: all of them showed at once, so only the last one was ever seen)
  const lines = [...el.querySelectorAll(".gf-ending-line")], laters = [...el.querySelectorAll(".gf-ending-later")];
  const sync = () => { if (!laters.length || !(still || el.classList.contains("all"))) return; const tops = lines.map((p) => p.getBoundingClientRect().top); const on = laterOn(tops, laters.map((x) => +x.dataset.at), el.clientHeight || innerHeight); laters.forEach((x, i) => x.classList.toggle("on", on[i])); };
  el.addEventListener("scroll", sync, { passive: true }); addEventListener("resize", sync);
  const all = () => { el.classList.add("all"); sync(); };
  el.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button[data-i]"); if (b) { const f = (o.buttons || [])[+b.dataset.i]; f && f.fn && f.fn(); } else all(); });
  el.addEventListener("keydown", (e) => { if ((e.code === "Space" || e.code === "Enter") && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); all(); } });
  el.tabIndex = -1; el.focus({ preventScroll: true }); requestAnimationFrame(sync);
  // a long epilogue is taller than the screen: follow each part down as it appears, until the player scrolls or shows it all (1.10.10)
  if (!still) {
    let follow = true; const stop = () => { follow = false; };
    el.addEventListener("wheel", stop, { passive: true }); el.addEventListener("touchstart", stop, { passive: true }); el.addEventListener("click", stop); el.addEventListener("keydown", stop);
    for (const part of el.querySelectorAll(".gf-ending-text > *")) {
      const at = parseFloat(part.style.getPropertyValue("--d")) || 0;
      setTimeout(() => { if (!follow || !el.isConnected) return; const r = part.getBoundingClientRect(), h = el.clientHeight; if (r.bottom > h - 24) el.scrollTo({ top: el.scrollTop + r.bottom - h + Math.min(h * 0.18, 140), behavior: "smooth" }); }, at * 1000 + 150);
    }
  }
  const btn = el.querySelector(".gf-ending-buttons button");
  if (btn) setTimeout(() => btn.focus({ preventScroll: true }), still ? 0 : tl.buttons * 1000 + 600);
  return el;
}
