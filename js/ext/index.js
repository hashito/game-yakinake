// 夜勤明けの街: the game's own code. One small shared state (G) and its events (G.on / G.emit); the parts in the order they need each other:
//   sound.js   the shots, strikes and the zombies' voices          case.js     the grid case, the storage box, loot, boxes
//   combat.js  weapons, aiming, the body, the HUD                  zombies.js  the dot zombies (spawns.js: where they are)
//   people.js  the people (dot figures) and the ones who fight     story.js    talks, choices, factions, saves, the roof, the endings
//   factions.js the groups (友好 / 警戒 / 敵対), attacks on people and what follows from them (1.4.0)
// The dot look of the world (furniture, cars, light) is js/dot/index.js.
import { installSound } from './sound.js';
import { installCase } from './case.js';
import { installCombat } from './combat.js';
import { installZombies } from './zombies.js';
import { installPeople } from './people.js';
import { installStory } from './story.js';
import { installFactions } from './factions.js';
import { installBlocks } from './blocks.js';
import { installShutter } from './shutter.js';
import { LOOT } from './loot.js';

export default function (ext, env = {}) {
  const L = {};
  const G = {
    manifest: env.manifest || {},
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
  installFactions(ext, G);
  installBlocks(ext, G);
  installShutter(ext, G);
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
  // 1.6.0 (play test 2 #1 「机が小さすぎる」): the view was 72° high - on a wide screen everything looked small and far. 62° on a wide
  // screen (about 92° across at 16:9); a phone held upright keeps 72° (it is narrow already). The look-to of the first reveal zooms from this.
  const FOV_WIDE = 62, FOV_TALL = 72;
  const fitFov = () => { const c = G.ctx && G.ctx.camera; if (!c) return; const f = c.aspect < 1 ? FOV_TALL : FOV_WIDE; if (Math.abs((c.userData.ykFov || 0) - f) > 0.1) { c.fov = f; c.userData.ykFov = f; c.updateProjectionMatrix(); } };
  ext.on('game:ready', () => { fitFov(); if (typeof window !== 'undefined') addEventListener('resize', () => setTimeout(fitFov, 0)); });
  ext.on('player:dead', () => { G.deaths = (G.deaths || 0) + 1; });
  ext.on('bus:error', ({ name, error }) => console.error('[yakinake]', name, error && error.stack ? error.stack.split('\n').slice(0, 3).join(' ') : String(error)));
}
