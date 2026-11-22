#!/usr/bin/env node
// Play scripts for 夜勤明けの街 (headless, ?qa=1: talks resolve at once, timers run 10x). Each route plays the whole game through
// the real [E] key and the real choices (window.__pref: the option ids this route picks, in order of preference), and checks the
// ending it must reach. "combat" checks the shooter itself with real keys: a shot to the legs makes a crawler, a shot to the head
// kills, melee, grab and shove, the case (equip, combine, heal), death -> the last checkpoint with the case as it was.
// "offroute" presses things out of order (locked doors, tasks before their needs, a full case) and walks into side rooms.
// 1.4.0 (#13): E5 / E6 kill a person who was not hostile and go alone (the pilot refuses: step back / take it by force), E7 the mixed
// way (hostile to the mart, allied with the station); "attack" attacks one of every group off the route: the 「撃つ？」 confirm stops the
// first shot, the hit turns the group, the others answer (fight / shoot / flee), a killed person's task is done by force (no soft-lock).
//   node tools/play-routes.mjs [--route E1|E2|E3|E4|E5|E6|E7|mart-fight|combat|offroute|attack|all] [--mobile] [--shots dir]
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
  E5: { pref: ['sneak', 'talk', 'no', 'refuse', 'down'], end: 'E5', kill: 'nishina' },
  E6: { pref: ['sneak', 'talk', 'no', 'refuse', 'force'], end: 'E6', kill: 'nishina' },
  E7: { pref: ['sneak', 'talk', 'join', 'share', 'expose'], end: 'E7', kill: 'nishina' },
};
const which = arg('--route', 'all');
const list = which === 'all' ? [...Object.keys(ROUTES), 'combat', 'offroute', 'attack'] : which.split(',');
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
  // 1.3.0: a block's loading screen (kit js/block-loader.js) waits for its button: wait for the load, then press it as a player does
  const blockGo = async () => {
    if (!(await p.eval("!!document.querySelector('.gf-block-load.on')"))) return false;
    await p.waitFor("(() => { const b = document.querySelector('.gf-block-load .gf-bl-go'); return !document.querySelector('.gf-block-load.on') || (b && !b.disabled); })()", 120000);
    await p.eval("(() => { const b = document.querySelector('.gf-block-load.on .gf-bl-go'); if (b) b.click(); return 1; })()"); await sleep(400);
    return true;
  };
  const dismiss = async () => { await blockGo(); for (let i = 0; i < 6 && (await G('!!(g.ui.open || g.wm.isOpen || (g.blockers || []).some((f) => f()))')); i++) { await p.key('Escape'); await sleep(250); if (await G('!!(g.ui.open || g.wm.isOpen)')) { await p.eval("document.querySelector('.win-foot .btn')?.click()"); await sleep(250); } } };
  const press = async (name) => { await dismiss(); const a = await approach(name); if (a !== 'ok') { log('cannot reach', name, a, JSON.stringify(await G("({ blocked: g.blocked && g.blocked(), wm: g.wm.current, ui: !!g.ui.open, target: g.target && g.target.id, floor: g.floor, blockers: (g.blockers || []).map((f) => !!f()), mg: !!g.mgOpen, rn: !!g.rnOpen, started: g.state.started, ended: g.state.ended, ov: [...document.querySelectorAll('[class*=mg-], .reading, .lane')].filter((e) => e.offsetParent).map((e) => e.className).slice(0, 4), dead: !!g.state.dead, hold: !!g.holding })"))); return false; } await p.key('KeyE'); await sleep(400); return true; };
  // clear the zombies near the player (the play scripts are about the story; "combat" checks the fighting)
  const calm = () => G('(y.liveZombies().forEach((L) => { if (L.alive && L.z && L.z.root && L.z.root.position.distanceTo(g.camera.position) < 12) L.z.kill(); }), 1)');
  // 1.4.0 #13: people
  const J = JSON.stringify;
  const arm = () => G("(() => { if (!y.case.items.some((i) => i.id === 'pistol')) y.case.add('pistol', 1, { loaded: 8 }); y.case.add('p9', 40); const w = y.case.items.find((i) => i.id === 'pistol'); if (w) { w.loaded = 8; y.equipUid(w.uid, { quiet: true }); } return 1; })()");
  const pState = (id) => G(`(() => { const p = y.person(${J(id)}); return p ? { mode: p.mode, hp: Math.round(p.hp), max: p.max, room: p.room, floor: p.floor, vis: p.f.root.visible } : null; })()`);
  // stand 2.4 m from a person, in their room, facing them (their block loads first)
  // stand 1.6-2.4 m from a person, on their room's open side, so nothing stands between
  const stand = async (id) => {
    await G(`(() => { const p = y.person(${J(id)}); if (!p) return 0; const o = p.f.root.position, R = g.data.plan.rooms.find((r) => r.id === p.room); let dx = R.x + R.w / 2 - o.x, dz = R.z + R.d / 2 - o.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; const k = Math.min(2.4, Math.max(1.6, L)); g.teleport({ x: Math.min(R.x + R.w - 0.5, Math.max(R.x + 0.5, o.x + dx * k)), z: Math.min(R.z + R.d - 0.5, Math.max(R.z + 0.5, o.z + dz * k)), floor: p.floor, yaw: 0 }); return 1; })()`);
  };
  const goTo = async (id, room, x, z, floor = 0) => {
    // blocks load by the stage reached: off the route, the person's block is loaded as the stage would
    await G(`(() => { const b = y.blockOfRoom(${J(room)}); if (b && y.blocks && y.blocks.current !== b) y.blocks.ensure(b, {}); return 1; })()`); await sleep(300);
    await G(`(g.teleport({ x: ${x}, z: ${z}, floor: ${floor}, yaw: 0 }), 1)`); await sleep(500); await dismiss(); await sleep(600);
    // the person's block may still be loading (its screen comes up a moment after the teleport): wait for them, pressing はじめる
    for (let i = 0; i < 120 && !(await G(`!!y.person(${J(id)})`)); i++) { if (!(await blockGo())) await sleep(500); }
    await dismiss();
    await stand(id);
    await frames(3);
  };
  const aimAt = async (id) => { const a = await G(`(() => { const p = y.person(${J(id)}); if (!p) return null; const o = p.f.root.position, low = p.mode === 'down' || p.mode === 'dead' || (p.cover && (p.cover.down || p.cover.ph === 'down')); return [o.x, o.y + p.P.h * (low ? 0.42 : 0.82), o.z]; })()`); if (a) await lookAt(...a); return a; };
  const fireOnce = async () => { await key('Fire'); await frames(3); await key('Fire', 'keyup'); await sleep(350); await dismiss(); };
  // shoot a person until `until` (an expression on p) holds; the confirm is answered `answer`; the player kept alive meanwhile
  const shootPerson = async (id, until, answer = 'yes', max = 40) => {
    const keep = await p.eval('JSON.stringify(window.__pref)'); await p.eval(`window.__pref = [${J(answer)}]; 1`);
    for (let i = 0; i < max; i++) {
      if (await G(`(() => { const p = y.person(${J(id)}); return !p || (${until}); })()`)) break;
      await G('(y.hp = 100, y.dead = false, 1)'); await arm(); if (i % 3 === 2) { await stand(id); await frames(2); } await aimAt(id); await fireOnce(); await key('KeyR'); await sleep(150);
    }
    await p.eval(`window.__pref = ${keep}; 1`);
    return G(`(() => { const p = y.person(${J(id)}); return !p || (${until}); })()`);
  };
  // fight off whoever is hostile now (the ones who fight or shoot) until they give up
  const fightAll = async () => {
    for (let i = 0; i < 6; i++) {
      const foe = await G("(() => { const t = y.peopleTargets().find((t) => t.alive && !t.guard && t.aimPoints().length); return t ? t.id : null; })()");
      if (!foe) return;
      await shootPerson(foe, "p.mode === 'down' || p.mode === 'dead'", 'no', 30);
    }
  };
  try {
    await p.goto(`${base}?qa=1${mobile ? '&touch=1' : ''}`);
    await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled", 120000);
    await shot('title');
    const r = await p.eval("(() => { const b = document.getElementById('start-btn'); b.scrollIntoView({ block: 'center' }); return JSON.stringify(b.getBoundingClientRect()); })()").then(JSON.parse);
    await p.click(r.x + r.width / 2, r.y + r.height / 2);
    await p.waitFor("!!document.querySelector('.gf-block-load.on') || __game.state.started", 15000);
    expect(await blockGo(), 'the first block loads behind its loading screen and waits for はじめる (1.3.0)');
    await p.waitFor('__game.state.started', 15000);
    await sleep(800);
    // the route's choices
    const R = ROUTES[route];
    await p.eval(`(() => { const g = window.__game, o = g.choose; window.__pref = ${JSON.stringify(R ? R.pref : [])}; window.__chosen = [];
      g.choose = (c) => { const pick = window.__pref.find((id) => (c.options || []).some((x) => x.id === id && !x.disabled)); window.__chosen.push([c.who, pick || 'primary']); return pick ? Promise.resolve(pick) : o(c); }; return 1; })()`);
    await shot('start');

    if (route === 'combat') await combat();
    else if (route === 'offroute') await offroute();
    else if (route === 'attack') await attack();
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
        // 1.4.0 #13: the violence routes kill a person who was not hostile (confirmed), then fight off the rest of the group
        if (t.id === 'T_GONDO' && R.kill && !fought) {
          fought = true;
          await goTo(R.kill, 'S_MART', 63, 9); await shot('kill_aim');
          expect(await shootPerson(R.kill, "p.mode === 'dead'"), `${R.kill} is shot (confirmed 撃つ) and killed (confirmed again once he gives up)`);
          expect(await G(`!!y.flags['hostile:mart'] && !!y.flags['dead:${R.kill}'] && (y.flags.blood || 0) >= 1`), 'the mart turns hostile; the killing is counted');
          await shot('killed'); await fightAll();
          await sleep(600);
          expect(await G("!!y.flags['mart:open']"), 'the mart beaten: its back door opens (no soft-lock)');
        }
        // the mart fight: shoot 権藤 and 仁科 until they give up
        if (t.id === 'T_GONDO' && R.fight && !fought) {
          fought = true;
          expect(await G("y.flags['mart:fight'] === true || y.flags.mart === 'fight'"), 'the mart fight starts');
          await G("(() => { const it = y.case.add('pistol', 1, { loaded: 8 }); y.case.add('p9', 40); const w = y.case.items.find((i) => i.id === 'pistol'); if (w) y.equipUid(w.uid); return 1; })()");
          for (let i = 0; i < 80 && !(await G("!!y.flags['mart:open']")); i++) {
            const t2 = await G("(() => { const t = y.peopleTargets().find((t) => t.alive && !t.guard && t.aimPoints().length); if (!t) return null; const p = t.aimPoints()[0]; return [p.x, p.y, p.z]; })()");
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
    // 1.4.1: a killing is seen to spread (the radio), and the roof names the groups that will not come
    if (R.kill) {
      const cq = await G('(y.consequences || []).slice()'), roofed = await G('!!(y.roofState && y.roofState().t > 8)');
      log('consequences', JSON.stringify(cq), 'roof', roofed);
      expect(cq.includes('rumor'), 'the radio rumour of the killing was shown');
      if (roofed) expect(cq.includes('roof-missing'), 'the roof named the group that does not come');
    }
    await sleep(1200); await shot(`ending_${end}`);
  }

  // ------------------------------------------------------------------ the shooter itself
  async function combat() {
    await dismiss();
    // 1.3.0: the patterns come block by block; the fights here use some from other blocks
    await G("y.ensurePatterns(['doctor', 'salaryman', 'clerk'])");
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
    for (let i = 0; i < 3; i++) { const at = await partAt('head'); if (at) await lookAt(...at); await key('KeyV'); await sleep(120); await key('KeyV', 'keyup'); await sleep(700); }   // a press: down and up (a key left down is not pressed again)
    const hp1 = await G(`(() => { const L = ${Z}; return L ? L.z.life || L.z.hp || 0 : 0; })()`);
    expect(hp1 < hp0 || !(await G(`!!${Z}`)), `melee hurts (${hp0} -> ${hp1})`);
    // 1.4.1 (iPhone: the pipe's blood hung in the air): after the hit the blood is ON the weapon - its world box inside the weapon's (+1 cm)
    { const bb = await G(`(() => { const b = y.fpRig && y.fpRig.built.get('pipe'); if (!b || !b.blood) return null; const box = (m) => { m.updateWorldMatrix(true, false); m.geometry.computeBoundingBox(); const B = m.geometry.boundingBox, e = m.matrixWorld.elements, P = []; for (const x of [B.min.x, B.max.x]) for (const yy of [B.min.y, B.max.y]) for (const z of [B.min.z, B.max.z]) P.push([e[0]*x+e[4]*yy+e[8]*z+e[12], e[1]*x+e[5]*yy+e[9]*z+e[13], e[2]*x+e[6]*yy+e[10]*z+e[14]]); return [0,1,2].map((k) => [Math.min(...P.map((q) => q[k])), Math.max(...P.map((q) => q[k]))]); }; const W = box(b.mesh), Bl = box(b.blood); return { vis: b.blood.visible, ok: [0,1,2].every((k) => Bl[k][0] >= W[k][0] - 0.01 && Bl[k][1] <= W[k][1] + 0.01) }; })()`);
      expect(bb && bb.vis && bb.ok, `the pipe is bloody after the hit, and the blood is on the pipe (${JSON.stringify(bb)})`); }
    // the struck zombie is still up and close: lay it down first, so its own lunge / bite cannot start or end the grab under test
    await G('(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)'); await key('KeyV', 'keyup'); await sleep(900);
    // a long hold (7 s) so a slow headless frame rate cannot run the clock out before three presses land
    await G('(y.hurt(5, { grab: 6, by: null }), 1)'); await sleep(200);
    expect(await G("document.getElementById('yk-grab').classList.contains('on')"), 'a grab shows the shove hint');
    await shot('grabbed');
    // a press is a key down and up (a key left down is not pressed again); the swing before may still be recovering
    let freed = false;
    for (let i = 0; i < 12 && !freed; i++) { await key('KeyV', 'keyup'); await key('KeyV'); await sleep(250); await key('KeyV', 'keyup'); freed = await G("!document.getElementById('yk-grab').classList.contains('on')"); }
    expect(freed, 'melee shoves free of a grab');
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
    // 1.4.0 #11: death -> the death card waits for 再開 (no auto-advance) -> back to the last 当直日誌, the case as it was written there
    const before = await G('y.case.items.map((i) => i.id).sort().join(",")');
    await G('(y.writeLog(), 1)');
    await G("(y.case.add('medkit', 1), 1)");
    await G('(g.qa = false, 1)');   // ?qa presses the card's button by itself: off here, to see that it waits
    await G("(y.hurt(500, { reason: 'bitten' }), 1)");
    await sleep(1500); await shot('death');
    const card = '(() => { const b = document.querySelector(".gf-mo-card button"); return !!b && b.textContent.includes("再開"); })()';
    expect(await p.waitFor(card, 8000).then(() => true, () => false), 'the death card shows a 再開 button');
    await sleep(2500);
    expect(await p.eval(card), 'the death card is still waiting for its button (no auto-advance)');
    await p.eval('document.querySelector(".gf-mo-card button")?.click(), 1'); await G('(g.qa = true, 1)');
    await p.waitFor('(() => { const b = document.querySelector(".gf-block-load.on .gf-bl-go"); if (b && !b.disabled) b.click(); return !!window.__yk && !window.__yk.dead && __game.state.started && !document.querySelector(".gf-block-load.on") && !document.querySelector(".gf-mo-card"); })()', 60000).catch(() => {});
    await sleep(800);
    expect((await G('y.case.items.map((i) => i.id).sort().join(",")')) === before, 'after a death the case is as it was at the last 当直日誌');
    expect((await G('y.hp')) >= 100, 'after a death the body is whole again');
  }

  // ------------------------------------------------------------------ 1.4.0 #13: an attack on every group, off the route
  async function attack() {
    await dismiss();
    const groups = [
      { f: 'hospital', who: 'chisato', room: 'H_NS', at: [9.5, 3.4], others: ['genzo'], task: 'T_CHISATO', next: 'T_RADIO' },
      { f: 'mart', who: 'nishina', room: 'S_MART', at: [63, 9], others: ['gondo'], task: 'T_NISHINA' },
      { f: 'cult', who: 'shirasaka', room: 'S_KOMIN', at: [70, 27], others: ['taeko'], task: 'T_CULT', next: 'T_ROPE' },
      { f: 'alliance', who: 'katagiri', room: 'P_KYU', at: [100, 3.2], others: ['mori'], task: 'T_KATA', next: 'T_GEN' },
      { f: 'tower', who: 'noguchi', room: 'O_BOSAI', at: [149, 4], others: [], task: 'T_NOGUCHI', next: 'T_SERVER' },
      { f: 'hayase', who: 'hayase', room: 'O_CHU', at: [149, 4.5], floor: 2, others: [], task: 'T_HAYASE' },
    ];
    for (const A of groups) {
      await goTo(A.who, A.room, A.at[0], A.at[1], A.floor || 0);
      const s0 = await pState(A.who);
      if (!s0) { expect(false, `${A.who} is there to be attacked`); continue; }
      await arm(); await aimAt(A.who); await frames(6);
      for (let k = 0; k < 4 && !(await G("document.getElementById('yk-aimtag').classList.contains('on')")); k++) { await sleep(600); await stand(A.who); await frames(3); await aimAt(A.who); await frames(6); }
      expect(await G("document.getElementById('yk-aimtag').classList.contains('on')"), `${A.who}: the sights say 「（撃たない）」 and the weapon drops`);
      // a shot answered やめる: nothing happens to the person
      await p.eval("window.__pref = ['no']; 1"); await fireOnce();
      const s1 = await pState(A.who);
      expect(s1.hp === s0.hp && s1.mode === s0.mode, `${A.who}: the 「撃つ？」 confirm stopped the shot (hp ${s1.hp}, ${s1.mode})`);
      expect((await G('window.__chosen.slice(-1)[0]'))?.[1] === 'no', `${A.who}: the confirm was asked`);
      await shot(`${A.f}_aim`);
      // 撃つ: the hit turns the group, the others answer
      expect(await shootPerson(A.who, `p.hp < p.max`), `${A.who}: hit after 撃つ`);
      await sleep(700);
      expect(await G(`!!y.flags['hostile:${A.f}'] && y.facState(${J(A.f)}) !== 'friendly'`), `${A.f}: hostile (${await G(`y.facState(${J(A.f)})`)})`);
      for (const o of A.others) { const so = await pState(o); expect(!so || ['fight', 'shoot', 'flee', 'down'].includes(so.mode), `${A.f}: ${o} answers (${so && so.mode})`); }
      // a frightened one of a hostile group gives way at [E] (no friendly talk, the task done as by force)
      if (A.f === 'hospital') {
        // (T_GENZO's stage is later than here: its registered run is called as [E] would)
        const r = await p.eval("(async () => { const g = window.__game, n = (g.talkLog || []).length; const ok = await g.ext.reg.task.get('T_GENZO').run(g, g.data.tasks.find((t) => t.id === 'T_GENZO')); return JSON.stringify({ ok, talked: (g.talkLog || []).length - n, mg: !!g.mgOpen }); })()").then(JSON.parse);
        await dismiss();
        expect(r.ok === true && !r.talked && !r.mg, `hospital: the frightened 戸川 gives way at [E] (no talk, no mini game: ${JSON.stringify(r)})`);
      }
      await shot(`${A.f}_hostile`);
      // killed: the body stays, the task they stood in is done by force, the way on is open
      expect(await shootPerson(A.who, "p.mode === 'dead'"), `${A.who}: killed (the second confirm at the one who gave up) ${JSON.stringify(await pState(A.who))} ${JSON.stringify(await G('window.__chosen.slice(-3)'))}`);
      await sleep(600);
      expect(await G(`!!y.flags['dead:${A.who}'] && g.state.tasks.includes(${J(A.task)})`), `${A.who}: dead and ${A.task} done by force`);
      if (A.next) { const why = await G(`(() => { const t = g.data.tasks.find((x) => x.id === ${J(A.next)}); return t.needs.every((n) => g.state.tasks.includes(n)) ? true : 'needs: ' + t.needs.filter((n) => !g.state.tasks.includes(n)).join(','); })()`); expect(why === true, `${A.f}: ${A.next} is not locked behind the dead (${why})`); }
      await fightAll(); await G('(y.hp = 100, 1)');
      await shot(`${A.f}_after`);
    }
    // the pause menu lists the groups and their state
    const fac = await G("y.facList().filter((f) => y.flags['met:' + f.id]).map((f) => f.id + ':' + f.state).join(' ')");
    log('groups', fac);
    expect(/hostile|wary|gone/.test(fac), 'the groups met show their state (友好 / 警戒 / 敵対)');
    expect((await G('y.flags.blood')) >= 6, 'six killings counted');
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
