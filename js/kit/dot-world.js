/* game-kit 1d2a49bf: js/dot-world.js — edit in game-kit and run tools/kit-sync.js */
// Dot world (standard 1.21.0; 水無瀬病院 / 札の家 ドット版, 2026-11-21: 「非常灯などがドットでないです。全て対応してください」
// 「壁もドット絵でないです。全てドットで再構築してください」「全体の色合いを合わせる」).
// One palette for the whole picture, and every visible surface drawn in it:
//   - DOT_PALETTES: named palettes (hex lists). A game picks one (game.json "dot": { "palette": "wa" } or its own list); the UI tokens of the
//     pixel skin are in it too, so the world, the people, the photos and the windows share their colours.
//   - palette(hexes) -> { hex, rgb, nearest(r, g, b) -> [r, g, b], index(r, g, b) }
//   - dotTile(kind, { pal, base, px, seed }) -> canvas: a pixel tile of a family (和: plaster, plaster-soot, earth, tatami, plank, plank-dark,
//     engawa, ceiling-board, shoji, stone, fusuma, metal, concrete, tile, flat), every pixel a palette colour, `base` the surface's colour
//   - quantizeImage(img, { pal, size, alphaSteps }) -> canvas: any picture redrawn small in the palette (ordered dither), alpha in steps
//   - gradePixels(data, pal) : RGBA bytes (a sprite-stack atlas, a photo) moved to the palette in place
//   - dotifyScene(THREE, root, { pal, tileM, kindOf }) -> stats: every visible mesh / sprite of the scene (walls, floors, ceilings, doors,
//     lights, glow planes, fixtures, the old item models) gets a dot material: a family tile (by the material's / object's name), or its own
//     picture quantized, or a flat palette colour drawn as a two-tone tile; vertex-coloured sprite stacks are graded to the palette.
//     Every converted material carries userData.dot = 'stack' | 'tile' | 'quant' | 'flat' and its textures NearestFilter (no mip blur).
//   - dotSceneSource() : page code for checks (tools/dot-scene.mjs, check-playtest P33): the materials that are not dot.
// A game may mark its own already-dot materials with material.userData.dot = 'ui' (rings, markers drawn in the palette).

export const DOT_PALETTES = {
  // 和の夜: soot blacks, wood browns, lamp amber, paper creams, warm greys, skin, charm reds, indigo, moss (札の家 / 鏡屋)
  wa: ['#0b0806', '#120d09', '#1e1610', '#2c2118', '#3b2c1f', '#4e3a27', '#634a31', '#7a5a2a', '#8e6a43', '#a6804f', '#c9862f', '#e0a040',
    '#f0c06a', '#d9c7a0', '#efe2c4', '#f1e6cc', '#fff6e0', '#4a4540', '#6b645b', '#8f877b', '#b5ab9b', '#e2ad8c', '#c98d6c', '#9e6a4f',
    '#5c1c18', '#8a2a20', '#b8432f', '#d8694a', '#1f2433', '#2b3247', '#46506a', '#6d7a92', '#2f3a2a', '#4f5c3c', '#7a8456', '#a9b07e'],
  // 病院の夜: cold greens, tile whites, emergency red, sodium amber, steel (水無瀬病院)
  ward: ['#060a0a', '#0d1514', '#16211f', '#22302d', '#31433f', '#455a55', '#5e756e', '#7c938a', '#9fb3a9', '#c4d3ca', '#e3ece6', '#f6fbf7',
    '#2a2622', '#433c34', '#5f554a', '#857867', '#b0a28c', '#e2ad8c', '#c98d6c', '#9e6a4f', '#3c0e0e', '#6e1a18', '#a8302a', '#e0503c',
    '#c9862f', '#e0a040', '#f0c06a', '#1d2433', '#2f3a52', '#4b5a7a', '#79a0c0', '#2f3a2a', '#56704a', '#8fb07a'],
};

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

/** a palette from hex colours (or a DOT_PALETTES name) */
export function palette(hexes = 'wa') {
  const hex = (typeof hexes === 'string' ? DOT_PALETTES[hexes] || DOT_PALETTES.wa : hexes).map((h) => h.toLowerCase());
  const rgb = hex.map(hexRgb);
  const cache = new Map();
  // perceptual-ish distance (weighted RGB, the "redmean" formula)
  const index = (r, g, b) => {
    const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let i = cache.get(k);
    if (i !== undefined) return i;
    let best = 1e12; i = 0;
    for (let j = 0; j < rgb.length; j++) {
      const c = rgb[j], rm = (r + c[0]) / 2, dr = r - c[0], dg = g - c[1], db = b - c[2];
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < best) { best = d; i = j; }
    }
    cache.set(k, i);
    return i;
  };
  return { hex, rgb, index, nearest: (r, g, b) => rgb[index(r, g, b)], has: (r, g, b) => rgb.some((c) => c[0] === r && c[1] === g && c[2] === b) };
}

/** RGBA bytes moved to the palette in place (dither: ordered 4x4 strength in 0..1 of a palette step; 0 for voxels) */
export function gradePixels(data, pal, { w = 0, dither = 0 } = {}) {
  const amp = dither * 24;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] === 0) continue;
    const o = amp && w ? BAYER[((Math.floor(p / w) & 3) << 2) | (p % w & 3)] * amp : 0;
    const c = pal.nearest(clamp8(data[i] + o), clamp8(data[i + 1] + o), clamp8(data[i + 2] + o));
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  }
  return data;
}
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// a small seeded random (tiles are the same on every load)
const rnd = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; };
const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const TILE_KINDS = ['plaster', 'plaster-soot', 'earth', 'tatami', 'plank', 'plank-dark', 'engawa', 'ceiling-board', 'shoji', 'stone', 'fusuma', 'metal', 'concrete', 'tile', 'flat'];
const BASES = { plaster: '#b5a07c', 'plaster-soot': '#6b5a44', earth: '#5e4a36', tatami: '#a39a62', plank: '#7a5a3a', 'plank-dark': '#4a3626', engawa: '#8a6a44',
  'ceiling-board': '#6e5236', shoji: '#e6dcc2', stone: '#6b645b', fusuma: '#c9b890', metal: '#6d7a80', concrete: '#8f877b', tile: '#c4d3ca', flat: '#7a6a58' };

/** a pixel tile of a family: px x px (default 32), every pixel a palette colour; base = the surface's colour [r, g, b] (default the family's) */
export function dotTile(kind, { pal = palette(), base = null, px = 32, seed = 1 } = {}) {
  const k = TILE_KINDS.includes(kind) ? kind : 'flat';
  const B = base || hexRgb(BASES[k]);
  const R = rnd(hash(k) ^ seed), N = px;
  const v = new Float32Array(N * N);   // a shade per pixel: 0 = the base, -1 darker step, +1 lighter
  const at = (x, y) => ((y + N) % N) * N + ((x + N) % N);
  const line = (x0, y0, x1, y1, s) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let t = 0; t <= n; t++) v[at(Math.round(x0 + (x1 - x0) * t / n), Math.round(y0 + (y1 - y0) * t / n))] = s; };
  const speckle = (p, s) => { for (let i = 0; i < N * N; i++) if (R() < p) v[i] = s; };
  switch (k) {
    case 'plaster': case 'plaster-soot': case 'concrete':
      speckle(0.10, -0.6); speckle(0.02, 0.5);   // few light flecks: on a low picture they read as blotches
      for (let c = 0; c < 2; c++) { let x = Math.floor(R() * N), y = Math.floor(R() * N); for (let t = 0; t < 7; t++) { const nx = x + Math.round(R() * 4 - 2), ny = y + 2; line(x, y, nx, ny, -1.4); x = nx; y = ny; } }
      if (k === 'plaster-soot') for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (R() < y / N * 0.35) v[at(x, y)] -= 0.8;
      break;
    case 'earth':
      speckle(0.16, -0.7); speckle(0.08, 0.7);
      for (let i = 0; i < 6; i++) { const x = Math.floor(R() * N), y = Math.floor(R() * N); v[at(x, y)] = 1.2; v[at(x + 1, y)] = 0.6; v[at(x, y + 1)] = -1; }
      break;
    case 'tatami':
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[at(x, y)] = (y % 2 ? -0.35 : 0.3) + ((x + (y >> 1)) % 6 === 0 ? -0.5 : 0);
      for (let x = 0; x < N; x++) { v[at(x, 0)] = -2.2; v[at(x, 1)] = -1.8; v[at(x, 2)] = -2.2; }   // the 畳縁 along one edge
      break;
    case 'plank': case 'plank-dark': case 'engawa': case 'ceiling-board': {
      const w = k === 'ceiling-board' ? 16 : k === 'engawa' ? 6 : 8;
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const b = Math.floor(x / w), xi = x % w;
        v[at(x, y)] = (b % 2 ? -0.25 : 0.2) + (xi === 0 ? -1.8 : 0) + ((y + b * 7) % 11 === 0 && xi > 1 ? -0.6 : 0);
      }
      for (let i = 0; i < 3; i++) { const x = Math.floor(R() * N), y = Math.floor(R() * N); v[at(x, y)] = -1.4; v[at(x + 1, y)] = -1; }   // knots
      if (k === 'ceiling-board') for (let y = 0; y < N; y++) v[at(w * 2 - 1, y)] = -2.2;   // a batten
      break;
    }
    case 'shoji': case 'fusuma':
      speckle(0.05, -0.4);
      if (k === 'shoji') { for (let i = 0; i < N; i++) { v[at(i, 0)] = -2.5; v[at(0, i)] = -2.5; v[at(i, N / 2)] = -2.5; v[at(N / 2, i)] = -2.5; } }
      else for (let i = 0; i < 9; i++) { const x = Math.floor(R() * N), y = Math.floor(R() * N); line(x, y, x + 3, y, 0.8); }
      break;
    case 'stone':
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[at(x, y)] = R() < 0.12 ? -0.6 : R() < 0.06 ? 0.6 : 0;
      for (let r = 0; r < N; r += 8) { line(0, r, N - 1, r, -2); const o = (r / 8) % 2 ? 6 : 0; for (let x = o; x < N; x += 12) line(x, r, x, r + 7, -2); }
      break;
    case 'metal':
      speckle(0.04, 0.8); for (let i = 0; i < 4; i++) { const y = Math.floor(R() * N); line(0, y, N - 1, y, 0.35); }
      for (const [x, y] of [[3, 3], [N - 4, 3], [3, N - 4], [N - 4, N - 4]]) { v[at(x, y)] = 1.5; v[at(x + 1, y + 1)] = -1.5; }
      break;
    case 'tile':
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[at(x, y)] = (x % 16 === 0 || y % 16 === 0) ? -1.6 : (R() < 0.05 ? -0.4 : 0);
      break;
    default: speckle(0.12, -0.5); speckle(0.06, 0.5);
  }
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d'), id = g.createImageData(N, N), d = id.data;
  for (let i = 0; i < N * N; i++) {
    const f = 1 + v[i] * 0.16;
    const q = pal.nearest(clamp8(B[0] * f), clamp8(B[1] * f), clamp8(B[2] * f));
    d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c;
}

/** any picture redrawn small in the palette (ordered dither); alpha in alphaSteps levels (0 = keep it) */
export function quantizeImage(img, { pal = palette(), size = 32, alphaSteps = 4, dither = 0.6 } = {}) {
  const iw = img.naturalWidth || img.videoWidth || img.width || 1, ih = img.naturalHeight || img.videoHeight || img.height || 1;
  const k = size / Math.max(iw, ih), w = Math.max(1, Math.round(iw * Math.min(1, k))), h = Math.max(1, Math.round(ih * Math.min(1, k)));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h);
  gradePixels(id.data, pal, { w, dither });
  if (alphaSteps) { const st = 255 / alphaSteps; for (let i = 3; i < id.data.length; i += 4) id.data[i] = Math.round(id.data[i] / st) * st; }
  g.putImageData(id, 0, 0);
  return c;
}

// the family of a surface from its names (the texture library's names, the world builder's object names)
export function tileKindOf(name = '') {
  const n = String(name).toLowerCase();
  if (/tatami/.test(n)) return 'tatami';
  if (/engawa|roka/.test(n)) return 'engawa';
  if (/ceil|tenjo|天井/.test(n)) return 'ceiling-board';
  if (/plank.*dark|dark.*plank|wood_dark|lacquer/.test(n)) return 'plank-dark';
  if (/plank|board|wood|floor:/.test(n)) return 'plank';
  if (/dirt|earth|doma|soil|mud/.test(n)) return 'earth';
  if (/soot|stain/.test(n)) return 'plaster-soot';
  if (/stone|rock|brick|masonry/.test(n)) return 'stone';
  if (/shoji|washi|paper/.test(n)) return 'shoji';
  if (/fusuma/.test(n)) return 'fusuma';
  if (/metal|steel|brass|iron|tin|coin/.test(n)) return 'metal';
  if (/tile|ceramic/.test(n)) return 'tile';
  if (/concrete|cement/.test(n)) return 'concrete';
  if (/clay|plaster|wall|kabe/.test(n)) return 'plaster';
  return null;
}

const imgName = (t) => (t && (t.name || (t.image && (t.image.currentSrc || t.image.src)) || '')) || '';
const ready = (im) => !!im && ((im.complete && im.naturalWidth) || im instanceof HTMLCanvasElement || (im.width && im.height && !(im instanceof HTMLImageElement)));

/** every visible material of root redrawn in the palette; o: { pal, tileM (metres one tile covers on a surface without its own map), kindOf(mesh, material) } */
export function dotifyScene(THREE, root, o = {}) {
  const pal = o.pal || palette(o.palette);
  const tileM = o.tileM || 1.28;
  const st = { stack: 0, tile: 0, quant: 0, flat: 0, kept: 0, later: 0 };
  const texCache = o.cache || (dotifyScene.cache = dotifyScene.cache || new Map());
  const tex = (key, make, src) => {
    let t = texCache.get(key);
    if (!t) { t = new THREE.CanvasTexture(make()); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace || t.colorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.dot = true; texCache.set(key, t); }
    if (src) { const c = t.clone(); c.repeat.copy(src.repeat); c.offset.copy(src.offset); c.rotation = src.rotation; c.center.copy(src.center); c.wrapS = src.wrapS; c.wrapT = src.wrapT; c.needsUpdate = true; c.userData.dot = true; return c; }
    return t;
  };
  const colRgb = (c) => [clamp8(c.r * 255), clamp8(c.g * 255), clamp8(c.b * 255)];
  const srgb = (c) => { const x = c.clone(); if (x.convertLinearToSRGB) x.convertLinearToSRGB(); return x; };
  const setCol = (c, rgb) => { c.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); };
  const avg = (im) => { try { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 4, 4); const d = g.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 64; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } return [r / 16, gg / 16, b / 16]; } catch { return null; } };
  const done = new Set();
  const gradeGeom = (geo) => {
    if (!geo || geo.userData.dotGraded) return; const a = geo.attributes && geo.attributes.color; if (!a) return;
    for (let i = 0; i < a.count; i++) { const q = pal.nearest(clamp8(a.getX(i) * 255), clamp8(a.getY(i) * 255), clamp8(a.getZ(i) * 255)); a.setXYZ(i, q[0] / 255, q[1] / 255, q[2] / 255); }
    a.needsUpdate = true; geo.userData.dotGraded = true;
  };
  root.traverse((obj) => {
    if (!(obj.isMesh || obj.isSprite || obj.isPoints)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.vertexColors) { gradeGeom(obj.geometry); if (!m.userData.dot) m.userData.dot = 'stack'; if (m.map && !m.map.userData.dot) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.needsUpdate = true; } if (!done.has(m)) { st.stack++; done.add(m); } continue; }
      // already dot (a map set again later by its loader - the item models do - is redrawn)
      if (done.has(m) || (m.userData.dot && m.userData.dot !== 'later' && (!m.map || (m.map.userData && m.map.userData.dot)))) { continue; }
      const name = `${m.name || ''} ${imgName(m.map)} ${obj.name || ''} ${(obj.parent && obj.parent.name) || ''}`;
      const kind = (o.kindOf && o.kindOf(obj, m)) || tileKindOf(m.name) || tileKindOf(imgName(m.map)) || tileKindOf(obj.name) || null;
      const base = srgb(m.color || new THREE.Color(1, 1, 1));
      if (m.map && !m.map.userData.dot) {
        const im = m.map.image;
        if (kind && !obj.isSprite && !(m.transparent && m.opacity < 1 && m.blending !== THREE.NormalBlending)) {
          // a world surface with a texture: the family tile in the texture's own colour (times the material colour), on the same repeat
          const a = ready(im) ? avg(im) : null;
          if (!a) { m.userData.dot = 'later'; st.later++; continue; }
          const rgb = [a[0] * base.r, a[1] * base.g, a[2] * base.b].map(clamp8);
          const q = pal.nearest(...rgb);
          m.map = tex(`tile:${kind}:${q.join(',')}`, () => dotTile(kind, { pal, base: rgb, seed: hash(name) & 7 }), m.map);
          m.color.setRGB(1, 1, 1); m.userData.dot = 'tile'; st.tile++;
        } else {
          // a picture (an item's texture, a glow, a sign): redrawn small in the palette, alpha in steps
          if (!ready(im)) { m.userData.dot = 'later'; st.later++; continue; }
          const key = `quant:${m.map.uuid}`;
          m.map = tex(key, () => quantizeImage(im, { pal, size: obj.isSprite ? 16 : 32, alphaSteps: m.transparent ? 4 : 0 }), m.map);
          const q = pal.nearest(...colRgb(base)); setCol(m.color, q); m.userData.dot = 'quant'; st.quant++;
        }
      } else if (!m.map) {
        // a plain colour (a ceiling board without a picture, a door frame, a lamp's glass): the palette colour as a two-tone tile
        const rgb = colRgb(base), k2 = kind || 'flat';
        if (obj.isSprite || (m.transparent && m.opacity < 0.6)) { setCol(m.color, pal.nearest(...rgb)); m.userData.dot = 'flat'; st.flat++; }
        else {
          const q = pal.nearest(...rgb);
          m.map = tex(`tile:${k2}:${q.join(',')}`, () => dotTile(k2, { pal, base: rgb, seed: 3 }));
          if (obj.geometry) { if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox(); const s = obj.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(obj.scale); const [a, b] = [s.x, s.y, s.z].sort((x, y) => y - x); if (k2 !== 'flat') { m.map = m.map.clone(); m.map.userData.dot = true; m.map.repeat.set(Math.max(1, Math.round(a / tileM)), Math.max(1, Math.round(b / tileM))); m.map.needsUpdate = true; } }
          m.color.setRGB(1, 1, 1); m.userData.dot = 'tile'; st.tile++;
        }
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) setCol(m.emissive, pal.nearest(...colRgb(srgb(m.emissive))));
      } else { st.kept++; }
      if (m.emissiveMap && !m.emissiveMap.userData.dot) { m.emissiveMap.magFilter = THREE.NearestFilter; m.emissiveMap.minFilter = THREE.NearestFilter; }
      for (const k of ['normalMap', 'roughnessMap', 'bumpMap', 'aoMap']) if (m[k]) m[k] = null;   // photo detail maps would bring the photo back
      m.needsUpdate = true; done.add(m);
    }
  });
  return st;
}

/** page code: the visible materials that are not dot (a check: tools/dot-scene.mjs / check-playtest P33). scene = an expression for the scene */
export function dotSceneSource(scene = 'window.__game && window.__game.scene') {
  return `(() => {
    const S = ${scene}; if (!S) return { error: 'no scene' };
    const bad = new Map(); let n = 0, ok = 0;
    const isDotTex = (t) => !t || (t.userData && t.userData.dot) || (t.magFilter === 1003 && t.image && (t.image.width || 0) <= 64);
    S.traverse((o) => {
      if (!(o.isMesh || o.isSprite || o.isPoints) || !o.visible) return;
      for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
      for (const m of [].concat(o.material)) {
        if (!m || m.visible === false || (m.opacity === 0 && m.transparent)) continue; n++;
        const d = m.userData && m.userData.dot;
        let why = '';
        if (!d || d === 'later') why = d === 'later' ? 'texture not ready when the world was drawn' : (m.map ? 'a picture texture (not a dot tile)' : 'a plain material (not a dot tile)');
        else if (m.map && !isDotTex(m.map)) why = 'a smooth texture';
        if (!why) { ok++; continue; }
        const k = (o.name || (o.parent && o.parent.name) || o.type) + ' | ' + (m.name || m.type) + ' | ' + why;
        bad.set(k, (bad.get(k) || 0) + 1);
      }
    });
    return { n, ok, bad: [...bad].sort((a, b) => b[1] - a[1]).slice(0, 30) };
  })()`;
}
