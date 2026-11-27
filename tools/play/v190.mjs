#!/usr/bin/env node
// 1.9.0 (2026-11-27 #6 #9 #10 #11): the hospital without a gun (the case holds nails and the carpenter's note), the ways that fell in
// (the stair hall, the link corridor with someone beyond the rubble, the outpatient wing behind glass), 佐竹工務店 off the street (the
// layout of 札の家's 町家, through its lattice door), the carpenter who gives the nail gun, hides the bite and turns.
//   node tools/play/v190.mjs [--phone] [--shots D:/yakinake-stages/190]
import { open, sleep } from './lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const phone = args.includes('--phone');
const T = await open({ phone, shots: arg('--shots', null) });
const { G, expect, shot, lookAt, frames, tp, log, p } = T;
const room = () => G('g.state.room');
const walk = async (code, ms) => { await T.key(code); await new Promise((r) => setTimeout(r, ms)); await T.key(code, 'keyup'); };
try {
  await T.start();
  // ---- #10 the ways that fell in
  await tp(1.2, 6.5, Math.PI / 2); await lookAt(-2, 1.2, 5.2); await frames(6);
  expect((await G('y.rubbleStats ? y.rubbleStats().piles : 0')) === 3, 'three piles of rubble in the hospital');
  await shot('kaidan_from_corridor');
  await tp(-2, 8.4, 0); await lookAt(-2, 1.6, 4.6); await frames(6); await shot('kaidan_close');
  await walk('KeyW', 2200); const zk = await G('g.camera.position.z');
  expect(zk > 6.8, `the stairs' rubble stops the player (z ${zk.toFixed(2)})`);
  await G("y.ensurePatterns(['patient'])"); await G('(y.syncZombies(), 1)'); await sleep(600);
  await tp(9.4, -0.6, 0); await lookAt(9.4, 1.5, -8); await frames(6); await sleep(2500);
  const zw = await G("(() => { const L = y.liveZombies().find((q) => q.def.id === 'Z_WATARI'); return L ? +L.z.pos[2].toFixed(2) : null; })()");
  expect(zw != null && zw < -6.5, `the one beyond the link corridor's rubble cannot get over (z ${zw})`);
  await shot('watari_over_rubble');
  await tp(31.5, 1.6, 0); await lookAt(31.5, 1.2, -4); await frames(6); await shot('gairai_through_glass');
  expect(await G("!!g.world.doors.get('D_GAIRAI').locked()"), 'the outpatient wing door stays shut');

  // ---- #6 the hospital without a gun: the case holds the nails and a note
  await T.toStage('L3', ['T_CART', 'T_TOOLBOX', 'T_POWER', 'T_CHISATO', 'T_RADIO', 'T_SAFE', 'T_INSULIN', 'T_GENZO', 'T_REI']);
  await G("(g.state.inv.includes('KEYRING') || g.state.inv.push('KEYRING'), 1)");
  await G("(g.startTask('T_CASE'), 1)"); await sleep(900);
  await shot('case_note');
  await T.dismiss(); await sleep(400);
  const kit = await G("y.case.items.map((i) => i.id)");
  expect(!kit.includes('nailgun') && kit.includes('nails'), `the hospital's case: nails, no nail gun (${kit.join(',')})`);

  // ---- #11 佐竹工務店 off the street
  await T.toStage('L4', ['T_SHUTTER']);
  await tp(48.6, -1.2, 0); await lookAt(48.6, 1.2, -3.6); await frames(6);
  await shot('shop_front');
  await G("(() => { const m = g.world.group.getObjectByName('stairs:D_SATAKE:a'); g.useStairs(m.userData.interact); return 1; })()"); await sleep(1800); await T.dismiss();
  expect((await room()) === 'S_SDOMA', `the lattice door leads into the shop's 土間 (${await room()})`);
  await frames(6); await shot('doma_inside');
  await tp(203.4, -18.4, 0); await lookAt(205.4, 1.2, -25); await frames(6); await shot('mise_to_naka');
  // ---- #9 the carpenter
  await tp(205.4, -21.8, 0); await lookAt(205.6, 1.3, -24.6); await frames(8); await shot('satake_sitting');
  { // P29 inside the shop, walked: the player stands 1 m round him on four sides and the live [E] is him (check-playtest's ring moves
    // only the camera from the start, where the shop is not reached, and reads 0/32 here)
    const got = [];
    for (const [x, z] of [[206.6, -24.6], [205.6, -23.6], [204.6, -24.6], [205.6, -22.8]]) { await tp(x, z, 0); await lookAt(205.6, 0.75, -24.6); await frames(4); got.push(await G("g.target && g.target.kind + ':' + g.target.id")); }
    expect(got.every((t) => t === 'station:S_SATAKE'), `佐竹さん can be spoken to from four sides (${got.join(', ')})`);
    await tp(205.4, -21.8, 0); await lookAt(205.6, 1.3, -24.6); await frames(2);
  }
  await G("(g.startTask('T_SATAKE'), 1)"); await sleep(1200);
  await shot('satake_talk');
  for (let i = 0; i < 4; i++) { await T.talkThrough(1); await sleep(300); }
  await shot('satake_talk_arm');
  await T.talkThrough(); await sleep(500); await T.dismiss();
  expect((await G("y.case.items.map((i) => i.id)")).includes('nailgun'), 'the carpenter hands over the nail gun');
  await tp(204.2, -38.6, 0); await lookAt(206.4, 1.0, -39.4); await frames(6); await shot('sagyo');
  await G("(g.startTask('T_SATAKE_BOX'), 1)"); await sleep(2600);
  await shot('satake_far_voice');
  await T.talkThrough(); await sleep(1200); await T.dismiss();
  expect(await G("!!y.flags['satake:turned']"), 'his voice from the front room, then he turns');
  expect(await G("(() => { const p = y.person('satake'); return !p || p.hidden; })()"), 'the carpenter himself is gone');
  await G("y.ensurePatterns(['worker'])"); await G('(y.syncZombies(), 1)'); await sleep(800);
  const zs = await G("(() => { const L = y.liveZombies().find((q) => q.def.id === 'Z_SATAKE'); return L ? { lying: L.z.lying(), x: L.z.pos[0], z: L.z.pos[2] } : null; })()");
  expect(zs && zs.lying, `he lies where he sat (${JSON.stringify(zs)})`);
  await tp(203.0, -20.4, 0); if (zs) await lookAt(zs.x, 0.2, zs.z); await frames(6); await shot('satake_fallen');
  await tp(205.2, -21.6, 0); if (zs) await lookAt(zs.x, 1.0, zs.z); await sleep(2200); await frames(4);
  expect(await G("(() => { const L = y.liveZombies().find((q) => q.def.id === 'Z_SATAKE'); return L && !L.z.lying(); })()"), 'he gets up as the player comes near');
  await shot('satake_risen');
  await G("(() => { const L = y.liveZombies().find((q) => q.def.id === 'Z_SATAKE'); L.z.kill(); return 1; })()"); await sleep(600);
  await G("(() => { const m = g.world.group.getObjectByName('stairs:D_SATAKE:b'); g.useStairs(m.userData.interact); return 1; })()"); await sleep(1800); await T.dismiss();
  expect((await room()) === 'S_ODORI', `out again onto the street (${await room()})`);
} catch (e) { expect(false, 'ERROR ' + e.message); }
process.exitCode = (await T.done()) ? 1 : 0;
