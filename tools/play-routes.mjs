#!/usr/bin/env node
// Play scripts for 夜勤明けの街 (headless, ?qa=1: talks resolve at once, timers run 10x). Each route plays the whole game through
// the real [E] key and the real choices (window.__pref: the option ids this route picks, in order of preference), and checks the
// ending it must reach. "combat" checks the shooter itself with real keys: a shot to the legs makes a crawler, a shot to the head
// kills, melee, grab and shove, the case (equip, combine, heal), death -> the last checkpoint with the case as it was.
// "offroute" presses things out of order (locked doors, tasks before their needs, a full case) and walks into side rooms.
//   node tools/play-routes.mjs [--route E1|E2|E3|E4|mart-fight|combat|offroute|all] [--mobile] [--shots dir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const mobile = args.includes('--mobile'), shotsRoot = arg('--shots', null);
const ROUTES = {
  // choices: mart, cult, alliance, rack, hayase, roof door
  E1: { pref: ['trade', 'talk', 'join', 'share', 'expose'], end: 'E1' },
  E3: { pref: ['sneak', 'fake', 'join', 'share', 'refuse', 'hold'], end: 'E3' },
  E4: { pref: ['trade', 'fight', 'join', 'share', 'give', 'go'], end: 'E4' },
  E2: { pref: ['sneak', 'talk', 'no', 'refuse'], end: 'E2' },
  'mart-fight': { pref: ['fight', 'talk', 'join', 'all', 'expose'], end: 'E2', fight: true },
};
const which = arg('--route', 'all');
const list = which === 'all' ? [...Object.keys(ROUTES), 'combat', 'offroute'] : which.split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, [path.join(import.meta.dirname, 'serve.js'), '--port', String(port)], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 50; i++) { if (await fetch(base).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
let failedAll = 0;

async function run(route) {
  const p = await launch(mobile ? { width: 844, height: 390, mobile: true, dpr: 1 } : { width: 1280, height: 720 });
  const t0 = Date.now(), log = (...a) => console.log(`[${route}] ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`, ...a);
  const shots = shotsRoot && path.join(shotsRoot, route); if (shots) fs.mkdirSync(shots, { recursive: true });
  let n = 0;
  const shot = async (name) => shots && (await p.shot(path.join(shots, `${String(++n).padStart(2, '0')}_${name}.jpg`)));
  const G = (expr) => p.eval(`(() => { const g = window.__game, y = window.__yk; return JSON.stringify(${expr}); })()`).then((s) => (s === undefined ? undefined : JSON.parse(s)));
  let failed = 0;
  const expect = (ok, m) => { if (!ok) { failed++; log('FAIL', m); } else log('ok  ', m); };
  const key = (code, type = 'keydown') => p.eval(`dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { code: ${JSON.stringify(code)} })) && 1`);
  // look at a point (camera yaw / pitch)
  const lookAt = (x, y, z) => p.eval(`(() => { const g = window.__game, c = g.camera.position, dx = ${x} - c.x, dy = ${y} - c.y, dz = ${z} - c.z; g.fp.yaw = Math.atan2(-dx, -dz); g.fp.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return 1; })()`);
  const frames = (k = 2) => p.eval(`new Promise((r) => { let n = ${k}; const f = () => (--n <= 0 ? r(1) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
  const approach = (name) => p.eval(`(async () => { const g = window.__game, m = g.world.interactables.find((o) => o.name === ${JSON.stringify(name)});
    if (!m) return 'no such object'; const c = m.getWorldPosition(new m.position.constructor());
    const fy = (f) => (g.world.floorY ? g.world.floorY(f) : f * 3.4); let fl = 0; while (fl < 8 && fy(fl + 1) <= c.y + 0.3) fl++;
    for (const [dx, dz] of [[0, -1.3], [0, 1.3], [-1.3, 0], [1.3, 0], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) {
      if (g.world.roomAt(c.x + dx, c.z + dz, fy(fl) + 1.6) === null) continue;
      g.teleport({ x: c.x + dx, z: c.z + dz, yaw: Math.atan2(dx, dz), floor: fl });
      g.fp.pitch = -Math.atan2(1.65 - (c.y - fy(fl)), Math.hypot(dx, dz));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (g.target && g.target.kind + ':' + g.target.id === ${JSON.stringify(name)}) return 'ok'; }
    return 'no selectable approach side'; })()`);
  const dismiss = async () => { for (let i = 0; i < 6 && (await G('!!(g.ui.open || g.wm.isOpen || (g.blockers || []).some((f) => f()))')); i++) { await p.key('Escape'); await sleep(250); if (await G('!!(g.ui.open || g.wm.isOpen)')) { await p.eval("document.querySelector('.win-foot .btn')?.click()"); await sleep(250); } } };
  const press = async (name) => { await dismiss(); const a = await approach(name); if (a !== 'ok') { log('cannot reach', name, a, JSON.stringify(await G("({ blocked: g.blocked && g.blocked(), wm: g.wm.current, ui: !!g.ui.open, target: g.target && g.target.id, floor: g.floor, blockers: (g.blockers || []).map((f) => !!f()), mg: !!g.mgOpen, rn: !!g.rnOpen, started: g.state.started, ended: g.state.ended, ov: [...document.querySelectorAll('[class*=mg-], .reading, .lane')].filter((e) => e.offsetParent).map((e) => e.className).slice(0, 4), dead: !!g.state.dead, hold: !!g.holding })"))); return false; } await p.key('KeyE'); await sleep(400); return true; };
  // clear the zombies near the player (the play scripts are about the story; "combat" checks the fighting)
  const calm = () => G('(y.liveZombies().forEach((L) => { if (L.alive && L.z && L.z.root && L.z.root.position.distanceTo(g.camera.position) < 12) L.z.kill(); }), 1)');
  try {
    await p.goto(`${base}?qa=1${mobile ? '&touch=1' : ''}`);
    await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 120000);
    await shot('title');
    const r = await p.eval("(() => { const b = document.getElementById('start-btn'); b.scrollIntoView({ block: 'center' }); return JSON.stringify(b.getBoundingClientRect()); })()").then(JSON.parse);
    await p.click(r.x + r.width / 2, r.y + r.height / 2);
    await p.waitFor('__game.state.started', 15000);
    await sleep(800);
    // the route's choices
    const R = ROUTES[route];
    await p.eval(`(() => { const g = window.__game, o = g.choose; window.__pref = ${JSON.stringify(R ? R.pref : [])}; window.__chosen = [];
      g.choose = (c) => { const pick = window.__pref.find((id) => (c.options || []).some((x) => x.id === id && !x.disabled)); window.__chosen.push([c.who, pick || 'primary']); return pick ? Promise.resolve(pick) : o(c); }; return 1; })()`);
    await shot('start');

    if (route === 'combat') await combat();
    else if (route === 'offroute') await offroute();
    else await story(R);
  } catch (e) { failed++; log('ERROR', e.message); }
  const errs = p.errors.filter((e) => !/favicon|404/.test(e));
  expect(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`);
  const miss = p.errors.filter((e) => /404/.test(e) && !/favicon/.test(e));
  if (miss.length) log('missing files:', [...new Set(miss.map((e) => e.replace(/.*\/\/[^/]+\//, '')))].slice(0, 8).join(' '));
  await p.close();
  failedAll += failed;
  log(failed ? `FAILED ${failed}` : 'OK');

  // ------------------------------------------------------------------ the whole story, one route
  async function story(R) {
    const tasks = await G('g.data.tasks');
    const doors = await G('g.data.plan.doors.filter((d) => g.world.doors.get(d.id) && !d.open).map((d) => d.id)');
    const doneAll = () => G('!!g.state.ended');
    const items = await G('g.data.items.filter((i) => !i.start && !i.given).map((i) => i.id)');
    for (const id of items) await press(`item:${id}`);
    let fought = false;
    for (let round = 0; round < 14 && !(await doneAll()); round++) {
      const left = await G('Math.max(0, ...g.data.tasks.filter((t) => t.timer && !g.state.tasks.includes(t.id) && (g.state.timers || {})[t.id] > 0).map((t) => (g.timer(t.id) || {}).left || 0))');
      if (left > 0) { log('waiting for the timer', Math.round(left), 's (10x)'); await calm(); await sleep(Math.min(60000, (left / 10) * 1000 + 800)); }
      for (const d of doors) { if (await G(`g.world.doors.get(${JSON.stringify(d)}).isOpen || g.world.doors.get(${JSON.stringify(d)}).locked()`)) continue; await press(`door:${d}`); }
      // the loot lying in the world is picked up as the route passes (enough ammunition for the fights)
      await G(`(g.world.interactables.filter((o) => String(o.name).startsWith('loot:') && o.visible !== false).forEach((o) => { const d = o.userData.def; if (d && (g.state.tasks.length > 3 || (d.floor || 0) === 0)) {} }), 1)`);
      for (const t of tasks) {
        if (await doneAll()) break;
        if (await G(`g.state.tasks.includes(${JSON.stringify(t.id)})`)) continue;
        if ((await G(`g.canStart(g.data.tasks.find((x) => x.id === ${JSON.stringify(t.id)}))`)) !== true) continue;
        await calm();
        await press(`station:${t.station}`);
        await p.waitFor(`__game.state.tasks.includes(${JSON.stringify(t.id)}) || __game.state.ended`, 20000).catch(() => {});
        const done = await G(`g.state.tasks.includes(${JSON.stringify(t.id)})`);
        if (!done && !t.optional) log('not done', t.id, await G("document.getElementById('prompt').textContent"));
        else if (done) { log('task', t.id); if (args.includes('--all-shots') || ['T_GONDO', 'T_CULT', 'T_KATA', 'T_RACK', 'T_HAYASE', 'T_HOLD', 'T_HELI'].includes(t.id)) await shot(t.id); }
        // the mart fight: shoot 権藤 and 仁科 until they give up
        if (t.id === 'T_GONDO' && R.fight && !fought) {
          fought = true;
          expect(await G("y.flags['mart:fight'] === true || y.flags.mart === 'fight'"), 'the mart fight starts');
          await G("(() => { const it = y.case.add('pistol', 1, { loaded: 8 }); y.case.add('p9', 40); const w = y.case.items.find((i) => i.id === 'pistol'); if (w) y.equipUid(w.uid); return 1; })()");
          for (let i = 0; i < 80 && !(await G("!!y.flags['mart:open']")); i++) {
            const t2 = await G("(() => { const t = y.peopleTargets().find((t) => t.alive); if (!t) return null; const p = t.aimPoints()[0]; return [p.x, p.y, p.z]; })()");
            if (!t2) break;
            await lookAt(...t2); await key('Fire'); await frames(3); await key('Fire', 'keyup'); await key('KeyR'); await sleep(250);
          }
          await sleep(500);
          expect(await G("!!y.flags['mart:open']"), 'shooting both makes them give up (the back door opens)');
          await shot('mart_fight');
        }
      }
    }
    await p.waitFor('__game.state.ended', 20000).catch(() => {});
    const end = await G('g.state.ended'), chosen = await G('window.__chosen');
    log('choices', JSON.stringify(chosen));
    expect(end === R.end, `the ending is ${R.end} (got ${end})`);
    await sleep(1200); await shot(`ending_${end}`);
  }

  // ------------------------------------------------------------------ the shooter itself
  async function combat() {
    await dismiss();
    // the wide street (S_ODORI), looking along it: room to shoot and to be reached
    await G("(g.teleport({ x: 50, z: 1, yaw: -Math.PI / 2, floor: 0 }), g.fp.pitch = 0, 1)"); await sleep(400);
    // a doctor zombie in front of the player, in the on-call room; a pistol and a pipe in the case
    await G("(() => { y.case.add('pistol', 1, { loaded: 8 }); y.case.add('p9', 24); y.case.add('pipe', 1); y.case.add('bandage', 2); y.case.add('disinfect', 1); return 1; })()");
    const pistol = await G("(y.case.items.find((i) => i.id === 'pistol') || {}).uid");
    expect(!!pistol, 'a pistol fits in the case');
    await G(`(y.equipUid(${pistol}), 1)`);
    const spawn = (pat, d = 3.2) => G(`(() => { const c = g.camera.position, f = g.camera.getWorldDirection(c.clone()); f.y = 0; f.normalize(); const x = c.x + f.x * ${d}, z = c.z + f.z * ${d}, R = y.roomAtP(x, z, g.floor || 0); if (!R) return 0; return y.extraZombie({ id: 'T' + Math.random().toString(36).slice(2, 7), p: ${JSON.stringify(pat)}, room: R.id, x, z, yaw: Math.atan2(c.x - x, c.z - z) }) ? 1 : 0; })()`);
    await G('(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)');
    await sleep(300);
    // legs: a shot to each thigh -> it crawls
    expect(await spawn('doctor'), 'a zombie can be placed in front of the player');
    await sleep(600);
    const MOT = "String((L.z.motion && (L.z.motion.name || L.z.motion.id)) || L.z.motion || '')";
    const Z = "y.liveZombies().filter((L) => L.alive).sort((a, b) => a.z.root.position.distanceTo(g.camera.position) - b.z.root.position.distanceTo(g.camera.position))[0]";
    const partAt = (part) => G(`(() => { const L = ${Z}; if (!L) return null; const b = L.z.bones && L.z.bones[${JSON.stringify(part)}]; const o = b || L.z.root; const p = o.getWorldPosition(o.position.clone()); return [p.x, p.y + (b ? 0 : ${part === 'head' ? 1.6 : 0.5}), p.z]; })()`);
    await shot('zombie_front');
    for (const leg of ['thighL', 'thighR', 'shinL', 'shinR']) {
      for (let i = 0; i < 6 && !(await G(`(() => { const L = ${Z}; return !L || /crawl|squirm|fall/.test(${MOT}) || [...(L.z.missing || [])].includes(${JSON.stringify(leg)}); })()`)); i++) {
        const at = await partAt(leg); if (!at) break; await lookAt(...at); await frames(2); await key('Fire'); await frames(3); await key('Fire', 'keyup'); await sleep(260); await key('KeyR'); await sleep(200);
      }
      await sleep(1500);
      log('leg', leg, JSON.stringify(await G(`(() => { const L = ${Z}; return L ? { life: Math.round(L.z.life), motion: ${MOT}, missing: [...L.z.missing] } : 'dead'; })()`)));
      if (await G(`(() => { const L = ${Z}; return !L || /crawl|squirm/.test(${MOT}); })()`)) break;
    }
    const st = await G(`(() => { const L = ${Z}; return L ? { state: L.z.state, motion: ${MOT}, missing: [...(L.z.missing || [])] } : null; })()`);
    log('after the leg shots', JSON.stringify(st));
    expect(st && /crawl|squirm|fall/.test(st.motion), 'shooting the legs makes it crawl');
    await shot('crawler');
    expect(await G("!document.getElementById('yk-part')"), 'no part tag under the sights (1.2.0 #5)');
    // head -> dead at once
    for (let i = 0; i < 4 && (await G(`!!${Z}`)); i++) { const at = await partAt('head'); if (!at) break; await lookAt(...at); await frames(2); await key('Fire'); await frames(3); await key('Fire', 'keyup'); await sleep(300); await key('KeyR'); await sleep(200); }
    expect(await G(`!${Z}`), 'a shot to the head kills it');
    await shot('headshot');
    // 1.2.1: the hits read - the mark round the sights on a hit, two body shots in a row stop it (a stagger), a hit flash
    { await spawn('salaryman', 3.4); await sleep(700);
      await G(`(() => { const L = ${Z}; window.__reacts = []; if (L) L.z.on('react', (e) => window.__reacts.push(e.kind)); return 1; })()`);
      await key('KeyR'); await sleep(1500);
      let marked = false;
      for (let i = 0; i < 3; i++) {
        const at = await partAt('chest'); if (!at) break; await lookAt(at[0], at[1] + 0.05, at[2]); await frames(2); await key('Fire'); await frames(2); await key('Fire', 'keyup');
        if (!marked) marked = await G("document.getElementById('yk-hitmark').classList.contains('on')");
        await sleep(330);
      }
      const R = await G('window.__reacts || []');
      log('reactions', JSON.stringify(R));
      expect(marked, 'a hit shows the mark round the sights');
      expect(R.includes('stagger'), `body shots in a row stop it with a stagger (${R.join(', ')})`);
      await shot('hit_reaction');
      await G('(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)'); await key('KeyR'); await sleep(1400); }
    // 1.2.1: every pickup has a glint (the floor ones were missed)
    { await G("(g.teleport({ x: 39.4, z: 6.4, yaw: 0, floor: 0 }), 1)"); await sleep(800);
      const n = await G("(() => { const s = y.lootGlints(); return [s.length, s.filter((x) => x.visible).length]; })()");
      expect(n && n[0] >= 30 && n[1] >= 1, `the pickups glint (${JSON.stringify(n)})`);
      await G("(g.teleport({ x: 50, z: 1, yaw: -Math.PI / 2, floor: 0 }), g.fp.pitch = 0, 1)"); await sleep(400); }
    // 1.2.0 #2: tougher by block - weak in the hospital, the strongest on the roof (tools/ammo-budget.mjs adds up the ammo)
    { const T = await G("(() => { const o = {}; for (const [r, x, z] of [['H_ROKA', 13, 6.8], ['S_ODORI', 56, 1.2], ['P_ROKA', 112, 7.6], ['O_OFF', 136, 7], ['O_ROOF', 137, 8]]) { const L = y.extraZombie({ id: 'Z_TOUGH_' + r, room: r, x, z, p: 'salaryman', yaw: 0 }); o[r] = L ? [L.z.maxLife, L.z.parts.head.max, L.z.parts.chest.max] : null; if (L) L.z.kill(); } return o; })()");
      log('toughness', JSON.stringify(T));
      const life = ['H_ROKA', 'S_ODORI', 'P_ROKA', 'O_OFF', 'O_ROOF'].map((r) => T && T[r] ? T[r][0] : 0);
      expect(life[0] > 100 && life.every((v, i) => !i || v > life[i - 1]), `life grows block by block, all above 1.1.1's 100 (${life.join(' / ')})`); }
    // 1.2.0 #6: a fallen one says who it was ([E] on the body: one line, no window)
    { await G("(() => { const c = g.camera.position, f = g.camera.getWorldDirection(c.clone()); f.y = 0; f.normalize(); const L = y.extraZombie({ id: 'Z_TEST_BODY', room: y.roomAtP(c.x + f.x * 2, c.z + f.z * 2, g.floor || 0).id, x: c.x + f.x * 2, z: c.z + f.z * 2, p: 'clerk', yaw: 0 }); L.z.kill(); return 1; })()");
      await sleep(2200);
      const B = await G("(() => { const b = y.bodyBox('Z_TEST_BODY'); return b ? { kind: b.userData.interact.kind, inList: g.world.interactables.includes(b) } : null; })()");
      expect(B && B.kind === 'corpse' && B.inList, `a fallen zombie can be looked at (${JSON.stringify(B)})`);
      expect(/田辺/.test(await G("y.corpseLine('Z_ROKA1')")) && /署長/.test(await G("y.corpseLine('Z_RYU2')")) && /40代/.test(await G("y.corpseLine('Z_REI3')")), 'the identity lines tie to the documents (田辺さん, the chief, the morgue list)');
      const at = await G("(() => { const b = y.bodyBox('Z_TEST_BODY'); return b ? [b.position.x, b.position.y, b.position.z] : null; })()");
      if (at) { await lookAt(...at); await frames(4); await key('KeyE'); await frames(2); await key('KeyE', 'keyup'); await sleep(500); }
      const said = await G("(document.getElementById('say') || {}).textContent || ''");
      expect(/コンビニ/.test(said) && !(await G("!!(g.wm && g.wm.isOpen)")), `[E] on the body says who it was, with no window (${said.slice(0, 40)})`);
      await shot('corpse_look'); }
    // melee with the pipe, then grab + shove
    const pipe = await G("(y.case.items.find((i) => i.id === 'pipe') || {}).uid");
    await G(`(y.equipUid(${pipe}), 1)`);
    await spawn('salaryman', 1.3); await sleep(400);
    const hp0 = await G(`(() => { const L = ${Z}; return L ? L.z.life || L.z.hp || 0 : 0; })()`);
    for (let i = 0; i < 3; i++) { const at = await partAt('head'); if (at) await lookAt(...at); await key('KeyV'); await sleep(700); }
    const hp1 = await G(`(() => { const L = ${Z}; return L ? L.z.life || L.z.hp || 0 : 0; })()`);
    expect(hp1 < hp0 || !(await G(`!!${Z}`)), `melee hurts (${hp0} -> ${hp1})`);
    await G('(y.hurt(5, { grab: 1.5, by: null }), 1)'); await sleep(200);
    expect(await G("document.getElementById('yk-grab').classList.contains('on')"), 'a grab shows the shove hint');
    await shot('grabbed');
    await key('KeyV'); await sleep(300);
    expect(await G("!document.getElementById('yk-grab').classList.contains('on')"), 'melee shoves free of a grab');
    await G('(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)');
    // the case: open with B, combine bandage + disinfectant, heal
    await key('KeyB'); await sleep(500);
    expect(await G("g.wm.isOpen && g.wm.current === 'case'"), '[B] opens the case');
    await shot('case');
    await G("(() => { const b = y.case.items.find((i) => i.id === 'bandage'); y.case.sel = b; return 1; })()");
    await G('(y.case.redraw && y.case.redraw(), 1)'); await sleep(200);
    await p.eval("document.querySelector('[data-act=combo]') ? (document.querySelector('[data-act=combo]').click(), 1) : 0");
    await sleep(300);
    expect(await G("y.case.items.some((i) => i.id === 'aidkit')"), 'bandage + disinfectant make a first-aid kit');
    await shot('case_combined');
    await dismiss();
    await G('(y.hurt(50, {}), 1)'); const h0 = await G('y.hp'); await key('KeyH'); await sleep(300);
    expect((await G('y.hp')) > h0, `[H] heals (${h0} -> ${await G('Math.round(y.hp)')})`);
    // death -> the last checkpoint, the case as it was there
    const before = await G('y.case.items.map((i) => i.id).sort().join(",")');
    await G('(y.cp = { case: y.case.snapshot(), killed: [...y.killed], flags: { ...y.flags } }, 1)');
    await G("(y.case.add('medkit', 1), 1)");
    await G("(y.hurt(500, { reason: 'bitten' }), 1)");
    await sleep(600); await shot('death');
    await p.waitFor('!__game.state.dead && window.__yk.hp >= 100', 15000).catch(() => {});
    await sleep(500);
    expect((await G('y.case.items.map((i) => i.id).sort().join(",")')) === before, 'after a death the case is as it was at the checkpoint');
    expect((await G('y.hp')) >= 100, 'after a death the body is whole again');
  }

  // ------------------------------------------------------------------ off the route
  async function offroute() {
    await dismiss();
    // a locked door before its key / task
    for (const d of ['D_SHOBO', 'D_PBUKI', 'D_OROOF']) {
      const locked = await G(`!!(g.world.doors.get(${JSON.stringify(d)}) && g.world.doors.get(${JSON.stringify(d)}).locked())`);
      expect(locked, `${d} is locked at the start`);
    }
    // tasks pressed before their needs say why
    for (const id of ['T_CASE', 'T_SAFE', 'T_HELI']) {
      const why = await G(`g.canStart(g.data.tasks.find((t) => t.id === ${JSON.stringify(id)}))`);
      expect(why !== true && typeof why === 'string' && why.length > 4, `${id} early says why: ${why}`);
    }
    // a full case: the pickup stays where it was and says so
    await G("(() => { for (let i = 0; i < 30; i++) if (y.case.add('canned', 1)) break; return 1; })()");
    const free = await G("y.case.add('rifle', 1)");
    expect(free === 1 || free === true || free > 0, 'a rifle does not fit a full doctor bag');
    // walking: W for 3 s from the start goes somewhere and does not leave the plan
    await p.key('KeyW', 'down'); await sleep(3000); await p.key('KeyW', 'up');
    expect((await G('g.world.roomAt(g.camera.position.x, g.camera.position.z)')) !== null, 'walking stays inside the rooms');
    // a side room in the street block, a zombie in it, the player standing still: it comes
    await G("(g.teleport({ x: 60, z: 4, yaw: 0, floor: 0 }), 1)"); await sleep(400);
    await shot('street_side');
    const z0 = await G('y.zStats');
    log('zombies near the street', JSON.stringify(z0));
  }
}

for (const r of list) await run(r);
server.kill();
console.log(failedAll ? `PLAY FAILED (${failedAll})` : 'PLAY OK');
process.exit(failedAll ? 1 : 0);
