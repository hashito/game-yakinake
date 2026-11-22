// node tools/check-viewmodel.mjs [outDir] (1.4.2, kit 1.37.3): in the real game, each hand / weapon viewmodel x 4 sizes (390x844, 844x390,
// 1280x720, 844x340): at least 60 % of the item (not the arm) on screen, none of it round the crosshair (8 % of the short side), the
// middle of what shows lower right (x 0.38..0.82, y below 0.55); under = the share drawn under the phone's buttons (reported).
// 1.4.3 (kit 1.37.6): measured by area; at most 15 % of what shows under the phone's buttons (MAXU), IDS='a,b' to measure some only.
// SHOTS=1 writes <outDir>/<id>-390x844.png and -844x390.png (the screenshot item); SIZES='[[w,h],...]', FIT='{...}' (rig.fit) to try values.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] || path.join(dir, 'tools/_raw/viewmodel'); fs.mkdirSync(out, { recursive: true });
const { launch } = await import(pathToFileURL(path.join(dir, 'tools/cdp.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const port = 26000 + Math.floor(Math.random() * 9000);
const srv = spawn(process.execPath, [path.join(dir, 'tools/serve.js'), '--port', String(port), '--root', dir], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
const E = (p, x) => p.eval(`(() => { const g = window.__game, y = window.__yk; return JSON.stringify(${x}); })()`).then((r) => (r === undefined ? undefined : JSON.parse(r)));
const go = async (p) => { for (let i = 0; i < 240; i++) { const s = await E(p, "(() => { const b = document.querySelector('.gf-block-load.on .gf-bl-go'); if (b && !b.disabled) { b.click(); return 'click'; } return document.querySelector('.gf-block-load.on') ? 'wait' : 'none'; })()"); if (s === 'none') return; await sleep(500); } };
const IDS = process.env.IDS ? process.env.IDS.split(',') : ['hands', 'scalpel', 'pipe', 'axe', 'nailgun', 'pistol', 'shotgun', 'rifle'];
const MAXU = +(process.env.MAXU || 0.15);   // 1.4.3: at most 15 % of what shows under the phone's buttons
const MIN = +(process.env.MIN || 0.6);
let bad = 0;
const sizes = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[390, 844], [844, 390], [1280, 720], [844, 340]];
for (const [w, h] of sizes) {
  const mob = w < 1000; const p = await launch({ width: w, height: h, mobile: mob, dpr: mob ? 2 : 1 });
  try {
    await p.goto(`http://127.0.0.1:${port}/?${process.env.NOQA ? '' : 'qa=1&'}${mob ? 'touch=1' : ''}`);   // NOQA=1: normal mode (the screenshot review)
    await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 180000);
    await sleep(500); await p.eval("(document.querySelector('.gf-rot-ok') || { click() {} }).click(), 1");
    await p.eval("document.getElementById('start-btn').click(), 1"); await sleep(1500); await go(p);
    await p.waitFor('__game.state.started && window.__yk', 60000); await sleep(2000);
    for (let i = 0; i < 6; i++) { await p.eval("(() => { const g = window.__game; try { g.wm && g.wm.isOpen && g.wm.close(); } catch (e) {} [...document.querySelectorAll('.wm-layer .btn.primary, #gf-reader .tl-close')].filter((b) => b.offsetParent).forEach((b) => b.click()); return 1; })()"); await sleep(250); }
    await sleep(+(process.env.SAYWAIT || 5000));   // the opening hint (portrait: 横持ち) fades
    await E(p, "(g.teleport({ x: 13, z: 6.6, floor: 0, yaw: Math.PI / 2 }), g.fp.yaw = Math.PI / 2, g.fp.pitch = -0.05, 1)"); await sleep(1200);
    if (process.env.FIT) await E(p, `(Object.assign(y.fpRig.fit, ${process.env.FIT}), 1)`);
    console.log(w, h, 'fit', JSON.stringify(await E(p, 'y.fpRig.fitNow ? y.fpRig.fitNow() : null')));
    for (const id of IDS) {
      await E(p, `(() => { y.case.restore({ bag: y.case.bag, items: [], store: [], equip: null }); if (${JSON.stringify(id)} === 'hands') { y.equip = null; } else { y.case.add(${JSON.stringify(id)}, 1, { loaded: 4 }); const it = y.case.items.find((i) => i.id === ${JSON.stringify(id)}); y.equipUid(it.uid, { quiet: true }); } y.hud && y.hud(); return 1; })()`);
      await sleep(700);
      // 1.4.3: measured by area, not by vertex - every item triangle is filled into a 4 px grid (a long gun's big flat sides have few
      // vertices, so the 1.4.2 vertex count said 3 % under the buttons where the screenshot showed the whole stock under them)
      const measure = () => E(p, `(() => { const b = y.fpRig.built.get(${JSON.stringify(id)}); if (!b || !b.g.visible) return { err: 'not shown' }; const cam = g.camera; cam.updateMatrixWorld(); b.mesh.updateWorldMatrix(true, false);
        const geo = b.mesh.geometry, pos = geo.attributes.position, idx = geo.index, e = b.mesh.matrixWorld.elements, V = new cam.position.constructor();
        const btn = [...document.querySelectorAll('#t-buttons [data-k], button[data-k]')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect());
        const W = innerWidth, H = innerHeight, C = 4, iv = cam.matrixWorldInverse, cells = new Set();
        const P = (i) => { const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i); V.set(e[0]*x+e[4]*yy+e[8]*z+e[12], e[1]*x+e[5]*yy+e[9]*z+e[13], e[2]*x+e[6]*yy+e[10]*z+e[14]); if (V.clone().applyMatrix4(iv).z > -0.05) return null; V.project(cam); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H, z]; };
        const nt = idx ? idx.count / 3 : pos.count / 3;
        for (let t = 0; t < nt; t++) { const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          const A = P(ia), B = P(ib), D = P(ic); if (!A || !B || !D) continue; if ((A[2] + B[2] + D[2]) / 3 > -0.005) continue;
          const x0 = Math.max(-W, Math.floor(Math.min(A[0], B[0], D[0]) / C)), x1 = Math.min(2 * W, Math.ceil(Math.max(A[0], B[0], D[0]) / C)), y0 = Math.max(-H, Math.floor(Math.min(A[1], B[1], D[1]) / C)), y1 = Math.min(2 * H, Math.ceil(Math.max(A[1], B[1], D[1]) / C));
          const ar = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]); if (Math.abs(ar) < 1e-6) continue;
          for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const px = cx * C + C / 2, py = cy * C + C / 2;
            const w0 = ((B[0] - px) * (D[1] - py) - (B[1] - py) * (D[0] - px)) / ar, w1 = ((D[0] - px) * (A[1] - py) - (D[1] - py) * (A[0] - px)) / ar, w2 = 1 - w0 - w1;
            if (w0 >= 0 && w1 >= 0 && w2 >= 0) cells.add(cx * 100000 + cy); } }
        let vn = 0, von = 0; for (let i = 0; i < pos.count; i += 3) { if (pos.getZ(i) > -0.005) continue; const q = P(i); if (!q) continue; vn++; if (q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H) von++; }   // on: the share of the model (by vertex, as 1.4.2)
        let n = 0, on = 0, mid = 0, under = 0, sx = 0, sy = 0;
        for (const k of cells) { const cx = Math.round(k / 100000), cy = k - cx * 100000, px = cx * C + C / 2, py = cy * C + C / 2; n++;
          if (px < 0 || px > W || py < 0 || py > H) continue; on++; sx += px / W; sy += py / H;
          if (Math.hypot(px - W / 2, py - H / 2) < Math.min(W, H) * 0.08) mid++; if (btn.some((r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom)) under++; }
        return { on: +(von / Math.max(1, vn)).toFixed(2), area: +(on / n).toFixed(2), mid: +(mid / n).toFixed(3), under: +(under / Math.max(1, on)).toFixed(2), btns: btn.length, cx: +(sx / Math.max(1, on)).toFixed(2), cy: +(sy / Math.max(1, on)).toFixed(2),
          rects: ${JSON.stringify(id)} === 'hands' ? btn.map((r) => [r.left / W, r.top / H, r.right / W, r.bottom / H].map((v) => +v.toFixed(3))) : undefined }; })()`);
      const pass = (m) => m && !m.err && m.on >= MIN && m.mid < 0.01 && m.cx >= 0.38 && m.cx <= 0.82 && m.cy >= 0.55 && m.under <= MAXU;
      let m = await measure();
      // a weapon just put in the hand can still be in its raise / settle: measure again once before calling it bad
      if (!pass(m)) { await sleep(1500); m = await measure(); }
      const ok = pass(m);
      if (!ok) bad++;
      console.log(w, h, id, ok ? 'ok ' : 'BAD', JSON.stringify(m));
      if (process.env.SHOTS && (process.env.SHOTS === 'all' || (w === 390 && h === 844) || (w === 844 && h === 390))) await p.shot(path.join(out, `${id}-${w}x${h}.png`));
    }
  } catch (e) { console.error(w, h, e.message); bad++; } finally { await p.close(); }
}
srv.kill(); console.log(bad ? `VIEWMODEL BAD ${bad}` : 'VIEWMODEL OK'); process.exit(bad ? 1 : 0);
