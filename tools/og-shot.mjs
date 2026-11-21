#!/usr/bin/env node
// The key pictures from inside the game (headless, no HUD): the night street with the dead walking toward the player under the sodium
// light, and the roof at dawn. Writes tools/_raw/og-street.png and tools/_raw/og-roof.png (1200x630); tools/make_og.py puts the title on
// the street one (assets/og-image.png).
//   node tools/og-shot.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, [path.join(import.meta.dirname, 'serve.js'), '--port', String(port)], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
const p = await launch({ width: 1200, height: 630 });
fs.mkdirSync(path.join(ROOT, 'tools/_raw'), { recursive: true });
try {
  await p.goto(`http://127.0.0.1:${port}/?qa=1`);
  await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 120000);
  await p.eval("document.getElementById('start-btn').click()");
  await p.waitFor('__game.state.started', 15000);
  await sleep(1000);
  const scene = async (file, js) => {
    await p.eval(`(async () => { ${js} })()`);
    await sleep(2500);
    await p.eval("(() => { const s = document.createElement('style'); s.id = 'og-hide'; s.textContent = 'body > *:not(canvas):not(#c):not(.game-canvas) { visibility: hidden !important } canvas { visibility: visible !important }'; document.head.append(s); return 1; })()");
    await sleep(400);
    await p.shot(path.join(ROOT, 'tools/_raw', file));
    await p.eval("document.getElementById('og-hide').remove() || 1");
  };
  const zombies = (list) => `const y = window.__yk; y.liveZombies().forEach((L) => L.alive && L.z.kill());
    for (const [i, [pat, x, z]] of ${JSON.stringify(list)}.entries()) { const R = y.roomAtP(x, z, g.floor || 0); if (R) y.extraZombie({ id: 'OG' + i, p: pat, room: R.id, x, z, yaw: Math.PI / 2 }); }`;
  // the street (S_ODORI), looking west along it toward the hospital, five of the dead coming
  await scene('og-street.png', `const g = window.__game; g.prog.index = 3; g.stageLook.apply(); g.teleport({ x: 66, z: 1.5, yaw: Math.PI / 2 + 0.12, floor: 0 }); g.fp.pitch = -0.04;
    ${zombies([['salaryman', 61.5, 1.2], ['nurse-rot', 59, 2.6], ['office-woman', 57.2, 0.2], ['police', 55, 3.2], ['runner', 53, 1.5], ['crawler', 62.8, 3.0]])}`);
  // the roof at dawn (O_ROOF), the helipad, a few climbing over
  await scene('og-roof.png', `const g = window.__game; g.prog.index = 7; g.stageLook.apply(); g.teleport({ x: 131, z: 10, yaw: -Math.PI / 2, floor: 4 }); g.fp.pitch = 0.02;
    ${zombies([['salaryman-rot', 137, 9], ['clerk', 139, 11.5], ['giant', 141, 8]])}`);
  console.log('shots in tools/_raw: og-street.png og-roof.png');
} catch (e) { console.log('ERROR', e.message); }
await p.close(); server.kill();
process.exit(0);
