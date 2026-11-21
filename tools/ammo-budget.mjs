#!/usr/bin/env node
// 夜勤明けの街 1.2.0 (play test #2 「ゾンビの体力が少ないので、強くしてください」): the zombies' toughness by block against the ammo the
// world gives. For every zombie of js/ext/spawns.js (and the roof waves of js/ext/story.js) it works out, with the hit rule of
// js/kit/dot-zombie.js (a part takes min(dmg, its hp) x its mult off the life; the head severed or the chest at 0 kills), how many
// rounds of each gun it takes - aimed at the head and at the chest - at the toughness of its block (G.TOUGH in js/ext/zombies.js).
// Then, block by block in the order of the route, what the player has to shoot (a share of the zombies: some are passed by, some
// meet the pipe or the axe, the roof has allies with guns) against the ammo lying in the world up to there (js/ext/loot.js LOOT,
// BOXES, the smaller RACK choice), carried forward. Exit 1 when a block gives less than it asks (with a 1.15 margin) or when a
// tough zombie dies to fewer rounds than an easy one (the progression).
//   node tools/ammo-budget.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { SPAWNS, ROOF_WAVE } = await imp('js/ext/spawns.js');
const { LOOT, BOXES, RACK } = await imp('js/ext/loot.js');
const { CATALOG } = await imp('js/ext/case-data.js');
const tasks = JSON.parse(fs.readFileSync(path.join(root, 'data/tasks.json'), 'utf8'));
const taskRoom = new Map((Array.isArray(tasks) ? tasks : tasks.tasks).map((t) => [t.id, t.room]));
// the toughness: the same table as js/ext/zombies.js (read from its source so the two cannot drift)
const zsrc = fs.readFileSync(path.join(root, 'js/ext/zombies.js'), 'utf8');
const TOUGH = Function(`return (${zsrc.match(/G\.TOUGH = (\{[^}]*\})/)[1]})`)();
const PLAZA = /O_PLAZA: '([A-Z]+)'/.exec(zsrc);
const blockOf = (room) => room === 'O_ROOF' ? 'ROOF' : PLAZA && room === 'O_PLAZA' ? PLAZA[1] : room.charAt(0);
const toughOf = (p, room) => p === 'giant' ? TOUGH.giant : TOUGH[blockOf(room)] || 1;
const pat = (id) => JSON.parse(fs.readFileSync(path.join(root, 'assets/zombies', id + '.json'), 'utf8'));

// rounds to kill: aimed at `aim` ('head' | 'chest'), each round `hits` hits of dmg (the shotgun: 8 pellets, about 5 of them land)
function rounds(J, k, dmg, aim, hits = 1) {
  const P = { ...J.parts[aim] }, max = Math.round(P.hp * k), armor = P.armor ?? 1, mult = P.mult ?? 1;
  let hp = max, life = Math.round(J.stats.life * k);
  for (let n = 1; n < 60; n++) {
    for (let i = 0; i < hits; i++) {
      const d = dmg * armor, took = hp > 0 ? Math.min(d, hp) : d * 0.25;
      hp -= d; life -= took * mult;
      if ((aim === 'head' && hp <= 0 && !J.headless) || (aim === 'chest' && hp <= 0) || life <= 0) return n;
    }
  }
  return 60;
}
const GUNS = { nails: ['nailgun', 1], p9: ['pistol', 1], shell: ['shotgun', 5], rifleAmmo: ['rifle', 1] };
const HEAD = 0.4, MISS = 1.25;   // two kills in five by the head; one round in five misses
const perKill = (J, k, ammo) => { const [g, hits] = GUNS[ammo], dmg = CATALOG[g].gun.dmg; return MISS * (HEAD * rounds(J, k, dmg, 'head', ammo === 'shell' ? 3 : 1) + (1 - HEAD) * rounds(J, k, dmg, 'chest', hits)); };

// the blocks in the order of the route; the share the player has to shoot (the streets: the axe of the fire station does much)
const ORDER = ['H', 'S', 'P', 'O', 'ROOF'], NAME = { H: '病院', S: '街', P: '警察署・裏', O: 'ビル', ROOF: '屋上' };
const SHARE = { H: 0.5, S: 0.55, P: 0.75, O: 0.8, ROOF: 0.45 };   // the roof: 権藤・片桐・森 shoot too
// the zombies of each block (the chained ones of the arcade are set loose only in the fight; counted)
const zs = Object.fromEntries(ORDER.map((b) => [b, []]));
for (const s of SPAWNS) zs[blockOf(s.room)].push({ p: s.p, room: s.room });
const wsrc = fs.readFileSync(path.join(root, 'js/ext/story.js'), 'utf8');
const waveN = [...wsrc.matchAll(/\{ from: \d+, to: \d+, every: [\d.]+, n: (\d+)/g)].reduce((a, m) => a + +m[1], 0);
for (let k = 0; k < waveN; k++) zs.ROOF.push({ p: k === waveN - 1 ? 'giant' : ROOF_WAVE[k % (ROOF_WAVE.length - 1)], room: 'O_ROOF' });

// the ammo each block gives (LOOT, the boxes of its tasks, the smaller rack, the guns' loaded rounds; powder + casing = 4 shells)
const give = Object.fromEntries(ORDER.map((b) => [b, { nails: 0, p9: 0, shell: 0, rifleAmmo: 0 }]));
const add = (b, id, n, o) => { if (give[b][id] != null) give[b][id] += n; if (o && o.loaded) give[b][CATALOG[id].gun.ammo] += o.loaded; if (id === 'powder') give[b].shell += 4 * n; };
for (const l of LOOT) add(blockOf(l.room), l.item, l.n);
for (const [t, list] of Object.entries(BOXES)) { const r = taskRoom.get(t); if (r) for (const [id, n, o] of list) add(blockOf(r), id, n, o); }
for (const [id, n, o] of RACK.share) add(blockOf(taskRoom.get('T_RACK') || 'P_BUKI'), id, n, o);
const guns = { H: ['nails'], S: ['nails'], P: ['nails', 'p9', 'shell'], O: ['nails', 'p9', 'shell', 'rifleAmmo'], ROOF: ['nails', 'p9', 'shell', 'rifleAmmo'] };   // the nail gun still in the case

const out = { tough: TOUGH, blocks: [], progression: [], errors: [] };
const carry = { nails: 0, p9: 0, shell: 0, rifleAmmo: 0 };
for (const b of ORDER) {
  for (const a in carry) carry[a] += give[b][a];
  // what the share of this block costs, paid with the guns at hand: kill capacity of the ammo in "kills", spent in order of cheapness
  const list = zs[b].map((z) => ({ ...z, J: pat(z.p), k: toughOf(z.p, z.room) }));
  const avgCost = (a) => list.length ? list.reduce((s, z) => s + perKill(z.J, z.k, a), 0) / list.length : 1;
  const capacity = guns[b].reduce((s, a) => s + carry[a] / avgCost(a), 0);
  let need = list.length * SHARE[b];
  if (b === 'ROOF') need = (list.length - 1) * SHARE[b] + 1;   // the giant is the player's
  // spend: take the kills from each ammo in turn (rifle for the giant first)
  let left = need;
  for (const a of [...guns[b]].reverse()) { if (left <= 0) break; const c = avgCost(a), kills = Math.min(left, carry[a] / c); carry[a] -= kills * c; left -= kills; }
  const row = { block: b, name: NAME[b], zombies: list.length, toughness: TOUGH[b] ?? null, need: +need.toFixed(1), capacity: +capacity.toFixed(1), give: give[b],
    pistolChest: list.length ? Math.round(list.reduce((s, z) => s + rounds(z.J, z.k, 38, 'chest'), 0) / list.length * 10) / 10 : 0,
    pistolHead: list.length ? Math.round(list.reduce((s, z) => s + rounds(z.J, z.k, 38, 'head'), 0) / list.length * 10) / 10 : 0,
    leftAfter: Object.fromEntries(Object.entries(carry).map(([a, n]) => [a, Math.round(n)])) };
  out.blocks.push(row);
  if (capacity < need * 1.15) out.errors.push(`${NAME[b]}: the ammo up to here kills ${row.capacity} of the ${row.need} the player has to shoot (x1.15 margin)`);
}
// the progression: a salaryman's pistol rounds to the chest, block by block, never fewer than the block before
let last = 0;
for (const b of ORDER) { const n = rounds(pat('salaryman'), b === 'ROOF' ? TOUGH.ROOF : TOUGH[b], 38, 'chest'); out.progression.push([NAME[b], n]); if (n < last) out.errors.push(`${NAME[b]}: a salaryman takes ${n} pistol rounds to the chest, fewer than the block before (${last})`); last = n; }
// and the old rule: 1.1.1 had every zombie at 100 % (pistol to the chest 3)
out.before = { pistolChest: rounds(pat('salaryman'), 1, 38, 'chest'), pistolHead: rounds(pat('salaryman'), 1, 38, 'head') };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`toughness ${JSON.stringify(TOUGH)}; 1.1.1: pistol chest ${out.before.pistolChest} / head ${out.before.pistolHead}`);
  for (const r of out.blocks) console.log(`${r.name.padEnd(6, '　')} zombies ${String(r.zombies).padStart(2)}  pistol chest ${r.pistolChest} head ${r.pistolHead}  need ${r.need}  ammo kills ${r.capacity}  given ${JSON.stringify(r.give)}  left ${JSON.stringify(r.leftAfter)}`);
  console.log('progression (salaryman, pistol, chest):', out.progression.map(([n, k]) => `${n} ${k}`).join(' / '));
  for (const e of out.errors) console.log('  ERROR', e);
  console.log(out.errors.length ? `=> ${out.errors.length} error(s)` : '=> ok');
}
process.exit(out.errors.length ? 1 : 0);
