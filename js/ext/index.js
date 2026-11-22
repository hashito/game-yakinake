// 夜勤明けの街: the game's own code. One small shared state (G) and its events (G.on / G.emit); the parts in the order they need each other:
//   sound.js   the shots, strikes and the zombies' voices          case.js     the grid case, the storage box, loot, boxes
//   combat.js  weapons, aiming, the body, the HUD                  zombies.js  the dot zombies (spawns.js: where they are)
//   people.js  the people (dot figures) and the ones who fight     story.js    talks, choices, factions, saves, the roof, the endings
// The dot look of the world (furniture, cars, light) is js/dot/index.js.
import { installSound } from './sound.js';
import { installCase } from './case.js';
import { installCombat } from './combat.js';
import { installZombies } from './zombies.js';
import { installPeople } from './people.js';
import { installStory } from './story.js';
import { installBlocks } from './blocks.js';
import { LOOT } from './loot.js';

export default function (ext) {
  const L = {};
  const G = {
    lootDefs: LOOT,
    on: (ev, fn) => { (L[ev] = L[ev] || []).push(fn); },
    emit: (ev, e) => { for (const fn of L[ev] || []) { try { fn(e); } catch (err) { console.error('[yakinake]', ev, err); } } },
  };
  installSound(ext, G);
  installCase(ext, G);
  installCombat(ext, G);
  installZombies(ext, G);
  installPeople(ext, G);
  installStory(ext, G);
  installBlocks(ext, G);
  G.targets = () => [...(G.zombieTargets ? G.zombieTargets() : []), ...(G.peopleTargets ? G.peopleTargets() : [])];
  // what stops a bullet: the walls, doors, floors and furniture of the world (not the pickups, the people or the marks)
  let solid = [], solidAt = -1e9;
  G.solidMeshes = () => {
    const now = performance.now();
    if (now - solidAt > 2000 && G.ctx) {
      solidAt = now; solid = [];
      G.ctx.world.group.traverse((o) => {
        if (!o.isMesh || o.visible === false || !o.material || o.material.visible === false) return;
        const n = String(o.name || ''), pn = String((o.parent && o.parent.name) || '');
        if (/^(station|item|doc|loot|log|person|zombie|stlook|lamp|warm)/.test(n) || /^(station|item|doc|loot|log|person|zombie)/.test(pn)) return;
        if (o.material.transparent && o.material.opacity < 0.5) return;
        solid.push(o);
      });
    }
    return solid;
  };
  ext.on('game:ready', (ctx) => { G.ctx = ctx; if (typeof window !== 'undefined') window.__yk = G; });
  ext.on('player:dead', () => { G.deaths = (G.deaths || 0) + 1; });
  ext.on('bus:error', ({ name, error }) => console.error('[yakinake]', name, error && error.stack ? error.stack.split('\n').slice(0, 3).join(' ') : String(error)));
}
