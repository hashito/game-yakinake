#!/usr/bin/env node
// 1.3.1: the dot pictures of assets/photos/ made at build time by the game's own js/dot/photos.js pixelate() in a headless browser, so the
// phone neither decodes nor dithers 57 photos with the first block (1.3 MB and 1.5 s at CPU 4x) and fetches a picture only when it shows.
//   node tools/bake-photos.mjs [--check]     -> assets/photos-px/<name>.png + index.json { name: { file, src } }
// --check: exit 1 when a photo has no baked picture or was changed after it was baked (npm run build runs it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/photos'), OUT = path.join(root, 'assets/photos-px');
const check = process.argv.includes('--check');
const hash = (f) => crypto.createHash('sha1').update('px1').update(fs.readFileSync(path.join(SRC, f))).update(fs.readFileSync(path.join(root, 'js/dot/photos.js'))).digest('hex').slice(0, 16);
const names = fs.readdirSync(SRC).filter((f) => /\.(webp|png|jpe?g)$/.test(f)).sort();
const idxFile = path.join(OUT, 'index.json');
const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
const todo = names.filter((f) => !(idx[f] && idx[f].src === hash(f) && fs.existsSync(path.join(OUT, idx[f].file))));
if (check) {
  for (const f of todo) console.log(`STALE assets/photos/${f}: no baked dot picture or made from another photo (run node tools/bake-photos.mjs)`);
  console.log(todo.length ? `bake-photos: ${todo.length} stale` : `bake-photos: ${names.length} up to date`);
  process.exit(todo.length ? 1 : 0);
}
fs.mkdirSync(OUT, { recursive: true });
if (todo.length) {
  const { launch } = await import(new URL('./cdp.mjs', import.meta.url).href);
  const port = 47400 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(root, 'tools/serve.js'), '--port', String(port), '--root', root], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const page = path.join(OUT, '_bake.html');   // an HTML page of the same origin that runs nothing (a canvas needs an HTML document)
  fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><title>bake</title>');
  const p = await launch({ width: 800, height: 600 });
  try {
    await p.goto(`http://127.0.0.1:${port}/assets/photos-px/_bake.html`);
    for (const f of todo) {
      const b64 = await p.eval(`(async () => { const m = await import('/js/dot/photos.js'); const u = await m.pixelate('/assets/photos/${f}'); const ab = await (await fetch(u)).arrayBuffer(); let s = ''; const b = new Uint8Array(ab); for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); })()`);
      const file = f.replace(/\.(webp|png|jpe?g)$/, '.png');
      fs.writeFileSync(path.join(OUT, file), Buffer.from(b64, 'base64'));
      idx[f] = { file, src: hash(f) };
      console.log(`baked assets/photos-px/${file}`);
    }
  } finally { await p.close(); srv.kill(); fs.rmSync(page, { force: true }); }
}
for (const k of Object.keys(idx)) if (!names.includes(k)) { try { fs.unlinkSync(path.join(OUT, idx[k].file)); } catch (e) { /* gone */ } delete idx[k]; }
fs.writeFileSync(idxFile, JSON.stringify(Object.fromEntries(Object.keys(idx).sort().map((k) => [k, idx[k]])), null, 1) + '\n');
console.log(`bake-photos: ${todo.length} baked, ${names.length - todo.length} up to date`);
