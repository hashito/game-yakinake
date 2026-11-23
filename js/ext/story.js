// The story: what each talk, box and choice does; the factions (the mart, the 黎明の会, the station's alliance, the man in the kitchen);
// the safe rooms (当直日誌 = the save point, 保管箱 = the storage box); the checkpoint snapshot (the case, the dead zombies) a death
// goes back to; the roof's last stand; and the four endings.
import * as THREE from 'three';
import { BOXES, RACK } from './loot.js';
import { ROOF_WAVE } from './spawns.js';
import { CATALOG } from './case-data.js';
import { factionOf, TASK_OF, FACTIONS } from './factions.js';

const SAFE = [
  { room: 'H_TOU', x: 5.2, z: 3.2, y: 0.78, name: '当直室' },
  { room: 'S_YAMA', x: 51.5, z: 23.0, y: 0.92, name: '山とキャンプの店' },
  { room: 'P_KYU', x: 98, z: 3.2, y: 0.76, name: '署の休憩室' },
  { room: 'O_BOSAI', x: 150.5, z: 0.5, y: 0.8, name: '防災センター' },
];

export function installStory(ext, G) {
  let ctx = null;
  // 1.4.0 #13: a person whose group the player turned on does not talk as before. At [E] the frightened give way (「持っていって」) and
  // the task is done as by force (nothing soft-locks); the ones still fighting say nothing. Wraps every person's task registered here.
  const WHO = Object.fromEntries(Object.entries(TASK_OF).map(([who, t]) => [t, who]));
  const regTask0 = ext.registerTask;
  ext.registerTask = (id, d) => {
    const who = WHO[id];
    if (who && d && d.run) {
      const run = d.run;
      d = { ...d, run: async (c, task) => {
        const f = factionOf(who);
        if (!f || !G.flags[`hostile:${f}`]) return run(c, task);
        const p = G.person && G.person(who), name = p ? p.P.name : who;
        if (p && ['fight', 'shoot'].includes(p.mode)) { ctx.ui.toast(`${name}さんは、話を聞く気がない。`); return false; }
        ctx.ui.toast(`${name}「来ないで……持っていって。もう、関わらないで」`);
        G.forceFlags && G.forceFlags(who);
        return true;
      } };
    }
    return regTask0(id, d);
  };
  G.flags = {};
  const flag = (k, v = true) => { G.flags[k] = v; G.emit('flag', { k, v }); };
  const has = (id) => ctx.state.inv.includes(id);
  // 1.4.0 #13: after a killing the people have heard of it (a rumour line before their own talk, once)
  const RUMOR = { katagiri: 'rumor_katagiri', noguchi: 'rumor_noguchi', hayase: 'rumor_hayase' };
  const talk = async (id, o = {}) => {
    if (RUMOR[id] && (G.flags.blood || 0) > 0 && !G.flags[`rumor:${id}`]) { G.flags[`rumor:${id}`] = true; await ctx.talk(RUMOR[id], { title: '', last: '続ける' }); }
    return ctx.talk(id, { title: o.title || '', last: o.last || '続ける' });
  };
  const choose = (who, text, options) => ctx.choose({ who, text, options });
  // 1.4.1: the consequences of a killing are SEEN, once each - the radio spreads it at once (the people say it again when you meet
  // them), and on the roof the groups who will not come are named. G.consequences lists what was shown (play-routes checks it).
  G.consequences = [];
  const shown = (k) => { if (!G.consequences.includes(k)) G.consequences.push(k); };
  G.on('person:killed', () => {
    if (G.flags['rumor:radio']) return;
    G.flags['rumor:radio'] = true;
    setTimeout(() => { if (!ctx || ctx.state.ended) return; ctx.ui.toast('どこかで無線が鳴った。「……白衣の女が、人を殺した。近づくな」噂は、もう広まっている。'); shown('rumor'); }, 6000);
  });

  // ---------------------------------------------------------------- the checkpoint: what a death goes back to
  // 1.4.0 (play test #11 「死んだら前のセーブポイントから再開」): a death goes back to the last 当直日誌 written - everything as it was then
  // (the case, the tasks, the flags, the dead, the pickups: the kit puts back what was taken since) - after the death card's 再開 button.
  // The log save is kept apart from the running save (which is written all the time). Before the first log: the start of the game.
  // On the roof (the last stand, a phase) a death starts the hold over, as before.
  const LOGKEY = 'yakinake.logsave.v1';
  const writeLogSave = () => { if (ctx.testMode) return; const s = ctx.snapshot(); if (!s) return; try { localStorage.setItem(LOGKEY, JSON.stringify({ ...s, v: 1, savedAt: Date.now() })); } catch (e) { /* private mode */ } };
  const readLogSave = () => { try { return JSON.parse(localStorage.getItem(LOGKEY) || 'null'); } catch (e) { return null; } };
  G.logSave = readLogSave; G.writeLog = () => writeLogSave();
  const snap = () => { G.cp = { case: G.case.snapshot(), killed: [...G.killed], flags: { ...G.flags } }; };
  ext.on('task:done', () => setTimeout(snap, 0));
  ext.on('game:start', ({ resume }) => { setTimeout(() => { if (!resume || !readLogSave()) writeLogSave(); }, 600); });
  ext.registerDeath({
    run: async (c, reason) => {
      const DS = G.manifest.deaths || {}, D = { ...(DS.default || {}), ...(DS[reason] || {}) };
      c.bus.emit('player:dead', { reason });
      const inRoof = !!c.phaseId && c.phaseId() === 'roof';
      const log = !inRoof && readLogSave();
      const sub = inRoof ? '屋上の守りを、最初からやり直す。' : log ? '最後に当直日誌に書いた所から、再開する。持ち物も、そのときのまま。' : 'はじめから、再開する。';
      const { showDeath } = await import('../kit/moments.js');
      await c.hold(() => showDeath(c, D.text || '噛まれた。', sub, { ...D, retry: '再開' }));
      G.dead = false; G.hp = 100;
      if (inRoof || c.testMode) { c.respawn(); G.hud && G.hud(); try { c.fp.lock(); } catch (e) { /* no lock */ } return; }
      if (log) { c.store.save(log); c.start({ restart: true, resume: true, skipIntro: true, quiet: true }); }
      else c.start({ restart: true, skipIntro: true });
      G.emit('resumed', { from: log ? 'log' : 'start' });
    },
  });
  ext.on('player:respawn', () => {
    if (G.cp) { G.case.restore(G.cp.case); G.resetZombies(G.cp.killed); }
    G.hp = 100; G.hud && G.hud();
    // a fight that was going on starts over from the beginning
    if (G.flags['mart:fight'] && !G.flags['mart:open']) { G.fight(['gondo', 'nishina']); }
    if (roof.on) roof.reset();
  });

  // ---------------------------------------------------------------- tasks
  const after = (id, fn) => ext.registerTask(id, { onDone: (c) => { try { fn(c); } catch (e) { console.error(e); } } });
  ext.registerTask('T_CART', { run: async () => { G.case.give(BOXES.T_CART); const s = G.case.items.find((i) => i.id === 'scalpel'); if (s) G.equipUid(s.uid, { quiet: true }); G.weaponHint('scalpel', 'メスを手に取った。軽くて速いが、届かない。', 5); await ctx.mapTip(); return true; } });
  ext.registerTask('T_TOOLBOX', { run: async () => { G.case.give(BOXES.T_TOOLBOX); const p = G.case.items.find((i) => i.id === 'pipe'); if (p) G.equipUid(p.uid, { quiet: true }); return true; } });
  ext.registerTask('T_CASE', { canStart: () => (has('KEYRING') ? true : '鍵がかかっている。霊安室の机に、鍵束があるはず。'), run: async () => { G.case.give(BOXES.T_CASE); const n = G.case.items.find((i) => i.id === 'nailgun'); if (n) G.equipUid(n.uid, { quiet: true }); G.weaponHint('nailgun', '釘打ち機。音が小さい。', 4); return true; } });
  ext.registerTask('T_AXE', { canStart: () => (has('FIREKEY') ? true : '南京錠がかかっている。鍵は、消防団の人が持っているはず。'), run: async () => { G.case.give(BOXES.T_AXE); return true; } });
  after('T_FUEL', () => G.case.give(BOXES.T_FUEL));
  after('T_SHOKO', () => { ctx.ui.say('写真の奥、ロッカーの前に、誰か立っている。……写っている札は、二十三番。', 6); G.case.give(BOXES.T_SHOKO); });
  ext.registerTask('T_PACK', { run: async () => {
    G.case.bag = 'pack';
    ctx.ui.toast('登山リュック（8×5）に持ち替えた'); G.emit('case:change'); return true;
  } });

  // talk tasks
  ext.registerTask('T_CHISATO', { run: async () => { await talk('chisato'); return true; } });
  after('T_RADIO', () => talk('radio_done'));
  after('T_SAFE', () => talk('safe_done'));
  ext.registerTask('T_GENZO', { run: async (c, task) => { if (!(await ctx.runMinigame(task))) return false; await talk('genzo'); ctx.state.inv.splice(ctx.state.inv.indexOf('INSULIN'), 1); return true; } });
  // 1.6.0 (play test 2 #6): the three under the sheets were there all along; with the keys in hand, the sheets move - one, then the next
  after('T_REI', () => { const ids = ['Z_REI1', 'Z_REI3', 'Z_REI2']; ids.forEach((id, i) => setTimeout(() => { const L = G.liveZombies().find((x) => x.def.id === id); if (L && L.z.lying && L.z.lying() && G.riseNow) { L.rising = null; G.wakeSlow && G.wakeSlow(id); } }, 200 + i * 1100)); setTimeout(() => talk('morgue_wake'), 1500); });
  after('T_SHUTTER', () => { G.noise(ctx.camera.position, 30); setTimeout(() => talk('outside'), 3000); });   // 1.5.0: the line waits for the shutter to be up (js/ext/shutter.js rolls it for 2.6 s)

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
  // 1.4.0 (#5 #14): the back way is through the food court (fallen, smashed open) to the storeroom; 仁科's key opens the padlock at once
  ext.registerTask('T_MARTLOCK', { canStart: () => (G.flags['mart:open'] ? 'もう、奥の戸から通れる。' : true),
    run: async (c, task) => { if (has('MARTKEY')) ctx.ui.say('仁科さんの鍵で、南京錠を外した。', 3); else if (!(await ctx.runMinigame(task))) return false; if (!G.flags.mart || G.flags.mart === 'fight') flag('mart', G.flags.mart || 'sneak'); return true; } });
  ext.registerTask('T_NISHINA', { canStart: () => (G.flags['mart:open'] ? 'もう、奥の戸から通れる。' : G.flags['hostile:mart'] ? '仁科は、もう口をきいてくれない。' : true), run: async () => { await talk('nishina'); flag('mart:nishina'); return true; } });
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
      // 1.4.0 (#5 #14): what was found in the 公民館 changes how it can end - the man shut in the cellar, told in front of everyone
      ...(G.flags['cult:miyake'] ? [{ id: 'split', label: '地下の三宅さんのことを、皆の前で話す', primary: true }] : []),
    ]);
    if (v === 'talk') { await talk('shirasaka_talk'); flag('cult', 'talked'); }
    else if (v === 'fake') { await talk('shirasaka_fake'); flag('cult', 'faked'); }
    else if (v === 'split') { await talk('shirasaka_split'); flag('cult', 'split'); flag('cult:taken'); G.syncZombies(); setTimeout(() => { if (!ctx.state.tasks.includes('T_ROPE')) ctx.completeTask('T_ROPE'); }, 400); }
    else { await talk('shirasaka_fight'); flag('cult', 'fought'); flag('cult:loose'); G.noise(new THREE.Vector3(80, 0, 19), 20); }
    return true;
  } });
  ext.registerTask('T_TAEKO', { canStart: () => (G.flags['hostile:cult'] ? '妙子さんは、怯えて口をきかない。' : true), run: async () => { await talk('taeko'); flag('cult:taeko'); return true; } });
  ext.registerTask('T_MIYAKE', { run: async () => {
    await talk('miyake');
    const v = await choose('私', '格子の錠を、開ける？', [{ id: 'free', label: '開ける', primary: true }, { id: 'no', label: '今はやめる' }]);
    if (v !== 'free') return false;
    await talk('miyake_free'); flag('cult:miyake'); return true;
  } });
  after('T_ROPE', () => { if (G.flags.cult === 'talked') flag('cult:taken'); G.syncZombies(); });

  // the station's alliance
  ext.registerTask('T_KATA', { run: async () => {
    await talk('katagiri');
    const v = await choose('片桐', '手を組む？', [{ id: 'join', label: '手を組む', primary: true }, { id: 'no', label: '断る（自分でやる）' }, { id: 'rob', label: '武器を向けて、休憩室の物資を奪う' }]);
    if (v === 'join') flag('alliance', 'joined');
    else if (v === 'rob') { await talk('katagiri_rob'); flag('alliance', 'none'); flag('robbed'); G.turnHostile('alliance', { atk: true }); }
    else { await talk('katagiri_no'); flag('alliance', 'none'); }
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
    const p = G.case.items.find((i) => i.id === 'pistol'); if (p) G.equipUid(p.uid, { quiet: true });
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
  const roof = { on: false, t: 0, spawned: 0, next: 2, ids: [], wave: -1, inWave: 0, allies: null, shotT: 0 };
  roof.reset = () => { for (const L of G.liveZombies()) if (String(L.def.id).startsWith('Z_RF')) { L.z.dispose(); } roof.t = 0; roof.spawned = 0; roof.next = 3; roof.wave = -1; roof.inWave = 0; roof.giant = false; };
  ext.registerTask('T_HOLD', { run: async () => { await talk('heli'); roof.on = false;
    // the hold is over: 権藤 and 仁科 go back down to the daughter
    if (roof.allies && roof.allies.has('gondo')) { G.showPerson('gondo', false); G.showPerson('nishina', false); ctx.ui.toast('権藤さんたちは、娘さんのところへ戻っていった。'); } for (const L of G.liveZombies()) if (String(L.def.id).startsWith('Z_RF') && L.alive) L.z.kill(); return true; } });
  ext.registerTask('T_HELI', { run: async () => {
    let end = 'E2';
    const A = roof.allies || allies();
    if (G.violent && G.violent()) {
      // 1.4.0 #13: a killing or an attack on people who were not hostile: with the station's people on the roof they still board
      // (E7, the mixed way: hostile to one group, allied with another); alone, the pilot has heard of it and will not take the player
      if (A.has('katagiri') || A.has('mori')) { await talk('heli_mixed'); end = 'E7'; }
      else {
        await talk('heli_refuse');
        const v = await choose('私', 'パイロットは、首を振っている。', [{ id: 'down', label: '武器を下ろす', primary: true }, { id: 'force', label: 'パイロットに武器を向けて、乗る' }]);
        if (v === 'force') { await talk('heli_force'); end = 'E6'; } else { await talk('heli_down'); end = 'E5'; }
      }
    } else if (G.flags.alliance === 'joined' && !G.flags.betrayed) {
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
  // The hold comes in three waves with a breath between them (a notice at each), and who comes up to help depends on the choices:
  // 権藤 and 仁科 after the trade at the mart (they hold the first wave and go back down to the daughter), 片桐 and 森 when the
  // promise of the rack was kept (the second wave), and 白坂 with 宮下 and 戸川 when the wife was seen to as a doctor (the last
  // wave, as in E1). The ones with guns shoot the nearest of the risen now and then.
  const WAVES = [
    { from: 0, to: 28, every: 5, n: 5, say: '第一波。階段から、上がってくる。' },
    { from: 40, to: 76, every: 3.4, n: 9, giant: true, say: '第二波。さっきより、数が多い。大きいのが一体いる。' },
    { from: 88, to: 115, every: 2.8, n: 9, giant: true, say: '最後の波。大きな足音が、混じっている。' },
  ];
  const LULL = '途切れた。今のうちに、弾を込める。';
  const ALLY = {
    gondo: { at: [140.6, 7.6], wave: 0, gun: 'shotgun', reach: 6, every: 7, say: '権藤さんと仁科さんが、猟銃を持って上がってきた。「借りは返す」' },
    nishina: { at: [139.8, 5.6], wave: 0 },
    katagiri: { at: [141.2, 12.6], wave: 1, gun: 'pistol', reach: 9, every: 5.5, say: '片桐さんと森くんが、階段の扉から来た。「約束どおり、追いかけてきた」' },
    mori: { at: [140.2, 13.4], wave: 1, gun: 'pistol', reach: 9, every: 6.5 },
    shirasaka: { at: [133.4, 11.6], wave: 2, say: '白坂さんが、戸川さんの肩を支えて上がってきた。宮下さんも一緒だ。' },
    genzo: { at: [132.6, 12.2], wave: 2 },
    chisato: { at: [134.2, 12.4], wave: 2 },
  };
  G.roofAllies = () => allies();
  G.roofState = () => ({ on: roof.on, t: roof.t, wave: roof.wave });   // 1.3.0: the roof block loads just these people
  function allies() {
    const f = G.flags, kept = f.alliance === 'joined' && !f.betrayed;
    const on = new Set();
    if (f.mart === 'trade') { on.add('gondo'); on.add('nishina'); }
    if (kept) { on.add('katagiri'); on.add('mori'); }
    if (kept && f.cult === 'talked') { on.add('shirasaka'); on.add('genzo'); on.add('chisato'); }
    // 1.4.0 #13: nobody comes from a group the player turned on, and nobody who is dead
    return new Set([...on].filter((id) => !(G.isDead && G.isDead(id)) && !f[`hostile:${factionOf(id)}`]));
  }
  function allyArrive(w) {
    let said = null;
    for (const id of roof.allies) {
      const A = ALLY[id]; if (A.wave !== w) continue;
      G.placePerson(id, 'O_ROOF', A.at[0], A.at[1], A.gun ? Math.PI / 2 : Math.PI * 0.75);
      if (A.say) said = A.say;
      if (A.gun) roof.guns.set(id, A.every * 0.5);
    }
    if (said) setTimeout(() => ctx.ui.toast(said), 3200);
    if (w === 0) {
      // the groups the player turned on or killed from: named once, as the first wave comes
      const gone = ['mart', 'alliance', 'cult', 'hospital'].filter((f) => G.flags[`hostile:${f}`] || FACTIONS[f].members.some((id) => G.isDead && G.isDead(id)));
      if (gone.length) setTimeout(() => { if (!ctx || ctx.state.ended) return; ctx.ui.say(`${gone.map((f) => FACTIONS[f].name).join('も、')}も、来ない。……私が、手を汚したから。`, 6, { urgent: true }); shown('roof-missing'); }, 7000);
    }
  }
  ext.registerSystem('yk-roof', {
    update(dt) {
      if (!ctx || !ctx.state.started || ctx.state.ended) return;
      const inRoof = ctx.floor === 4 && G.roomAtP(ctx.camera.position.x, ctx.camera.position.z, 4);
      if (!inRoof || ctx.state.tasks.includes('T_HOLD') || !ctx.state.tasks.includes('T_RIFLE')) return;
      if (!roof.on) { roof.on = true; roof.t = 0; roof.wave = -1; roof.allies = allies(); roof.guns = new Map(); talk('roof'); ctx.phase('roof', { at: { x: 137, z: 10, yaw: 0, floor: 4 } }); }
      if (ctx.blocked && ctx.blocked()) return;
      roof.t += dt; roof.next -= dt;
      const live = G.liveZombies().filter((L) => String(L.def.id).startsWith('Z_RF') && L.alive);
      // the waves
      const w = WAVES.findIndex((W) => roof.t >= W.from && roof.t < W.to), W = WAVES[w];
      if (w >= 0 && w !== roof.wave) { roof.wave = w; roof.inWave = 0; roof.next = 1.5; ctx.ui.toast(W.say); allyArrive(w); }
      if (w < 0 && roof.wave >= 0 && !roof.lull && live.length === 0 && roof.t < 115) { roof.lull = true; ctx.ui.toast(LULL); }
      if (w >= 0) roof.lull = false;
      if (W && roof.next <= 0 && roof.inWave < W.n && live.length < (ctx.isTouch ? 6 : 8)) {
        roof.next = W.every; roof.inWave++;
        const k = roof.spawned++, p = W.giant && roof.giant !== w ? 'giant' : ROOF_WAVE[k % (ROOF_WAVE.length - 1)];
        if (p === 'giant') roof.giant = w;
        G.extraZombie({ id: `Z_RF${k}`, room: 'O_ROOF', x: 143.6 - (k % 3) * 0.5, z: 10.5 + ((k % 2) - 0.5) * 0.8, p, yaw: -Math.PI / 2 });
      }
      // the ones with guns help: the nearest of the risen within reach, now and then (never the giant: that one is the player's)
      for (const [id, t] of roof.guns) {
        const nt = t - dt; roof.guns.set(id, nt); if (nt > 0) continue;
        const A = ALLY[id], me = G.person(id); if (!me) continue;
        roof.guns.set(id, A.every * (0.8 + Math.random() * 0.4));
        const o = me.f.root.position;
        const tgt = live.filter((L) => L.def.p !== 'giant' && Math.hypot(L.z.pos[0] - o.x, L.z.pos[2] - o.z) < A.reach)
          .sort((a, b) => Math.hypot(a.z.pos[0] - o.x, a.z.pos[2] - o.z) - Math.hypot(b.z.pos[0] - o.x, b.z.pos[2] - o.z))[0];
        if (!tgt) continue;
        me.f.root.rotation.y = Math.atan2(tgt.z.pos[0] - o.x, tgt.z.pos[2] - o.z);
        G.personAct(id); G.sfx3d(A.gun, o); tgt.z.kill();
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
        if (G.shutShelter && G.shutShelter(s.room)) ctx.ui.toast('戸を閉めて、かんぬきをかけた。');
        const p = ctx.camera.position; ctx.checkpoint = { x: p.x, z: p.z, yaw: ctx.fp ? ctx.fp.yaw : 0, floor: ctx.floor || 0 };
        snap(); G.hp = Math.max(G.hp, 60); ctx.save(); writeLogSave(); ctx.ui.toast(`当直日誌に書いた：${new Date().toTimeString().slice(0, 5)}　${s.name}（死んだら、ここから再開）`); G.hud && G.hud();
      } else if (v === 'store') G.case.open({ store: true });
    },
  });

  // ---------------------------------------------------------------- first sights and lessons
  const seen = new Set();
  ext.on('game:start', ({ resume }) => {
    if (!resume) ctx.talk('opening', { title: 'はじまり', last: '始める' }).then(() => { if (ctx.isTouch && innerHeight > innerWidth) ctx.ui.say('スマホは横持ちがおすすめ。', 5); });
  });
  // 1.5.0 (play test 2026-11-23 「コメントが少し前に表示されます。ゾンビがいるのを発見したりドア枠内にいる場合はそこまで少しアップしてください。
  // もう少しあとの方が良い」): a zombie standing still in view (in the eyes' cone, nothing solid between, within 16 m) for a quarter of a second
  // is "spotted": the eyes turn to it and zoom in a little, once per zombie; the line about it waits for that look (or for the player to be
  // right on it). The talks on entering a room wait until the player has been inside for a moment and a few steps in.
  const spotted = new Set(), dwell = new Map(), ray = new THREE.Raycaster(), fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let spotT = 0, looking = 0, roomT = 0, roomId = null;
  const headOf = (L) => { const q = L.z.root ? L.z.root.position : new THREE.Vector3(L.z.pos[0], L.z.pos[1] || 0, L.z.pos[2]); const low = (L.z.lying && L.z.lying()) || /crawl/.test((L.def && L.def.p) || ''); return new THREE.Vector3(q.x, q.y + (low ? 0.35 : 1.45), q.z); };
  // the first ones the story speaks of are caught from beside too, when close (passing the treatment room's glass door, the crawler in the corridor)
  // 1.5.1: the glass door is a 1.4 m gap seen while walking past it - 2.1 rad (the door already a little behind the shoulder) and a short dwell
  const WIDE = { Z_SHO_EAT: 2.1, Z_CRAWL: 1.75 };
  const inSight = (L, max = 16) => {
    if (!L || !L.alive || L.floor !== (ctx.floor || 0) || !L.z) return false;
    const cam = ctx.camera, h = headOf(L); to.copy(h).sub(cam.position); const d = to.length(); if (d > max || d < 0.5) return false;
    cam.getWorldDirection(fwd); const wide = WIDE[L.def && L.def.id]; if (fwd.angleTo(to) > (wide && d < 6 ? wide : 0.6)) return false;   // in the eyes' cone (35°): one seen from the corner of the eye, in a door frame, counts
    ray.set(cam.position, to.clone().normalize()); ray.far = d - 0.4;
    return !(G.solidMeshes && ray.intersectObjects(G.solidMeshes(), false).some((h) => !(h.object.material && h.object.material.transparent)));   // seen through glass (the treatment room's glass door)
  };
  G.spotted = (id) => spotted.has(id);
  const spot = (dt) => {
    if ((spotT -= dt) > 0) return; spotT = 0.1;
    if (looking > 0 || !G.liveZombies) return;
    for (const L of G.liveZombies()) {
      const id = L.def && L.def.id; if (!id || spotted.has(id)) continue;
      if (!inSight(L)) { dwell.delete(id); continue; }
      const t = (dwell.get(id) || 0) + 0.1; dwell.set(id, t); if (t < (WIDE[id] ? 0.15 : 0.25)) continue;
      spotted.add(id); G.emit('zombie:spotted', { id });
      const d = headOf(L).distanceTo(ctx.camera.position);
      // 1.5.1 (play test #3 again: the zoom showed a door, not the one behind it): the glass-door one is seen from 3.5-4 m across the corridor,
      // so the first two (WIDE) turn the eyes from 2.5 m on
      // 1.6.0 (play test 2 #7 「敵が出るたびにアップにする演出は不要です」): no zoom on an ordinary zombie. Only the first reveal, the one
      // eating behind the treatment room's glass, turns the eyes - slowly, a slight 1.08 zoom - and the [E] and centre prompts wait
      // until the look is over (D-11 / D-18: nothing on the screen but the thing seen)
      if (id === 'Z_SHO_EAT' && d > 2.5 && !(L.alert > 0 && d < 9) && ctx.lookTo) { looking = 1.5; document.body.classList.add('yk-looking'); ctx.lookTo(headOf(L), { sec: 1.3, zoom: 1.08, speed: 2 }).then(() => setTimeout(() => document.body.classList.remove('yk-looking'), 150)); }
      return;
    }
  };
  const lineAfterLook = (key, fn) => { if (seen.has(key)) return; seen.add(key); setTimeout(fn, looking > 0 ? Math.round(looking * 1000) + 350 : 350); };
  ext.registerSystem('yk-story', {
    update(dt = 0.016) {
      if (!ctx || !ctx.state.started || ctx.state.ended || (ctx.blocked && ctx.blocked())) return;
      if (looking > 0) looking = Math.max(0, looking - dt);
      spot(dt);
      const p = ctx.camera.position, r = G.roomAtP(p.x, p.z, ctx.floor || 0), rid = r && r.id;
      if (rid !== roomId) { roomId = rid; roomT = 0; } else roomT += dt;
      // a few steps inside, a moment in the room: a line about a room is never said on its threshold
      const settled = r && roomT > 1.2 && Math.min(p.x - r.x, r.x + r.w - p.x, p.z - r.z, r.z + r.d - p.z) > 1.0;
      // the first one eating, seen through the treatment room's glass: once it has been spotted (or the player is beside the glass)
      if (rid === 'H_ROKA' && !seen.has('glass') && (spotted.has('Z_SHO_EAT') || p.x > 26)) lineAfterLook('glass', () => talk('first_glass'));
      if (ctx.state.tasks.includes('T_TOOLBOX') && rid === 'H_ROKA' && !seen.has('crawl') && (spotted.has('Z_CRAWL') || G.liveZombies().some((L) => L.def && L.def.id === 'Z_CRAWL' && L.alive && Math.hypot(L.z.pos[0] - p.x, L.z.pos[2] - p.z) < 5))) lineAfterLook('crawl', () => talk('crawler'));
      if (ctx.state.tasks.includes('T_CHISATO') && rid === 'H_ROKA' && settled && !seen.has('lesson')) { seen.add('lesson'); talk('lesson'); }
      if (rid === 'P_URA' && settled && !seen.has('byd')) { seen.add('byd'); talk('backyard'); }
      if (rid === 'O_BOSAI' && settled && !seen.has('nog')) { seen.add('nog'); talk('noguchi'); }
      // 1.4.0 (#5 #14): the quarrels heard on the way in (the mart's two; the 公民館's leader and the one who doubts)
      if (rid === 'S_MART' && settled && !seen.has('margue') && !G.flags['hostile:mart'] && !ctx.state.tasks.includes('T_GONDO')) { seen.add('margue'); talk('mart_argue'); }
      if (rid === 'S_KOMIN' && settled && !seen.has('cargue') && !G.flags['hostile:cult'] && !ctx.state.tasks.includes('T_CULT')) { seen.add('cargue'); talk('cult_argue'); }
    },
  });
  G.on('zombie:died', () => { G.kills = (G.kills || 0) + 1; });

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
    // 1.4.0 (#5 #14 #15): the rooms where people live are shut; the mart, the 公民館 and the room of the ones who want out answer a knock
    for (const [k, K] of Object.entries(KNOCK)) L(K.door, () => !G.flags[`knock:${k}`], () => (G.flags[`hostile:${K.fac}`] ? '戸の向こうで、誰かが息をひそめている。' : '戸は閉まっている。中に人がいる。ノックした。'));
    L('D_MSTAFF', () => true);
    L('D_KSHIN', () => true);
    L('D_KLEAD', () => !(has('KLEADKEY') || G.flags['hostile:cult'] || (G.isDead && G.isDead('shirasaka'))), () => (G.flags['cult:taeko'] ? '妙子さんの合鍵がある。' : '白坂の部屋。鍵がかかっている。'));
    L('ST_KCHIKA', () => !has('CELLARKEY'), '床の上げ蓋。南京錠がかかっている。鍵は、白坂が持っているはず。');
    L('D_OROOF', () => !(has('ROOFKEY') || ctx.state.tasks.includes('T_FORCE')), () => (G.flags.hayase === 'gave' ? '鍵がかかっている。屋上の鍵は、早瀬が持ち逃げした。錠を壊すしかない。' : '屋上への扉。鍵がかかっている。'));
    // the shaft's door opens once the server room is cooled (the plan's EV12, a ladder since 1.5.0)
    // 1.5.0 (play test 2026-11-23 "階段は全てはしご"): the lift became the shaft's ladder; its door is an electric lock on the emergency power
    ctx.lockDoor('EV12', () => !ctx.state.tasks.includes('T_SERVER'), 'シャフトの扉は電気錠だ。非常電源が落ちていて開かない。');
  });

  // 1.6.0 (D-21 「オフィスの3階へのはしごが平ら」): the first climb up the shaft stops halfway in the dark - a blow on the steel above, something
  // comes rattling down the shaft past the ladder and hits the bottom, a breath somewhere close in the dark; then on up (kit ctx.climbBeat)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  ext.on('game:ready', (c) => {
    c.climbBeat = (o, { up }) => {
      if (o.id !== 'EV12' || !up || seen.has('shaft') || c.qa) return null;
      seen.add('shaft');
      return (async () => {
        const p = c.camera.position.clone();
        G.sfx('bang'); G.shake && G.shake(0.45, 0.35); await wait(650);
        G.sfx('rattle'); await wait(420); G.sfx('fall'); G.shake && G.shake(0.3, 0.25); await wait(380);
        G.sfx3d('z-groan-4', new THREE.Vector3(p.x + 0.6, p.y + 0.4, p.z)); G.sfx('heart', { g: 0.8 });
        c.ui.say('上で、何かが落ちてきた。……すぐそばで、何かが息をしている。', 3.4);
        await wait(1500);
      })();
    };
  });
  // 1.4.0 #15: a knock at a shut door where people live: they ask who it is, let the player in, and close the door behind
  const KNOCK = { mart: { door: 'D_MART_F', talk: 'knock_mart', fac: 'mart', who: ['gondo', 'nishina'] }, cult: { door: 'D_KOMIN', talk: 'knock_cult', fac: 'cult', who: ['shirasaka', 'taeko'] }, khan: { door: 'D_KHAN', talk: 'knock_khan', fac: 'cult', who: ['taeko'] } };
  const openDoor = (id) => { const w = ctx.world.doors && ctx.world.doors.get(id); if (!w || w.isOpen) return; w.locked = () => false; if (w.open()) { if (!ctx.state.doors.includes(id)) ctx.state.doors.push(id); ctx.bus.emit('door:open', { id }); } };
  ext.on('door:locked', async ({ id }) => {
    const k = Object.keys(KNOCK).find((x) => KNOCK[x].door === id); if (!k || G.flags[`knock:${k}`]) return;
    const K = KNOCK[k]; G.sfx('knock');
    const alive = K.who.filter((w) => !(G.isDead && G.isDead(w)));
    if (!alive.length) { G.flags[`knock:${k}`] = true; ctx.ui.say('返事はない。戸は、押すと開いた。', 3); openDoor(id); return; }
    if (G.flags[`hostile:${K.fac}`]) { K.tries = (K.tries || 0) + 1; if (K.tries >= 2) { G.flags[`knock:${k}`] = true; ctx.ui.say('体当たりで、戸を破った。', 3); G.noise(ctx.camera.position, 10); openDoor(id); } return; }
    G.flags[`knock:${k}`] = true;
    await new Promise((r) => setTimeout(r, 700));
    await talk(K.talk); openDoor(id);
  });
  // the doors of the lived-in and safe rooms close again: the people inside close them when the player is through (one way or
  // the other), and a safe room's door is shut behind the player who stays in it. Open, the zombies follow; shut, they bang on it.
  const ROOMFAC = (rid) => (/^S_M/.test(rid) ? 'mart' : /^S_K/.test(rid) ? 'cult' : /^H_(NS|BYO)$/.test(rid) ? 'hospital' : rid === 'O_CHU' ? 'hayase' : rid === 'P_KYU' ? 'alliance' : rid === 'O_BOSAI' ? 'tower' : null);
  let shelterDoors = [], shutT = 0;
  const shelter = (r) => !!(r && (r.inhabited || r.safe));
  ext.on('game:ready', (c) => {
    const rooms = new Map(c.data.plan.rooms.map((r) => [r.id, r]));
    shelterDoors = c.data.plan.doors.filter((d) => d.x != null && !(d.open && !d.unlock) && d.kind !== 'stairs' && d.kind !== 'lift' && shelter(rooms.get(d.a)) !== shelter(rooms.get(d.b)))
      .map((d) => { const inner = shelter(rooms.get(d.a)) ? rooms.get(d.a) : rooms.get(d.b); return { d, inner, fac: ROOMFAC(inner.id), away: 0 }; });
  });
  G.shutShelter = (roomId) => { let n = 0; for (const S of shelterDoors) { if (S.inner.id !== roomId) continue; const w = ctx.world.doors.get(S.d.id); if (w && w.isOpen && w.close) { w.close(); const i = ctx.state.doors.indexOf(S.d.id); if (i >= 0) ctx.state.doors.splice(i, 1); n++; } } return n; };
  ext.registerSystem('yk-shelter', {
    update(dt) {
      if (!ctx || !ctx.state.started || ctx.state.ended || (shutT -= dt) > 0) return; shutT = 0.4;
      const p = ctx.camera.position, fl = ctx.floor || 0, here = G.roomAtP(p.x, p.z, fl);
      for (const S of shelterDoors) {
        const w = ctx.world.doors.get(S.d.id); if (!w || !w.isOpen || !w.close || (S.inner.floor || 0) !== fl) { S.away = 0; continue; }
        const dd = Math.hypot(p.x - S.d.x, p.z - S.d.z); if (dd < 2.4) { S.away = 0; continue; }
        const live = S.fac && FACMEMBERS[S.fac] && FACMEMBERS[S.fac].some((id) => !(G.isDead && G.isDead(id))) && !G.flags[`hostile:${S.fac}`];
        const inside = here && here.id === S.inner.id;
        if (!(live || (S.inner.safe && inside))) { S.away = 0; continue; }
        S.away += 0.4; if (S.away < 1.2) continue; S.away = 0;
        w.close(); const i = ctx.state.doors.indexOf(S.d.id); if (i >= 0) ctx.state.doors.splice(i, 1); G.sfx('shut');
        const once = `shut:${S.d.id}`;
        if (!G.flags[once]) { G.flags[once] = true; ctx.ui.toast(live ? `${S.inner.name}の戸が、内側から閉められた。` : '戸を閉めた。開けたままだと、ゾンビが入ってくる。'); }
      }
    },
  });
  const FACMEMBERS = { mart: ['gondo', 'nishina'], cult: ['shirasaka', 'taeko'], hospital: ['chisato', 'genzo'], hayase: ['hayase'], alliance: ['katagiri', 'mori'], tower: ['noguchi'] };

  ext.registerPersist('yk-story', {
    serialize: () => ({ flags: G.flags, seen: [...seen], downs: [...downs], ending: G.ending || null }),
    restore: (s) => { G.flags = (s && s.flags) || {}; seen.clear(); for (const x of (s && s.seen) || []) seen.add(x); downs = new Set((s && s.downs) || []); G.ending = (s && s.ending) || null; if (ctx) setTimeout(snap, 0); },
  });
}
