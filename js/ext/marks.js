// 1.7.0 (2026-11-27 #2 「アイテムの場所が分かりづらいので札のゲームのを真似て印をつけてください」): the marks of 札の家 (kushi js/ext/marks.js,
// its 2.5.3): over every thing that can be taken (loot, documents) a pale thin chevron (kit P53: small and faint) a little above it and a faint
// warm glow on it that breathes slowly. Hidden while a wall or a door stands between it and the eye (kit js/mark-sight.js, P42), gone with the
// thing when it is taken. The glow is depth-tested (a shelf in front hides it); the chevron is drawn over its own prop and hidden by mark-sight.
import * as THREE from 'three';
import { markSight } from '../kit/mark-sight.js';

const KINDS = new Set(['loot', 'doc', 'item']);

export function installMarks(ext, G) {
  let tick = null;
  ext.registerSystem('yk-marks', { update(dt) { if (tick) tick(dt || 0.016); } });   // registered at install (a system registered at game:ready never runs)
  ext.on('game:ready', (ctx) => {
    if (typeof document === 'undefined') return;
    const icv = document.createElement('canvas'); icv.width = icv.height = 32;
    { const x = icv.getContext('2d'); x.strokeStyle = '#d8cdb4'; x.lineWidth = 3; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); x.moveTo(9, 12); x.lineTo(16, 20); x.lineTo(23, 12); x.stroke(); }
    const itex = new THREE.CanvasTexture(icv); itex.colorSpace = THREE.SRGBColorSpace; itex.magFilter = THREE.NearestFilter;
    const gcv = document.createElement('canvas'); gcv.width = gcv.height = 64;
    { const c = gcv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,226,160,1)'); gr.addColorStop(0.3, 'rgba(255,190,110,0.6)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }
    const gtex = new THREE.CanvasTexture(gcv); gtex.colorSpace = THREE.SRGBColorSpace;
    const iconM = new THREE.SpriteMaterial({ map: itex, transparent: true, opacity: 0.55, depthWrite: false, depthTest: true, fog: false }); iconM.name = 'yk-mark-icon'; iconM.userData.guideMark = true; iconM.userData.dot = 'fx';
    const softM = new THREE.SpriteMaterial({ map: gtex, color: 0xffe2a8, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); softM.name = 'yk-mark-glow'; softM.userData.dot = 'fx';
    // 1.9.0: the icon tests depth too - a wall in front hides it in every draw, whatever the tick or the sight rays have done (P42 still
    // failed in check-playtest's held start); it floats 0.34 m over its thing, so the thing itself does not cover it
    const marks = new Map();
    const layer = new THREE.Group(); layer.name = 'yk-marks'; ctx.scene.add(layer);
    const markAll = () => {
      for (const o of ctx.world.interactables) {
        const ia = o.userData.interact;
        if (!ia || !KINDS.has(ia.kind) || marks.has(o)) continue;
        const m = new THREE.Group(); m.name = 'yk-mark';
        const ic = new THREE.Sprite(iconM); ic.scale.set(0.12, 0.12, 1); ic.userData.guideMark = true; ic.renderOrder = 6; ic.name = 'yk-mark-icon'; m.add(ic);

        const gl = new THREE.Sprite(softM); gl.scale.set(0.42, 0.42, 1); gl.renderOrder = 5; gl.name = 'yk-mark-glow'; m.add(gl);
        ic.raycast = gl.raycast = () => {};   // the marks are never picked: [E] and the shots go to the thing itself (W18)
        layer.add(m); marks.set(o, { m, ic, gl });   // beside the thing, not in it: a child would grow the thing's box and the [E] pick with it (W18)
      }
    };
    markAll();
    G.marks = () => [...marks.entries()].filter(([o]) => o.parent && ctx.world.interactables.includes(o)).map(([o, k]) => ({ id: o.userData.interact.id, kind: o.userData.interact.kind, shown: k.m.visible && o.visible, icon: k.ic.visible }));
    const sight = markSight(THREE, ctx);
    G.on('loot:placed', () => { markAll(); });
    let markT = 0, t = 0;
    const wp = new THREE.Vector3();
    let tickAt = 0;
    tick = (dt) => {
      {
        tickAt = performance.now(); t += dt; markT -= dt; if (markT <= 0) { markT = 1; markAll(); sight.refresh(); }
        const k = 0.5 + 0.5 * Math.sin(t * 3.1);
        for (const [o, M] of marks) {
          if (!o.parent) { M.m.removeFromParent(); marks.delete(o); continue; }
          const on = ctx.world.interactables.includes(o) && !o.userData.off && o.visible !== false;
          M.m.visible = on; if (!on) continue;
          o.getWorldPosition(wp);
          const near = Math.hypot(wp.x - ctx.camera.position.x, wp.z - ctx.camera.position.z);
          if (near > 16) { M.m.visible = false; continue; }   // far ones wait (the fog has them; no rays for them)
          M.m.position.copy(wp);
          M.ic.position.y = 0.34 + 0.015 * k;
          M.gl.material.opacity = 0.22 + 0.1 * k;
          M.ic.visible = sight.clear(M.ic);
        }
      }
    };
    // 1.8.0: the frame is drawn even while the tick is held (a window, a mini game, a check moving the camera): before each draw, a mark
    // the camera has moved behind a wall is hidden (marks out of the view too: they are not drawn, so they cannot hide themselves)
    let wallsAt = null;   // 1.9.0: every draw (a check may move the camera away and back between two draws)
    const prevBR = ctx.scene.onBeforeRender;
    ctx.scene.onBeforeRender = function (...a) {
      if (prevBR) prevBR.apply(this, a);
      const c = ctx.camera.position;
      // 1.9.0: the walls the sight rays test were collected while far rooms were hidden: with the tick held, or after a jump (a
      // teleport, a door to another area), collect them again before testing
      if (performance.now() - tickAt > 250 || !wallsAt || wallsAt.distanceToSquared(c) > 2.25) { sight.refresh(); wallsAt = (wallsAt || c.clone()).copy(c); }
      for (const M of marks.values()) if (M.m.visible && M.ic.visible && !sight.clear(M.ic)) M.ic.visible = false;
    };
  });
}
