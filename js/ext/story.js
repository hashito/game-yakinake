// The story: what each talk, box and choice does; the factions (the mart, the 黎明の会, the station's alliance, the man in the kitchen);
// the safe rooms (当直日誌 = the save point, 保管箱 = the storage box); the checkpoint snapshot (the case, the dead zombies) a death
// goes back to; the roof's last stand; and the four endings.
import * as THREE from 'three';
import { BOXES, RACK } from './loot.js';
import { ROOF_WAVE } from './spawns.js';
import { CATALOG } from './case-data.js';

const SAFE = [
  { room: 'H_TOU', x: 5.2, z: 3.2, y: 0.78, name: '当直室' },
  { room: 'S_YAMA', x: 51.5, z: 23.0, y: 0.92, name: '山とキャンプの店' },
  { room: 'P_KYU', x: 98, z: 3.2, y: 0.76, name: '署の休憩室' },
  { room: 'O_BOSAI', x: 150.5, z: 0.5, y: 0.8, name: '防災センター' },
];

export function installStory(ext, G) {
  let ctx = null;
  G.flags = {};
  const flag = (k, v = true) => { G.flags[k] = v; G.emit('flag', { k, v }); };
  const has = (id) => ctx.state.inv.includes(id);
  const talk = (id, o = {}) => ctx.talk(id, { title: o.title || '', last: o.last || '続ける' });
  const choose = (who, text, options) => ctx.choose({ who, text, options });

  // ---------------------------------------------------------------- the checkpoint: what a death goes back to
  const snap = () => { G.cp = { case: G.case.snapshot(), killed: [...G.killed], flags: { ...G.flags } }; };
  ext.on('task:done', () => setTimeout(snap, 0));
  ext.on('player:respawn', () => {
    if (G.cp) { G.case.restore(G.cp.case); G.resetZombies(G.cp.killed); }
    G.hp = 100; G.hud && G.hud();
    // a fight that was going on starts over from the beginning
    if (G.flags['mart:fight'] && !G.flags['mart:open']) { G.fight(['gondo', 'nishina']); }
    if (roof.on) roof.reset();
  });

  // ---------------------------------------------------------------- tasks
  const after = (id, fn) => ext.registerTask(id, { onDone: (c) => { try { fn(c); } catch (e) { console.error(e); } } });
  ext.registerTask('T_CART', { run: async () => { G.case.give(BOXES.T_CART); const s = G.case.items.find((i) => i.id === 'scalpel'); if (s) G.equipUid(s.uid); ctx.ui.say('メスを持った。左クリック（スマホは「殴る」）で振る。ケースは［B］。', 7); return true; } });
  ext.registerTask('T_TOOLBOX', { run: async () => { G.case.give(BOXES.T_TOOLBOX); const p = G.case.items.find((i) => i.id === 'pipe'); if (p) G.equipUid(p.uid); return true; } });
  ext.registerTask('T_CASE', { canStart: () => (has('KEYRING') ? true : '鍵がかかっている。霊安室の机に、鍵束があるはず。'), run: async () => { G.case.give(BOXES.T_CASE); const n = G.case.items.find((i) => i.id === 'nailgun'); if (n) G.equipUid(n.uid); ctx.ui.say('釘打ち機。音が小さい。撃つと、釘が減る。［R］で装填。', 6); return true; } });
  ext.registerTask('T_AXE', { canStart: () => (has('FIREKEY') ? true : '南京錠がかかっている。鍵は、消防団の人が持っているはず。'), run: async () => { G.case.give(BOXES.T_AXE); return true; } });
  after('T_FUEL', () => G.case.give(BOXES.T_FUEL));
  after('T_SHOKO', () => G.case.give(BOXES.T_SHOKO));
  ext.registerTask('T_PACK', { run: async () => {
    G.case.bag = 'pack';
    ctx.ui.toast('登山リュック（8×5）に持ち替えた'); G.emit('case:change'); return true;
  } });

  // talk tasks
  ext.registerTask('T_CHISATO', { run: async () => { await talk('chisato'); return true; } });
  after('T_RADIO', () => talk('radio_done'));
  after('T_SAFE', () => talk('safe_done'));
  ext.registerTask('T_GENZO', { run: async () => { await talk('genzo'); ctx.state.inv.splice(ctx.state.inv.indexOf('INSULIN'), 1); return true; } });
  after('T_REI', () => { setTimeout(() => talk('morgue_wake'), 300); });
  after('T_SHUTTER', () => { G.noise(ctx.camera.position, 30); setTimeout(() => talk('outside'), 400); });

  // the mart: trade / sneak / fight
  ext.registerTask('T_GONDO', { run: async () => {
    await talk('gondo');
    const opts = [
      { id: 'trade', label: has('ANTIBIO') ? '抗生物質を渡す' : '抗生物質を渡す（持っていない）', primary: has('ANTIBIO'), disabled: !has('ANTIBIO') },
      { id: 'sneak', label: '断って、奥の搬入口から忍び込む' },
      { id: 'fight', label: '力ずくで通る' },
    ];
    let v = await choose('権藤', '薬を出すか、帰るか。', opts);
    if (v === 'trade' && !has('ANTIBIO')) v = 'sneak';
    if (v === 'trade') { ctx.state.inv.splice(ctx.state.inv.indexOf('ANTIBIO'), 1); await talk('gondo_trade'); flag('mart', 'trade'); flag('mart:open'); }
    else if (v === 'sneak') { await talk('gondo_sneak'); flag('mart', 'sneak'); }
    else { await talk('gondo_fight'); flag('mart', 'fight'); flag('mart:fight'); G.fight(['gondo', 'nishina']); }
    return true;
  } });
  ext.registerTask('T_MARTLOCK', { canStart: () => (G.flags.mart === 'sneak' ? true : G.flags['mart:open'] ? 'もう、奥の戸から通れる。' : '権藤が見ている。今は無理だ。') });
  let downs = new Set();
  G.on('person:down', async ({ id }) => {
    downs.add(id);
    if (G.flags['mart:fight'] && downs.has('gondo') && downs.has('nishina') && !G.flags['mart:open']) { await talk('gondo_give'); flag('mart:open'); ctx.save(); }
  });

  // the 黎明の会: examine the wife (talk) / pretend to follow / fight
  ext.registerTask('T_CULT', { run: async () => {
    await talk('shirasaka');
    const v = await choose('白坂', 'お還りさまを、ともに守ってくださいますか。', [
      { id: 'talk', label: '医者として、奥さんを診る', primary: true },
      { id: 'fake', label: 'ついて行くふりをする' },
      { id: 'fight', label: '縄を切って、力ずくで通る' },
    ]);
    if (v === 'talk') { await talk('shirasaka_talk'); flag('cult', 'talked'); }
    else if (v === 'fake') { await talk('shirasaka_fake'); flag('cult', 'faked'); }
    else { await talk('shirasaka_fight'); flag('cult', 'fought'); flag('cult:loose'); G.noise(new THREE.Vector3(80, 0, 19), 20); }
    return true;
  } });
  after('T_ROPE', () => { if (G.flags.cult === 'talked') flag('cult:taken'); G.syncZombies(); });

  // the station's alliance
  ext.registerTask('T_KATA', { run: async () => {
    await talk('katagiri');
    const v = await choose('片桐', '手を組む？', [{ id: 'join', label: '手を組む', primary: true }, { id: 'no', label: '断る（自分でやる）' }]);
    if (v === 'join') flag('alliance', 'joined'); else { await talk('katagiri_no'); flag('alliance', 'none'); }
    return true;
  } });
  after('T_GEN', () => {
    const d = ctx.world.doors && ctx.world.doors.get('D_PRYU'); if (d && d.open) { d.locked = () => false; d.open(); }
    G.syncZombies(); G.noise(new THREE.Vector3(100, 0, 18), 25);
    setTimeout(() => talk('gen_done'), 200);
  });
  ext.registerTask('T_RACK', { run: async () => {
    await talk('rack');
    const joined = G.flags.alliance === 'joined';
    const v = joined ? await choose('私', '約束は、半分ずつ。', [{ id: 'share', label: '約束どおり、半分を持っていく', primary: true }, { id: 'all', label: '全部持っていく' }]) : 'all';
    if (v === 'share') { G.case.give(RACK.share); await talk('rack_share'); flag('rack', 'share'); }
    else { G.case.give(RACK.all); if (joined) { await talk('rack_all'); flag('betrayed'); } flag('rack', 'all'); }
    const p = G.case.items.find((i) => i.id === 'pistol'); if (p) G.equipUid(p.uid);
    return true;
  } });
  after('T_TAPE', () => talk('tape_done'));

  // the tower
  ext.registerTask('T_NOGUCHI', { onDone: () => talk('noguchi_done'), canStart: () => true });
  ext.registerTask('T_HAYASE', { run: async () => {
    await talk('hayase');
    const gun = G.case.items.find((i) => i.id === 'pistol');
    const v = await choose('早瀬', '銃を、一丁。', [
      { id: 'give', label: gun ? '拳銃を渡す' : '拳銃を渡す（持っていない）', disabled: !gun },
      { id: 'refuse', label: '断る' },
      { id: 'expose', label: '「早瀬さんは昨夜死んだ」と言う', primary: true },
    ]);
    if (v === 'give' && gun) { G.case.items.splice(G.case.items.indexOf(gun), 1); if (G.equip === gun.uid) G.equip = null; await talk('hayase_give'); flag('hayase', 'gave'); G.showPerson('hayase', false); }
    else if (v === 'expose') { await talk('hayase_expose'); flag('hayase', 'exposed'); }
    else { await talk('hayase_refuse'); flag('hayase', 'refused'); }
    G.emit('case:change');
    return true;
  } });
  after('T_RIFLE', () => {
    G.case.give(BOXES.T_RIFLE);
    if (G.flags.hayase === 'gave') { const i = ctx.state.inv.indexOf('ROOFKEY'); if (i >= 0) ctx.state.inv.splice(i, 1); talk('box_empty'); }
  });
  ext.registerTask('T_FORCE', { canStart: () => (G.flags.hayase === 'gave' && !has('ROOFKEY') ? true : '屋上の鍵がある。鍵で開ければいい。') });

  // ---------------------------------------------------------------- the roof: the last stand, the helicopter, the endings
  const roof = { on: false, t: 0, spawned: 0, next: 2, ids: [] };
  roof.reset = () => { for (const L of G.liveZombies()) if (String(L.def.id).startsWith('Z_RF')) { L.z.dispose(); } roof.t = 0; roof.spawned = 0; roof.next = 3; };
  ext.registerTask('T_HOLD', { run: async () => { await talk('heli'); roof.on = false; for (const L of G.liveZombies()) if (String(L.def.id).startsWith('Z_RF') && L.alive) L.z.kill(); return true; } });
  ext.registerTask('T_HELI', { run: async () => {
    let end = 'E2';
    if (G.flags.alliance === 'joined' && !G.flags.betrayed) {
      if (G.flags.cult === 'talked') end = 'E1';
      else {
        await talk('heli_hold');
        const v = await choose('私', '扉を……', [{ id: 'hold', label: '押さえて残る', primary: true }, { id: 'go', label: '離して、ヘリへ走る' }]);
        end = v === 'hold' ? 'E3' : 'E4';
      }
    }
    G.ending = end;
    ctx.setFlag(`end:${end}`);
    return true;
  } });
  ext.registerSystem('yk-roof', {
    update(dt) {
      if (!ctx || !ctx.state.started || ctx.state.ended) return;
      const inRoof = ctx.floor === 4 && G.roomAtP(ctx.camera.position.x, ctx.camera.position.z, 4);
      if (!inRoof || ctx.state.tasks.includes('T_HOLD') || !ctx.state.tasks.includes('T_RIFLE')) return;
      if (!roof.on) { roof.on = true; roof.t = 0; talk('roof'); ctx.phase('roof', { at: { x: 137, z: 10, yaw: 0, floor: 4 } }); }
      if (ctx.blocked && ctx.blocked()) return;
      roof.t += dt; roof.next -= dt;
      const alive = G.liveZombies().filter((L) => String(L.def.id).startsWith('Z_RF') && L.alive).length;
      if (roof.next <= 0 && alive < (ctx.isTouch ? 6 : 8) && roof.t < 115) {
        roof.next = roof.t > 60 ? 4 : 6;
        const k = roof.spawned++, p = roof.t > 85 && !roof.giant ? 'giant' : ROOF_WAVE[k % (ROOF_WAVE.length - 1)];
        if (p === 'giant') roof.giant = true;
        G.extraZombie({ id: `Z_RF${k}`, room: 'O_ROOF', x: 143.6 - (k % 3) * 0.5, z: 10.5 + ((k % 2) - 0.5) * 0.8, p, yaw: -Math.PI / 2 });
      }
    },
  });

  // ---------------------------------------------------------------- the safe rooms: 当直日誌 (save) and 保管箱 (storage)
  const logMat = new THREE.MeshLambertMaterial({ color: 0xd8c8a0, emissive: 0x3a2a10, emissiveIntensity: 0.4 });
  ext.on('game:ready', (c) => {
    ctx = c;
    const W = ctx.world;
    for (const s of SAFE) {
      const R = ctx.data.plan.rooms.find((r) => r.id === s.room), y = W.floorY((R && R.floor) || 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), logMat);
      m.position.set(s.x, y + s.y, s.z); m.name = `log:${s.room}`;
      m.userData.interact = { kind: 'log', id: s.room, label: '当直日誌と保管箱' }; m.userData.def = s;
      W.group.add(m); W.interactables.push(m);
    }
    snap();
  });
  ext.registerInteract('log', {
    prompt: () => '[E] 当直日誌に書く／保管箱',
    run: async (o) => {
      const s = SAFE.find((x) => x.room === o.id);
      const v = await choose('私', `${s.name}の当直日誌と、保管箱。`, [{ id: 'write', label: '日誌に書く（ここから続けられる）', primary: true }, { id: 'store', label: '保管箱を開ける' }, { id: 'no', label: 'やめる' }]);
      if (v === 'write') {
        const p = ctx.camera.position; ctx.checkpoint = { x: p.x, z: p.z, yaw: ctx.fp ? ctx.fp.yaw : 0, floor: ctx.floor || 0 };
        snap(); G.hp = Math.max(G.hp, 60); ctx.save(); ctx.ui.toast(`当直日誌に書いた：${new Date().toTimeString().slice(0, 5)}　${s.name}`); G.hud && G.hud();
      } else if (v === 'store') G.case.open({ store: true });
    },
  });

  // ---------------------------------------------------------------- first sights and lessons
  const seen = new Set();
  ext.on('game:start', ({ resume }) => {
    if (!resume) ctx.talk('opening', { title: 'はじまり', last: '始める' }).then(() => { if (ctx.isTouch && innerHeight > innerWidth) ctx.ui.say('スマホは横持ちがおすすめ。', 5); });
  });
  ext.registerSystem('yk-story', {
    update() {
      if (!ctx || !ctx.state.started || ctx.state.ended || (ctx.blocked && ctx.blocked())) return;
      const p = ctx.camera.position, r = G.roomAtP(p.x, p.z, ctx.floor || 0), rid = r && r.id;
      if (rid === 'H_ROKA' && p.x > 19.5 && !seen.has('glass')) { seen.add('glass'); talk('first_glass'); }
      if (ctx.state.tasks.includes('T_TOOLBOX') && rid === 'H_ROKA' && !seen.has('crawl')) { seen.add('crawl'); G.teachParts = true; talk('crawler'); }
      if (ctx.state.tasks.includes('T_CHISATO') && rid === 'H_ROKA' && !seen.has('lesson')) { seen.add('lesson'); G.teachParts = true; talk('lesson'); }
      if (rid === 'P_URA' && !seen.has('byd')) { seen.add('byd'); talk('backyard'); }
      if (rid === 'O_BOSAI' && !seen.has('nog')) { seen.add('nog'); talk('noguchi'); }
    },
  });
  G.on('zombie:died', () => { G.kills = (G.kills || 0) + 1; if (G.kills >= 10) G.teachParts = false; });

  // ---------------------------------------------------------------- doors that need a thing or a deed
  ext.on('game:ready', () => {
    const L = (id, fn, hint) => ctx.lockDoor(id, fn, hint);
    L('D_SHOBO', () => !has('FIREKEY'));
    L('D_MART_B', () => !G.flags['mart:open']);
    L('D_MART_K', () => !ctx.state.tasks.includes('T_MARTLOCK'), '搬入口の戸。外から南京錠がかかっている。');
    L('D_PTSU', () => !ctx.state.tasks.includes('T_GEN'));
    L('D_PBUKI', () => !ctx.state.tasks.includes('T_BUKI'));
    L('D_PRYU', () => !ctx.state.tasks.includes('T_GEN'), '留置場の扉。電気の錠で閉まっている。中で、何かが鉄格子を叩いている。');
    L('D_OCHU', () => !ctx.state.tasks.includes('T_HAYASE'));
    L('D_OROOF', () => !(has('ROOFKEY') || ctx.state.tasks.includes('T_FORCE')), () => (G.flags.hayase === 'gave' ? '鍵がかかっている。屋上の鍵は、早瀬が持ち逃げした。錠を壊すしかない。' : '屋上への扉。鍵がかかっている。'));
    // the lift runs once the server room is cooled (the plan's lift EV12)
    const ev = ctx.world.doors && ctx.world.doors.get('EV12'); if (ev) ctx.lockDoor('EV12', () => !ctx.state.tasks.includes('T_SERVER'), 'エレベーターは止まっている。非常電源が落ちている。');
  });

  ext.registerPersist('yk-story', {
    serialize: () => ({ flags: G.flags, seen: [...seen], downs: [...downs], ending: G.ending || null }),
    restore: (s) => { G.flags = (s && s.flags) || {}; seen.clear(); for (const x of (s && s.seen) || []) seen.add(x); downs = new Set((s && s.downs) || []); G.ending = (s && s.ending) || null; if (ctx) setTimeout(snap, 0); },
  });
}
