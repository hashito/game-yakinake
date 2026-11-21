#!/usr/bin/env node
// Frame rate with a crowd (headless; the phone run uses a landscape phone viewport and ?touch=1, the touch LOD and the touch cap on
// bodies shown). Places N dead in the wide street (S_ODORI) walking at the player and counts frames for 8 s.
//   node tools/perf.mjs [--mobile] [--n 15]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launch } from './cdp.mjs';

const args = process.argv.slice(2), mobile = args.includes('--mobile'), N = Number(args.includes('--n') ? args[args.indexOf('--n') + 1] : 15);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, [path.join(import.meta.dirname, 'serve.js'), '--port', String(port)], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
const p = await launch(mobile ? { width: 844, height: 390, mobile: true, dpr: 2 } : { width: 1280, height: 720 });
try {
  await p.goto(`http://127.0.0.1:${port}/?qa=1${mobile ? '&touch=1' : ''}`);
  await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 150000);
  await p.eval("document.getElementById('start-btn').click()");
  await p.waitFor('__game.state.started', 15000);
  await sleep(1500);
  const r = await p.eval(`(async () => { const g = window.__game, y = window.__yk; g.prog.index = 3; g.stageLook.apply();
    g.teleport({ x: 69, z: 1, yaw: Math.PI / 2, floor: 0 }); g.fp.pitch = 0;
    y.liveZombies().forEach((L) => L.alive && L.z.kill());
    const pats = ['salaryman', 'office-woman', 'clerk', 'police', 'nurse-rot', 'worker', 'housewife', 'punk', 'runner', 'cleaner', 'old-man', 'doctor', 'patient', 'salaryman-rot', 'raincoat'];
    for (let i = 0; i < ${N}; i++) { const x = 50 + (i % 5) * 3.2, z = -2.5 + Math.floor(i / 5) * 2.6; const R = y.roomAtP(x, z, 0); if (R) y.extraZombie({ id: 'PF' + i, p: pats[i % pats.length], room: R.id, x, z, yaw: Math.PI / 2 }); }
    await new Promise((res) => setTimeout(res, 1500));
    // they keep walking at the player; the player does not die during the count
    const hurt = y.hurt; y.hurt = () => {};
    const times = []; let last = performance.now(); const t0 = last;
    await new Promise((res) => { const f = (t) => { times.push(t - last); last = t; if (t - t0 < 8000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    y.hurt = hurt;
    times.sort((a, b) => a - b); const fps = times.length / 8, p95 = times[Math.floor(times.length * 0.95)];
    return JSON.stringify({ fps: Math.round(fps * 10) / 10, p95ms: Math.round(p95 * 10) / 10, minFps: Math.round(1000 / times[times.length - 1]), live: y.zStats, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles });
  })()`);
  console.log(mobile ? 'phone 844x390 dpr2' : 'pc 1280x720', N, 'zombies:', r);
} catch (e) { console.log('ERROR', e.message); }
await p.close(); server.kill();
process.exit(0);
