// 1.7.0: what a round and a broken body leave on the world.
//  #5 「中で壁やガラスを打つと弾のあとが残るように」: a round that reaches a wall, a door, the floor or a piece of furniture leaves a hole there - a dark
//     pixel pit with a pale chipped ring (a 16 px hard-pixel tile), stuck to what it hit (it moves with a sliding door). A round through a glass
//     pane leaves a star of cracks on the pane and flies on. Pooled: the oldest hole is reused (PC 64 holes and 24 cracks, a phone 32 and 12).
//  #4 「ゾンビの部分を破壊した時ピクセル単位で飛び散って壁とかに付く」: when a part comes off (a severed arm, a burst head, a bloated one bursting) it
//     throws little cubes of itself - flesh, blood, bone, cloth, one dot each (2.5 cm) - that fly, strike the wall or the floor and stick there
//     (flattened against it, with a small splat). One instanced mesh for all of them (PC 900, a phone 360; the oldest cube is reused), each
//     cube's flight is one ray at the throw (where along its path it meets a wall) and the floor, never a ray per frame.
// The blood setting decides: off - no cubes (the holes stay, they are not blood); low - a third of the cubes and no splats.
import * as THREE from 'three';

function holeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const px = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const d = Math.hypot(i - 7.5, j - 7.5), n = ((i * 7 + j * 13) % 5) / 5;
    if (d < 2.2) px(i, j, 'rgba(8,6,6,1)');
    else if (d < 3.4) px(i, j, 'rgba(30,26,24,0.95)');
    else if (d < 5.2 + n * 1.4) px(i, j, n > 0.5 ? 'rgba(150,140,126,0.7)' : 'rgba(96,88,80,0.55)');
    else if (d < 7 && n > 0.7) px(i, j, 'rgba(70,64,58,0.45)');
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crackTex() {
  const S = 48, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = 'rgba(235,245,248,0.95)';
  const m = S / 2; let seed = 11; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 9; k++) {   // the rays of the star, one pixel wide, wandering a little
    let a = (k / 9) * Math.PI * 2 + r() * 0.4, px = m, py = m; const len = 12 + r() * 11;
    for (let s = 0; s < len; s++) { a += (r() - 0.5) * 0.35; px += Math.cos(a); py += Math.sin(a); x.fillRect(Math.round(px), Math.round(py), 1, 1); }
  }
  for (let ring = 0; ring < 2; ring++) {   // two broken rings round the hit
    const R = 6 + ring * 8;
    for (let s = 0; s < 40; s++) { if (r() < 0.45) continue; const a = (s / 40) * Math.PI * 2; x.fillRect(Math.round(m + Math.cos(a) * R), Math.round(m + Math.sin(a) * R), 1, 1); }
  }
  x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(m - 1, m - 1, 3, 3);
  x.fillStyle = 'rgba(20,24,26,0.9)'; x.fillRect(m, m, 1, 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function installImpacts(ext, G) {
  let ctx = null, holeM = null, crackM = null, plane = null, chunks = null;
  const holes = [], cracks = [];
  // 1.10.0 (2026-11-28 #1 「セーブはその断面をしっかり保存して」): every mark gets a serial; a save keeps the serial it was made at (SN is bumped,
  // and the blood marks laid so far are given it); going back to that save takes away every mark made after it - the holes, the cracks, the
  // cubes, the blood on the floor and walls. A new game takes them all away.
  let SN = 0;
  const touch = () => (ctx && ctx.isTouch) || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  const CAP = () => (touch() ? { holes: 32, cracks: 12, cubes: 360 } : { holes: 64, cracks: 24, cubes: 900 });
  // the glass panes of the doors (transparent, see-through: not in G.solidMeshes, a round goes through them)
  let glass = [], glassAt = -1e9;
  const glassMeshes = () => {
    const now = performance.now();
    if (now - glassAt > 2000 && ctx) {
      glassAt = now; glass = [];
      ctx.world.group.traverse((o) => { const m = o.material; if (o.isMesh && o.visible !== false && m && m.transparent && m.opacity < 0.5 && m.roughness != null && m.roughness < 0.2) glass.push(o); });
    }
    return glass;
  };
  const q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3();
  // a flat mark stuck to what it hit, oriented to the face
  function stick(pool, max, mat, size, obj, point, normal, off) {
    let m;
    if (pool.length >= max) { m = pool.shift(); m.removeFromParent(); } else { m = new THREE.Mesh(plane, mat); m.renderOrder = 2; m.name = 'yk-impact'; m.raycast = () => {}; }
    m.userData.sn = ++SN;
    nrm.copy(normal).normalize();
    m.position.copy(point).addScaledVector(nrm, off);
    m.quaternion.copy(q.setFromUnitVectors(zAxis, nrm));
    m.rotateZ(Math.floor(Math.random() * 4) * Math.PI / 2);
    m.scale.set(size, size, 1);
    ctx.scene.add(m);
    if (obj && obj.parent) { obj.updateMatrixWorld(true); obj.attach(m); }   // it moves with the door it is in
    m.matrixAutoUpdate = false; m.updateMatrix();
    pool.push(m);
    return m;
  }
  G.bulletHole = (obj, point, normal, size = 0.08) => { if (ctx && point && normal) return stick(holes, CAP().holes, holeM, size * (0.85 + Math.random() * 0.3), obj, point, normal, 0.004); };
  G.glassCrack = (obj, point, normal) => { if (ctx && point && normal) return stick(cracks, CAP().cracks, crackM, 0.2 + Math.random() * 0.1, obj, point, normal, 0.003); };
  G.impactStats = () => ({ holes: holes.length, cracks: cracks.length, cubes: chunks ? chunks.count() : 0, caps: CAP() });

  // ---------------------------------------------------------------- the cubes of a broken body
  function makeChunks() {
    const N = CAP().cubes;
    const geo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); mat.name = 'yk-chunk'; mat.userData.dot = 'fx';
    const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.name = 'yk-chunks'; mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color()); mesh.raycast = () => {};
    ctx.scene.add(mesh);
    const S = [];   // { p, v, t, hitT, hitP, hitN, floor, stuck, s, rot }
    let next = 0;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
    const ray = new THREE.Raycaster();
    const COLS = { blood: [0x5a0a0c, 0x7a1012, 0x4a0608], flesh: [0x8a5a50, 0x9c6e62, 0x6e4038], bone: [0xd8d0bc, 0xc4baa2], cloth: [0x40464e, 0x5a5048, 0x2e3238] };
    const tmpC = new THREE.Color();
    const write = (i) => {
      const s = S[i];
      if (s.gone) { M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); return; }
      SC.set(s.s * (s.flat ? 1.25 : 1), s.s * (s.flat ? 1.25 : 1), s.s * (s.flat ? 0.35 : 1));
      if (s.flat) Q.setFromUnitVectors(zAxis, s.n); else Q.setFromEuler(E.set(s.rot[0], s.rot[1], s.rot[2]));
      M.compose(P.set(s.p[0], s.p[1], s.p[2]), Q, SC); mesh.setMatrixAt(i, M);
    };
    const api = {
      count: () => S.filter((s) => !s.gone).length,
      burst(point, dir, n, o = {}) {
        if (G.gore === 'off' || !point) return;
        const solid = G.solidMeshes ? G.solidMeshes() : [];
        const k = G.gore === 'low' ? 0.35 : 1, count = Math.max(2, Math.round(n * k));
        const fl = o.floorY ?? (ctx.world.floorY(ctx.floor || 0));
        const d = dir || [0, 0, 1], dh = Math.hypot(d[0], d[2]) || 1;
        let splats = 0;
        for (let c = 0; c < count; c++) {
          const sp = o.speed || 3.2;
          const v = [d[0] / dh * sp * (0.5 + Math.random() * 0.8) + (Math.random() - 0.5) * sp, 0.6 + Math.random() * 2.6, d[2] / dh * sp * (0.5 + Math.random() * 0.8) + (Math.random() - 0.5) * sp];
          const kind = Math.random() < 0.42 ? 'blood' : Math.random() < 0.6 ? 'flesh' : o.cloth !== false && Math.random() < 0.6 ? 'cloth' : 'bone';
          const pal = COLS[kind]; tmpC.setHex(pal[Math.floor(Math.random() * pal.length)]);
          if (o.tint && kind === 'flesh') tmpC.multiply(o.tint);
          const s = { sn: ++SN, p: [point.x, point.y, point.z], v, t: 0, hitT: Infinity, hitP: null, n: new THREE.Vector3(0, 1, 0), floor: fl, flat: false, rest: false, s: 0.8 + Math.random() * 0.9, rot: [Math.random() * 6, Math.random() * 6, Math.random() * 6], kind };
          // where its flight (taken as a straight line for its first 0.45 s) meets a wall: it sticks there
          const hv = new THREE.Vector3(v[0], v[1] - 1.1, v[2]), len = hv.length() * 0.45;
          ray.set(new THREE.Vector3(...s.p), hv.clone().normalize()); ray.far = len;
          const h = ray.intersectObjects(solid, false)[0];
          if (h && h.face) { s.hitT = (h.distance / len) * 0.45; s.hitP = h.point.clone(); s.n.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (kind === 'blood' && splats < 2 && G.gore === 'full') { splats++; s.splat = true; } }
          const i = S.length < mesh.instanceMatrix.count ? S.length : (next = (next + 1) % mesh.instanceMatrix.count);
          S[i] = s; mesh.setColorAt(i, tmpC); write(i);
        }
        mesh.count = S.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        G.sfx3d && G.sfx3d('splat', point);
      },
      update(dt) {
        let moved = false;
        for (let i = 0; i < S.length; i++) {
          const s = S[i]; if (s.rest || s.gone) continue;
          s.t += dt; moved = true;
          if (s.t >= s.hitT) {   // against the wall: flattened onto it, a little blood splat for the first ones
            s.p = [s.hitP.x + s.n.x * 0.006, s.hitP.y + s.n.y * 0.006, s.hitP.z + s.n.z * 0.006]; s.flat = true; s.rest = true;
            if (s.splat && G.zfx && G.zfx.wallDecal && Math.abs(s.n.y) < 0.5) G.zfx.wallDecal(s.hitP, [s.n.x, s.n.y, s.n.z], 0.16 + Math.random() * 0.12);
            else if (s.splat && G.zfx && s.n.y > 0.5) G.zfx.decal([s.hitP.x, s.hitP.y, s.hitP.z], 0.14);
            write(i); continue;
          }
          s.v[1] -= 9.8 * dt;
          s.p[0] += s.v[0] * dt; s.p[1] += s.v[1] * dt; s.p[2] += s.v[2] * dt;
          s.rot[0] += dt * 9; s.rot[2] += dt * 7;
          if (s.p[1] <= s.floor + 0.004) { s.p[1] = s.floor + 0.004; s.flat = true; s.n.set(0, 1, 0); s.rest = true; }
          if (s.t > 3) s.rest = true;
          write(i);
        }
        if (moved) mesh.instanceMatrix.needsUpdate = true;
      },
      clear() { S.length = 0; mesh.count = 0; },
      rollback(mark) { for (let i = 0; i < S.length; i++) if (S[i] && !S[i].gone && S[i].sn > mark) { S[i].gone = true; S[i].rest = true; write(i); } mesh.instanceMatrix.needsUpdate = true; },
    };
    return api;
  }
  G.chunkBurst = (point, dir, n, o) => chunks && chunks.burst(point, dir, n, o);
  const decalList = () => (G.zfx && G.zfx.decals) || [];
  G.impactMark = () => { const m = ++SN; for (const d of decalList()) if (d.userData.sn == null) d.userData.sn = m; return m; };
  G.impactRollback = (mark) => {
    for (const pool of [holes, cracks]) for (let i = pool.length - 1; i >= 0; i--) if (!(pool[i].userData.sn <= mark)) { pool[i].removeFromParent(); pool.splice(i, 1); }
    if (chunks) { if (mark <= 0) chunks.clear(); else chunks.rollback(mark); }
    for (const d of decalList()) if (!(d.userData.sn <= mark)) { d.position.y = -9999; d.userData.grow = null; d.userData.sn = 0; d.userData.body = null; }   // a pooled mark: reused (and placed again) later
  };
  ext.registerPersist('yk-impacts', {
    serialize: () => ({ sn: G.impactMark() }),
    restore: (s) => { G.impactRollback((s && s.sn) || 0); },
  });

  ext.on('game:ready', (c) => {
    ctx = c;
    plane = new THREE.PlaneGeometry(1, 1);
    holeM = new THREE.MeshLambertMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); holeM.name = 'yk-hole'; holeM.userData.dot = 'fx';
    crackM = new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide }); crackM.name = 'yk-crack'; crackM.userData.dot = 'fx';
    chunks = makeChunks();
  });
  G.on('gore', (g) => { if (g === 'off' && chunks) chunks.clear(); });

  // a round's path (combat.js emits one per pellet): the panes it passes crack, the wall it stops in gets a hole
  const rc = new THREE.Raycaster();
  G.on('shot:ray', (e) => {
    if (!ctx) return;
    rc.ray.copy(e.ray); rc.far = e.stop;
    for (const h of rc.intersectObjects(glassMeshes(), false).slice(0, 2)) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.dot(e.ray.direction) > 0) n.negate();
      G.glassCrack(h.object, h.point, n); G.sfx3d('crack', h.point);
    }
    if (e.toWall && e.wallObj && e.wallNormal && e.wallPoint) {
      const n = e.wallNormal.clone(); if (n.dot(e.ray.direction) > 0) n.negate();
      G.bulletHole(e.wallObj, e.wallPoint, n, e.weapon === 'shotgun' ? 0.06 : e.weapon === 'rifle' ? 0.1 : e.weapon === 'nailgun' ? 0.05 : 0.08);
      if (G.zfx && G.zfx.flash) G.zfx.flash(e.wallPoint.clone().addScaledVector(n, 0.02), 0.6);
      G.sfx3d('chip', e.wallPoint);
    }
  });
  // a part that comes off throws its cubes (the head bursts wider; a bloated one bursting, most of all)
  G.on('zombie:sever', (e) => {
    if (!e.point) return;
    const p = e.point.isVector3 ? e.point : new THREE.Vector3(e.point[0], e.point[1], e.point[2]);
    const n = e.part === 'head' ? 34 : /pelvis|chest/.test(e.part || '') ? 30 : 20;
    G.chunkBurst(p, e.dir, n, { floorY: e.floorY, tint: e.tint, speed: e.part === 'head' ? 3.6 : 3 });
  });
  G.on('zombie:burst', (e) => { G.chunkBurst(e.point, [0, 0, 0], 70, { floorY: e.floorY, speed: 4.5 }); });

  ext.registerSystem('yk-impacts', { update(dt) { if (chunks && ctx && ctx.state.started) chunks.update(Math.min(dt, 0.05)); } });
}
