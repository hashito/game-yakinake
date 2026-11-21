/* game-kit 1d2a49bf: js/toast-lane.js — edit in game-kit and run tools/kit-sync.js */
// Toast lane (rule U27, docs/hud-slots.md): ONE place for every short notification, so it never lands on the clock, the sensors or the menu.
// The lane is the top-centre HUD slot (#hs-tc): hud-slots.js puts it BELOW the taller of the top stacks that it would touch and keeps it above the
// prompt / action cluster. Everything that used to be its own floating box (toasts, side-job notes, pick-up cards, "carrying" hint, "click to return")
// is an item of this lane.
//
//   const lane = new ToastLane({ el: document.getElementById('hs-tc'), calm: () => document.documentElement.hasAttribute('data-gf-calm') });
//   lane.push('入手：作業灯');                                       // kind 'toast' (4.2 s)
//   lane.push({ kind: 'quest-note', title: 'サブ業務を受けた', html: '…' });  // 5 s, higher priority
//   lane.sticky('carry-hint', true, '運搬中…');                      // stays until sticky('carry-hint', false)
//   lane.clear();  lane.snapshot();                                  // snapshot() -> [{ id, kind, text, count, prio }]  (tests, window.__gf)
//
// LaneModel is pure (no DOM, injectable clock): queue, de-dup (same text+kind: count goes up, time restarts), priorities, max visible (default 3),
// time-to-live that only runs while an item is visible, and a hard cap on the waiting list.
export const KINDS = {
  toast: { prio: 30, ttl: 4200 },
  "quest-note": { prio: 50, ttl: 5000 },
  card: { prio: 40, ttl: 4200 },        // pick-up / place cards
  prompt: { prio: 80, ttl: 0 },         // a state prompt ("click to return"): sticky
  "carry-hint": { prio: 20, ttl: 0 },   // sticky hint, the first to give way
};
export const LANE_MAX = 3;
const WAIT_CAP = 12;

import { gfRegister, gfEmit, gfOk, gfFail, gfUnknown } from "./gf-test.js";
import { fitPanel, keepFitted } from "./panel-fit.js";

// 1.20.3 (札の家 ドット版, phone play: 「スクロールできるようにではなく他のUIの邪魔にならないように広く場所を取るべき」): a card with the class
// tl-read (the look-at card, things.js) is a READING card: not a small box in the lane but a large panel of its own (#gf-reader, near full screen
// on a phone, a big centred panel on a PC) with a close button; while it is open the rest of the HUD and the touch controls are hidden and the
// game's input waits (game-core: ctx.blockers). Scrolling is only the fallback for an unusually long text.
export const READ_PRIO = 90;
export const isRead = (cls) => /(^|\s)tl-read(\s|$)/.test(cls || "");
const plain = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");

export class LaneModel {
  constructor(o = {}) {
    this.max = o.max ?? LANE_MAX;
    this.limit = Infinity;   // places the screen height allows (ToastLane.fit); never below 1
    this.cap = o.cap ?? WAIT_CAP;
    this.now = o.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.items = [];   // all live items, arrival order. item: { id, key, kind, html, text, prio, ttl, count, shown, left, since }
    this.seq = 0;
  }
  // spec: { kind, html | text, key, prio, ttl, sticky, cls, title }; returns the item (an existing one when it is a repeat)
  push(spec) {
    const k = KINDS[spec.kind] ? spec.kind : "toast";
    const def = KINDS[k];
    const html = spec.html ?? "";
    const text = plain(spec.text ?? html);
    const key = spec.key || `${k}:${text}`;
    const read = isRead(spec.cls);   // 1.20.3: a reading card stays until the player closes it, and no notice pushes it away
    const ttl = spec.sticky || read ? 0 : spec.ttl ?? def.ttl;
    const dup = this.items.find((i) => i.key === key);
    if (dup) { dup.count++; dup.left = ttl; dup.ttl = ttl; dup.bump = (dup.bump || 0) + 1; return dup; }   // a repeat: no second copy, the time restarts
    if (read) this.items = this.items.filter((i) => !isRead(i.cls));   // one reading card at a time: the new one replaces the old
    const it = { id: ++this.seq, key, kind: k, html, text, prio: read ? READ_PRIO : spec.prio ?? def.prio, ttl, left: ttl, count: 1, shown: false, cls: spec.cls || "", title: spec.title || "", since: this.now() };
    this.items.push(it);
    this._trim();
    this.fill();
    return it;
  }
  remove(id) { const n = this.items.length; this.items = this.items.filter((i) => i.id !== id && i.key !== id); this.fill(); return this.items.length !== n; }
  clear(kind) { this.items = kind ? this.items.filter((i) => i.kind !== kind) : []; this.fill(); }
  setMax(n) { this.max = Math.max(1, Math.floor(n)); this.fill(); }
  setLimit(n) { this.limit = n >= 1 ? Math.floor(n) : 1; this.fill(); }
  get places() { return Math.min(this.max, this.limit); }
  visible() { return this.items.filter((i) => i.shown); }
  waiting() { return this.items.filter((i) => !i.shown); }
  // The waiting list is capped: the lowest priority, oldest drop first (never an item that is on screen).
  _trim() {
    while (this.waiting().length > this.cap) {
      const w = this.waiting().sort((a, b) => a.prio - b.prio || a.id - b.id)[0];
      this.items = this.items.filter((i) => i !== w);
    }
  }
  // Decide what is on screen: fill free places by priority (then arrival); a waiting item with a STRICTLY higher priority than the lowest visible one
  // takes its place (that one goes back to waiting, its remaining time kept); equal priority waits its turn.
  fill() {
    let vis = this.visible();
    while (vis.length > this.places) {   // the lane shrank (short screen): the lowest priority, newest give way
      const w = vis.sort((a, b) => a.prio - b.prio || b.id - a.id)[0];
      w.shown = false; vis = this.visible();
    }
    for (;;) {
      const wait = this.waiting().sort((a, b) => b.prio - a.prio || a.id - b.id);
      if (!wait.length) break;
      const best = wait[0];
      if (vis.length < this.places) { best.shown = true; best.since = this.now(); vis = this.visible(); continue; }
      const low = vis.sort((a, b) => a.prio - b.prio || b.id - a.id)[0];
      if (best.prio > low.prio) { low.shown = false; best.shown = true; best.since = this.now(); vis = this.visible(); continue; }
      break;
    }
    return this.visible();
  }
  // advance time by dt ms: only visible items age; returns the ids that expired
  tick(dt) {
    const gone = [];
    for (const i of this.items) if (i.shown && i.ttl > 0 && !i.hold) { i.left -= dt; if (i.left <= 0) gone.push(i.id); }   // hold: a card with more to read below (1.20.2)
    if (gone.length) { this.items = this.items.filter((i) => !gone.includes(i.id)); this.fill(); }
    return gone;
  }
  snapshot() { return this.items.map((i) => ({ id: i.id, kind: i.kind, text: i.text, count: i.count, prio: i.prio, shown: i.shown, left: Math.round(i.left) })); }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hasDom = () => typeof document !== "undefined" && !!document.body;

export class ToastLane {
  // o: el (the lane container), calm (() => bool: no motion), max, onChange (after every render), fit ((lane) => max places by the free height)
  constructor(o = {}) {
    this.o = o;
    this.model = new LaneModel({ max: o.max, now: o.now });
    this.el = o.el || null;
    this.nodes = new Map();   // id -> element
    this.last = 0;
    this.timer = 0;
    this.pending = false;
    if (this.el) { this.el.setAttribute("role", "status"); this.el.setAttribute("aria-live", "polite"); this.el.classList.add("tl-lane"); }
    this._gf();
  }
  // test hooks (docs/testing.md; only with ?gftest=1): window.__gf.modules.toastLane
  _gf() {
    gfRegister("toastLane", () => ({
      snapshot: () => { const m = this.model; return { shown: m.visible().map((i) => ({ id: i.id, kind: i.kind, text: i.text, count: i.count })), waiting: m.waiting().length, places: m.places, max: m.max, nodes: this.nodes.size }; },
      drive: (action, a = {}) => {
        switch (action) {
          case "push": { const it = this.push({ kind: a.kind || "toast", html: a.html, text: a.text, title: a.title, key: a.key, prio: a.prio, ttl: a.ttl, cls: a.cls }); gfEmit("toastLane", "push", { id: it.id, kind: it.kind }); return gfOk({ id: it.id, count: it.count, shown: it.shown }); }
          case "sticky": this.sticky(a.kind || "carry-hint", a.on !== false, a.html || a.text || "", a.key ? { key: a.key } : {}); return gfOk({ shown: this.model.visible().length });
          case "tick": { const gone = this.model.tick(Number(a.ms) || 0); this.render(); return gfOk({ expired: gone.length }); }
          case "clear": this.clear(a.kind); return gfOk({});
          case "remove": return this.model.remove(a.id) ? (this.render(), gfOk({})) : gfFail(`no item "${a.id}"`);
          case "setLimit": this.model.setLimit(a.n); this.render(); return gfOk({ places: this.model.places });
          default: return gfUnknown(action);
        }
      },
      reset: () => { this.model.limit = Infinity; this.clear(); },
    }));
  }
  get calm() { return typeof this.o.calm === "function" ? !!this.o.calm() : !!this.o.calm; }
  // push('text') | push({ kind, html, text, title, key, prio, ttl, sticky })
  push(spec, kind) {
    if (typeof spec === "string") spec = { html: spec, kind: kind || "toast" };
    const it = this.model.push(spec);
    this.render();
    this._run();
    return it;
  }
  // a sticky item switched by a condition (carry-hint, relock): on -> shown until switched off
  sticky(kind, on, html, o = {}) {
    const key = o.key || `sticky:${kind}`;
    const cur = this.model.items.find((i) => i.key === key);
    if (on && cur) { if (html != null && html !== cur.html) { cur.html = html; cur.text = plain(html); this.render(); } return cur; }
    if (on) return this.push({ ...o, kind, html, key, sticky: true });
    if (!on && cur) { this.model.remove(cur.id); this.render(); }
    return cur || null;
  }
  clear(kind) { this.model.clear(kind); this.render(); }
  snapshot() { return this.model.snapshot(); }
  _run() {
    if (this.timer || typeof setInterval !== "function") return;
    this.last = Date.now();
    this.timer = setInterval(() => {
      const t = Date.now(), dt = Math.min(t - this.last, 1000); this.last = t;
      if (document.hidden) return;   // a hidden tab does not age the notes: the player must see them
      if (this.o.paused && this.o.paused()) return;   // nor does a window over the screen (a talk opened right after a pick-up hid its card until it was gone)
      if (this.model.tick(dt).length) this.render();
      if (!this.model.items.some((i) => i.ttl > 0)) { clearInterval(this.timer); this.timer = 0; }
    }, 200);
  }
  _node(it) {
    const el = document.createElement("div");
    el.className = `tl-item tl-${it.kind} ${it.cls}`.trim();
    el.dataset.laneId = String(it.id); el.dataset.kind = it.kind;
    el.dataset.hudPart = `lane-${it.kind}`;
    // 1.20.2: a card taller than its room scrolls (css .tl-lookcard > .tl-body); reading it to the end lets its time run again
    el.addEventListener("scroll", () => this._more(), { capture: true, passive: true });
    if (isRead(it.cls)) { el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.addEventListener("click", (e) => { if (e.target.closest(".tl-close")) { e.preventDefault(); e.stopPropagation(); this.close(); } }); }
    return el;
  }
  _fill(el, it) {
    const body = (it.title ? `<small>${esc(it.title)}</small>` : "") + (it.html || esc(it.text));
    const close = isRead(it.cls) ? `<button type="button" class="btn primary tl-close" aria-label="閉じる">閉じる</button>` : "";
    const html = `<div class="tl-body">${body}</div>${close}${it.count > 1 && !close ? `<span class="tl-count" aria-hidden="true">×${it.count}</span>` : ""}`;
    if (el.dataset.sig !== html) { el.innerHTML = html; el.dataset.sig = html; }
  }
  render() {
    if (!this.el || !hasDom()) return;
    const calm = this.calm;
    this.el.classList.toggle("tl-calm", calm);
    const vis = this.model.fill();
    const keep = new Set(vis.map((i) => i.id));
    for (const [id, el] of this.nodes) if (!keep.has(id)) { this.nodes.delete(id); if (calm) el.remove(); else { el.classList.add("tl-out"); setTimeout(() => el.remove(), 360); } }
    vis.forEach((it, idx) => {
      let el = this.nodes.get(it.id);
      if (!el) { el = this._node(it); this.nodes.set(it.id, el); this._fill(el, it); this._host(it).appendChild(el); if (!calm) { el.classList.add("tl-in"); requestAnimationFrame(() => el.classList.remove("tl-in")); } } else this._fill(el, it);
      el.style.order = String(idx);
      if (it.bump) { it.bump = 0; if (!calm) { el.classList.remove("tl-bump"); void el.offsetWidth; el.classList.add("tl-bump"); } }
    });
    this.el.classList.toggle("tl-empty", !vis.some((i) => !isRead(i.cls)));
    this._reading(vis.some((i) => isRead(i.cls)));
    if (typeof this.o.fit === "function") this._fit();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => this._more()); else this._more();
    if (typeof this.o.onChange === "function") this.o.onChange(this);
  }
  // keep the lane inside the free height: while the visible items are taller than what is free, one place less (never below 1)
  _fit() {
    if (this.pending) return;
    this.pending = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => this.settle()); else this.settle();
  }
  // measure now: the free height below the lane's top (o.fit) decides how many places the lane has (tests / stress call it directly)
  settle() {
    this.pending = false;
    if (!this.el || !this.el.isConnected || typeof this.o.fit !== "function") return;
    const free = this.o.fit(this);   // px below the lane's top that may be used
    if (!(free > 0)) return;
    this.model.limit = Infinity; this.model.fill(); this._sync();
    let guard = 6;
    while (guard-- > 0 && this.model.visible().length > 1 && this.el.getBoundingClientRect().height > free) {
      this.model.setLimit(this.model.visible().length - 1);
      this._sync();
    }
  }
  // the model changed without a full render (fit): drop / add the nodes now so the next measurement is true
  _sync() {
    const vis = this.model.visible(), keep = new Set(vis.map((i) => i.id));
    for (const [id, el] of this.nodes) if (!keep.has(id)) { this.nodes.delete(id); el.remove(); }
    for (const it of vis) if (!this.nodes.has(it.id)) { const el = this._node(it); this._fill(el, it); this.nodes.set(it.id, el); this._host(it).appendChild(el); }
    vis.forEach((it, idx) => { const el = this.nodes.get(it.id); if (el) el.style.order = String(idx); });
  }
  // 1.20.2: which cards have more below than they show (.tl-more: the cue; the item holds its time until read to the end, then has 3 s at least)
  _more() {
    for (const [id, el] of this.nodes) {
      const body = el.querySelector(".tl-body"), it = this.model.items.find((i) => i.id === id);
      if (!body || !it) continue;
      const over = body.scrollHeight > body.clientHeight + 2 && getComputedStyle(body).overflowY !== "visible";
      const more = over && body.scrollTop + body.clientHeight < body.scrollHeight - 2;
      el.classList.toggle("tl-more", more);
      if (more) it.hold = true;
      else if (it.hold) { it.hold = false; it.left = Math.max(it.left, 3000); }
    }
  }
  // 1.20.3: the reading panel. Its host sits on <body> (not in the lane: nothing of the HUD may share its room); body.gf-reading hides the
  // rest of the HUD and the touch controls (css/shell.css); o.onReader(open) lets the game hold its input and the pointer lock.
  get reading() { return this.model.visible().some((i) => isRead(i.cls)); }
  close() { const it = this.model.items.find((i) => isRead(i.cls)); if (!it) return false; this.model.remove(it.id); this.render(); return true; }
  _host(it) {
    if (!isRead(it.cls) || !hasDom()) return this.el;
    if (!this.readerEl || !this.readerEl.isConnected) {
      const r = document.createElement("div"); r.id = "gf-reader"; r.className = "gf-reader";
      r.addEventListener("pointerdown", (e) => { if (e.target === r) { e.preventDefault(); this.close(); } });   // a tap beside the panel closes it too
      document.body.appendChild(r); this.readerEl = r;
    }
    return this.readerEl;
  }
  _reading(on) {
    if (!hasDom() || on === !!this._readOn) return;
    this._readOn = on;
    document.body.classList.toggle("gf-reading", on);
    if (on) { const b = this.readerEl && this.readerEl.querySelector(".tl-close"); if (b && b.focus) try { b.focus({ preventScroll: true }); } catch { /* old browsers */ } }
    if (on) this._fitRead(); else if (this._fitStop) { this._fitStop(); this._fitStop = null; }
    if (typeof this.o.onReader === "function") this.o.onReader(on);
  }
  // 1.21.1: the reading card fits its panel without scrolling: the picture gets smaller first (beside the text on a low landscape screen: its
  // width; above it: its height), then the text (js/panel-fit.js); scrolling stays only for an unusually long text
  _fitRead() {
    const card = this.readerEl && this.readerEl.querySelector(".tl-read"), body = card && card.querySelector(".tl-body");
    if (!body) return;
    const run = () => {
      const pic = card.querySelector(".iv-photo:not(.iv-nopic)"), row = !!pic && getComputedStyle(pic.parentElement).flexDirection === "row";
      const steps = [];
      if (pic) steps.push(row ? { el: card, prop: "--rd-photo-w", from: 76, to: 16, step: -2, unit: "%", max: 80 } : { el: card, prop: "--rd-photo-h", from: Math.max(80, Math.round(body.clientHeight * 0.86)), to: 56, step: -12, unit: "px", max: Math.max(80, body.clientHeight) });
      steps.push({ el: card, prop: "--rd-scale", from: 1, to: 0.82, step: -0.03, unit: "" });
      fitPanel(body, steps);
    };
    if (this._fitStop) this._fitStop();
    this._fitStop = keepFitted(body, run);
  }
  destroy() { clearInterval(this.timer); this.timer = 0; this.model.clear(); this.render(); }
}
