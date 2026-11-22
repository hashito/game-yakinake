// 1.3.0 (play test #10 「ゾンビのゲーム重すぎて開かないので各ブロック単位でロードする仕様に変えてください」): the game is five blocks
// (the hospital, the streets, the police station, the tower, the roof). The title opens with the core (the engine, the UI, the world's
// walls and furniture, the hands and the case pictures); starting, continuing or reaching the next block loads only that block's
// zombie patterns and people (kit js/block-loader.js: a loading screen with the block's name, a story line, a bar and a button), and
// the block that is left lets its patterns and figures go. The photos in dot are the common pack, made once with the first block.
// Music and voices were already per stage / per line (the kit's audio loads them when they play).
import * as THREE from 'three';
import { installBlockLoader } from '../kit/block-loader.js';
import { createZombie } from '../kit/dot-zombie.js';
import { SPAWNS, ROOF_WAVE } from './spawns.js';
import { PEOPLE } from './people.js';

export const BLOCKS = [
  { id: 'H', name: '灯ヶ浦市民病院', levels: ['L1', 'L2', 'L3'], pic: 'op-1.webp' },
  { id: 'S', name: '夜の街', levels: ['L4'], pic: 'sc-street.webp' },
  { id: 'P', name: '灯ヶ浦警察署', levels: ['L5', 'L6'], pic: 'sc-police.webp' },
  { id: 'O', name: '臨港セントラルビル', levels: ['L7'], pic: 'sc-office.webp' },
  { id: 'R', name: '屋上', levels: ['L8'], pic: 'sc-roof.webp' },
];
export const blockOfLevel = (lv) => (BLOCKS.find((b) => b.levels.includes(lv)) || BLOCKS[0]).id;
// a room's block: by its prefix; the plaza in front of the tower is still the police block's, the roof its own
export const blockOfRoom = (room) => {
  const r = String(room || '');
  if (r === 'O_PLAZA') return 'P';
  if (r === 'O_ROOF') return 'R';
  return { H: 'H', S: 'S', P: 'P', O: 'O' }[r.charAt(0)] || 'H';
};
export const patternsOf = (id) => [...new Set([...SPAWNS.filter((s) => blockOfRoom(s.room) === id).map((s) => s.p), ...(id === 'R' ? ROOF_WAVE : [])])];
const homeRoom = (P, plan) => (P.station ? (plan.stations.find((s) => s.id === P.station) || {}).room : P.at[0]);

export function installBlocks(ext, G) {
  let ctx = null;
  const peopleOf = (id) => {
    if (id === 'R') return G.roofAllies ? [...G.roofAllies()] : [];
    const plan = ctx.data.plan;
    return PEOPLE.filter((P) => blockOfRoom(homeRoom(P, plan)) === id).map((P) => P.id);
  };
  G.blockOfRoom = blockOfRoom; G.patternsOf = patternsOf; G.peopleOf = (id) => peopleOf(id);
  ext.on('game:ready', (c) => {
    ctx = c;
    const levels = ctx.data.stages.levels;
    const recap = (lv) => (levels.find((l) => l.id === lv) || {}).recap || '';
    const bl = G.blocks = installBlockLoader(ctx, {
      blocks: BLOCKS,
      startBlock: (o, snap) => {
        const m = /^stage:(L\d+)/.exec(o.scene || '');
        if (m) return blockOfLevel(m[1]);
        const lv = snap && snap.prog && snap.prog.level;
        return lv ? blockOfLevel(lv) : 'H';
      },
      // 1.3.1: the place on the card, as the dot picture the game makes of its own scene photo
      picture: (id) => { const b = BLOCKS.find((x) => x.id === id); return b && b.pic && window.__dot && window.__dot.pixelPhoto ? window.__dot.pixelPhoto(b.pic) : null; },
      // 1.3.1: the next block's baked bodies and people go into the HTTP cache while this one is played
      prefetch: (id) => [...patternsOf(id).map((p) => `assets/zombies/${p}.quads.bin`), ...peopleOf(id).map((q) => `assets/figures/${q}.quads.bin`)],
      line: (id, from, o = {}) => {
        const b = BLOCKS.find((x) => x.id === id);
        if (o.start && o.snap && o.snap.prog) { const L = levels.find((l) => l.id === o.snap.prog.level); return L ? `つづきから：${L.name}。${L.text || ''}` : ''; }
        if (o.start) return recap(b.levels[0]);
        return recap(b.levels[0]);
      },
      unload: async (id, to) => {
        G.unloadPeople(peopleOf(to));
        G.unloadPatterns(patternsOf(to));
      },
      load: async (id, report) => {
        const pats = patternsOf(id), people = peopleOf(id);
        const first = !(window.__dot && window.__dot.photos);
        const parts = first ? 3 : 2;
        await G.loadPatterns(pats, (k, t) => report(k / parts, t));
        await G.loadPeople(people, (k, t) => report((1 + k) / parts, t));
        if (first && window.__dot && window.__dot.preparePictures) await window.__dot.preparePictures((k) => report((2 + k) / parts, `写真を準備中… ${Math.round(k * 100)}%`));
        // pixel games load first: one hidden body of each pattern and every frame of the people are compiled and uploaded now
        report(0.98, '描画を準備中…');
        const tmp = [];
        for (const p of pats) { const pat = G.patternOf && G.patternOf(p); if (!pat) continue; const z = createZombie(pat, { position: [0, -50, 0] }); z.root.visible = false; ctx.scene.add(z.root); tmp.push(z); }
        try { if (ctx.prewarmNow) await ctx.prewarmNow([...tmp.map((z) => z.root), ...(G.peopleWarm ? G.peopleWarm() : [])]); } catch (e) { console.warn('[yakinake] block warm', e); }
        for (const z of tmp) { z.root.removeFromParent(); z.dispose(); }
        if (G.syncZombies && ctx.state.started) G.syncZombies();
      },
    });
    // the next block: when the stage that starts it is reached (a test scene walks there quietly: no stage:up, its start loads it)
    ext.on('stage:up', ({ level }) => {
      const b = blockOfLevel(level);
      if (b !== bl.current) bl.ensure(b, { line: recap(level) });
    });
  });
  if (typeof window !== 'undefined') window.__ykBlocks = { BLOCKS, blockOfLevel, blockOfRoom, patternsOf, THREE: !!THREE };
}
