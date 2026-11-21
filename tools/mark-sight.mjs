// P42 (standard 1.22.0): marks never show through walls. Page code: every visible sprite / mesh that is a mark (by name: mark, arrow, pointer,
// next-place, guide, beacon, ▼) and is drawn with depthTest off must not stand behind a wall from the camera (a ray to it hits a wall:, door:,
// floor: or ceil: mesh first). A depth-tested mark is hidden by the wall itself and passes.
//   markSightSource() -> { n, through: [{ name, at: [x, y, z], wall }] }
export function markSightSource(scene = 'window.__game && window.__game.scene', camera = 'window.__game && window.__game.camera') {
  return `(() => {
    const S = ${scene}, C = ${camera}; if (!S || !C) return { error: 'no scene' };
    const T = (window.__game && window.__game.THREE) || window.THREE; if (!T) return { error: 'no THREE' };
    const isMark = (o) => /mark|arrow|pointer|next-place|guide|beacon|▼/i.test(o.name || '') || (o.parent && /mark|arrow|pointer|next-place|guide|beacon/i.test(o.parent.name || ''));
    const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    const walls = []; S.traverse((o) => { if (o.isMesh && shown(o) && /^(wall:|door:|floor:|ceil:)/.test(o.name || '')) walls.push(o); });
    const ray = new T.Raycaster(), p = new T.Vector3(), d = new T.Vector3(); let n = 0; const through = [];
    S.traverse((o) => {
      if (!(o.isSprite || o.isMesh) || !isMark(o) || !shown(o)) return;
      const m = [].concat(o.material)[0]; if (!m || m.depthTest !== false) return;
      if (o.name === 'aim-marker') return;   // the kit's aim marker sits on what the aim ray already reached
      n++; o.getWorldPosition(p); const dist = p.distanceTo(C.position); if (dist < 0.6) return;
      ray.set(C.position, d.copy(p).sub(C.position).normalize()); ray.far = dist - 0.15;
      const hit = ray.intersectObjects(walls, false)[0];
      if (hit) through.push({ name: o.name || (o.parent && o.parent.name) || o.type, at: p.toArray().map((v) => +v.toFixed(2)), wall: hit.object.name });
    });
    return { n, through };
  })()`;
}
