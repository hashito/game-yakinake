// Nothing flickers on a still picture (札の家 ドット版, 2026-11-21: 「壁に張り紙がある場合その張り紙よりも大きな枠が見えて、ちらついている」).
// flickerSource(o) is page code (a string for page.evaluate): with the camera held still it copies the WebGL canvas on `frames`
// animation frames in a row (each right after the game has drawn) and, for a square round each world point, returns the largest share
// of pixels that jump by more than `jump` (0..255 luminance) from one frame to the next. Film grain / noise passes change most pixels a
// little; z-fighting changes a block of pixels a lot - so the jump is high and the share is per region.
//   const r = await page.evaluate(flickerSource({ camera: 'g.camera', points: { kanban: '[5, 1.75, 25.85]' } }));  // -> { kanban: { on, share } }
export const FLICKER_MAX = 0.04;   // check-playtest P21 (dot path): more than 4% of a wall paper's square jumping between still frames
export function flickerSource({ camera = 'g.camera', points = {}, box = 0.06, frames = 8, jump = 48, canvas = 'g.renderer.domElement' } = {}) {
  const pts = Object.entries(points).map(([k, e]) => `[${JSON.stringify(k)}, (() => { const v = ${e}; return Array.isArray(v) ? v : v && [v.x, v.y, v.z]; })()]`).join(', ');
  return `new Promise((done) => {
    const cv = ${canvas}, shots = [];
    const grab = () => { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, cv.width, cv.height).data; };
    const step = () => requestAnimationFrame(() => { try { shots.push(grab()); } catch (e) { return done({ error: String(e) }); } if (shots.length < ${frames}) step(); else finish(); });
    const finish = () => {
      const cam = ${camera}, W = cv.width, H = cv.height, half = Math.max(4, Math.round(Math.min(W, H) * ${box})), out = {};
      const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      for (const [k, p] of [${pts}]) {
        if (!p) { out[k] = { on: false }; continue; }
        const v = new cam.position.constructor(p[0], p[1], p[2]).project(cam);
        const sx = Math.round((v.x * 0.5 + 0.5) * W), sy = Math.round((-v.y * 0.5 + 0.5) * H);
        if (v.z > 1 || sx < 0 || sy < 0 || sx >= W || sy >= H) { out[k] = { on: false }; continue; }
        let worst = 0;
        for (let f = 1; f < shots.length; f++) {
          let n = 0, j = 0;
          for (let y = Math.max(0, sy - half); y < Math.min(H, sy + half); y += 2) for (let x = Math.max(0, sx - half); x < Math.min(W, sx + half); x += 2) { const i = (y * W + x) * 4; n++; if (Math.abs(L(shots[f], i) - L(shots[f - 1], i)) > ${jump}) j++; }
          worst = Math.max(worst, j / Math.max(1, n));
        }
        out[k] = { on: true, x: sx, y: sy, share: +worst.toFixed(3) };
      }
      done(out);
    };
    step();
  })`;
}
