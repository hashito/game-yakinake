// 1.9.0 (2026-11-27 #10 「病院でも他に道があったりするのに崩れて進めない感じで広がりを見せて」, #11 「家屋の設計を持ってきて流用して…広がりを作って」):
//   - the hospital's other ways, fallen in: the stair hall at the west end of the ward corridor (the stairs to the upper wards under the
//     ceiling that came down, a red emergency light through the gap above), the link corridor to the east ward (a wall of rubble the height
//     of a chest: over it the far corridor, and someone standing in it), the outpatient wing seen through the glass door of the loading bay
//     (its corridor filled to the ceiling). Each pile is cubes of concrete, tile and plaster with bent rebar, a dark hole in the ceiling over
//     it with cables hanging, and it stops the player, the zombies and the rounds (a collider and a solid mesh).
//   - the front of 佐竹工務店 on the street (the plan's lift door D_SATAKE): a lattice door with the shop's sign, and its inside face in the 土間.
import * as THREE from 'three';

// x0..x1, z0..z1 the footprint; h the height at its high side; high: which side is highest ('z0' | 'z1' | 'flat')
export const RUBBLE = [
  { id: 'kaidan', room: 'H_KAIDAN', x0: -4, x1: 0, z0: 4, z1: 6.9, h: 2.5, high: 'z0', glow: [-2.2, 2.45, 4.4] },
  { id: 'watari', room: 'H_WATARI', x0: 8.2, x1: 10.6, z0: -6.6, z1: -4.8, h: 1.45, high: 'flat' },
  { id: 'gairai', room: 'H_GAIRAI', x0: 30.6, x1: 33, z0: -9, z1: -0.9, h: 2.5, high: 'z0', glow: [31.8, 2.35, -6.5], scatter: [30.8, 32.8, -0.9, -0.15] },
];
const CONCRETE = [0x8d8a84, 0x77746e, 0xa19d94, 0x5f5c57, 0x6c6a64, 0xb4b0a6];
const TILE = [0xd8d8d0, 0xc9cbc4, 0xe4e2da];
const REBAR = 0x6a3a22;

export function installPlaces(ext, G) {
  let ctx = null;
  const rnd = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  function ceilY(room) {
    const c = ctx.world.group.getObjectByName(`ceil:${room}`);
    if (c) { const b = new THREE.Box3().setFromObject(c); if (isFinite(b.min.y)) return b.min.y; }
    return ctx.world.floorY(0) + 2.7;
  }
  function buildRubble() {
    const phone = !!ctx.isTouch, all = [];
    for (const R of RUBBLE) {
      const r = rnd(R.id.length * 7919 + 17), fy = ctx.world.floorY(0), cy = ceilY(R.room);
      const W = R.x1 - R.x0, D = R.z1 - R.z0, area = W * D;
      const n = Math.min(phone ? 220 : 420, Math.round(area * R.h * (phone ? 30 : 55)));
      const top = (x, z) => {
        const t = R.high === 'z0' ? 1 - (z - R.z0) / D : R.high === 'z1' ? (z - R.z0) / D : 1;
        const edge = Math.min(1, Math.min(x - R.x0, R.x1 - x) / 0.5 + 0.35);
        return Math.max(0.2, R.h * (0.35 + 0.65 * t) * (R.high === 'flat' ? 0.8 + 0.2 * Math.sin(x * 5.1) * Math.cos(z * 3.7) : 1) * Math.min(1, edge));
      };
      for (let i = 0; i < n; i++) {
        const x = R.x0 + 0.1 + r() * (W - 0.2), z = R.z0 + 0.1 + r() * (D - 0.2), hm = Math.min(cy - fy - 0.05, top(x, z));
        const s = 0.07 + r() ** 1.6 * 0.34, y = fy + Math.min(hm - s * 0.4, r() ** 0.6 * hm);
        const col = r() < 0.18 ? TILE[(r() * TILE.length) | 0] : CONCRETE[(r() * CONCRETE.length) | 0];
        const slab = r() < 0.3;   // some flat broken slabs of the ceiling among the lumps
        all.push({ p: [x, y + s * 0.3, z], s: slab ? [s * 2.2, s * 0.22, s * 1.6] : [s * (0.7 + r() * 0.8), s * (0.45 + r() * 0.6), s * (0.7 + r() * 0.8)], r: [(r() - 0.5) * 1.4, r() * 3.1, (r() - 0.5) * 1.4], c: col });
      }
      if (R.scatter) for (let i = 0; i < (phone ? 14 : 26); i++) {   // small bits on the floor in front of it
        const [a0, a1, b0, b1] = R.scatter, s = 0.05 + r() * 0.12;
        all.push({ p: [a0 + r() * (a1 - a0), fy + s * 0.25, b0 + r() * (b1 - b0)], s: [s, s * 0.45, s * (0.8 + r() * 0.6)], r: [0, r() * 3.1, 0], c: CONCRETE[(r() * CONCRETE.length) | 0] });
      }
      for (let i = 0; i < 7; i++) {   // bent rebar sticking out
        const x = R.x0 + 0.3 + r() * (W - 0.6), z = R.z0 + 0.2 + r() * (D - 0.4), y = fy + top(x, z) * (0.5 + r() * 0.5), L = 0.5 + r() * 0.9;
        all.push({ p: [x, y, z], s: [0.025, L, 0.025], r: [(r() - 0.5) * 1.6, r() * 3.1, (r() - 0.5) * 1.6], c: REBAR });
      }
      // the collider (the player and the zombies), a little inside the pile so it reads as touching it
      ctx.world.colliders.push({ box: new THREE.Box3(new THREE.Vector3(R.x0, fy, R.z0), new THREE.Vector3(R.x1, fy + Math.min(cy - fy, R.h + 0.6), R.z1)), off: false });
      // the hole in the ceiling over it, and cables down from it
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, D * 0.7), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      hole.rotation.x = Math.PI / 2; hole.position.set((R.x0 + R.x1) / 2, cy - 0.015, (R.z0 + R.z1) / 2 + (R.high === 'z0' ? -D * 0.1 : 0)); hole.name = `rubble-hole:${R.id}`;
      ctx.world.group.add(hole);
      const cab = new THREE.MeshBasicMaterial({ color: 0x141414 });
      for (let i = 0; i < 3; i++) { const L = 0.4 + r() * 0.7, c = new THREE.Mesh(new THREE.BoxGeometry(0.018, L, 0.018), cab); c.position.set(R.x0 + W * (0.25 + r() * 0.5), cy - L / 2, R.z0 + D * (0.3 + r() * 0.4)); c.rotation.z = (r() - 0.5) * 0.4; c.name = `rubble-cable:${R.id}`; ctx.world.group.add(c); }
      if (R.glow) {   // a red emergency light through the gap (the floor above)
        const m = new THREE.SpriteMaterial({ color: 0xff3020, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        const s = new THREE.Sprite(m); s.scale.set(0.35, 0.35, 1); s.position.set(...R.glow); s.name = `rubble-glow:${R.id}`; s.raycast = () => {};
        ctx.world.group.add(s); glows.push(s);
      }
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), all.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    all.forEach((b, i) => { q.setFromEuler(e.set(...b.r)); m4.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c.setHex(b.c)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'rubble:hospital'; mesh.material.name = 'rubble'; mesh.userData.dot = 'prop';
    mesh.computeBoundingSphere(); mesh.computeBoundingBox && mesh.computeBoundingBox();
    ctx.world.group.add(mesh);
    G.rubbleStats = () => ({ cubes: all.length, piles: RUBBLE.length });
  }
  const glows = [];
  // the shop front: a lattice door (paper behind dark wood bars) and the sign over it, on both ends of the lift door
  function latticeTex(sign) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#3a2a1c'; for (let x = 0; x <= 128; x += 16) g.fillRect(x - 2, 0, 4, 256); for (let y = 0; y <= 256; y += 32) g.fillRect(0, y - 2, 128, 4);
    g.fillRect(0, 0, 128, 10); g.fillRect(0, 246, 128, 10); g.fillRect(0, 0, 8, 256); g.fillRect(120, 0, 8, 256); g.fillRect(60, 0, 8, 256);
    if (sign) { g.fillStyle = 'rgba(40,20,10,0.55)'; g.fillRect(14, 96, 100, 64); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
  }
  function signTex() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#2a1e14'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#8a6a3a'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 112);
    g.fillStyle = '#f4e8c8'; g.font = 'bold 84px "Noto Sans JP", "Yu Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('佐竹工務店', 256, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.userData.dot = true; return t;
  }
  function dressShopFront() {
    const doorM = new THREE.MeshLambertMaterial({ map: latticeTex(false) }); doorM.name = 'satake-door';
    for (const k of ['a', 'b']) {
      const m = ctx.world.group.getObjectByName(`stairs:D_SATAKE:${k}`); if (!m) continue;
      m.material = doorM;
      if (k === 'a') {
        // a signboard sitting on the top of the door frame (P47: it rests on it), the name on its front only (drawn in the palette: P33)
        const face = new THREE.MeshBasicMaterial({ map: signTex() }), edge = new THREE.MeshLambertMaterial({ color: 0x2a1e14 });
        face.userData.dot = 'ui'; edge.userData.dot = 'flat';
        const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.06), [edge, edge, edge, edge, face, edge]);
        sign.position.copy(m.position).add(new THREE.Vector3(0, 1.0 + 0.275 + 0.004, 0.27)); sign.name = 'satake-sign'; sign.raycast = () => {};
        ctx.world.group.add(sign);
      }
    }
  }
  // a station whose person is gone (佐竹 once he has turned): no longer picked, nothing to talk to
  G.hideStation = (sid) => {
    if (!ctx || !sid) return;
    const W = ctx.world;
    for (let i = W.interactables.length - 1; i >= 0; i--) { const o = W.interactables[i], it = o.userData && o.userData.interact; if (it && it.kind === 'station' && it.id === sid) { W.interactables.splice(i, 1); o.visible = false; } }
  };
  ext.on('game:ready', (c) => {
    ctx = c;
    try { buildRubble(); } catch (e) { console.warn('[yakinake] rubble', e); }
    try { dressShopFront(); } catch (e) { console.warn('[yakinake] shop front', e); }
  });
  let t = 0;
  ext.registerSystem('yk-places', { update(dt) { t += dt || 0; const k = 0.55 + 0.25 * Math.sin(t * 2.3) + (Math.sin(t * 17) > 0.96 ? -0.4 : 0); for (const s of glows) s.material.opacity = Math.max(0.15, k); } });
}
