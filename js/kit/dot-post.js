/* game-kit 1d2a49bf: js/dot-post.js — edit in game-kit and run tools/kit-sync.js */
// Dot post-process presets (standard 1.21.0; the user on 札の家 ドット版's look, for 水無瀬病院: 「札のゲームのように全体的に少しぼやかすなどして
// 改善を行うべきです」). One line in game.json gives a dot game the soft look of 札の家:
//   "dotPost": "soft"                                   or   "dotPost": { "name": "soft", "over": { "pixel": { "short": 180 } } }
// The preset sets only how the 3D picture is drawn - the internal resolution (the world drawn small and enlarged), fog density, exposure /
// tone mapping, vignette, grain, saturation, the scanline strength over the canvas - and wins over the game's own values for those keys
// (the game's fog colour, lights and everything else stay its own; "over" adjusts the preset). Text and the UI are DOM and stay sharp.
// applyDotPost(manifest) -> the manifest with the preset merged in (game-core calls it before the renderer is made); the CSS part
// (scanlines over the canvas only) is put on <html data-dot-post="name">.
export const DOT_POST_PRESETS = {
  // 札の家 ドット版 (kushi 2.2.0): about 200 px on the short side, exp2 fog, a dim exposure, half vignette, no grain, colours pulled down
  soft: {
    style: 'pixel',
    pixel: { world: 'lowres', short: 200 },
    preset: { fog: { type: 'exp2', density: 0.055 }, exposure: 0.8, post: { grain: 0, vignette: 0.5 } },
    fx: { noise: 0, scanlines: 0, vignette: 1, saturation: 0.3, glitch: false, mist: true },
    css: { scanlines: 0.35, grain: false },
  },
  // the same, a little sharper and brighter (a game that needs to read signs far off)
  clear: {
    style: 'pixel',
    pixel: { world: 'lowres', short: 240 },
    preset: { fog: { type: 'exp2', density: 0.035 }, exposure: 0.95, post: { grain: 0, vignette: 0.35 } },
    fx: { noise: 0, scanlines: 0, vignette: 0.7, saturation: 0.5, glitch: false, mist: false },
    css: { scanlines: 0.25, grain: false },
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function deepMerge(a, b) {
  if (!isObj(b)) return b === undefined ? a : b;
  const o = { ...(isObj(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) o[k] = deepMerge(o[k], v);
  return o;
}

/** the manifest with its dot post preset merged in (no "dotPost": unchanged) */
export function applyDotPost(manifest) {
  const d = manifest && manifest.dotPost;
  if (!d) return manifest;
  const name = typeof d === 'string' ? d : d.name;
  const P = DOT_POST_PRESETS[name];
  if (!P) { try { console.warn('[dot-post] no preset', name); } catch { /* */ } return manifest; }
  const look = deepMerge(P, isObj(d) && d.over ? d.over : {});
  const { css, ...rest } = look;
  let m = { ...manifest };
  // a preset written as a name ("preset": "horror") becomes { base: name } so the look can extend it
  if (rest.preset && typeof m.preset === 'string') m.preset = { base: m.preset };
  m = deepMerge(m, rest);
  m.dotPostCss = css || {};
  if (typeof document !== 'undefined') {
    const H = document.documentElement; H.dataset.dotPost = name;
    const st = document.createElement('style'); st.id = 'gf-dot-post';
    st.textContent = `html[data-dot-post] .gf-scanlines{opacity:${css && css.scanlines != null ? css.scanlines : 0.35}!important}` + (css && css.grain === false ? 'html[data-dot-post] .kit-csspost>div[style*="kitGrain"]{display:none!important}' : '');
    document.head.appendChild(st);
  }
  return m;
}
