// Extension module of 夜勤明けの街: the ONLY place for game-specific code. Talk to the standard through `ext` (js/kit/ext.js):
// events (ext.on / ext.emit), registerTask / registerMinigame / registerMonster / registerScreen / registerTab / registerInteract / registerTheme.
// Do not reach into the DOM of the kit's windows; use the events and the data files. See docs/standard-3d.md in game-kit.
export default function (ext) {
  // The opening conversation (standard 1.7): data/talk.json "opening" in the standard conversation window; ?qa (tests) skips the window
  let ctx = null;
  ext.on('game:ready', (c) => { ctx = c; });
  ext.on('game:start', ({ resume }) => { if (!resume && ctx) ctx.talk('opening', { title: 'はじまり', last: '始める' }); });

  // Example: react to events
  ext.on('task:done', ({ id }) => console.log('task done:', id));

  // Example (1.7): a choice -> const v = await ctx.choose({ who: '電話', text: '出る？', options: [{ id: 'no', label: '出ない' }, { id: 'yes', label: '出る', primary: true }] });
  // Example (1.7): your monster's look -> ext.registerLook('shadow', (o) => ({ root, update(dt, st, cam) {}, respawn() {}, dispose() {} })); monsters.json "look": "shadow"
  // Example (1.7): a timed task -> tasks.json { "id": "T3", ..., "timer": { "seconds": 90, "label": "朝まで" } }, ext.registerTask('T3', { beforeDone: (ctx) => ctx.talk('dawn') })

  // Example: a task that needs code (replaces the default "play the mini game")
  // ext.registerTask('T2', { canStart: (ctx) => ctx.state.inv.includes('I1') || '社員証が要る。', onDone: (ctx) => ctx.ui.say('錠が外れた。') });

  // Example: your own mini game type (then list it in game.json "minigames" and use it in tasks.json: { "type": "radio" })
  // ext.registerMinigame('radio', { mount: (host, cfg, ctx) => new Promise((done) => { host.innerHTML = '<button>OK</button>'; host.firstChild.onclick = () => done(true); }) });

  // Example: a monster (create once, update every frame)
  // ext.registerMonster('lurker', { create: (ctx) => ({ update(dt, ctx) { /* ctx.camera.position, ctx.world.roomAt(...) , ctx.die('caught') */ } }) });

  // Example: a tab in the pause menu
  // ext.registerTab('memo', { label: 'メモ', order: 50, render: (host, ctx) => { host.textContent = '…'; } });

  // TODO(shell): when the window manager / map-svg / step-guide land in game-kit, their registration goes here too.
}
