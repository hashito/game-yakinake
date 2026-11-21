// 夜勤明けの街: the dot look of the whole world (this game has no other version). After js/ext/index.js (game.json "ext").
//   - the plan's furniture, the cars and the bus of the streets, the boxes the weapons come out of and the mood props are library
//     sprite stacks (assets/stacks, tools/dot/stacks.py; the vehicles and boxes are the kit's yakinake-* parts of helper YK);
//     the colliders and the picking boxes of the game do not change
//   - the walls, floors and ceilings are graded to one palette (kit js/dot-world.js dotifyScene), the photos are pixel art (photos.js)
//   - one palette for the whole night, its hues by block: cold hospital teal, sodium orange, police blue, office white, dawn rose
//   - the dark stays readable: a floor of light that never reaches black, a small light round the player, the next goal glows
import * as THREE from 'three';
import { buildStackGeometry, loadPixels, stripVolume } from '../kit/sprite-stack-mesh.js';
import { palette, dotifyScene } from '../kit/dot-world.js';
import { installPhotoHooks, preparePhotos } from './photos.js';

const AT = (p) => new URL(`../../${p}`, import.meta.url).href;
export const YK_PALETTE = [
  '#05070a', '#0b1014', '#121a1e', '#1b2629', '#26363a', '#35494c', '#4a6264', '#668080', '#8aa3a0', '#b4c8c2', '#dde8e2', '#f6faf6',   // hospital teal / tile
  '#1a1208', '#2e1f0e', '#4a3214', '#70491a', '#a0661e', '#d08a2a', '#f0aa48', '#ffd890',                                                // sodium street
  '#0c1226', '#18223e', '#2a3a62', '#46609a', '#7a96d0',                                                                                 // police blue
  '#2a2826', '#4a4642', '#76706a', '#a8a29a', '#e2ad8c', '#b8866a', '#8a5e48',                                                           // concrete, skin
  '#3a0a0a', '#6e1414', '#a8221e', '#e04a34',                                                                                            // blood, alarm red
  '#3a2a36', '#6a4a58', '#b07a80', '#f0b8a0',                                                                                            // dawn
  '#2a3a24', '#4e6a3a',                                                                                                                  // moss, olive
];
// furniture kind -> stack; furniture id -> stack where one piece wants its own part (the cars of the street)
const FURN = { bench: 'bench', locker: 'locker', desk: 'desk', steelDesk: 'steel-desk', counter: 'counter', shelf: 'shelf', bed: 'bed', drum: 'drum',
  crate: 'crate', pallet: 'pallet', bodyCabinets: 'body-cabinets', vendingMachine: 'vending', fridge: 'fridge', table: 'table', tank: 'generator', cabinet: 'server', car: 'car-stalled' };
const FURN_ID = { F_CAR1: 'car-doors-open', F_CAR2: 'car-stalled-red', F_AMBU: 'ambulance', F_CAR3: 'car-stalled', F_CAR4: 'car-burnt', F_CAR5: 'car-doors-open',
  F_CAR6: 'car-stalled-red', F_BUS: 'bus-side', F_SHOTEN_CAR: 'car-burnt', F_HIRO_CAR: 'police-car', F_P_CAR: 'police-car', F_P_CAR2: 'police-car', F_PL_CAR: 'car-stalled',
  F_MART_S1: 'shop-shelf', F_MART_S2: 'shop-shelf', F_YAMA_S1: 'shop-shelf', F_TOU_SOFA: 'sofa' };
// the stations' own things (the box the weapon comes out of, the safe, the radio): a part standing at the station
const STATION_PART = { S_CART: 'crash-cart', S_TOOL: 'toolbox', S_SAFE: 'safe', S_RADIO: 'radio', S_BREAKER: 'breaker', S_BOARD: 'switchboard', S_TAPE: 'tape-deck',
  S_RACK: { k: 'gun-rack-full', after: [['T_RACK', () => (window.__yk && window.__yk.flags.rack === 'all' ? 'gun-rack-empty' : 'gun-rack-half')]] }, S_RIFLE: 'rifle-case' };
const STATION_MOUNT = { S_TOOL: { y: 0, back: 0.2 }, S_RADIO: { y: 1.0, back: 0.1 }, S_BREAKER: { y: 0.9, wall: true }, S_TAPE: { y: 0.76 }, S_RIFLE: { y: 0.76 }, S_SAFE: { back: 0.1 } };
// mood props: [room, k, x, z, face (rad), scale]
const PROPS = [
  ['H_ROKA', 'wheelchair', 7.5, 7.2, 0.6], ['H_ROKA', 'iv-fallen', 15.5, 5.6, 1.2], ['H_ROKA', 'gurney', 25.8, 6.8, 0], ['H_SHO', 'iv-fallen', 22, 4.2, 0.4],
  ['H_HAN', 'cone', 31.6, 2.2, 0], ['S_URA', 'cone', 40, 1.2, 0], ['S_URA', 'street-lamp', 46.4, 0.6, Math.PI], ['S_URA', 'street-lamp', 34, 12.4, 0],
  ['S_ODORI', 'street-lamp', 50, 5.6, Math.PI], ['S_ODORI', 'street-lamp', 62, -3.6, 0], ['S_ODORI', 'cone', 68, 4.4, 0], ['S_ODORI', 'pole', 56, 5.6, 0],
  ['S_MART', 'barricade', 62, 6.6, 0], ['S_SHOTEN', 'street-lamp', 54, 16.4, 0], ['S_SHOTEN', 'street-lamp', 76, 16.4, 0], ['S_SHOTEN', 'cone', 81.8, 17, 0],
  ['S_HIROBA', 'sandbags', 94, 10, Math.PI / 2], ['S_HIROBA', 'street-lamp', 84, 7, 0], ['S_HIROBA', 'cone', 87, 20, 0],
  ['P_LOBBY', 'sandbags', 96.2, 10, -Math.PI / 2], ['P_URA', 'street-lamp', 128.4, 11, -Math.PI / 2], ['O_PLAZA', 'street-lamp', 130, 23, 0], ['O_PLAZA', 'cone', 136, 16, 0],
  ['O_OFF', 'collapsed-shelf', 142.4, 8, 0],
];
// the loot lying in the world: the parts that exist for it
const LOOT_PART = { pistol: 'pistol', shotgun: 'shotgun', medkit: 'medkit', aidkit: 'medkit', p9: 'ammo-9mm', shell: 'ammo-12g' };

export default async function dotLayer(ext, { manifest, data }) {
  document.documentElement.dataset.dot = 'fps';
  installPhotoHooks();
  const D = window.__dot = { timings: {}, furniture: [], props: [], stations: [], loot: 0 };
  const t0 = performance.now();
  const index = await fetch(AT('assets/stacks/index.json')).then((r) => r.json()).catch(() => ({}));
  const px = Object.fromEntries(await Promise.all(Object.keys(index).map(async (k) => [k, await loadPixels(AT(`assets/stacks/${k}.png`))])));
  D.timings.load = Math.round(performance.now() - t0);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); mat.name = 'dot-stack';
  const geo = new Map();
  const cgeo = (k) => {
    if (!geo.has(k)) {
      const s = index[k], g = buildStackGeometry(THREE, stripVolume(px[k], s.w, s.d, s.n, 0), { mpp: s.mpp });
      g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox();
      geo.set(k, g);
    }
    return geo.get(k);
  };
  const part = (k, s = 1) => { const m = new THREE.Mesh(cgeo(k), mat); m.name = `dot-part:${k}`; m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true; return m; };
  // a part filling a box (its long side along the box's long side), front toward `face`
  function fit(k, box, face = 0, o = {}) {
    const g = cgeo(k), gs = g.boundingBox.getSize(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const longX = gs.x >= gs.z, boxLongX = size.x >= size.z;
    const yaw = face + (longX === boxLongX ? 0 : Math.PI / 2);
    const q = Math.abs(Math.sin(yaw)) > 0.5, bw = q ? size.z : size.x, bd = q ? size.x : size.z;
    const s = Math.min(bw / gs.x, bd / gs.z) * (o.k || 1);
    const sy = o.exactY ? size.y / gs.y : Math.min(s * 1.15, Math.max(s, (o.hmax || 9) / gs.y));
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    m.scale.set(Math.min(bw / gs.x, s * 1.2), o.free ? s : sy, Math.min(bd / gs.z, s * 1.2)); m.rotation.y = yaw; m.position.set(c.x, box.min.y, c.z); m.name = `dot-stack:${k}`;
    return m;
  }

  ext.registerBoot('dot-pictures', async (ctx, report) => {
    const t = performance.now();
    const names = [...new Set(JSON.stringify(data).match(/assets\/photos\/[\w.-]+\.webp/g) || [])].map((s) => s.slice(14));
    names.push(...['title.webp', 'death.webp'].filter((n) => !names.includes(n)));
    D.photos = await preparePhotos(names, (k) => report(k, `ドット絵を準備中… ${Math.round(k * 100)}%`));
    D.timings.pictures = Math.round(performance.now() - t);
  });

  // systems are registered before the game starts; the world's own update is filled in at game:ready
  let worldUpdate = null;
  ext.registerSystem('dot-world', { update(dt) { if (worldUpdate) worldUpdate(dt); } });
  const PAL = palette(YK_PALETTE);
  D.palette = PAL;
  ext.on('game:ready', (ctx) => {
    const t = performance.now(), W = ctx.world, scene = ctx.scene, plan = ctx.data.plan;
    const roomOf = (id) => plan.rooms.find((r) => r.id === id) || {};
    const fy = (room) => W.floorY(roomOf(room).floor || 0);
    // ---- the plan's furniture (the kit's recipes build it a moment after game:ready) ----
    const dress = (tries = 0) => {
      const ready = plan.furniture.some((f) => ctx.recipes && ctx.recipes.props && ctx.recipes.props.get(f.id));
      if (!ready && tries < 200) { setTimeout(() => dress(tries + 1), 50); return; }
      for (const f of plan.furniture) {
        const obj = (ctx.recipes && ctx.recipes.props && ctx.recipes.props.get(f.id)) || W.group.getObjectByName(`prop:${f.id}`);
        const k = FURN_ID[f.id] || FURN[f.kind];
        if (!obj || !k || !index[k]) { D.furniture.push({ id: f.id, skipped: !obj ? 'no object' : 'no part' }); continue; }
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) continue;
        obj.traverse((x) => { if (x.isMesh) x.visible = false; });
        const face = ((f.rot || 0) * Math.PI) / 180;
        const vehicle = /car|bus|ambulance/.test(k);
        const m = fit(k, box, face, { exactY: /desk|bed|bench|counter|table/.test(k), hmax: vehicle ? 4 : (box.max.y - box.min.y) * 1.05, free: vehicle });
        W.group.add(m);
        D.furniture.push({ id: f.id, k });
      }
      if (ctx.pixelStyle) ctx.pixelStyle.sweep();
      D.timings.furniture = Math.round(performance.now() - t);
    };
    dress();
    // ---- the stations' own things ----
    const swaps = [];
    const lamps = [];
    for (const [sid, spec] of Object.entries(STATION_PART)) {
      const st = plan.stations.find((s) => s.id === sid); const S = typeof spec === 'string' ? { k: spec } : spec;
      if (!st || !index[S.k]) continue;
      const R = roomOf(st.room), mnt = STATION_MOUNT[sid] || {};
      // the part stands at the station, its back toward the nearest wall
      const dl = st.x - R.x, dr = R.x + R.w - st.x, dt = st.z - R.z, db = R.z + R.d - st.z, mn = Math.min(dl, dr, dt, db);
      const face = mn === dt ? 0 : mn === db ? Math.PI : mn === dl ? Math.PI / 2 : -Math.PI / 2;
      const m = part(S.k); m.rotation.y = face;
      const back = mnt.back || 0; m.position.set(st.x - Math.sin(face) * back, fy(st.room) + (mnt.y || 0), st.z - Math.cos(face) * back);
      W.group.add(m); D.stations.push([sid, S.k]);
      const old = W.group.getObjectByName(`stlook:${sid}`); if (old) old.traverse((x) => { if (x.isMesh) x.visible = false; });
      if (S.after) swaps.push({ m, after: S.after });
    }
    // ---- the mood props ----
    for (const [room, k, x, z, face = 0, s = 1] of PROPS) {
      if (!index[k]) { D.props.push([k, 'missing']); continue; }
      const m = part(k, s); m.rotation.y = face; m.position.set(x, fy(room), z); W.group.add(m); D.props.push([k, room]);
      if (k === 'street-lamp') lamps.push(new THREE.Vector3(x, fy(room) + 4.2, z));
    }
    // the street lamps that still burn: three sodium lights follow the three lamps nearest the player (cheap on a phone)
    const lampLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa850, 0, 16, 1.2); l.name = 'dot-street-lamp'; scene.add(l); return l; });
    D.lamps = lamps.length;
    // ---- the helicopter: it comes down onto the pad when the last stand is over ----
    let heli = null;
    if (index.helicopter) { heli = part('helicopter'); heli.position.set(136, W.floorY(4) + 40, 6); heli.rotation.y = Math.PI / 2; heli.visible = false; W.group.add(heli); D.heli = heli; }
    // ---- the loot: a part where one exists ----
    const dressLoot = ({ mesh, def }) => {
      const k = LOOT_PART[def.item]; if (!k || !index[k] || mesh.userData.dotDone) return;
      mesh.userData.dotDone = true; if (mesh.userData.model) mesh.userData.model.visible = false;
      const m = part(k, 1); mesh.add(m); D.loot++;
    };
    const G = window.__yk;
    if (G) { G.on('loot:placed', dressLoot); for (const o of W.interactables) if (String(o.name).startsWith('loot:')) dressLoot({ mesh: o, def: o.userData.def }); }
    // ---- the palette over everything, and again while the world changes (doors, the dressing above) ----
    const dotify = () => dotifyScene(THREE, scene, { pal: PAL });
    D.dotified = dotify();
    setInterval(() => { try { dotify(); } catch (e) { /* the next pass */ } }, 2000);
    // ---- light: never pure black, a small light round the player, the next goal glows ----
    const amb = new THREE.AmbientLight(0x2a3440, 0.6); amb.name = 'dot-floor-light'; scene.add(amb);
    const near = new THREE.PointLight(0xd0d8e0, 3, 7, 1.4); near.name = 'dot-near-light'; scene.add(near);
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 7) { g.fillStyle = d < 3 ? '#fff4c8' : d < 5 ? '#f2c66a' : '#a8742a'; g.fillRect(x, y, 1, 1); } }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, fog: false })); beacon.scale.setScalar(0.22); beacon.name = 'dot-goal-beacon'; beacon.visible = false; scene.add(beacon);
    const goalLight = new THREE.PointLight(0xffd890, 0, 3.2, 1.5); goalLight.name = 'dot-goal-light'; scene.add(goalLight);
    let T = 0, goalT = 0, goal = null, blockT = 0, lightWant = null;
    const DAWN = new THREE.Color(0x6a4a52);
    // the helipad: a painted H in a circle on the roof (a pixel decal)
    {
      const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 48; const q = cv2.getContext('2d');
      q.fillStyle = '#e8d8a0'; for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const d = Math.hypot(x - 23.5, y - 23.5); if (d > 19 && d < 22) q.fillRect(x, y, 1, 1); }
      q.fillRect(15, 13, 4, 22); q.fillRect(29, 13, 4, 22); q.fillRect(15, 22, 18, 4);
      const tx = new THREE.CanvasTexture(cv2); tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshLambertMaterial({ map: tx, transparent: true, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(137, W.floorY(4) + 0.02, 6.5); pad.name = 'dot-helipad'; W.group.add(pad);
    }
    const LIGHT = { hospital: { c: new THREE.Color(0x3a5058), i: 0.8 }, street: { c: new THREE.Color(0xd08a4a), i: 1.25 }, police: { c: new THREE.Color(0x3a4a78), i: 0.95 },
      tower: { c: new THREE.Color(0x4a5460), i: 0.9 }, roof: { c: new THREE.Color(0xb07a80), i: 1.4 } };
    const goalPos = () => {
      const tk = ctx.nextTask && ctx.nextTask(); if (!tk) return null;
      const m = tk.station ? W.interactables.find((o) => o.name === `station:${tk.station}` && o.visible !== false) : null;
      return m ? m.getWorldPosition(new THREE.Vector3()) : null;
    };
    worldUpdate = (dt) => {
        T += dt;
        const c = ctx.camera.position; near.position.set(c.x, c.y - 0.2, c.z); near.intensity = ctx.lightOn === false ? 1 : 3;
        // the floor of light by block: outside, the sodium lamps and the fires light the street; the roof is the coming dawn
        blockT -= dt;
        if (blockT <= 0) {
          blockT = 0.5;
          const G = window.__yk, r = G && G.roomAtP ? G.roomAtP(c.x, c.z, ctx.floor || 0) : null, id = (r && r.id) || '';
          const want = /^O_ROOF/.test(id) ? LIGHT.roof : /^(S_URA|S_ODORI|S_SHOTEN|S_HIROBA|O_PLAZA|P_URA)$/.test(id) ? LIGHT.street : /^S_/.test(id) ? LIGHT.tower : /^P_/.test(id) ? LIGHT.police : /^O_/.test(id) ? LIGHT.tower : LIGHT.hospital;
          lightWant = want;
          // the roof is open to the sky: the dawn shows behind it (the stage look keeps the night elsewhere)
          if (want === LIGHT.roof) { scene.background = DAWN; if (scene.fog) scene.fog.color.copy(DAWN); }
          else if (scene.background === DAWN) { scene.background = null; ctx.stageLook && ctx.stageLook.apply(); }
        }
        if (lamps.length && blockT >= 0.49) {
          const near3 = lamps.map((v) => [v, v.distanceToSquared(c)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
          lampLights.forEach((l, i) => { const n = near3[i]; if (n && n[1] < 30 * 30 && (ctx.floor || 0) === 0) { l.position.copy(n[0]); l.intensity = 22; } else l.intensity = 0; });
        }
        if (lightWant) { amb.color.lerp(lightWant.c, Math.min(1, dt * 2)); amb.intensity += (lightWant.i - amb.intensity) * Math.min(1, dt * 2); }
        goalT -= dt; if (goalT <= 0) { goalT = 0.5; goal = ctx.state.started ? goalPos() : null; }
        const gd = goal ? c.distanceTo(goal) : 99, on = gd < 14;
        beacon.visible = on && gd > 1.8; goalLight.intensity = on ? 4 + Math.sin(T * 3) * 1.2 : 0;
        if (on) { beacon.position.set(goal.x, goal.y + 0.55 + Math.sin(T * 2.5) * 0.05, goal.z); goalLight.position.set(goal.x, goal.y + 0.4, goal.z); }
        for (const s of swaps) for (const [task, k] of s.after) if (!s.done && ctx.state.tasks.includes(task)) { const kk = typeof k === 'function' ? k() : k; if (index[kk]) s.m.geometry = cgeo(kk); s.done = true; }
        // the helicopter: seen coming once the timer of the last stand runs low, landed when it is over
        if (heli) {
          const tm = ctx.timer && ctx.timer('T_HOLD'), done = ctx.state.tasks.includes('T_HOLD');
          if (done) { heli.visible = true; heli.position.y += (W.floorY(4) + 0.05 - heli.position.y) * Math.min(1, dt * 1.5); }
          else if (tm && tm.left < 25 && ctx.floor === 4) { heli.visible = true; heli.position.y = W.floorY(4) + 6 + tm.left * 1.4; }
        }
    };
    D.timings.dress = Math.round(performance.now() - t);
  });
}
