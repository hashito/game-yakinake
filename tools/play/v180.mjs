#!/usr/bin/env node
// 1.8.0 (2026-11-27 #3): each body is someone (its kind and moves from js/ext/profiles.js), the ten moves each told before they land
// (a pose, a sound, the first time a line), a hit in the tell stops it, a side step dodges the rushes; the 記録 after an ending.
//   node tools/play/v180.mjs [--phone] [--shots D:/yakinake-stages/180]
import { open, sleep } from './lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const phone = args.includes('--phone');
const T = await open({ phone, shots: arg('--shots', null) });
const { G, expect, shot, lookAt, frames, tp, log, p } = T;
const say = () => p.eval("(document.getElementById('say') || {}).textContent || ''");
try {
  await T.start();
  // ---- the profiles: every spawned body has its own numbers
  const prof = await G("y.liveZombies().map((L) => ({ id: L.def.id, kind: L.prof && L.prof.kind, moves: L.moves, walk: L.z.stats.walk, run: L.z.stats.run || 0, reach: L.reach, life: L.z.maxLife, role: L.z.role }))");
  log('first block', JSON.stringify(prof));
  expect(prof.length > 0 && prof.every((q) => q.kind), `every body has a kind (${prof.length})`);
  const all = await G("(() => { const r = {}; for (const id of ['Z_SHO_EAT', 'Z_CRAWL', 'Z_ROKA1', 'Z_URA3', 'Z_MF2', 'Z_OD4', 'Z_HI1']) { r[id] = 1; } return y.recordsCount(); })()");
  expect(all >= 60, `the 記録 knows everyone (${all})`);

  await G("y.ensurePatterns(['salaryman', 'patient', 'crawler'])"); await sleep(400);
  const fresh = async (id, dx, p = 'salaryman') => {
    await G(`(() => { y.liveZombies().forEach((L) => L.alive && L.z.kill()); y.emit('healed', {}); y.hp = 100; y.extraZombie({ id: '${id}', p: '${p}', room: 'H_ROKA', x: ${10 + dx}, z: 6.5, yaw: -Math.PI / 2 }); return 1; })()`);
    await tp(10, 6.5, -Math.PI / 2); await sleep(500);
    const L = await G(`(() => { const L = y.liveZombies().find((q) => q.def.id === '${id}'); return L ? [L.z.pos[0], L.z.root.position.y, L.z.pos[2]] : null; })()`);
    if (L) await lookAt(L[0], L[1] + 1.1, L[2]);
    return L;
  };
  const stateOf = (id) => G(`(() => { const L = y.liveZombies().find((q) => q.def.id === '${id}'); return L ? { st: L.z.state, mv: L.mv && L.mv.k, ph: L.mv && L.mv.ph, x: +L.z.pos[0].toFixed(2), m: L.z.motion } : null; })()`);
  // ---- the ten moves: each told (state yk-move in its tell, a line the first time), then it lands (the body is hurt)
  const MOVES = [['dash', 5], ['pounce', 3.5], ['swipe', 1.8], ['vomit', 1.6], ['ankle', 1.2], ['throw', 7], ['frenzy', 1.1], ['rake', 1.3], ['tackle', 4], ['ambush', 2.2]];
  for (const [k, dx] of MOVES) {
    const id = `TM_${k}`;
    await fresh(id, dx, k === 'ankle' ? 'crawler' : 'salaryman');
    const ok = await G(`y.forceMove('${id}', '${k}')`);
    await frames(3);
    const s0 = await stateOf(id), line = await say();
    if (!s0) log('missing', JSON.stringify(await G("({ dead: y.dead, hp: y.hp, ended: g.state.ended, ids: y.liveZombies().map((L) => L.def.id + ':' + L.alive), ui: !!g.ui.open, wm: g.wm.current })")));
    expect(ok && s0 && s0.st === 'yk-move' && s0.ph === 'tell', `${k}: told first (${JSON.stringify(s0)})`);
    if (k !== 'ambush') expect(line.length > 8, `${k}: the first time, a line says what it means (${line.slice(0, 30)})`);
    await shot(`move_${k}_tell`);
    await sleep(k === 'throw' ? 2600 : 1900);
    const hp = await G('Math.round(y.hp)'), bl = await G('y.bleeding()');
    expect(hp < 100, `${k}: it lands on a player who stands still (hp ${hp}${k === 'rake' ? ', bleed ' + bl.bleed : ''}${k === 'vomit' ? ', sick ' + bl.sick : ''})`);
    if (k === 'rake') expect(bl.bleed > 0, 'rake: the scratch bleeds');
    if (k === 'vomit') expect(bl.sick > 0, 'vomit: the spew sickens');
    await shot(`move_${k}_land`);
    await G("(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)");   // laid down before the grab is shaken off: standing next to it for seconds more would end the run (and the death card's button is not for this test)
    // free from any grab before the next
    for (let i = 0; i < 8 && (await G('!!y.grabbed()')); i++) { await T.key('KeyV'); await sleep(120); await T.key('KeyV', 'keyup'); await sleep(150); }
    await G("(y.emit('healed', {}), y.hp = 100, 1)");
  }
  // ---- a side step dodges the dash (its line is fixed when it starts)
  await fresh('TM_dodge', 5); await G("y.forceMove('TM_dodge', 'dash')"); await sleep(820);
  await G('(g.camera.position.z += 1.6, 1)'); await sleep(1400);
  expect((await G('Math.round(y.hp)')) === 100, `dash: a side step after it starts runs it past (hp ${await G('Math.round(y.hp)')})`);
  // ---- a hit in the tell stops it
  await fresh('TM_stop', 3.5); await G("y.forceMove('TM_stop', 'pounce')"); await sleep(200);
  await G("(() => { const t = y.zombieTargets().find((t) => t.id === 'TM_stop'); t.hit('chest', 30, { weapon: 'pistol', dir: [1, 0, 0] }); return 1; })()"); await sleep(1500);
  const st = await stateOf('TM_stop');
  expect(st && !st.mv && (await G('Math.round(y.hp)')) === 100, `pounce: a hit during the tell stops it (${JSON.stringify(st)})`);
  // ---- the ambusher waits where it stands until the player is close
  await fresh('TM_wait', 5);
  await G("(() => { const L = y.liveZombies().find((q) => q.def.id === 'TM_wait'); L.moves = ['ambush']; L.sprung = false; L.alert = 0; return 1; })()");
  const a0 = await stateOf('TM_wait'); await sleep(2500); const a1 = await stateOf('TM_wait');
  expect(a0 && a1 && Math.abs(a0.x - a1.x) < 0.05, `ambush: it waits, still (${a0 && a0.x} -> ${a1 && a1.x})`);
  await tp(13.2, 6.5, -Math.PI / 2); await sleep(1400);
  expect((await G('Math.round(y.hp)')) < 100, 'ambush: close by, it springs');
  await G('(y.liveZombies().forEach((L) => L.alive && L.z.kill()), y.hp = 100, 1)');

  // ---- the 記録: no button before an ending; after one, on the title and in the menu
  expect(!(await G('y.recordsOpen()')), 'no 記録 before an ending');
  await p.eval("(localStorage.setItem('yakinake.records', '1'), 1)");
  await p.goto(`${T.base}?${phone ? 'touch=1' : ''}`);
  await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 120000);
  await sleep(600);
  expect(await p.eval("!!document.querySelector('#title-extra .yk-rec-btn')"), 'after an ending the title has 記録');
  await shot('title_records_button');
  await p.eval("(document.querySelector('#title-extra .yk-rec-btn').click(), 1)"); await sleep(700);
  expect(await p.eval("document.querySelectorAll('.yk-rec').length > 3"), '記録 opens with the hospital people');
  await shot('records_hospital');
  for (const k of ['S', 'P', 'O', 'R']) { await p.eval(`(document.querySelector('[data-place=${k}]').click(), 1)`); await sleep(300); }
  await p.eval("(document.querySelector('[data-place=S]').click(), 1)"); await sleep(300);
  await shot('records_streets');
  const over = await p.eval("(() => { const l = document.querySelector('.yk-rec-list'); return l ? l.scrollHeight > l.clientHeight : false; })()");
  log('list scrolls', over);
} catch (e) { expect(false, 'ERROR ' + e.message); }
process.exitCode = (await T.done()) ? 1 : 0;
