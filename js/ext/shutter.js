// 1.5.0 (play test 2026-11-23 「病院から出るときの巻き上げのオブジェクトがありません」): the loading bay's roll-up shutter and its hand crank.
// The plan's D_SHUT was drawn as a pair of swing doors and S_SHUTTER (シャッターの巻き上げ) as nothing at all. Now:
//   - a steel roll-up shutter in the opening: ribbed slats, a bottom bar, the guide rails and the drum's housing over it
//   - a wall gearbox with a crank handle at the station
//   - when T_SHUTTER is done the handle turns and the curtain rolls up into the housing, slat by slat, with its rattle; then the way is open
//   - a restored save shows it up (or down) at once
import * as THREE from 'three';

const DOOR = 'D_SHUT', STATION = 'S_SHUTTER', TASK = 'T_SHUTTER', ROLL_SEC = 2.6;

export function installShutter(ext, G) {
  let ctx = null, S = null;
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.35, flatShading: true, ...o });
  const box = (host, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; host.add(o); return o; };

  function build() {
    const W = ctx.world, d = W.doors && W.doors.get(DOOR); if (!d || !d.look) return null;
    const plan = ctx.data.plan, def = d.def, H = (plan.dims && plan.dims.doorH) || 2.05, w = def.width || 2.6;
    const root = new THREE.Group(); root.name = 'yk-shutter';
    root.position.copy(d.look.position); root.rotation.copy(d.look.rotation); d.look.parent.add(root);
    d.look.visible = false;   // the drawn swing doors go: the shutter is the door
    const steel = mat(0x6d7376), steelDark = mat(0x41474a), rust = mat(0x6a4a34, { metalness: 0.2 }), paint = mat(0x8a7a3a, { metalness: 0.2 });
    // the housing of the drum over the opening and the two guide rails
    box(root, steelDark, 0, H + 0.2, 0, w + 0.3, 0.42, 0.42);
    box(root, rust, 0, H + 0.02, 0.2, w + 0.3, 0.05, 0.03);
    for (const sx of [-1, 1]) { box(root, steelDark, sx * (w / 2 + 0.05), H / 2, 0, 0.1, H, 0.16); box(root, steel, sx * (w / 2 + 0.05), H / 2, 0, 0.04, H, 0.2); }
    // the curtain: slats of 10 cm, every other one a shade darker, a rust stain low down; the bottom bar with its handle
    const curtain = new THREE.Group(); curtain.name = 'yk-shutter-curtain'; root.add(curtain);
    const slats = [], n = Math.ceil(H / 0.1);
    for (let i = 0; i < n; i++) {
      const y = 0.06 + i * 0.1; if (y > H) break;
      const s = box(curtain, i % 2 ? steel : steelDark, 0, y, 0, w, 0.085, 0.05); s.userData.y0 = y; slats.push(s);
      if (i < 4 && i % 2 === 0) { const r = box(curtain, rust, -w * 0.18 + i * 0.07, y, 0, 0.5 - i * 0.08, 0.06, 0.056); r.userData.y0 = y; slats.push(r); }
    }
    const bar = box(curtain, paint, 0, 0.03, 0, w, 0.06, 0.08); bar.userData.y0 = 0.03; slats.push(bar);
    for (const f of [-1, 1]) { const hnd = box(curtain, steelDark, 0, 0.16, f * 0.05, 0.2, 0.04, 0.03); hnd.userData.y0 = 0.16; slats.push(hnd); }
    // the crank: a gearbox on the wall by the station, a turning arm with a handle
    const st = plan.stations.find((s) => s.id === STATION), crank = new THREE.Group(); crank.name = 'yk-shutter-crank';
    let arm = null;
    if (st) {
      const R = plan.rooms.find((r) => r.id === st.room), fy = W.floorY((R && R.floor) || 0);
      // the wall nearest the station (the room's edges)
      const ed = [[st.x - R.x, -Math.PI / 2, R.x, 'x'], [R.x + R.w - st.x, Math.PI / 2, R.x + R.w, 'x'], [st.z - R.z, Math.PI, R.z, 'z'], [R.z + R.d - st.z, 0, R.z + R.d, 'z']].sort((a, b) => a[0] - b[0])[0];
      const wallT = (plan.dims && plan.dims.wallT) || 0.15;
      crank.position.set(ed[3] === 'x' ? ed[2] - Math.sign(Math.sin(ed[1])) * (wallT / 2 + 0.06) : st.x, fy, ed[3] === 'z' ? ed[2] - Math.sign(Math.cos(ed[1])) * (wallT / 2 + 0.06) : st.z);
      crank.rotation.y = ed[1] + Math.PI;   // local +z faces into the room
      box(crank, paint, 0, 1.15, 0, 0.26, 0.34, 0.12);
      box(crank, steelDark, 0, 1.15, 0.07, 0.1, 0.1, 0.04);
      box(crank, steelDark, 0, 1.97, -0.02, 0.06, 1.3, 0.05);   // the chain case up to the drum
      arm = new THREE.Group(); arm.position.set(0, 1.15, 0.1); crank.add(arm);
      box(arm, steel, 0, -0.13, 0, 0.04, 0.3, 0.03);
      const grip = box(arm, mat(0x2a2a2a, { metalness: 0 }), 0, -0.27, 0.07, 0.05, 0.05, 0.14); grip.name = 'grip';
      for (const m of [crank]) m.traverse((o) => { if (o.isMesh) o.userData.npcOk = true; });
      crank.userData.hangs = true;   // bolted to the wall (tools/rest-check.mjs P47)
      d.look.parent.add(crank);
    }
    return { root, curtain, slats, arm, crank, H, d, u: 0, to: 0, spin: 0, clat: 0 };
  }
  // u = how far up (0 down, 1 in the housing): each slat climbs and is gone once it reaches the drum
  function pose(u) {
    if (!S) return;
    const lift = u * (S.H + 0.05);
    for (const s of S.slats) { const y = s.userData.y0 + lift; s.position.y = y; s.visible = y < S.H + 0.02; }
  }
  const isUp = () => !!(ctx && ctx.state && ctx.state.tasks && ctx.state.tasks.includes(TASK));
  // the way out opens with the curtain up (no [E] on a shutter that is already in its drum)
  const openWay = () => { const d = S && S.d; if (!d || d.isOpen) return; if (d.open()) { if (d.snap) d.snap(); if (!ctx.state.doors.includes(DOOR)) ctx.state.doors.push(DOOR); } };
  const sync = () => { if (!S) return; const up = isUp(); S.u = S.to = up ? 1 : 0; S.spin = 0; pose(S.u); if (up) openWay(); };

  ext.on('game:ready', (c) => {
    ctx = c;
    try { S = build(); } catch (e) { console.warn('[yakinake] shutter', e); S = null; }
    sync();
  });
  for (const ev of ['game:start', 'state:sync', 'player:respawn']) ext.on(ev, () => setTimeout(sync, 0));
  ext.on('task:done', ({ id }) => {
    if (id !== TASK || !S) return;
    S.to = 1; S.u = 0; S.spin = ROLL_SEC; pose(0);
    if (G.sfx3d) G.sfx3d('rattle', S.root.getWorldPosition(new THREE.Vector3()));
  });
  G.shutterState = () => (S ? { u: +S.u.toFixed(2), to: S.to, spin: +S.spin.toFixed(2), look: S.d.look.visible } : null);
  ext.registerSystem('yk-shutter', {
    update(dt) {
      if (!S) return;
      if (S.d.look.visible) S.d.look.visible = false;   // a later dressing pass must not bring the swing doors back
      if (S.spin > 0) {
        S.spin = Math.max(0, S.spin - dt);
        if (S.arm) S.arm.rotation.z -= dt * 7;
        S.u = Math.min(1, 1 - S.spin / ROLL_SEC); pose(S.u);
        S.clat -= dt; if (S.clat <= 0 && G.sfx3d) { S.clat = 0.55; G.sfx3d('rattle', S.root.getWorldPosition(new THREE.Vector3())); }
      } else if (S.u !== S.to) { S.u = S.to; pose(S.u); }
      if (S.to === 1 && S.spin === 0 && !S.d.isOpen && isUp()) openWay();
    },
  });
}
