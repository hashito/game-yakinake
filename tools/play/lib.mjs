// Shared bits of the feature play scripts (tools/play/*.mjs): a served copy of the game, a headless browser, the game's hooks.
//   const T = await open({ phone: true, shots: 'D:/yakinake-stages/170' }); await T.start(); ... await T.done();
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../cdp.mjs';

if (!process.env.BROWSER) {
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1248/chrome-win64/chrome.exe');
  if (fs.existsSync(pw)) process.env.BROWSER = pw;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function open(o = {}) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const root = path.join(import.meta.dirname, '../..');
  const server = spawn(process.execPath, [path.join(root, 'tools/serve.js'), '--port', String(port)], { stdio: 'ignore', cwd: root });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) { if (await fetch(base).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
  const p = await launch(o.phone ? { width: 390, height: 844, mobile: true, dpr: 2 } : { width: o.width || 1280, height: o.height || 720 });
  const tag = o.phone ? 'phone' : 'pc';
  const dir = o.shots ? path.join(o.shots, tag) : null; if (dir) fs.mkdirSync(dir, { recursive: true });
  let n = 0, failed = 0;
  const t0 = Date.now();
  const log = (...a) => console.log(`[${tag}] ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`, ...a);
  const T = {
    p, base, log,
    G: (expr) => p.eval(`(() => { const g = window.__game, y = window.__yk; return JSON.stringify(${expr}); })()`).then((s) => (s === undefined ? undefined : JSON.parse(s))),
    shot: async (name) => { if (!dir) return null; const f = path.join(dir, `${String(++n).padStart(2, '0')}_${name}.jpg`); await p.shot(f); log('shot', f); return f; },
    expect: (ok, m) => { if (!ok) { failed++; log('FAIL', m); } else log('ok  ', m); return ok; },
    key: (code, type = 'keydown') => p.eval(`dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { code: ${JSON.stringify(code)} })) && 1`),
    frames: (k = 2) => p.eval(`new Promise((r) => { let n = ${k}; const f = () => (--n <= 0 ? r(1) : requestAnimationFrame(f)); requestAnimationFrame(f); })`),
    lookAt: (x, y, z) => p.eval(`(() => { const g = window.__game, c = g.camera.position, dx = ${x} - c.x, dy = ${y} - c.y, dz = ${z} - c.z; g.fp.yaw = Math.atan2(-dx, -dz); g.fp.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return 1; })()`),
    blockGo: async () => {
      if (!(await p.eval("!!document.querySelector('.gf-block-load.on')"))) return false;
      await p.waitFor("(() => { const b = document.querySelector('.gf-block-load .gf-bl-go'); return !document.querySelector('.gf-block-load.on') || (b && !b.disabled); })()", 120000);
      await p.eval("(() => { const b = document.querySelector('.gf-block-load.on .gf-bl-go'); if (b) b.click(); return 1; })()"); await sleep(400);
      return true;
    },
    dismiss: async () => { await T.blockGo(); for (let i = 0; i < 6 && (await T.G('!!(g.ui.open || g.wm.isOpen || (g.blockers || []).some((f) => f()))')); i++) { await p.key('Escape'); await sleep(250); if (await T.G('!!(g.ui.open || g.wm.isOpen)')) { await p.eval("document.querySelector('.win-foot .btn')?.click()"); await sleep(250); } } },
    // click through the talks and cards on screen (次へ / 続ける / 閉じる) as a player does
    async talkThrough(max = 40) {
      for (let i = 0; i < max; i++) {
        const hit = await p.eval("(() => { const b = [...document.querySelectorAll('.win button, .win-foot button, .gf-talk button')].find((b) => b.offsetParent && /^(次へ|続ける|閉じる|わかった|始める|OK)$/.test(b.textContent.trim())); if (!b) return 0; b.click(); return 1; })()");
        if (!hit) return i; await sleep(250);
      }
      return max;
    },
    async start(qa = true) {
      if (o.phone) { await p.goto(base); await p.eval("(localStorage.setItem('gf.portraitOk', '1'), 1)"); }   // held upright on purpose: no turn-sideways notice
      await p.goto(`${base}?${qa ? 'qa=1' : ''}${o.phone ? '&touch=1' : ''}`);
      await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 120000);
      const r = await p.eval("(() => { const b = document.getElementById('start-btn'); b.scrollIntoView({ block: 'center' }); return JSON.stringify(b.getBoundingClientRect()); })()").then(JSON.parse);
      if (o.phone) await p.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.click(r.x + r.width / 2, r.y + r.height / 2);
      await sleep(1200);
      // a phone held upright is asked once to turn sideways: play on as it is held
      const keep = await p.eval("(() => { const b = [...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.trim() === 'このまま遊ぶ'); return b ? JSON.stringify(b.getBoundingClientRect()) : ''; })()");
      if (keep) { const k = JSON.parse(keep); await p.tap(k.x + k.width / 2, k.y + k.height / 2); }
      await p.waitFor("!!document.querySelector('.gf-block-load.on') || __game.state.started", 20000);
      await T.blockGo();
      await p.waitFor('__game.state.started', 20000);
      await sleep(800);
    },
    // jump the story to a stage (the tasks before it done quietly, its block loaded)
    async toStage(lv, tasks = [], raw = false) {
      // raw: only marked done (no talks, no rewards) - for a scene that must not be covered by the talks of the tasks before it
      await T.G(`(() => { for (const id of ${JSON.stringify(tasks)}) if (!g.state.tasks.includes(id)) { if (${raw}) g.state.tasks.push(id); else g.completeTask(id, { quiet: true, noSave: true }); } return 1; })()`);
      await sleep(600); await T.dismiss();
      return T.G('g.prog ? g.prog.index : -1');
    },
    tp: async (x, z, yaw = 0, floor = 0) => { await T.G(`(g.teleport({ x: ${x}, z: ${z}, yaw: ${yaw}, floor: ${floor} }), g.fp.pitch = 0, 1)`); await sleep(300); await T.dismiss(); await T.frames(3); },
    async done() {
      const errs = p.errors.filter((e) => !/favicon|404/.test(e));
      T.expect(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`);
      await p.close(); server.kill();
      log(failed ? `FAILED ${failed}` : 'OK');
      return failed;
    },
    get failed() { return failed; },
  };
  return T;
}
