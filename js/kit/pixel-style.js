/* game-kit 1d2a49bf: js/pixel-style.js — edit in game-kit and run tools/kit-sync.js */
// The pixel-art style of a standard 3D game (game.json "style": "pixel", docs/pixel-style.md). The 3D itself does not change: camera, movement, collision, picking
// and all DOM text stay at full precision; only what the world looks like changes.
//   "pixel": { "world": "texture" }              the default: low-resolution textures on normal meshes, magnified with the nearest texel (rules PX01, PX02)
//   "pixel": { "world": "lowres", "short": 180 } the world is also drawn small and enlarged with hard edges; the short side of the view is about `short` px
// A texture stays smooth with texture.userData.smooth = true (a screen with fine text). Images under assets/pixel/ and pixel-assets/ are shown with hard edges in the UI.
export const DEFAULT_SHORT = 180;

/** the drawing size of the world: k = max(1, floor(min(W, H) / short)), W / k x H / k (1280x720 -> 320x180 at 4x, 375x812 -> 187x406 at 2x) */
export function pixelGrid(W, H, short = DEFAULT_SHORT) {
  const s = short > 0 ? short : DEFAULT_SHORT;
  const k = Math.max(1, Math.floor(Math.min(W, H) / s));
  return { k, w: Math.floor(W / k), h: Math.floor(H / k) };
}

/** hard magnification and stable minification on one texture; returns true when it changed anything */
export function pixelateTexture(THREE, tex) {
  if (!tex || tex.isRenderTargetTexture || tex.isVideoTexture || (tex.userData && tex.userData.smooth)) return false;
  const min = tex.generateMipmaps === false ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
  if (tex.magFilter === THREE.NearestFilter && tex.minFilter === min) return false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = min;
  if (tex.version > 0 && tex.image) tex.needsUpdate = true;   // already uploaded: the sampler is set at upload. Not loaded yet: the upload picks it up
  return true;
}

/** every picture a ledger names (pixel-items.json): loaded and decoded before the start button opens, so that no item's first appearance stops the game */
export function pixelLedgerImages(ledger) {
  return [...new Set((ledger && ledger.items || []).flatMap((i) => [i.world, i.inventory, i.examine]).filter((s) => typeof s === 'string' && s))];
}

export function createPixelStyle({ THREE, renderer, scene, canvas, options = {} }) {
  const lowres = options.world === 'lowres';
  const short = options.short || DEFAULT_SHORT;
  const seen = new WeakSet();
  let wait = 0;
  document.documentElement.dataset.style = 'pixel';
  if (!document.getElementById('kit-pixel-style')) {
    const st = document.createElement('style');
    st.id = 'kit-pixel-style';
    st.textContent = 'img[src*="assets/pixel/"],img[src*="pixel-assets/"]{image-rendering:pixelated}';
    document.head.appendChild(st);
  }
  const api = {
    lowres,
    booted: false,
    lateTextures: [],
    /** the drawing buffer follows the view: called once and after every setSize. The canvas keeps its CSS size, so tap coordinates need no conversion */
    resize(W = innerWidth, H = innerHeight) {
      if (!lowres) return null;
      const g = pixelGrid(W, H, short);
      renderer.setPixelRatio(1 / g.k);
      canvas.style.imageRendering = 'pixelated';
      return g;
    },
    /** every texture on the scene's materials, once each */
    sweep() {
      scene.traverse((o) => {
        if (!o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const t of [m.map, m.emissiveMap]) {
            if (!t || seen.has(t)) continue;
            seen.add(t);
            pixelateTexture(THREE, t);
            if (api.booted) api.lateTextures.push(t.name || (t.image && t.image.src) || 'texture');   // load first: anything here was not ready before play (docs/pixel-style.md)
          }
        }
      });
    },
    /** things added during play (a stage's props, a door's picture) join within two seconds */
    update(dt) { wait -= dt; if (wait <= 0) { wait = 2; api.sweep(); } },
  };
  api.resize();
  return api;
}
