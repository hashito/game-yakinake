/* game-kit f89b1fcd: js/sprite-stack-mesh.js — edit in game-kit and run tools/kit-sync.js */
// Sprite stacks as three.js meshes (docs/sprite-motions.md): the horizontal slices are read as a voxel volume and turned
// into one mesh per frame (faces only where a voxel meets air, coplanar faces of one colour merged into rectangles, colour
// per vertex). The model reads the same from every angle, also at eye level where stacked slice planes would vanish.
// Axes: the stack's x right / +y the face / z up -> three.js x / +z / y. The pivot (the point between the feet) is the origin,
// the lowest voxel sits on y 0.
//
//   import { loadFrameSet, buildFrameGeometry, createFigure } from './sprite-stack-mesh.js';
//   const set = await loadFrameSet(THREE, 'assets/stacks/worker.json');      // JSON + atlas PNG (motion_frames.py)
//   const fig = createFigure(THREE, set, { height: 1.7, material });        // { root, mesh, anim, show(frame), update(dt, o) }
//   scene.add(fig.root); fig.anim.play('walk'); fig.update(dt, { moved });
//   // a single prop from the library (slices.png + catalog sizes): buildStackGeometry(THREE, vol, { mpp })
//
// Every frame's geometry is built at load: put fig.warm (a group with every frame) through the game's warm-up so the first
// sight of a motion uploads nothing during play (pixel games load first).
import { MotionPlayer } from './sprite-stack-anim.js';

// iOS Safari (WebKit) caps a canvas at 16,777,216 pixels (4096 x 4096). The res-2 frame atlases are bigger (ひなた 10080 x 2880 = 29 MP,
// 千草 24 MP, worker 56 MP): read through one canvas, iPhones got pixels laid out at another width and every slice read from the wrong
// place - the figure fanned out into tilted copies (水無瀬病院 「ひなたが壊れてます」, 札の家 「ふだの家の老婆も壊れてます」, 1.31.1, P50).
// So a PNG is decoded here, in script (no canvas, no colour premultiplied and back, the same bytes on every browser); a canvas is only the
// fallback (no DecompressionStream, not a PNG), read in tiles that each stay under the cap.
export const CANVAS_MAX_AREA = 16777216;
export const CANVAS_TILE = 4096;

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');   // zlib (RFC 1950): what a PNG's IDAT holds
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(out);
}

/** decode a PNG (8-bit, not interlaced: grey, RGB, palette, grey + alpha, RGBA) to { data (RGBA), width, height }; null if it cannot */
export async function decodePng(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  if (b.length < 33 || SIG.some((v, i) => b[i] !== v)) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let w = 0, h = 0, depth = 0, type = 0, lace = 0, plte = null, trns = null; const idat = [];
  for (let o = 8; o + 8 <= b.length;) {
    const len = dv.getUint32(o), t = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]), d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); depth = d[8]; type = d[9]; lace = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    o += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!w || !h || depth !== 8 || lace !== 0 || !ch || !idat.length || (type === 3 && !plte)) return null;
  let n = 0; for (const d of idat) n += d.length;
  const z = new Uint8Array(n); n = 0; for (const d of idat) { z.set(d, n); n += d.length; }
  const raw = await inflate(z);
  const stride = w * ch;
  if (raw.length < (stride + 1) * h) return null;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i], a = i >= ch ? px[dst + i - ch] : 0, u = y ? px[up + i] : 0, c = y && i >= ch ? px[up + i - ch] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + u; else if (f === 3) v = x + ((a + u) >> 1);
      else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c); }
      else return null;
      px[dst + i] = v & 255;
    }
  }
  if (type === 6) return { data: new Uint8ClampedArray(px.buffer), width: w, height: h };
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    if (type === 2) { data[j] = px[i * 3]; data[j + 1] = px[i * 3 + 1]; data[j + 2] = px[i * 3 + 2]; data[j + 3] = 255; }
    else if (type === 0) { data[j] = data[j + 1] = data[j + 2] = px[i]; data[j + 3] = 255; }
    else if (type === 4) { data[j] = data[j + 1] = data[j + 2] = px[i * 2]; data[j + 3] = px[i * 2 + 1]; }
    else { const k = px[i]; data[j] = plte[k * 3]; data[j + 1] = plte[k * 3 + 1]; data[j + 2] = plte[k * 3 + 2]; data[j + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { data, width: w, height: h };
}

/** RGBA pixels of an image URL: { data, width, height } (data rows of `width` pixels). A PNG is decoded in script; otherwise a canvas
 *  read in tiles of at most CANVAS_TILE x CANVAS_TILE (never one canvas over CANVAS_MAX_AREA: see above). px.via says which. */
export async function loadPixels(url) {
  if (typeof DecompressionStream === 'function') {
    try {
      const r = await fetch(url);
      if (r.ok) { const px = await decodePng(await r.arrayBuffer()); if (px) { px.via = 'png'; return px; } }
    } catch (e) { console.warn('[sprite-stack] PNG decode failed, using a canvas:', url, e && e.message); }
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, data = new Uint8ClampedArray(W * H * 4);
  const T = CANVAS_TILE, c = document.createElement('canvas');
  c.width = Math.min(W, T); c.height = Math.min(H, T);
  const g = c.getContext('2d', { willReadFrequently: true });
  for (let ty = 0; ty < H; ty += T) for (let tx = 0; tx < W; tx += T) {
    const tw = Math.min(T, W - tx), th = Math.min(T, H - ty);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, tx, ty, tw, th, 0, 0, tw, th);
    const part = g.getImageData(0, 0, tw, th).data;
    for (let y = 0; y < th; y++) data.set(part.subarray(y * tw * 4, (y + 1) * tw * 4), ((ty + y) * W + tx) * 4);
  }
  return { data, width: W, height: H, via: 'canvas' };
}

/** a volume view of one strip (rows y, columns z * w + x) inside an RGBA picture, starting at row `row` */
export function stripVolume(px, w, d, n, row = 0) {
  const W = px.width, data = px.data;
  return {
    w, d, n,
    at(x, y, z) { const i = ((row + y) * W + z * w + x) * 4; return data[i + 3] > 127 ? i : -1; },
    rgb(i) { return [data[i], data[i + 1], data[i + 2]]; },
  };
}

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

// 1.33.0 (夜勤明けの街 「ブロックの読み込みが長すぎる」: 85 of a block's 125 s at CPU 4x were this meshing and the PNG decode): the
// meshing is two steps. stackQuads(vol) finds the faces (one pass over the volume into a colour array, then the greedy rectangles over
// plain arrays, no vol.at() per face test) and gives compact quads; quadsToGeometry() turns quads into the BufferGeometry. The quads can
// be baked at build time (tools/bake-stacks.mjs -> <id>.quads.bin) so a phone only does the cheap second step.
/** the faces of a volume as quads: { quads: Uint16Array (7 a quad: dir 0..5, plane, a, b, wa, hb, colour index), palette (0xRRGGBB), z0, w, d, n } */
export function stackQuads(vol) {
  const { w, d, n } = vol;
  const C = new Int32Array(w * d * n).fill(-1);
  for (let z = 0; z < n; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const i = vol.at(x, y, z); if (i < 0) continue;
    const c = vol.rgb(i); C[(z * d + y) * w + x] = (c[0] << 16) | (c[1] << 8) | c[2];
  }
  // lowest solid slice -> y 0 (nothing sinks or floats whatever the strip's bottom margin)
  let z0 = 0;
  find: for (; z0 < n; z0++) for (let j = z0 * w * d, e = j + w * d; j < e; j++) if (C[j] >= 0) break find;
  const dims = [w, d, n], str = [1, w, w * d];
  const pal = new Map(), palette = [], out = [];
  for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3, U = dims[u], V = dims[v], sA = str[ax], sU = str[u], sV = str[v], K = dims[ax];
    const mask = new Int32Array(U * V);
    for (let k = 0; k < K; k++) {
      const edge = k + sg < 0 || k + sg >= K;
      let any = false;
      for (let b = 0; b < V; b++) for (let a = 0; a < U; a++) {
        const j = k * sA + a * sU + b * sV, c = C[j];
        const m = c >= 0 && (edge || C[j + sg * sA] < 0) ? c : -1;
        mask[b * U + a] = m; if (m >= 0) any = true;
      }
      if (!any) continue;
      const dir = ax * 2 + (sg > 0 ? 0 : 1), plane = sg > 0 ? k + 1 : k;
      for (let b = 0; b < V; b++) for (let a = 0; a < U;) {
        const c = mask[b * U + a];
        if (c < 0) { a++; continue; }
        let wa = 1; while (a + wa < U && mask[b * U + a + wa] === c) wa++;
        let hb = 1;
        grow: for (; b + hb < V; hb++) for (let t = 0; t < wa; t++) if (mask[(b + hb) * U + a + t] !== c) break grow;
        for (let bb = 0; bb < hb; bb++) mask.fill(-1, (b + bb) * U + a, (b + bb) * U + a + wa);
        let ci = pal.get(c); if (ci === undefined) { ci = palette.length; palette.push(c); pal.set(c, ci); }
        out.push(dir, plane, a, b, wa, hb, ci);
        a += wa;
      }
    }
  }
  return { quads: Uint16Array.from(out), palette, z0, w, d, n };
}

const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
/** quads (stackQuads or a baked pack) -> one BufferGeometry. o: { mpp (metres per voxel), scale (extra), pivot [x, y] (voxels; default centre) } */
export function quadsToGeometry(THREE, q, o = {}) {
  const { w, d, quads, palette, z0 } = q;
  const s = (o.mpp || 0.025) * (o.scale || 1);
  const px = o.pivot ? o.pivot[0] + 0.5 : w / 2, py = o.pivot ? o.pivot[1] + 0.5 : d / 2;
  const nq = quads.length / 7, nv = nq * 4;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(nq * 6) : new Uint16Array(nq * 6);
  const P = [0, 0, 0], QA = [0, 1, 1, 0], QB = [0, 0, 1, 1];
  for (let i = 0; i < nq; i++) {
    const o7 = i * 7, dir = quads[o7], ax = dir >> 1, sg = dir & 1 ? -1 : 1, plane = quads[o7 + 1], a = quads[o7 + 2], b = quads[o7 + 3], wa = quads[o7 + 4], hb = quads[o7 + 5];
    const c = palette[quads[o7 + 6]], r = LIN[(c >> 16) & 255], g = LIN[(c >> 8) & 255], bl = LIN[c & 255];
    const u = (ax + 1) % 3, v = (ax + 2) % 3, base = i * 4;
    for (let j = 0; j < 4; j++) {
      P[ax] = plane; P[u] = a + QA[j] * wa; P[v] = b + QB[j] * hb;
      const t = (base + j) * 3;
      // stack (x, y, z) -> three (x, z, y)
      pos[t] = (P[0] - px) * s; pos[t + 1] = (P[2] - z0) * s; pos[t + 2] = (P[1] - py) * s;
      nor[t] = ax === 0 ? sg : 0; nor[t + 1] = ax === 2 ? sg : 0; nor[t + 2] = ax === 1 ? sg : 0;
      col[t] = r; col[t + 1] = g; col[t + 2] = bl;
    }
    // winding from the geometry itself: the triangle's own normal must agree with the face normal
    const t0 = base * 3, e1x = pos[t0 + 3] - pos[t0], e1y = pos[t0 + 4] - pos[t0 + 1], e1z = pos[t0 + 5] - pos[t0 + 2];
    const e2x = pos[t0 + 6] - pos[t0], e2y = pos[t0 + 7] - pos[t0 + 1], e2z = pos[t0 + 8] - pos[t0 + 2];
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x, k6 = i * 6;
    if (cx * nor[t0] + cy * nor[t0 + 1] + cz * nor[t0 + 2] > 0) { idx[k6] = base; idx[k6 + 1] = base + 1; idx[k6 + 2] = base + 2; idx[k6 + 3] = base; idx[k6 + 4] = base + 2; idx[k6 + 5] = base + 3; }
    else { idx[k6] = base; idx[k6 + 1] = base + 2; idx[k6 + 2] = base + 1; idx[k6 + 3] = base; idx[k6 + 4] = base + 3; idx[k6 + 5] = base + 2; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  geo.userData.voxels = { w, d, n: q.n, mpp: s };
  return geo;
}

/** one merged mesh geometry of a volume. o: { mpp (metres per voxel), scale (extra), pivot [x, y] (voxels; default centre) } */
export function buildStackGeometry(THREE, vol, o = {}) { return quadsToGeometry(THREE, stackQuads(vol), o); }

// ---- baked quads (1.33.0): a pack of named quad sets in one binary file
//   'SQK1', u32 header length, the header JSON { items: [{ key, w, d, n, z0, nq, palette, off, u8 }] }, padding to 4, then per item
//   its six geometry values a quad (Uint8 when they all fit, else Uint16) and its colour indices (Uint16).
//   tools/bake-stacks.mjs writes them, and <dir>/quads.json lists what is baked (with the hash of the sources it was made from).
export function packQuads(list) {
  const items = [], parts = []; let off = 0;
  const pad = (x) => (x + 3) & ~3;
  for (const [key, q] of list) {
    const nq = q.quads.length / 7;
    let max = 0; for (let i = 0; i < q.quads.length; i++) if (i % 7 !== 6 && q.quads[i] > max) max = q.quads[i];
    const u8 = max < 256;
    const geo = u8 ? new Uint8Array(nq * 6) : new Uint16Array(nq * 6), ci = new Uint16Array(nq);
    for (let i = 0; i < nq; i++) { for (let j = 0; j < 6; j++) geo[i * 6 + j] = q.quads[i * 7 + j]; ci[i] = q.quads[i * 7 + 6]; }
    items.push({ key, w: q.w, d: q.d, n: q.n, z0: q.z0, nq, palette: q.palette, off, u8 });
    const b1 = new Uint8Array(geo.buffer); parts.push([off, b1]); off = pad(off + b1.length);
    const b2 = new Uint8Array(ci.buffer); parts.push([off, b2]); off = pad(off + b2.length);
  }
  const head = new TextEncoder().encode(JSON.stringify({ items }));
  const H = pad(8 + head.length);
  const buf = new Uint8Array(H + off);
  buf.set([83, 81, 75, 49]); new DataView(buf.buffer).setUint32(4, head.length, true); buf.set(head, 8);
  for (const [o, b] of parts) buf.set(b, H + o);
  return buf;
}
/** a quad pack (ArrayBuffer) -> Map key -> quads */
export function unpackQuads(ab) {
  const b = new Uint8Array(ab);
  if (b[0] !== 83 || b[1] !== 81 || b[2] !== 75 || b[3] !== 49) throw new Error('not a quad pack');
  const hl = new DataView(ab).getUint32(4, true), H = (8 + hl + 3) & ~3;
  const { items } = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hl)));
  const out = new Map();
  for (const it of items) {
    const nq = it.nq, quads = new Uint16Array(nq * 7), gl = nq * 6 * (it.u8 ? 1 : 2);
    const geo = it.u8 ? new Uint8Array(ab, H + it.off, nq * 6) : new Uint16Array(ab, H + it.off, nq * 6);
    const ci = new Uint16Array(ab, H + ((it.off + gl + 3) & ~3), nq);
    for (let i = 0; i < nq; i++) { const o6 = i * 6, o7 = i * 7; quads[o7] = geo[o6]; quads[o7 + 1] = geo[o6 + 1]; quads[o7 + 2] = geo[o6 + 2]; quads[o7 + 3] = geo[o6 + 3]; quads[o7 + 4] = geo[o6 + 4]; quads[o7 + 5] = geo[o6 + 5]; quads[o7 + 6] = ci[i]; }
    out.set(it.key, { quads, palette: it.palette, z0: it.z0, w: it.w, d: it.d, n: it.n });
  }
  return out;
}
// <dir>/quads.json: { "<id>": { "bin": "<id>.quads.bin", "src": "<hash of the sources>", "gz": true } }, read once per directory
const bakedIndexes = new Map();
export function bakedIndex(dirUrl) {
  if (typeof fetch !== 'function') return Promise.resolve({});
  if (!bakedIndexes.has(dirUrl)) bakedIndexes.set(dirUrl, fetch(new URL('quads.json', dirUrl).href).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return bakedIndexes.get(dirUrl);
}
/** the baked quads of `id` in the directory of `url` (a Map key -> quads), or null when it is not baked */
export async function loadBakedQuads(url, id) {
  if (typeof fetch !== 'function') return null;
  const dir = new URL('.', new URL(url, typeof location !== 'undefined' ? location.href : 'file:///')).href;
  const idx = await bakedIndex(dir), e = idx && idx[id];
  if (!e || (e.gz && typeof DecompressionStream !== 'function')) return null;   // no gunzip here: the atlas path
  try {
    const r = await fetch(new URL(e.bin, dir).href); if (!r.ok) return null;
    // the pack is stored gzipped (a host does not compress a .bin): unzipped natively, off the script's own time
    const ab = e.gz ? await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : await r.arrayBuffer();
    return unpackQuads(ab);
  }
  catch (err) { console.warn('[sprite-stack] baked quads', id, err && err.message); return null; }
}

/** a frame set: { meta (the JSON), px (atlas pixels), url } */
export async function loadFrameSet(THREE, jsonUrl, o = {}) {
  const meta = await (await fetch(jsonUrl)).json();
  // 1.33.0: the baked quads when tools/bake-stacks.mjs made them (no picture to decode, no meshing); o.pixels: true also reads the atlas
  const quads = o.baked === false ? null : await loadBakedQuads(jsonUrl, meta.id);
  if (quads && meta.frames.every((f) => quads.has(f)) && !o.pixels) return { meta, px: null, quads, url: jsonUrl };
  const px = await loadPixels(new URL(`${meta.id}.png`, new URL(jsonUrl, location.href)).href);
  // the atlas must be exactly the frames x slices the JSON says (a picture read at another size puts every slice in the wrong place)
  if (px.width < meta.w * meta.n || px.height < meta.d * meta.frames.length) throw new Error(`${meta.id}: atlas ${px.width}x${px.height} is smaller than ${meta.w * meta.n}x${meta.d * meta.frames.length} (w*n x d*frames)`);
  return { meta, px, quads, url: jsonUrl };
}

/** the quads of one frame (baked, or meshed from the atlas) */
export function frameQuads(set, frame) {
  if (set.quads && set.quads.has(frame)) return set.quads.get(frame);
  const m = set.meta, i = m.frames.indexOf(frame);
  if (i < 0) throw new Error(`${m.id}: no frame ${frame}`);
  if (!set.px) throw new Error(`${m.id}: frame ${frame} is not baked and the atlas is gone`);
  return stackQuads(stripVolume(set.px, m.w, m.d, m.n, i * m.d));
}

/** the geometry of one frame of a set (cached on the set) */
export function buildFrameGeometry(THREE, set, frame, o = {}) {
  set.geo = set.geo || new Map();
  const k = `${frame}|${o.scale || 1}`;
  if (set.geo.has(k)) return set.geo.get(k);
  const m = set.meta;
  if (!m.frames.includes(frame)) throw new Error(`${m.id}: no frame ${frame}`);
  const g = quadsToGeometry(THREE, frameQuads(set, frame), { mpp: m.mpp, scale: o.scale, pivot: m.pivot });
  set.geo.set(k, g);
  return g;
}

/** a character: one mesh whose geometry follows the motion player.
 *  o: { height (m: scales the set so its standing frame is this tall), scale, material, motions (only these get geometry),
 *       state, fallback,
 *       lod: { set, far = 6, camera } }   1.21.0: a fine set (res 2, 1.25 cm a voxel: tools/sprite-stacks/motion_frames.py --res 2) near the
 *       camera and this normal-resolution set of the same character farther than `far` metres (with a 1 m band so it does not flicker);
 *       update(dt, { camera }) or o.lod.camera gives the camera. figure.res is the resolution in use, root.userData.res the finest it has. */
export function createFigure(THREE, set, o = {}) {
  const m = set.meta;
  const motions = o.motions || Object.keys(m.motions);
  const frames = [...new Set(motions.flatMap((k) => (m.motions[k] ? m.motions[k].frames : [])).filter((f) => m.frames.includes(f)))];
  if (!frames.length) frames.push(m.frames[0]);
  let scale = o.scale || 1;
  if (o.height) {
    const ref = frames.find((f) => /^idle\.|^stand/.test(f)) || frames[0];
    const g = quadsToGeometry(THREE, frameQuads(set, ref), { mpp: m.mpp, pivot: m.pivot });
    scale = o.height / Math.max(1e-6, g.boundingBox.max.y);
    g.dispose();
  }
  const mat = o.material || new THREE.MeshLambertMaterial({ vertexColors: true });
  const geos = new Map(frames.map((f) => [f, buildFrameGeometry(THREE, set, f, { scale })]));
  // the far (normal-resolution) frames: scaled to the same height
  let far = null;
  if (o.lod && o.lod.set) {
    const L = o.lod.set, lm = L.meta;
    const ref = lm.frames.find((f) => /^idle\.|^stand/.test(f)) || lm.frames[0];
    const g = quadsToGeometry(THREE, frameQuads(L, ref), { mpp: lm.mpp, pivot: lm.pivot });
    const ls = o.height ? o.height / Math.max(1e-6, g.boundingBox.max.y) : scale;
    g.dispose();
    far = new Map(frames.filter((f) => lm.frames.includes(f)).map((f) => [f, buildFrameGeometry(THREE, L, f, { scale: ls })]));
  }
  const root = new THREE.Group(); root.name = `figure:${m.id}`;
  root.userData.res = m.res || (m.mpp && m.mpp < 0.02 ? 2 : 1);
  const mesh = new THREE.Mesh(geos.get(frames[0]), mat); mesh.castShadow = true; root.add(mesh);
  const anim = new MotionPlayer({ ...m, frames }, { state: o.state || 'idle', fallback: o.fallback, name: o.name || set.id, holdOk: o.holdOk });
  // every frame once, for the warm-up (geometry uploads before play)
  const warm = new THREE.Group(); warm.name = `warm:${m.id}`;
  for (const g of geos.values()) warm.add(new THREE.Mesh(g, mat));
  if (far) for (const g of far.values()) warm.add(new THREE.Mesh(g, mat));
  let shown = null, useFar = false;
  const P = new THREE.Vector3();
  const show = (f) => { const G = useFar && far && far.has(f) ? far : geos; const g = f && G.get(f); if (g && mesh.geometry !== g) { mesh.geometry = g; } if (f && G.has(f)) shown = f; return shown; };
  show(anim.update(0));
  const fig = {
    root, mesh, anim, warm, scale, frames, material: mat, res: root.userData.res,
    show,
    update(dt, u = {}) {
      const cam = u.camera || (o.lod && o.lod.camera);
      if (far && cam) {
        root.getWorldPosition(P); const d = P.distanceTo(cam.position || cam), F = (o.lod.far ?? 6);
        const next = useFar ? d > F - 0.5 : d > F + 0.5;
        if (next !== useFar) { useFar = next; fig.res = useFar ? (o.lod.set.meta.res || 1) : root.userData.res; }
      }
      return show(anim.update(dt, u));
    },
    dispose() { for (const g of geos.values()) g.dispose(); if (far) for (const g of far.values()) g.dispose(); },
  };
  return fig;
}

/** 1.22.0: a small dot picture of a stack for menus that have no photo (「絵のない詳細は空の箱や代わりの文字ではなく、ドットの絵」):
 *  the volume drawn as an oblique sprite stack (each slice half a pixel back per row of depth, back to front, bottom to top; the top of a
 *  column a step lighter), scaled up by a whole number with no smoothing. vol: stripVolume(...) or any { w, d, n, at(x, y, z), rgb(i) }.
 *  Returns a data URL (PNG). o.px = the longest side wanted (default 96). */
export function stackThumb(vol, o = {}) {
  if (typeof document === 'undefined') return null;
  const W = vol.w, H = Math.ceil(vol.n + vol.d * 0.5) + 1;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const img = g.createImageData(W, H), D = img.data;
  for (let z = 0; z < vol.n; z++) for (let y = 0; y < vol.d; y++) for (let x = 0; x < vol.w; x++) {
    const i = vol.at(x, y, z); if (i < 0) continue;
    const top = z + 1 >= vol.n || vol.at(x, y, z + 1) < 0;
    const px = x, py = Math.round((vol.n - 1 - z) + y * 0.5); if (py < 0 || py >= H) continue;
    const [r, gg, b] = vol.rgb(i), k = top ? 1.12 : 0.92, j = (py * W + px) * 4;
    D[j] = Math.min(255, r * k); D[j + 1] = Math.min(255, gg * k); D[j + 2] = Math.min(255, b * k); D[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const s = Math.max(1, Math.floor((o.px || 96) / Math.max(W, H)));
  const out = document.createElement('canvas'); out.width = W * s; out.height = H * s;
  const og = out.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, W * s, H * s);
  return out.toDataURL('image/png');
}
