#!/usr/bin/env node
// Bake the sprite-stack meshing at build time (standard 1.33.0, 夜勤明けの街 1.3.1: a block took 70-125 s on a phone profile, 85 % of it
// decoding the atlases and meshing the voxels). For every frame set (<id>.json with frames + <id>.png), zombie pattern (pieces / lod /
// caps + atlas) and stack index (index.json { key: { w, d, n } } + <key>.png) in the given asset folders, the faces are found here once
// and written as compact quads (<id>.quads.bin, js/sprite-stack-mesh.js packQuads) with <folder>/quads.json listing them and the hash of
// the files they were made from. The game then loads a .bin (no picture, no meshing: loadFrameSet / loadZombiePattern / loadBakedQuads)
// and only turns quads into vertices.
//   node tools/bake-stacks.mjs [gameDir] [--dirs assets/figures,assets/zombies,assets/stacks] [--check]
// --check: exit 1 when something bakeable has no up-to-date pack (build-site / the release checks run it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const root = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--dirs'))) || '.');
const check = args.includes('--check');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lib = [path.join(root, 'js/kit/sprite-stack-mesh.js'), path.join(here, '../js/kit/sprite-stack-mesh.js')].find((p) => fs.existsSync(p));
const zlibPath = [path.join(root, 'js/kit/dot-zombie.js'), path.join(here, '../js/kit/dot-zombie.js')].find((p) => fs.existsSync(p));
const S = await import(pathToFileURL(lib).href);
const { stripVol } = await import(pathToFileURL(zlibPath).href);
const dirs = (opt('--dirs') || 'assets/figures,assets/zombies,assets/stacks').split(',').map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
const hash = (files) => { const h = crypto.createHash('sha1'); h.update('SQK1'); for (const f of files) h.update(fs.readFileSync(f)); return h.digest('hex').slice(0, 16); };
const decode = async (f) => { const px = await S.decodePng(fs.readFileSync(f)); if (!px) throw new Error(`${f}: not a PNG the kit can read`); return px; };
let stale = 0, made = 0, kept = 0, bytes = 0;
for (const dir of dirs) {
  const idxFile = path.join(dir, 'quads.json');
  const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
  const next = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'quads.json').sort()) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    let kind = null, id = null, png = [];
    if (Array.isArray(j.frames) && j.w && j.d && j.n && j.id) { kind = 'frames'; id = j.id; png = [path.join(dir, `${j.id}.png`)]; }
    else if (Array.isArray(j.pieces) && Array.isArray(j.caps) && j.atlas && j.id) { kind = 'zombie'; id = j.id; png = [path.join(dir, j.atlas)]; }
    else if (f === 'index.json' && Object.values(j).length && Object.values(j).every((s) => s && s.w && s.d && s.n)) { kind = 'stacks'; id = 'index'; png = Object.keys(j).map((k) => path.join(dir, `${k}.png`)); }
    if (!kind || png.some((p) => !fs.existsSync(p))) continue;
    const src = hash([path.join(dir, f), ...png]), bin = `${id}.quads.bin`;
    if (idx[id] && idx[id].src === src && idx[id].gz && fs.existsSync(path.join(dir, bin))) { next[id] = idx[id]; kept++; continue; }
    if (check) { console.log(`STALE ${path.relative(root, path.join(dir, f))}: no baked quads or made from other files (run node tools/bake-stacks.mjs)`); stale++; continue; }
    const t0 = Date.now(), list = [];
    if (kind === 'frames') {
      const px = await decode(png[0]);
      j.frames.forEach((fr, i) => list.push([fr, S.stackQuads(S.stripVolume(px, j.w, j.d, j.n, i * j.d))]));
    } else if (kind === 'zombie') {
      const px = await decode(png[0]);
      for (const p of j.pieces) list.push([`fine:${p.name}`, S.stackQuads(stripVol(px, p))]);
      for (const p of j.lod) list.push([`lod:${p.name}`, S.stackQuads(stripVol(px, p))]);
      for (const c of j.caps) list.push([`cap:${c.name}`, S.stackQuads(stripVol(px, c))]);
    } else {
      for (const [k, s] of Object.entries(j)) { const px = await decode(path.join(dir, `${k}.png`)); list.push([k, S.stackQuads(S.stripVolume(px, s.w, s.d, s.n, 0))]); }
    }
    const raw = S.packQuads(list), buf = zlib.gzipSync(raw, { level: 9 });   // gzipped: a host does not compress a .bin
    fs.writeFileSync(path.join(dir, bin), buf);
    next[id] = { bin, src, gz: true };
    made++; bytes += buf.length;
    console.log(`baked ${path.relative(root, path.join(dir, bin))} (${list.length} sets, ${Math.round(buf.length / 1024)} KB gzipped of ${Math.round(raw.length / 1024)}, ${Date.now() - t0} ms)`);
  }
  if (!check) {
    for (const id of Object.keys(idx)) if (!next[id] && idx[id].bin && fs.existsSync(path.join(dir, idx[id].bin))) fs.unlinkSync(path.join(dir, idx[id].bin));
    if (Object.keys(next).length) fs.writeFileSync(idxFile, JSON.stringify(next, null, 1) + '\n'); else if (fs.existsSync(idxFile)) fs.unlinkSync(idxFile);
  }
}
if (check) { console.log(stale ? `bake-stacks: ${stale} stale (${kept} up to date)` : `bake-stacks: ${kept} up to date`); process.exit(stale ? 1 : 0); }
console.log(`bake-stacks: ${made} baked (${Math.round(bytes / 1024)} KB), ${kept} up to date`);
