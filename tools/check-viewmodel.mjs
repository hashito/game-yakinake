// node tools/check-viewmodel.mjs [outDir] (1.4.2, kit 1.37.3): in the real game, each hand / weapon viewmodel x 4 sizes (390x844, 844x390,
// 1280x720, 844x340): at least 60 % of the item (not the arm) on screen, none of it round the crosshair (8 % of the short side), the
// middle of what shows lower right (x 0.38..0.82, y below 0.55); under = the share drawn under the phone's buttons (reported).
// SHOTS=1 writes <outDir>/<id>-390x844.png and -844x390.png (the screenshot item); SIZES='[[w,h],...]', FIT='{...}' (rig.fit) to try values.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] || path.join(dir, 'tools/_raw/viewmodel'); fs.mkdirSync(out, { recursive: true });
const { launch } = await import(pathToFileURL(path.join(dir, 'tools/cdp.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const port = 26000 + Math.floor(Math.random() * 9000);
const srv = spawn(process.execPath, [path.join(dir, 'tools/serve.js'), '--port', String(port), '--root', dir], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
const E = (p, x) => p.eval(`(() => { const g = window.__game, y = window.__yk; return JSON.stringify(${x}); })()`).then((r) => (r === undefined ? undefined : JSON.parse(r)));
const go = async (p) => { for (let i = 0; i < 240; i++) { const s = await E(p, "(() => { const b = document.querySelector('.gf-block-load.on .gf-bl-go'); if (b && !b.disabled) { b.click(); return 'click'; } return document.querySelector('.gf-block-load.on') ? 'wait' : 'none'; })()"); if (s === 'none') return; await sleep(500); } };
const IDS = ['hands', 'scalpel', 'pipe', 'axe', 'nailgun', 'pistol', 'shotgun', 'rifle'];
const MIN = +(process.env.MIN || 0.6);
let bad = 0;
const sizes = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[390, 844], [844, 390], [1280, 720], [844, 340]];
for (const [w, h] of sizes) {
  const mob = w < 1000; const p = await launch({ width: w, height: h, mobile: mob, dpr: mob ? 2 : 1 });
  try {
    await p.goto(`http://127.0.0.1:${port}/?qa=1${mob ? '&touch=1' : ''}`);
    await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 180000);
    await sleep(500); await p.eval("(document.querySelector('.gf-rot-ok') || { click() {} }).click(), 1");
    await p.eval("document.getElementById('start-btn').click(), 1"); await sleep(1500); await go(p);
    await p.waitFor('__game.state.started && window.__yk', 60000); await sleep(2000);
    for (let i = 0; i < 6; i++) { await p.eval("(() => { const g = window.__game; try { g.wm && g.wm.isOpen && g.wm.close(); } catch (e) {} [...document.querySelectorAll('.wm-layer .btn.primary, #gf-reader .tl-close')].filter((b) => b.offsetParent).forEach((b) => b.click()); return 1; })()"); await sleep(250); }
    await E(p, "(g.teleport({ x: 13, z: 6.6, floor: 0, yaw: Math.PI / 2 }), g.fp.yaw = Math.PI / 2, g.fp.pitch = -0.05, 1)"); await sleep(1200);
    if (process.env.FIT) await E(p, `(Object.assign(y.fpRig.fit, ${process.env.FIT}), 1)`);
    console.log(w, h, 'fit', JSON.stringify(await E(p, 'y.fpRig.fitNow ? y.fpRig.fitNow() : null')));
    for (const id of IDS) {
      await E(p, `(() => { y.case.restore({ bag: y.case.bag, items: [], store: [], equip: null }); if (${JSON.stringify(id)} === 'hands') { y.equip = null; } else { y.case.add(${JSON.stringify(id)}, 1, { loaded: 4 }); const it = y.case.items.find((i) => i.id === ${JSON.stringify(id)}); y.equipUid(it.uid, { quiet: true }); } y.hud && y.hud(); return 1; })()`);
      await sleep(700);
      const measure = () => E(p, `(() => { const b = y.fpRig.built.get(${JSON.stringify(id)}); if (!b || !b.g.visible) return { err: 'not shown' }; const cam = g.camera; cam.updateMatrixWorld(); b.mesh.updateWorldMatrix(true, false);
        const pos = b.mesh.geometry.attributes.position, e = b.mesh.matrixWorld.elements, V = new cam.position.constructor();
        const btn = [...document.querySelectorAll('button[data-k]')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect());
        const iv = cam.matrixWorldInverse; let n = 0, on = 0, mid = 0, under = 0, cx = 0, cy = 0;
        for (let i = 0; i < pos.count; i += 3) { const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i); if (z > -0.005) continue; V.set(e[0]*x+e[4]*yy+e[8]*z+e[12], e[1]*x+e[5]*yy+e[9]*z+e[13], e[2]*x+e[6]*yy+e[10]*z+e[14]); if (V.clone().applyMatrix4(iv).z > -0.05) continue; V.project(cam); n++;
          if (Math.abs(V.x) <= 1 && Math.abs(V.y) <= 1) { on++; const px = (V.x + 1) / 2 * innerWidth, py = (1 - V.y) / 2 * innerHeight; cx += px / innerWidth; cy += py / innerHeight; if (Math.hypot(px - innerWidth / 2, py - innerHeight / 2) < Math.min(innerWidth, innerHeight) * 0.08) mid++; if (btn.some((r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom)) under++; } }
        return { on: +(on / n).toFixed(2), mid: +(mid / n).toFixed(3), under: +(under / Math.max(1, on)).toFixed(2), btns: btn.length, cx: +(cx / Math.max(1, on)).toFixed(2), cy: +(cy / Math.max(1, on)).toFixed(2) }; })()`);
      const pass = (m) => m && !m.err && m.on >= MIN && m.mid < 0.01 && m.cx >= 0.38 && m.cx <= 0.82 && m.cy >= 0.55;
      let m = await measure();
      // a weapon just put in the hand can still be in its raise / settle: measure again once before calling it bad
      if (!pass(m)) { await sleep(1500); m = await measure(); }
      const ok = pass(m);
      if (!ok) bad++;
      console.log(w, h, id, ok ? 'ok ' : 'BAD', JSON.stringify(m));
      if (process.env.SHOTS && ((w === 390 && h === 844) || (w === 844 && h === 390))) await p.shot(path.join(out, `${id}-${w}x${h}.png`));
    }
  } catch (e) { console.error(w, h, e.message); bad++; } finally { await p.close(); }
}
srv.kill(); console.log(bad ? `VIEWMODEL BAD ${bad}` : 'VIEWMODEL OK'); process.exit(bad ? 1 : 0);
