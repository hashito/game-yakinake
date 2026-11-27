/* game-kit 33762870: js/mark-sight.js — edit in game-kit and run tools/kit-sync.js */
// Marks never show through walls (standard 1.22.0, 鏡屋 ドット版 play test 2026-11-21: 「壁を通り越してアイテムの矢印が見える」).
// Every ▼ / arrow / glow over a thing is depth-tested (a wall in front hides it), and a mark that is drawn on top of everything on purpose
// (a small sprite with depthTest off so it is not swallowed by its own prop) is hidden while a wall stands between it and the eye:
//   const sight = markSight(THREE, ctx, { walls: /^(wall:|door:)/ });   // the names of what blocks the view (default: wall:, door:, floor:, ceil:)
//   ... each frame: mark.visible = wanted && sight.clear(mark);          // a ray from the camera to the mark's world position
// o.camera (1.22.5): the camera the picture is drawn with, or a function returning it (a top-down view drawn from its own camera); default
// ctx.camera. A wall cut away by its material's clipping planes (a top-down view cutting the house above the player) does not block.
// The list of blocking meshes is collected once and again after sight.refresh() (call it when the world changes: a door opened, a room built).
// Checked by tools/mark-sight.mjs (P42): no visible mark draws through walls.
export function markSight(THREE, ctx, o = {}) {
  const re = o.walls || /^(wall:|door:|floor:|ceil:)/;
  const ray = new THREE.Raycaster(), p = new THREE.Vector3(), d = new THREE.Vector3();
  const cam = () => (typeof o.camera === 'function' ? o.camera() : o.camera) || ctx.camera;
  const cut = (h) => { const m = [].concat(h.object.material)[0], cp = m && m.clippingPlanes; return !!(cp && cp.some((pl) => pl.distanceToPoint(h.point) < 0)); };
  let list = null;
  const collect = () => { const out = []; const root = (ctx.world && ctx.world.group) || ctx.scene; root.traverse((m) => { if (m.isMesh && m.visible && re.test(m.name || '')) out.push(m); }); return out; };
  return {
    refresh() { list = null; },
    clear(obj, near = 0.6) {
      const C = cam(); C.updateMatrixWorld(); obj.getWorldPosition(p); const c = new THREE.Vector3().setFromMatrixPosition(C.matrixWorld), dist = p.distanceTo(c);
      if (dist < near) return true;
      list = list || collect();
      ray.set(c, d.copy(p).sub(c).normalize()); ray.far = dist - 0.15;
      return !ray.intersectObjects(list, false).some((h) => !cut(h));
    },
  };
}
