#!/usr/bin/env node
// Pictures listed in tools/media.json through the local media queue (http://127.0.0.1:8765, kind "image", model flux), one job at a time,
// saved as assets/photos/<key>.webp (Pillow: long side 1024, 640 for square ones, quality 82). Existing files are skipped.
//   node tools/gen-images.mjs [--only k1,k2] [--force k1,k2]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:8765';
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/media.json'), 'utf8'));
const args = process.argv.slice(2), arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1].split(',') : null);
const only = arg('--only'), force = new Set(arg('--force') || []);
const out = path.join(ROOT, 'assets/photos'); fs.mkdirSync(out, { recursive: true });
const raw = path.join(ROOT, 'tools/_raw'); fs.mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seedOf = (k) => ([...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000) + ((M.seeds || {})[k] || 0);
const PY = "import sys\nfrom PIL import Image\nsrc,dst,L=sys.argv[1],sys.argv[2],int(sys.argv[3])\nim=Image.open(src).convert('RGB')\nw,h=im.size\nk=L/max(w,h)\nim=im.resize((round(w*k),round(h*k)),Image.LANCZOS)\nim.save(dst,'WEBP',quality=82)\n";
for (const im of M.images) {
  if (only && !only.includes(im.key)) continue;
  const dst = path.join(out, `${im.key}.webp`);
  if (fs.existsSync(dst) && !force.has(im.key)) continue;
  const body = { kind: 'image', params: { prompt: `${im.prompt}, ${im.tail || M.tail}`, negative: im.negative || M.negative, model: im.model || 'flux', size: im.size, seed: seedOf(im.key), n: 1 } };
  const j = await (await fetch(`${API}/v1/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  if (!j.id) { console.log('post failed', im.key, JSON.stringify(j)); continue; }
  for (;;) {
    const s = await (await fetch(`${API}/v1/jobs/${j.id}`)).json();
    if (s.status === 'done') {
      const keep = path.join(raw, `${im.key}.png`);
      fs.copyFileSync(s.files[0].path, keep);
      execFileSync('python', ['-c', PY, keep, dst, im.size.startsWith('768') ? '640' : '1024']);
      await fetch(`${API}/v1/jobs/${j.id}`, { method: 'DELETE' }).catch(() => {});
      console.log('ok', im.key);
      break;
    }
    if (s.status === 'failed' || s.status === 'deleted') { console.log('failed', im.key, s.error || ''); break; }
    await sleep(2000);
  }
}
console.log('done');
