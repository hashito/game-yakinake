#!/usr/bin/env node
// pixel-items.json: every gameplay thing and its dot pictures (kit tools/audit-pixel-items.mjs): the case's things (CATALOG),
// the story's things (data/items.json) and the key objects the weapons come out of (the station parts of js/dot/index.js).
//   node tools/dot/ledger.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { CATALOG } = await import(new URL('../../js/ext/case-data.js', import.meta.url).href);
const has = (p) => fs.existsSync(path.join(ROOT, p));
const LOOT_PART = { pistol: 'pistol', shotgun: 'shotgun', medkit: 'medkit', aidkit: 'medkit', p9: 'ammo-9mm', shell: 'ammo-12g' };
const slug = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '').replace(/_/g, '-');
const items = [];
for (const [id, c] of Object.entries(CATALOG)) {
  if (c.hidden) continue;
  const icon = `assets/icons/${id}.png`, part = LOOT_PART[id] ? `assets/stacks/${LOOT_PART[id]}.png` : null;
  items.push({ id: slug(id), name: c.name, kind: c.kind, collectable: true, examinable: false, world: part && has(part) ? part : icon, inventory: icon,
    states: c.gun ? ['lying', 'in-case', 'held', 'empty'] : c.stack ? ['lying', 'in-case', 'used-up'] : ['lying', 'in-case', 'used'], pixelArt: true });
}
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/items.json'), 'utf8'));
for (const it of data.items || data) {
  const icon = `assets/icons/${it.id}.png`;
  items.push({ id: slug(it.id), name: it.name, kind: 'story', collectable: true, examinable: true, world: icon, inventory: icon, examine: icon, states: it.start ? ['carried'] : ['in-box', 'carried'], pixelArt: true });
}
const PARTS = { S_CART: ['crash-cart', '救急カート'], S_TOOL: ['toolbox', '工具箱'], S_SAFE: ['safe', '警備室の金庫'], S_RADIO: ['radio', '防災無線の受信機'], S_BREAKER: ['breaker', '配電盤'],
  S_BOARD: ['switchboard', '交換台'], S_TAPE: ['tape-deck', '録音機'], S_RACK: ['gun-rack-full', '銃の保管庫'], S_RIFLE: ['rifle-case', '会長室の銃のケース'] };
for (const [sid, [k, name]] of Object.entries(PARTS)) items.push({ id: `station-${slug(sid.slice(2))}`, name, kind: 'station', collectable: false, examinable: false, world: `assets/stacks/${k}.png`,
  states: sid === 'S_RACK' ? ['full', 'half', 'empty'] : ['closed', 'opened'], pixelArt: true });
fs.writeFileSync(path.join(ROOT, 'pixel-items.json'), JSON.stringify({ version: 1, policy: 'all-gameplay-items-pixel', items }, null, 2) + '\n');
console.log(items.length, 'things in pixel-items.json');
