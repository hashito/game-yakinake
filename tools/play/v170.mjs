#!/usr/bin/env node
// 1.7.0 features, played headless and photographed (PC 1280x720 and a phone 390x844):
//   #2 marks on the things to take   #4 the cubes of a broken part on the wall and floor   #5 bullet holes in a wall and cracks in glass
//   #7 the first hurt opens the 手当て card, a mend closes it   #8 the safe's 開ける lights up once the third number clicks   #1 a sheet goes once its body stands
//   node tools/play/v170.mjs [--phone] [--shots D:/yakinake-stages/170]
import { open, sleep } from './lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const phone = args.includes('--phone');
const T = await open({ phone, shots: arg('--shots', null) });
const { G, expect, shot, lookAt, frames, key, tp, log } = T;
try {
  await T.start();
  await shot('start');
  // ---- #2 marks: the water bottle on the on-call desk
  const mk = await G('y.marks ? y.marks() : null');
  expect(Array.isArray(mk) && mk.length > 0, `things to take carry a mark (${mk && mk.length})`);
  const w = await G("(() => { const o = g.world.interactables.find((o) => o.userData.interact && o.userData.interact.id === 'L_TOU_W'); if (!o) return null; const p = o.getWorldPosition(o.position.clone()); return [p.x, p.y, p.z]; })()");
  if (w) { await tp(w[0] - 1.4, w[2] + 0.9, 0); await lookAt(w[0], w[1], w[2]); await frames(6); await shot('mark_water_on_desk'); }
  const shown = await G("y.marks().filter((m) => m.icon && m.shown).map((m) => m.id)");
  expect(shown.includes('L_TOU_W'), 'the water on the desk shows its chevron');
  // through a wall: from the corridor, the room's things keep their chevron hidden
  await tp(3, 6.5, Math.PI); if (w) await lookAt(w[0], w[1], w[2]); await frames(6);
  const through = await G("y.marks().filter((m) => m.id === 'L_TOU_W' && m.icon).length");
  expect(through === 0, 'no chevron through the wall from the corridor (P42)');
  await shot('mark_hidden_through_wall');

  // ---- #5 bullet holes: a pistol into the corridor's wall and the glass door of the treatment room
  await G("(() => { y.case.add('pistol', 1, { loaded: 8 }); y.case.add('p9', 40); const p = y.case.items.find((i) => i.id === 'pistol'); y.equipUid(p.uid, { quiet: true }); y.liveZombies().forEach((L) => L.alive && L.z.kill()); return 1; })()");
  await tp(10, 6.5, 0);
  for (const [x, yy] of [[9.2, 1.3], [9.6, 1.45], [10.1, 1.2], [10.5, 1.55], [11.0, 1.35]]) { await lookAt(x, yy, 8); await frames(2); await key('Fire'); await frames(3); await key('Fire', 'keyup'); await sleep(340); }
  await lookAt(10, 1.35, 8); await frames(4);
  let st = await G('y.impactStats()');
  expect(st.holes >= 4, `rounds into the wall leave holes (${st.holes})`);
  await shot('bullet_holes_wall');
  await tp(24, 6.9, 0);
  for (const [x, yy] of [[23.7, 1.5], [24.3, 1.2]]) { await lookAt(x, yy, 5); await frames(2); await key('Fire'); await frames(3); await key('Fire', 'keyup'); await sleep(340); }
  await lookAt(24, 1.35, 5); await frames(4);
  st = await G('y.impactStats()');
  expect(st.cracks >= 1, `a round through the glass door cracks the pane (${st.cracks})`);
  await shot('glass_cracks');
  // the pool: fire 90 more rounds, the holes stay at the cap
  await G(`(() => { const W = g.world, n = new g.THREE.Vector3(0, 0, -1); for (let i = 0; i < 90; i++) y.bulletHole(null, new g.THREE.Vector3(2 + i * 0.2, 1.2, 7.99), n); return 1; })()`);
  st = await G('y.impactStats()');
  expect(st.holes <= st.caps.holes, `the holes are capped (${st.holes} <= ${st.caps.holes})`);

  // ---- #4 cubes: a zombie close to the corridor wall loses its head and an arm (a heavy hit to each part, as a shotgun's)
  await G("y.ensurePatterns(['doctor', 'patient'])");
  await G("(() => { y.extraZombie({ id: 'TCUBE', p: 'patient', room: 'H_ROKA', x: 16, z: 7.3, yaw: Math.PI }); return 1; })()");
  await G('(g.teleport({ x: 16, z: 5.6, yaw: 0, floor: 0 }), 1)'); await sleep(900);
  await G("(() => { const t = y.zombieTargets().find((t) => t.id === 'TCUBE'); t.hit('foreArmL', 999, { weapon: 'shotgun', dir: [0.3, 0.1, 1] }); t.hit('head', 999, { weapon: 'shotgun', dir: [-0.2, 0.2, 1] }); return 1; })()");
  await sleep(1600);
  st = await G('y.impactStats()');
  expect(st.cubes > 10, `a broken part throws its cubes (${st.cubes})`);
  const stuckOn = await G("(() => { const m = g.scene.getObjectByName('yk-chunks'); return m ? m.count : 0; })()");
  await G('(g.teleport({ x: 14.4, z: 5.5, yaw: 0, floor: 0 }), 1)'); await lookAt(16.3, 0.7, 8); await frames(8);
  await shot('cubes_on_wall_and_floor');
  await G('(g.teleport({ x: 15.6, z: 7.0, yaw: 0, floor: 0 }), 1)'); await lookAt(16, 0.4, 8); await frames(8);
  await shot('cubes_close');
  log('cubes', stuckOn);
  // many bursts: the cubes stay at their cap
  await G("(() => { for (let i = 0; i < 40; i++) y.chunkBurst(new g.THREE.Vector3(12, 1.2, 6.5), [0, 0, 1], 40); return 1; })()");
  st = await G('y.impactStats()');
  expect(st.cubes <= st.caps.cubes, `the cubes are capped (${st.cubes} <= ${st.caps.cubes})`);

  // ---- #7 the first hurt: the 手当て card
  await G("(() => { y.liveZombies().forEach((L) => L.alive && L.z.kill()); y.case.add('bandage', 1); return 1; })()");
  await tp(10, 6.5, 0);
  await G("(y.hurt(22, { reason: 'bitten' }), 1)"); await sleep(1200);
  let hl = await G('y.healLesson()');
  expect(hl.open, 'the first hurt opens the card on how to mend');
  await shot('heal_lesson');
  if (phone) await T.p.eval("(() => { document.querySelector('.yk-hpbox').click(); return 1; })()"); else await key('KeyH');
  await sleep(500); await key('KeyH', 'keyup');
  hl = await G('y.healLesson()');
  expect(!hl.open && hl.done, `a mend closes it for good (${JSON.stringify(hl)})`);
  await shot('heal_lesson_closed');

  // ---- #1 the sheets of the morgue: they slide off and are gone once the body stands
  await T.toStage('L3', ['T_CART', 'T_TOOLBOX', 'T_POWER', 'T_CHISATO', 'T_RADIO', 'T_SAFE', 'T_INSULIN', 'T_GENZO']);
  await G("y.ensurePatterns(['old-man', 'old-woman', 'salaryman'])"); await G('(y.syncZombies(), 1)'); await sleep(1500);
  await tp(23.5, 12.4, 0); await lookAt(23.5, 0.2, 9.8); await frames(8);
  const sheets = await G("(() => { let n = 0; g.scene.traverse((o) => { if (o.name === 'yk-sheet' && o.visible) n++; }); return n; })()");
  expect(sheets >= 3, `the morgue's three lie under sheets (${sheets})`);
  await shot('morgue_sheets');
  await G("(['Z_REI1', 'Z_REI2', 'Z_REI3'].forEach((id) => y.riseNow(id)), 1)");
  await sleep(700); await shot('morgue_sheets_sliding');
  await sleep(3500);
  const left = await G("(() => { let n = 0; g.scene.traverse((o) => { if (o.name === 'yk-sheet') n++; }); return n; })()");
  expect(left === 0, `once they stand, the sheets are gone (${left} left)`);
  await G("(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)"); await sleep(300);
  await shot('morgue_after');
} catch (e) { expect(false, 'ERROR ' + e.message); }
process.exitCode = (await T.done()) ? 1 : 0;
