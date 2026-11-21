// How light is the picture around a point (札の家 ドット版, 2026-11-21: 「地下室が真っ暗で見えずどこで何するか分かりづらいです」).
// lumaSource(o) is page code (a string for page.evaluate): on the next animation frame, right after the game has drawn (the drawing
// buffer is still whole inside that frame), it copies the WebGL canvas, projects each world point with the camera, and returns the
// mean luminance (0..255, Rec. 709 on the sRGB values) of a square around each point, plus the whole frame's mean and how many pixels
// are pure black.
//   const r = await page.evaluate(lumaSource({ camera: 'window.__dot.topCam || g.camera', points: { player: 'g.camera.position', goal: '[2, 1, -3]' }, box: 0.08 }));
//   r -> { frame: 41.2, black: 0.18, points: { player: { x, y, on: true, mean: 63.5 }, goal: { ... } } }
// camera: page expression of a THREE camera; points: name -> page expression of a Vector3 or [x, y, z]; box: half size as a share of the
// shorter screen side. A point behind the camera or off the screen is { on: false }.
export const LUMA_MIN = { player: 28, goal: 22, frame: 10 };   // check-playtest P27: below these the place reads as black
export const LUMA_DARK = { player: 14, goal: 14, frame: 4 };   // a deliberate dark beat (before the first light is lit): shapes still show, the goal glows

export function lumaSource({ camera = 'g.camera', points = {}, box = 0.08, canvas = 'g.renderer.domElement' } = {}) {
  const pts = Object.entries(points).map(([k, e]) => `[${JSON.stringify(k)}, (() => { const v = ${e}; return Array.isArray(v) ? v : v && [v.x, v.y, v.z]; })()]`).join(', ');
  return `new Promise((done) => requestAnimationFrame(() => {
    try {
      const cv = ${canvas}, cam = ${camera}, W = cv.width, H = cv.height;
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
      const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.drawImage(cv, 0, 0);
      const img = x2.getImageData(0, 0, W, H).data;
      const L = (i) => 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2];
      let sum = 0, black = 0, n = 0;
      for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const l = L((y * W + x) * 4); sum += l; if (l < 3) black++; n++; }
      const half = Math.max(4, Math.round(Math.min(W, H) * ${box}));
      const out = {};
      for (const [k, p] of [${pts}]) {
        if (!p) { out[k] = { on: false }; continue; }
        const v = new cam.position.constructor(p[0], p[1], p[2]).project(cam);
        const sx = Math.round((v.x * 0.5 + 0.5) * W), sy = Math.round((-v.y * 0.5 + 0.5) * H);
        if (v.z > 1 || sx < 0 || sy < 0 || sx >= W || sy >= H) { out[k] = { on: false, x: sx, y: sy }; continue; }
        let s = 0, m = 0;
        for (let y = Math.max(0, sy - half); y < Math.min(H, sy + half); y += 2) for (let x = Math.max(0, sx - half); x < Math.min(W, sx + half); x += 2) { s += L((y * W + x) * 4); m++; }
        out[k] = { on: true, x: sx, y: sy, mean: +(s / Math.max(1, m)).toFixed(1) };
      }
      done({ frame: +(sum / n).toFixed(1), black: +(black / n).toFixed(3), points: out });
    } catch (e) { done({ error: String(e) }); }
  }))`;
}
