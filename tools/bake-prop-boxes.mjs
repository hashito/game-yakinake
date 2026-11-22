#!/usr/bin/env node
// Measure every recipe prop once at build time (standard 1.34.0, 夜勤明けの街 1.3.2): a dot build replaces most props with its own
// sprite-stack parts and only needs their boxes, yet building them all took 4.5 s of the title at CPU 4x. The game is opened headless with
// ?bakeprops (the full props), each prop's local box and colliders are written to data/prop-boxes.json, and from then on the props the game
// stubs (ctx.recipeStub(f) -> true) are built as boxes only (js/recipes.js).
//   node tools/bake-prop-boxes.mjs [gameDir] [--check]
// --check: exit 1 when the plan or the kit's prop code changed after the boxes were measured (a game's build runs it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const check = args.includes('--check');
const OUT = path.join(root, 'data/prop-boxes.json');
const kitDir = fs.existsSync(path.join(root, 'js/kit/recipes.js')) ? 'js/kit' : 'js';
const srcFiles = ['data/plan.json', ...['recipes.js', 'recipes-data.js', 'room-types.js', 'props.js', 'env-props.js', 'prop-geo.js', 'prop-batch.js'].map((f) => `${kitDir}/${f}`)].filter((f) => fs.existsSync(path.join(root, f)));
const strip = (b) => b.toString('utf8').replace(/^\/\* game-kit [0-9a-f]+:[^\n]*\n/, '');   // the sync header names the kit commit: not a change
const src = crypto.createHash('sha1').update(srcFiles.map((f) => strip(fs.readFileSync(path.join(root, f)))).join('\0')).digest('hex').slice(0, 16);
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (check) {
  const ok = old && old.src === src;
  console.log(ok ? `bake-prop-boxes: up to date (${Object.keys(old.items || {}).length} props)` : 'STALE data/prop-boxes.json: the plan or the kit prop code changed (run node tools/bake-prop-boxes.mjs)');
  process.exit(ok ? 0 : 1);
}
const { launch } = await import(pathToFileURL(path.join(root, 'tools/cdp.mjs')).href);
const port = 47300 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(root, 'tools/serve.js'), '--port', String(port), '--root', root], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const p = await launch({ width: 1280, height: 720 });
try {
  await p.goto(`http://127.0.0.1:${port}/?bakeprops=1&calm=1`);
  await p.waitFor("(() => { const g = window.__game; return !!(g && g.recipes && g.recipes.props && g.recipes.props.size); })()", 300000);
  await new Promise((r) => setTimeout(r, 500));
  const items = await p.eval(`(async () => { const R = await import('/${kitDir}/recipes.js'); const G = await import('/${kitDir}/prop-geo.js'); return R.measureProps(window.__game, G.localBox); })()`);
  fs.writeFileSync(OUT, JSON.stringify({ src, items }, null, 0) + '\n');
  console.log(`bake-prop-boxes: ${Object.keys(items).length} props measured -> data/prop-boxes.json`);
} finally { await p.close(); srv.kill(); }
