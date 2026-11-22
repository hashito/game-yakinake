/* game-kit a4da8f61: js/hide-looks.js — edit in game-kit and run tools/kit-sync.js */
// Hiding places you can see (standard 1.10.13, rule G7 "隠れる場所は、見て隠れ場所と分かる物にする"; feedback 2026-11-03 出口はこちらです
// 「棚の隙間に隠れるの分かりづらい。ロッカーとかおいて」). plan.hides[i].look builds the thing at the hide spot (x, z = its centre):
//   'locker'   a grey steel locker, a louvre at eye height to peek through (offices, stations, schools, plant rooms)
//   'cabinet'  a tall painted wooden cupboard, dull green so it stands out from plank walls (sheds, huts, old houses)
//   'oshiire'  a Japanese closet: a recess in the wall with two fusuma (bedrooms, tatami rooms)
// Its back goes to the nearest wall of the room (h.yaw overrides: 0 = the front faces +z). The sides and the back are solid (colliders).
// 1.37.0 (水無瀬病院 2026-11-22 #7 「ロッカーの中が壁と同じ色」「ロッカーは基本締めておいて」): a locker / cabinet stands shut; its door swings
// open as you step in and shuts behind you, and again as you come out (monster-std: setShut, the front collider while shut). Inside it is
// its own dark metal (a lining, a hat shelf, coat hooks, air slits) - never the wall's colour; the steel is named 'metal' so a dot game draws
// it as a metal tile (js/dot-world.js tileKindOf). h.open: true keeps the old door standing open.
import * as THREE from 'three';

/** the wall nearest to (x, z) in a room { x, z, w, d }: its side and the yaw that turns a front (+z) away from it */
export function nearestWallYaw(room, x, z) {
  const c = [['w', x - room.x, Math.PI / 2], ['e', room.x + room.w - x, -Math.PI / 2], ['n', z - room.z, 0], ['s', room.z + room.d - z, Math.PI]];
  c.sort((a, b) => a[1] - b[1]);
  return { side: c[0][0], dist: c[0][1], yaw: c[0][2] };
}

const mats = {};
const mat = (k, o) => (mats[k] ||= Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide, ...o }), { name: k }));   // named: a dot game picks its tile family by the name

/** the look of one hide: { group, solids: [meshes with colliders], setShut(k 0..1) } (k 1 = shut) */
export function buildHideLook(h, room) {
  const kind = h.look, g = new THREE.Group(); g.name = `hidelook:${h.id}`;
  const box = (host, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; host.add(b); return b; };
  const solids = [];
  let setShut = () => {}, front = null;
  if (kind === 'locker' || kind === 'cabinet') {
    const body = kind === 'locker' ? mat('locker-metal', { color: 0x5f6f78, metalness: 0.45, roughness: 0.5, side: THREE.FrontSide }) : mat('cabinet', { color: 0x55654f, roughness: 0.7, side: THREE.FrontSide });
    const handle = mat('handle-metal', { color: 0x2a2b2b, metalness: 0.6 });
    const inner = kind === 'locker' ? mat('locker-metal-inside', { color: 0x22282a, metalness: 0.5, roughness: 0.65 }) : mat('cabinet-inside', { color: 0x262019, roughness: 0.85 });
    const hook = mat('hook-metal', { color: 0x8a8c86, metalness: 0.8, roughness: 0.35 });
    solids.push(box(g, 0.92, 1.95, 0.03, 0, 0.975, -0.31, body), box(g, 0.03, 1.95, 0.64, -0.46, 0.975, 0, body), box(g, 0.03, 1.95, 0.64, 0.46, 0.975, 0, body));
    box(g, 0.92, 0.03, 0.64, 0, 1.965, 0, body); box(g, 0.92, 0.08, 0.64, 0, 0.04, 0, body);
    // the inside: a dark lining on the back and both sides, a hat shelf, two coat hooks under it, air slits in the back
    box(g, 0.86, 1.86, 0.01, 0, 0.98, -0.29, inner); for (const s of [-1, 1]) box(g, 0.01, 1.86, 0.6, s * 0.44, 0.98, 0.01, inner);
    box(g, 0.86, 0.015, 0.6, 0, 0.09, 0.01, inner); box(g, 0.86, 0.02, 0.4, 0, 1.68, -0.08, inner);
    for (const x of [-0.2, 0.2]) { box(g, 0.02, 0.02, 0.07, x, 1.6, -0.25, hook); box(g, 0.02, 0.05, 0.02, x, 1.62, -0.215, hook); }
    for (let i = 0; i < 5; i++) box(g, 0.3, 0.012, 0.006, 0, 1.25 + i * 0.05, -0.283, mat('slit', { color: 0x050606, roughness: 1 }));
    // the door, hinged on the right: solid below and above, a louvre inset in the door at 1.44..1.76 m (a frame on both sides; you see
    // out between the slats, which stop short of the door's edges)
    const door = new THREE.Group(); door.position.set(0.45, 0, 0.32); g.add(door);
    for (const [sy, y] of [[1.4, 0.74], [0.18, 1.85]]) box(door, 0.88, sy, 0.025, -0.44, y, 0, body);
    for (const x of [-0.06, -0.82]) box(door, 0.12, 0.32, 0.025, x, 1.6, 0, body);
    for (let i = 0; i < 4; i++) box(door, 0.64, 0.035, 0.02, -0.44, 1.49 + i * 0.075, -0.004, body);
    box(door, 0.03, 0.16, 0.04, -0.8, 1.05, 0.03, handle);
    setShut = (k) => { door.rotation.y = (1 - k) * 1.9; };
    front = box(g, 0.9, 1.9, 0.03, 0, 0.95, 0.32, mat('hidden-front', { visible: false }));   // the collider of the shut door (monster-std)
  } else if (kind === 'oshiire') {
    const frame = mat('oshiire-frame', { color: 0x3e2c1e, roughness: 0.8 }), paper = mat('oshiire-paper', { color: 0xd9cfb4, roughness: 0.9 }), inner = mat('oshiire-in', { color: 0x4a3c2c, roughness: 0.9 });
    solids.push(box(g, 1.7, 1.85, 0.03, 0, 0.925, -0.42, inner), box(g, 0.05, 1.85, 0.86, -0.85, 0.925, 0, frame), box(g, 0.05, 1.85, 0.86, 0.85, 0.925, 0, frame));
    box(g, 1.75, 0.06, 0.86, 0, 1.88, 0, frame); box(g, 1.7, 0.04, 0.86, 0, 0.02, 0, inner);   // no middle shelf (中段): you step in and stand (standard 1.18.0, 鏡屋 #7 「間で２段にきれているので入りづらい」)
    // two fusuma on their tracks; open = the right one slid behind the left, shut = side by side with a finger gap between
    const leaves = [-1, 1].map((s) => { const f = new THREE.Group(); f.position.set(s * 0.42, 0, 0.4 + (s > 0 ? 0.03 : 0)); g.add(f); box(f, 0.84, 1.8, 0.025, 0, 0.92, 0, paper); for (const x of [-0.4, 0.4]) box(f, 0.03, 1.8, 0.03, x, 0.92, 0, frame); box(f, 0.05, 0.05, 0.01, s * -0.3, 0.95, 0.015, frame); return f; });
    setShut = (k) => { leaves[1].position.x = 0.44 - (1 - k) * 0.84; };   // shut: a 2 cm gap at the middle to peek through
  } else return null;
  const yaw = h.yaw ?? (room ? nearestWallYaw(room, h.x, h.z).yaw : 0);
  g.rotation.y = yaw; g.position.set(h.x, 0, h.z);
  const rest = h.open || kind === 'oshiire' ? 0 : 1;   // a locker / cabinet stands shut (1.36.0); an oshiire keeps its open fusuma
  setShut(rest);
  return { group: g, solids, setShut, front, rest };
}
