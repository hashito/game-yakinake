/* game-kit 10af67dd: js/sprite-stack-anim.js — edit in game-kit and run tools/kit-sync.js */
// The generic motion player of sprite-stack characters (docs/sprite-motions.md). No three.js, no DOM: it only decides
// which frame of a frame set shows now. The same player drives every character and monster, in 3D (sprite-stack-mesh.js)
// or 2D (sprite-stack-library.js draw by frame id).
//
//   import { MotionPlayer, locomotion } from './sprite-stack-anim.js';
//   const anim = new MotionPlayer(set);              // set = the frame-set JSON of tools/sprite-stacks/motion_frames.py
//   anim.play('walk');                               // a state: idle | walk | run | crouch | crouch-walk | stand-up | sit |
//                                                    //          reach | paste | caught | turn | fear | attack | kneel | ...
//   const f = anim.update(dt, { moved });            // -> the frame name to show ('walk.3'); moved = metres walked this frame
//   anim.play(locomotion({ speed, crouch, run }));   // the usual mapping of a moving body to a state
//   anim.once('paste').then(() => ...);              // a one-shot motion; resolves when its last frame has shown
//
// Timing: a cyclic motion with a stride (metres per cycle) advances by the distance moved, so the feet do not slide on the
// floor; without `moved` it runs at its fps scaled by speed / (stride * fps / frames) (or plain fps). A one-shot motion plays
// at its fps and holds its last frame. A motion the set lacks falls back along its `fallback` chain (crouch-walk -> crouch ->
// idle, run -> walk, paste -> reach ...), finally to the first frame of the set.

export const DEFAULT_FALLBACK = {
  idle: null, walk: 'idle', run: 'walk', crouch: 'idle', 'crouch-walk': 'crouch', 'stand-up': 'idle', sit: 'crouch',
  reach: 'paste', paste: 'reach', caught: 'fear', turn: 'walk', fear: 'crouch', attack: 'reach', kneel: 'sit',
};

/** the state of a moving body: idle / walk / run / crouch / crouch-walk (speed in m/s) */
export function locomotion({ speed = 0, crouch = false, run = false, walkMin = 0.15, runMin = 2.9 } = {}) {
  const moving = speed > walkMin;
  if (crouch) return moving ? 'crouch-walk' : 'crouch';
  if (!moving) return 'idle';
  return run || speed >= runMin ? 'run' : 'walk';
}

/** turn an angle toward a target at most rate rad/s (shortest way) */
export function turnToward(a, target, dt, rate = 10) {
  let d = ((target - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const m = rate * dt;
  if (Math.abs(d) <= m) return target;
  return a + Math.sign(d) * m;
}

// the states a body may stay in (P41, 1.21.5: 「ひなたがずっと手をあげてます」 - any other pose held 3 s or more is a finding)
export const REST_STATES = new Set(['idle', 'walk', 'run', 'crouch', 'crouch-walk', 'sit']);
const heldLog = () => (globalThis.__gfMotionHeld = globalThis.__gfMotionHeld || {});

export class MotionPlayer {
  constructor(set, o = {}) {
    this.set = set;
    this.name = o.name || set.id || 'figure';
    this.holdOk = new Set(o.holdOk || []);   // poses this body may hold on purpose (a monster pressing on a door)
    this.since = 0;
    this.motions = set.motions || {};
    this.fallback = { ...DEFAULT_FALLBACK, ...(o.fallback || {}) };
    this.has = new Set(set.frames || []);
    this.state = null;
    this.motion = null;      // the motion actually shown (after the fallback)
    this.phase = 0;          // cycles (cyclic) or seconds (one-shot)
    this.frame = null;
    this.done = false;
    this._wait = null;
    this.play(o.state || 'idle');
  }

  /** the motion that will show for a state: itself if the set has its frames, else along the fallback chain */
  resolve(name) {
    const seen = new Set();
    let m = name;
    while (m && !seen.has(m)) {
      seen.add(m);
      const d = this.motions[m];
      if (d && d.frames && d.frames.length && d.frames.every((f) => this.has.has(f))) return m;
      m = d && d.fallback !== undefined ? d.fallback : this.fallback[m];
    }
    return this.motions.idle && this.motions.idle.frames.every((f) => this.has.has(f)) ? 'idle' : null;
  }

  /** switch to a state (no restart when it is already playing, unless o.restart) */
  play(state, o = {}) {
    if (state === this.state && !o.restart) return this;
    const prev = this.motion;
    if (state !== this.state) this.since = 0;
    this.state = state;
    this.motion = this.resolve(state);
    // a cycle keeps its phase when switching between gaits (walk <-> run), so the feet do not jump
    const d = this.def;
    if (!(prev && d && d.loop && this.motions[prev] && this.motions[prev].loop) || o.restart) this.phase = 0;
    this.done = false;
    if (this._wait) { const w = this._wait; this._wait = null; w(false); }
    return this;
  }

  /** a one-shot motion; resolves true when its last frame has shown (false when another state took over) */
  once(state) {
    this.play(state, { restart: true });
    return new Promise((r) => { this._wait = r; if (!this.def || this.def.loop) { this._wait = null; r(true); } });
  }

  get def() { return this.motion ? this.motions[this.motion] : null; }

  /** advance; returns the frame name to show */
  update(dt, { moved = null, speed = null } = {}) {
    this.since += dt;
    if (this.state && !REST_STATES.has(this.state) && !this.holdOk.has(this.state)) { const L = heldLog(), k = `${this.name}|${this.state}`; if (!(L[k] >= this.since)) L[k] = +this.since.toFixed(2); }
    const d = this.def;
    if (!d) { this.frame = (this.set.frames || [])[0] || null; return this.frame; }
    const n = d.frames.length;
    if (d.loop) {
      if (n > 1) {
        if (d.stride && moved != null) this.phase += moved / d.stride;
        else {
          let rate = (d.fps || 8) / n;                       // cycles per second
          if (d.stride && speed != null) rate = speed / d.stride;
          this.phase += dt * rate;
        }
        this.phase -= Math.floor(this.phase);
      }
      this.frame = d.frames[Math.min(n - 1, Math.floor(this.phase * n))];
    } else {
      this.phase += dt;
      const k = Math.floor(this.phase * (d.fps || 8));
      if (k >= n - 1 && !this.done) {
        this.done = true;
        if (this._wait) { const w = this._wait; this._wait = null; queueMicrotask(() => w(true)); }
      }
      this.frame = d.frames[Math.min(n - 1, k)];
    }
    return this.frame;
  }
}
