// Fighting: the weapon in the hand (from the case), shooting (the mouse / 撃つ), striking (right button, [V] / 殴る), reloading ([R] / 装填),
// changing weapons ([Q] / 持ち替え, number keys), first aid ([H] / 手当て), the player's body (体力 100, つかまれる, 死ぬ) and the HUD.
// Targets are the zombies (js/ext/zombies.js) and the people who fight (js/ext/people.js); both answer G.targets() with
//   { kind, pos: Vector3, raycast(ray) -> { part, dist, point } | null, hit(ray|part, dmg, o) -> result, alive }
import * as THREE from 'three';
import { CATALOG } from './case-data.js';
import { drawWeapon } from './weapon-art.js';

const PART_SAY = { head: '頭：撃てば止まる', chest: '胴：倒れにくい', pelvis: '腰：上と下に分かれる', upperArmL: '腕：つかめなくなる', upperArmR: '腕：つかめなくなる', foreArmL: '腕：つかめなくなる', foreArmR: '腕：つかめなくなる', thighL: '脚：倒れて這う', thighR: '脚：倒れて這う', shinL: '脚：倒れて這う', shinR: '脚：倒れて這う' };

export function installCombat(ext, G) {
  let ctx = null;
  G.hp = 100;
  G.equip = null;
  G.gore = (() => { try { return localStorage.getItem('yk-gore') || 'full'; } catch (e) { return 'full'; } })();
  G.setGore = (g) => { G.gore = g; try { localStorage.setItem('yk-gore', g); } catch (e) { /* private mode */ } G.emit('gore', g); };
  const ray = new THREE.Raycaster();
  let cool = 0, reloading = 0, swing = 0, kick = 0, flashT = 0, grab = null, hurtFlash = 0, regen = 0;
  const heldNow = () => { const it = G.equip && G.case.byUid(G.equip); return it ? { it, c: CATALOG[it.id] } : { it: null, c: CATALOG.hands }; };
  G.held = heldNow;
  G.equipUid = (uid) => { G.equip = uid; reloading = 0; const h = heldNow(); if (ctx && h.it) ctx.ui.toast(`構えた：${h.c.name}`); G.emit('equip'); hud(); };
  G.heal = (it) => {
    const c = CATALOG[it.id]; if (!c.heal) return false;
    if (G.hp >= 100) { ctx.ui.say('今は、手当ての必要はない。', 3); return false; }
    G.hp = Math.min(100, G.hp + c.heal); it.n -= 1; if (it.n <= 0) G.case.items.splice(G.case.items.indexOf(it), 1);
    ctx.sound && ctx.sound('pickup'); ctx.ui.toast(`${c.name}を使った（体力 ${Math.round(G.hp)}）`); G.emit('case:change'); hud(); return true;
  };
  const quickHeal = () => {
    const meds = G.case.items.filter((i) => CATALOG[i.id].heal).sort((a, b) => CATALOG[a.id].heal - CATALOG[b.id].heal);
    if (!meds.length) return ctx.ui.say('手当てに使える物がない。包帯や救急箱を探す。', 3, { urgent: true });
    const need = 100 - G.hp, pick = meds.find((m) => CATALOG[m.id].heal >= need * 0.7) || meds[meds.length - 1];
    G.heal(pick);
  };

  // ---------------------------------------------------------------- HUD: body, weapon, ammo; the weapon in the hand; the part under the sights
  const el = document.createElement('div'); el.id = 'yk-status'; el.className = 'yk-status';
  el.innerHTML = '<div class="yk-hp"><i></i></div><div class="yk-w"><b class="yk-wn"></b><span class="yk-wa"></span></div>';
  const view = document.createElement('canvas'); view.id = 'yk-weapon'; view.width = 96; view.height = 64; view.className = 'yk-weapon';
  const partTag = document.createElement('div'); partTag.id = 'yk-part'; partTag.className = 'yk-part';
  const blood = document.createElement('div'); blood.id = 'yk-blood'; blood.className = 'yk-blood';
  const grabTag = document.createElement('div'); grabTag.id = 'yk-grab'; grabTag.className = 'yk-grab';
  function hud() {
    const h = heldNow();
    el.querySelector('.yk-hp i').style.width = `${Math.max(0, G.hp)}%`;
    el.querySelector('.yk-hp').classList.toggle('low', G.hp < 35);
    el.querySelector('.yk-wn').textContent = h.c.name;
    el.querySelector('.yk-wa').textContent = h.c.gun ? `${h.it.loaded} / ${G.case.count(h.c.gun.ammo)}${reloading > 0 ? '　装填中' : ''}` : '';
    drawWeapon(view, h.it ? h.it.id : 'hands', { swing, kick, flash: flashT > 0 });
  }
  G.hud = hud;
  ext.on('game:ready', (c) => {
    ctx = c;
    document.body.append(view, partTag, blood, grabTag);
    if (ctx.isTouch) {   // a phone has no 装填 / 持ち替え / 手当て buttons (the right column stays short): the status panel takes them
      el.classList.add('yk-tap');
      const tap = (sel, f) => el.querySelector(sel).addEventListener('click', (e) => { e.stopPropagation(); if (!ctx.blocked || !ctx.blocked()) f(); });
      tap('.yk-hp', () => quickHeal()); tap('.yk-wn', () => cycle(1)); tap('.yk-wa', () => reload());
    }
    place();
    hud();
  });
  // a phone hides the top-left stack (#hud-left) behind the goal chip, so there the panel floats on its own under the chip:
  // the body, the weapon and the count must stay in sight while fighting
  let placed = '';
  function place() {
    const phone = document.body.classList.contains('gf-phone'), want = phone ? 'float' : 'slot';
    if (want === placed) return; placed = want;
    el.classList.toggle('yk-float', phone);
    if (phone || !ctx.registerHudPart) document.body.append(el); else ctx.registerHudPart('yk-status', { slot: 'tl', order: 60, el });
  }
  addEventListener('resize', () => { if (ctx) setTimeout(place, 50); });
  ext.on('game:start', () => { document.body.classList.add('yk-playing'); place(); hud(); });

  // ---------------------------------------------------------------- input
  const want = { fire: false, melee: false };
  ext.on('input:key', (k) => {
    if (!ctx) return;
    const c = k.code;
    if (c === 'Fire') { k.handled = true; want.fire = true; }
    else if (c === 'KeyV') { k.handled = true; want.melee = true; }
    else if (c === 'KeyR') { k.handled = true; reload(); }
    else if (c === 'KeyQ') { k.handled = true; cycle(1); }
    else if (c === 'KeyH') { k.handled = true; quickHeal(); }
    else if (/^Digit[1-5]$/.test(c)) { const ws = G.case.weapons(); const w = ws[+c.slice(5) - 1]; if (w) { k.handled = true; G.equipUid(w.uid); } }
  });
  addEventListener('keyup', (e) => { if (e.code === 'Fire') want.fire = false; });
  addEventListener('mousedown', (e) => {
    if (!ctx || !ctx.state.started || !document.pointerLockElement) return;
    if (e.button === 0) want.fire = true; else if (e.button === 2) want.melee = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) want.fire = false; });
  addEventListener('contextmenu', (e) => { if (document.pointerLockElement) e.preventDefault(); });
  function cycle(d) {
    const ws = G.case.weapons(); if (!ws.length) return ctx.ui.say('構える物がない。', 2);
    const i = ws.findIndex((w) => w.uid === G.equip); G.equipUid(ws[(i + d + ws.length) % ws.length].uid);
  }
  function reload() {
    const h = heldNow(); if (!h.c.gun || reloading > 0) return;
    if (h.it.loaded >= h.c.gun.mag) return;
    if (!G.case.count(h.c.gun.ammo)) return ctx.ui.say(`${CATALOG[h.c.gun.ammo].name}がない。`, 3, { urgent: true });
    reloading = h.c.gun.mag > 6 ? 1.3 : 0.6 * (h.c.gun.mag - h.it.loaded); G.sfx('reload'); hud();
  }

  // ---------------------------------------------------------------- aim: the crosshair ray, nudged to the nearest part on a touch screen
  const fwd = new THREE.Vector3();
  function aimRay() {
    const cam = ctx.camera; cam.getWorldDirection(fwd);
    ray.set(cam.getWorldPosition(new THREE.Vector3()), fwd.clone());
    const assist = ctx.isTouch || G.assist;
    if (!assist) return ray.ray;
    // within 7 degrees: aim at the nearest target's chest (or head when it is closer to the line)
    let best = null;
    for (const t of G.targets()) {
      if (!t.alive) continue;
      for (const p of t.aimPoints ? t.aimPoints() : []) {
        const d = p.clone().sub(ray.ray.origin), dist = d.length(); if (dist > 22) continue;
        const ang = d.normalize().angleTo(fwd);
        if (ang < 0.12 && (!best || ang < best.ang)) best = { ang, dir: d.clone() };
      }
    }
    if (best) ray.ray.direction.lerp(best.dir, 0.75).normalize();
    return ray.ray;
  }
  // walls first: what the shot can reach
  const wallHit = (r, far) => {
    ray.ray.copy(r); ray.far = far;
    const hits = ray.intersectObjects(G.solidMeshes(), false);
    return hits.length ? hits[0].distance : far;
  };
  function shoot() {
    const h = heldNow(), g = h.c.gun;
    if (h.it.loaded <= 0) { G.sfx('empty'); cool = 0.25; if (G.case.count(g.ammo)) reload(); else ctx.ui.say(`弾がない。${CATALOG[g.ammo].name}を探すか、${ctx.isTouch ? '「殴る」' : '[V]'}で殴る。`, 3, { urgent: true }); return; }
    h.it.loaded -= 1; cool = g.rate; kick = 1; flashT = 0.06;
    G.sfx(h.it.id); G.noise(ctx.camera.position, g.noise);
    const base = aimRay().clone(), n = g.pellets || 1;
    let anyHit = false;
    for (let i = 0; i < n; i++) {
      const r = base.clone(); r.direction.x += (Math.random() - 0.5) * g.spread * 2; r.direction.y += (Math.random() - 0.5) * g.spread * 2; r.direction.z += (Math.random() - 0.5) * g.spread * 2; r.direction.normalize();
      const wall = wallHit(r, 40);
      const hits = [];
      for (const t of G.targets()) { if (!t.alive && !t.corpse) continue; const q = t.raycast(r); if (q && q.dist < wall) hits.push({ t, q }); }
      hits.sort((a, b) => a.q.dist - b.q.dist);
      const pierce = g.pierce || 1;
      for (const { t } of hits.slice(0, pierce)) { const res = t.hit(r, g.dmg * (1 - Math.min(0.5, hits.length && t.dist ? 0 : 0)), { force: n > 1 ? 0.5 : 1, dir: [r.direction.x, r.direction.y, r.direction.z] }); if (res && res.part) anyHit = true; }
      if (!hits.length && wall < 40) G.emit('shot:wall', { point: r.at(wall - 0.02, new THREE.Vector3()) });
    }
    if (anyHit) G.emit('shot:hit');
    G.emit('case:change'); hud();
  }
  function strike() {
    const h = heldNow(), m = h.c.melee || CATALOG.hands.melee;
    cool = m.rate; swing = 1; G.sfx('swing');
    const r = aimRay().clone();
    const wall = wallHit(r, m.reach + 0.4);
    let best = null;
    for (const t of G.targets()) {
      if (!t.alive) continue;
      const q = t.raycast(r);
      if (q && q.dist <= m.reach && q.dist < wall && (!best || q.dist < best.q.dist)) best = { t, q };
      // a body right in front counts even when the ray slips past it (a strike is a wide arc)
      if (!best && t.pos.distanceTo(ctx.camera.position) < m.reach * 0.75) { const to = t.pos.clone().setY(ctx.camera.position.y).sub(ctx.camera.position).normalize(); if (to.angleTo(fwd) < 0.6) best = { t, q: { part: 'chest', dist: 0.8 } }; }
    }
    if (grab) { grab = null; grabTag.classList.remove('on'); G.sfx('shove'); ctx.ui.say('振りほどいた。', 2); }
    if (!best) return;
    const res = best.t.hit(best.q.point ? r : best.q.part, m.dmg, { force: m.knock, dir: [r.direction.x, 0, r.direction.z], melee: true, sever: m.sever });
    if (res && res.part) { G.sfx(h.it && h.it.id === 'scalpel' ? 'stab' : 'thud'); G.noise(ctx.camera.position, 3); }
  }

  // ---------------------------------------------------------------- the body: hurt by zombies and people
  G.hurt = (dmg, o = {}) => {
    if (!ctx || ctx.state.ended || G.dead) return;
    G.hp -= dmg; hurtFlash = 1; regen = 0; G.sfx('hurt');
    if (o.grab && !grab) { grab = { t: o.grab + 0.6, by: o.by }; grabTag.textContent = ctx.isTouch ? 'つかまれた！「殴る」で振りほどく' : 'つかまれた！[V]か右クリックで振りほどく'; grabTag.classList.add('on'); }
    hud();
    if (G.hp <= 0) { G.dead = true; G.hp = 0; grab = null; grabTag.classList.remove('on'); ctx.die(o.reason || 'bitten'); }
  };
  ext.on('player:respawn', () => { G.dead = false; G.hp = Math.max(G.hp, 100); grab = null; grabTag.classList.remove('on'); hud(); });

  // ---------------------------------------------------------------- every frame
  let partT = 0;
  ext.registerSystem('yk-combat', {
    update(dt, c) {
      if (!ctx || !ctx.state.started || ctx.state.ended) return;
      const busy = ctx.blocked && ctx.blocked();
      cool -= dt; flashT -= dt;
      swing = Math.max(0, swing - dt * 3); kick = Math.max(0, kick - dt * 6);
      hurtFlash = Math.max(0, hurtFlash - dt * 1.6); blood.style.opacity = String(Math.min(0.85, hurtFlash * 0.7 + (G.hp < 35 ? 0.25 + Math.sin(performance.now() / 300) * 0.08 : 0)));
      if (reloading > 0) { reloading -= dt; if (reloading <= 0) { const h = heldNow(); if (h.c.gun) { const need = h.c.gun.mag - h.it.loaded; h.it.loaded += G.case.take(h.c.gun.ammo, need); G.sfx('reloaded'); } } }
      if (grab) { grab.t -= dt; G.hp -= dt * 5; if (G.hp <= 0) G.hurt(0, { reason: 'bitten' }); if (grab && grab.t <= 0) { grab = null; grabTag.classList.remove('on'); } }
      // slow mending while nothing hurts (to 40 at most: real healing needs the case)
      regen += dt; if (regen > 8 && G.hp < 40) G.hp = Math.min(40, G.hp + dt * 0.8);
      if (!busy && cool <= 0) {
        const h = heldNow();
        if (want.melee) { want.melee = false; strike(); }
        else if (want.fire) { if (h.c.gun) { shoot(); if (!(h.c.gun.rate < 0.35)) want.fire = false; } else { want.fire = false; strike(); } }
      } else if (busy) { want.fire = false; want.melee = false; }
      // the part under the sights (the first minutes teach what each part does; later only for the first look at a new kind)
      partT -= dt;
      if (partT <= 0) {
        partT = 0.12;
        let say = '';
        if (G.teachParts && !busy) {
          const r = aimRay().clone(); const wall = wallHit(r, 25);
          let best = null; for (const t of G.targets()) { if (!t.alive || t.kind !== 'zombie') continue; const q = t.raycast(r); if (q && q.dist < wall && (!best || q.dist < best.dist)) best = q; }
          if (best) say = PART_SAY[best.part] || '';
        }
        partTag.textContent = say; partTag.classList.toggle('on', !!say);
      }
      hud();
    },
  });
}
