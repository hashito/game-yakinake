#!/usr/bin/env node
// 1.10.0 (2026-11-28 #1 「セーブはその断面をしっかり保存してください。死んで戻るとドアがあいていたりしてよくわかりません」): a save is the whole moment.
// Writes the 当直日誌, takes a print of the world (the doors as they stand, the pickups, the loot, the case, the dead and the living, the
// people, the holes, the cubes, the blood, the flags and the tasks), then changes all of it (opens doors, shuts one that was open, kills,
// takes, drops, shoots the walls, finishes a task, turns 佐竹), dies, presses 再開 and takes the print again: it must be the same.
//   node tools/play/v1100-save.mjs [--phone] [--shots D:/yakinake-stages/1100/save]
import { open, sleep } from './lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const phone = args.includes('--phone');
const T = await open({ phone, shots: arg('--shots', null) });
const { G, expect, shot, lookAt, frames, tp, log, p } = T;
// the print of the world
const PRINT = `(() => {
  const W = g.world, srt = (a) => [...a].sort();
  return {
    doorsOpen: srt([...W.doors].filter(([, d]) => d.mesh && !d.barrier && d.isOpen).map(([id]) => id)),
    doorsState: srt(g.state.doors),
    taken: srt(g.takenPickups()),
    loot: srt(W.group.children.filter((o) => /^loot:/.test(o.name) && o.parent).map((o) => o.name)),
    caseItems: srt(y.case.items.map((i) => i.id + ':' + i.n + '@' + i.x + ',' + i.y)),
    store: srt(y.case.store.map((i) => i.id + ':' + i.n)),
    killed: srt(y.killed),
    living: srt(y.liveZombies().filter((L) => L.alive).map((L) => L.def.id + (L.z.state === 'lie' ? ':lie' : ':up'))),
    people: srt([...y.people].map(([id, q]) => id + ':' + q.mode + (q.hidden ? ':hid' : ''))),
    holes: y.impactStats().holes, cracks: y.impactStats().cracks, cubes: y.impactStats().cubes,
    blood: (y.zfx.decals || []).filter((d) => d.position.y > -100).length,
    flags: srt(Object.keys(y.flags).filter((k) => y.flags[k])),
    tasks: srt(g.state.tasks), inv: srt(g.state.inv),
    stations: srt(W.interactables.filter((o) => o.userData.interact && o.userData.interact.kind === 'station').map((o) => o.userData.interact.id)),
  };
})()`;
try {
  await T.start(false);   // not ?qa: the death card waits for 再開 as it does for a player
  // the hospital, the ward open (the first tasks done), the duty room: write the log there
  await T.toStage('L2', ['T_CART', 'T_TOOLBOX', 'T_POWER']);
  await G("(() => { const d = g.world.doors.get('D_DEN'); if (d.open()) g.state.doors.push('D_DEN'); d.snap(); return 1; })()");   // a door already open at the save
  await tp(5.2, 3.9, Math.PI); await frames(4);
  await G("(() => { const c = y.ctx.camera.position; g.checkpoint = { x: c.x, z: c.z, yaw: g.fp.yaw, floor: 0 }; y.writeLog(); return 1; })()"); await sleep(300);
  const before = await G(PRINT);
  log('print at the save', JSON.stringify({ ...before, flags: before.flags.length, tasks: before.tasks.length }));
  await shot('at_the_save');

  // ---- after the save: change everything
  await G(`(() => {
    const V = y.ctx.THREE.Vector3;
    for (const id of ['D_NS', 'D_KEI', 'D_YAKU']) { const d = g.world.doors.get(id); if (d.open()) g.state.doors.push(id); d.snap(); }
    { const d = g.world.doors.get('D_DEN'); d.close(); g.state.doors.splice(g.state.doors.indexOf('D_DEN'), 1); d.snap(); }
    y.liveZombies().filter((L) => L.alive).slice(0, 2).forEach((L) => L.z.kill());
    for (let i = 0; i < 5; i++) y.bulletHole(null, new V(6 + i * 0.3, 1.4, 4.94), new V(0, 0, -1));
    y.chunkBurst(new V(8, 1.2, 6.5), [0, 0, 1], 30);
    y.zfx.decal([9, 0.01, 6.5], 0.4); y.zfx.decal([10, 0.01, 6.5], 0.4);
    y.case.add('bandage', 2); y.case.add('nails', 10);
    const it = y.case.items.find((i) => i.id === 'bandage'); if (it) { y.case.items.splice(y.case.items.indexOf(it), 1); }
    y.flags['test:after'] = true; g.completeTask('T_CHISATO', { quiet: true, noSave: true });
    return 1;
  })()`);
  // a loot on the floor of the hospital and an item, taken the way the player takes them ([E])
  const took = await G("(() => { const m = g.world.group.children.find((o) => /^loot:/.test(o.name)); if (m) g.useInteract(m.userData.interact); const it = g.world.interactables.find((o) => o.userData.interact && o.userData.interact.kind === 'item'); if (it) g.useInteract(it.userData.interact); return [m && m.name, it && it.userData.interact.id]; })()");
  log('took', JSON.stringify(took)); await T.dismiss();
  await sleep(900);
  const after = await G(PRINT);
  const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  expect(changed.length >= 7, `the world changed after the save (${changed.join(', ')})`);
  await shot('changed');

  // ---- die, 再開
  await G("(y.hurt(999, { reason: 'bitten' }), 1)"); await sleep(1500);
  await shot('death_card');
  await p.waitFor("[...document.querySelectorAll('button')].some((b) => b.offsetParent && b.textContent.trim() === '再開')", 15000);
  await p.eval("[...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.trim() === '再開').click()");
  await sleep(1500); await T.blockGo(); await p.waitFor('__game.state.started', 30000); await sleep(1500);
  const back = await G(PRINT);
  for (const k of Object.keys(before)) expect(JSON.stringify(before[k]) === JSON.stringify(back[k]), `back at the save: ${k}${JSON.stringify(before[k]) === JSON.stringify(back[k]) ? '' : ` (save ${JSON.stringify(before[k]).slice(0, 160)} / now ${JSON.stringify(back[k]).slice(0, 160)})`}`);
  const doorsSeen = await G("['D_NS', 'D_KEI', 'D_YAKU', 'D_DEN'].map((id) => { const d = g.world.doors.get(id); return id + ':' + (d.isOpen ? 'open' : 'shut') + ':' + (d.col.off ? 'pass' : 'block'); })");
  expect(doorsSeen.join() === 'D_NS:shut:block,D_KEI:shut:block,D_YAKU:shut:block,D_DEN:open:pass', `the doors stand (and block) as at the save (${doorsSeen.join(' ')})`);
  await tp(5.2, 4.6, 0); await lookAt(3, 1.2, 7.5); await frames(6); await shot('back_doors');
} catch (e) { expect(false, `error: ${e.message}`); }
process.exit(await T.done() ? 1 : 0);
