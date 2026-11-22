// 1.4.0 (play test #13 「NPCもおそえる設計に…NPCの団体などと敵対することも可能に」): the people can be attacked, the groups turn
// hostile, and it reaches the endings. The rules:
//   - nobody turns on the player by surprise: a group is hostile only after the player's own act (a shot or a blow at one of them,
//     confirmed once with 「撃つ？」; 「力ずくで通る」 at the mart; 「武器を向けて、奪う」 at the station)
//   - the first shot or blow at a person who is not hostile asks first (and the weapon drops while it points at them), so a stray
//     click never hits anyone; a person who has given up (降参) asks once more
//   - a hit person reacts: the ones who can fight fight back (権藤・仁科・白坂 by hand, 片桐・森 with pistols from cover), the others
//     run and plead; the whole group turns with them and calls out
//   - a killed person stays dead (a body and a pool, 「動かなくなった」), what they were to give is taken from them, the tasks they
//     stood in are done by force (nothing soft-locks), the others hear of it (rumours), and the roof and the endings know
//   - there are no children to attack (権藤's daughter is never seen); the blood follows the blood setting
// The groups and their state (友好 / 警戒 / 敵対) are shown in the pause menu.
export const FACTIONS = {
  hospital: { name: '病院の二人', members: ['chisato', 'genzo'] },
  mart: { name: '丸福マート', members: ['gondo', 'nishina'] },
  cult: { name: '黎明の会', members: ['shirasaka', 'taeko'] },
  alliance: { name: '署の片桐たち', members: ['katagiri', 'mori'] },
  tower: { name: 'ビルの野口', members: ['noguchi'] },
  hayase: { name: '厨房の男（早瀬）', members: ['hayase'] },
};
// how each one answers an attack: by hand, with a gun from cover, or by running and pleading
export const ROLE = { gondo: 'melee', nishina: 'melee', shirasaka: 'melee', katagiri: 'gun', mori: 'gun', chisato: 'flee', genzo: 'flee', taeko: 'flee', noguchi: 'flee', hayase: 'flee' };
// the task each one stands in: done by force when they are killed (or their group beaten), so the way on never closes
export const TASK_OF = { chisato: 'T_CHISATO', genzo: 'T_GENZO', gondo: 'T_GONDO', shirasaka: 'T_CULT', katagiri: 'T_KATA', noguchi: 'T_NOGUCHI', hayase: 'T_HAYASE', taeko: 'T_TAEKO', nishina: 'T_NISHINA' };
export const factionOf = (id) => Object.keys(FACTIONS).find((f) => FACTIONS[f].members.includes(id)) || null;
const LABEL = { friendly: '友好', wary: '警戒', hostile: '敵対', gone: '全滅' };
// what a group's state is now (pure: flags + the people's modes)
export function facState(f, flags, modeOf = () => null) {
  const M = FACTIONS[f].members;
  if (M.every((id) => flags[`dead:${id}`])) return 'gone';
  if (flags[`hostile:${f}`] && M.some((id) => !flags[`dead:${id}`] && ['fight', 'shoot'].includes(modeOf(id)))) return 'hostile';
  if (flags[`hostile:${f}`]) return 'wary';   // beaten or calmed: they will not help again
  if (f === 'hospital') return 'friendly';
  if (f === 'mart') return flags.mart === 'trade' ? 'friendly' : 'wary';
  if (f === 'cult') return flags.cult === 'talked' || flags.cult === 'split' ? 'friendly' : 'wary';
  if (f === 'alliance') return flags.alliance === 'joined' && !flags.betrayed ? 'friendly' : 'wary';
  if (f === 'tower') return 'friendly';
  return flags.hayase === 'exposed' ? 'friendly' : 'wary';
}
export const facLabel = (s) => LABEL[s] || s;
/** the player has done violence: killed someone, attacked someone who was not hostile, or robbed (pure) */
export const violent = (flags) => (flags.blood || 0) > 0 || !!flags.robbed || Object.keys(flags).some((k) => k.startsWith('atk:'));

export function installFactions(ext, G) {
  let ctx = null;
  ext.on('game:ready', (c) => { ctx = c; });
  const flag = (k, v = true) => { G.flags[k] = v; G.emit('flag', { k, v }); };
  const modeOf = (id) => { const p = G.person && G.person(id); return p ? p.mode : null; };
  G.facState = (f) => facState(f, G.flags || {}, modeOf);
  G.facList = () => Object.keys(FACTIONS).map((f) => ({ id: f, name: FACTIONS[f].name, state: G.facState(f) }));
  G.violent = () => violent(G.flags || {});
  G.isDead = (id) => !!(G.flags && G.flags[`dead:${id}`]);

  /** a group turns on the player (the player's act: never by surprise) */
  G.turnHostile = (f, o = {}) => {
    if (!f || !FACTIONS[f]) return;
    const was = G.flags[`hostile:${f}`];
    flag(`hostile:${f}`);
    if (o.atk) flag(`atk:${f}`);
    for (const id of FACTIONS[f].members) {
      if (G.isDead(id)) continue;
      const p = G.person(id); if (!p || p.mode === 'down') continue;
      const r = ROLE[id];
      if (r === 'gun') G.shootAt && G.shootAt([id]); else if (r === 'melee') G.fight([id]); else G.flee && G.flee(id);
    }
    if (f === 'mart' && !G.flags['mart:fight']) { flag('mart', 'fight'); flag('mart:fight'); }
    if (!was && ctx) {
      const live = FACTIONS[f].members.filter((id) => !G.isDead(id)), caller = live.find((id) => ROLE[id] !== 'flee') || live[0];
      const P = caller && G.person(caller), name = P ? P.P.name : FACTIONS[f].name;
      const call = { mart: '「店長！ こいつ、やる気だ！」', cult: '「お還りさまを守れ！」', alliance: '「撃ってきた！ 森、伏せて！」', hospital: '「やめて！ 先生、どうしたの！」', tower: '「撃つな！ 頼む！」', hayase: '「……本気かよ」' }[f];
      ctx.ui.toast(`${name}が叫んだ：${call}`);
      setTimeout(() => ctx.ui.toast(`${FACTIONS[f].name}：敵対`), 1800);
      G.emit('faction:change', { f, state: 'hostile' });
    }
    ctx && ctx.save && ctx.save();
  };

  // a person was hit by the player
  G.on('person:hit', ({ id, before }) => {
    const f = factionOf(id); if (!f) return;
    if (before === 'stand' || before === 'walk') G.turnHostile(f, { atk: true });
  });
  // given up: when all who fight in a group are down or dead, the group is beaten - its way opens, its things can be taken
  G.on('person:down', ({ id }) => { const f = factionOf(id); if (f && G.flags[`hostile:${f}`]) setTimeout(() => beaten(f), 400); });
  G.on('person:killed', ({ id }) => {
    flag(`dead:${id}`); flag('blood', (G.flags.blood || 0) + 1);
    const p = G.person(id), name = p ? p.P.name : id;
    ctx.ui.toast(`${name}さんが、動かなくなった。`);
    setTimeout(() => ctx.ui.say(`${name}さんを、殺した。`, 4, { urgent: true }), 1200);
    const f = factionOf(id); if (f) { if (!G.flags[`hostile:${f}`]) G.turnHostile(f); setTimeout(() => beaten(f), 500); }
    force(id);
    G.emit('faction:change', { f, state: G.facState(f) });
    ctx.save && ctx.save();
  });
  // what a person stood in is done by force (quietly), with what it would have given
  function force(id) {
    const t = TASK_OF[id]; if (!t || !ctx || ctx.state.tasks.includes(t)) return;
    forceFlags(id);
    ctx.completeTask(t, { quiet: true });
  }
  // what a task done by force leaves behind (also when a frightened person gives way at [E]: js/ext/story.js)
  function forceFlags(id) {
    if (id === 'gondo') { flag('mart', G.flags.mart || 'fight'); flag('mart:open'); }
    if (id === 'shirasaka') { flag('cult', 'force'); flag('cult:loose'); G.syncZombies && G.syncZombies(); }
    if (id === 'katagiri') flag('alliance', 'none');
    if (id === 'hayase') flag('hayase', G.isDead('hayase') ? 'killed' : 'fled');
  }
  G.forceFlags = forceFlags;
  const TAKE = {
    mart: { say: '店の奥の箱を、力ずくで開けた。缶詰と散弾。', box: [['canned', 2], ['shell', 6], ['bandage', 2]] },
    cult: { say: '会の蓄えを、取り上げた。', box: [['canned', 2], ['water', 1]] },
    alliance: { say: '休憩室の物資を、奪った。', box: [['p9', 16], ['medkit', 1]] },
  };
  function beaten(f) {
    if (!ctx || G.flags[`beaten:${f}`]) return;
    const M = FACTIONS[f].members.filter((id) => ROLE[id] !== 'flee' && !G.isDead(id));
    if (M.some((id) => { const p = G.person(id); return p && ['fight', 'shoot'].includes(p.mode); })) return;
    flag(`beaten:${f}`);
    for (const id of FACTIONS[f].members) if (ROLE[id] !== 'flee') force(id);
    if (f === 'mart') flag('mart:open');
    const T = TAKE[f]; if (T && G.case) { G.case.give(T.box); ctx.ui.toast(T.say); }
    G.emit('faction:change', { f, state: G.facState(f) });
    ctx.save && ctx.save();
  }
  G.facBeaten = beaten;
  // met: a group is listed in the pause menu once one of them has been seen close by
  let metT = 0;
  ext.registerSystem('yk-factions', {
    update(dt) {
      if (!ctx || !ctx.state.started || (metT -= dt) > 0) return; metT = 1;
      const c = ctx.camera.position;
      for (const [f, F] of Object.entries(FACTIONS)) {
        if (G.flags[`met:${f}`]) continue;
        if (F.members.some((id) => { const p = G.person && G.person(id); return p && p.f.root.visible && Math.hypot(p.f.root.position.x - c.x, p.f.root.position.z - c.z) < 10; })) G.flags[`met:${f}`] = true;
      }
    },
  });
}
