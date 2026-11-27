// Fighting: the weapon in the hand (from the case), shooting (the mouse / 撃つ), striking (right button, [V] / 殴る), reloading ([R] / 装填),
// changing weapons ([Q] / 持ち替え, number keys), first aid ([H] / 手当て), the player's body (体力 100, つかまれる, 死ぬ) and the HUD.
// Targets are the zombies (js/ext/zombies.js) and the people who fight (js/ext/people.js); both answer G.targets() with
//   { kind, pos: Vector3, raycast(ray) -> { part, dist, point } | null, hit(ray|part, dmg, o) -> result, alive }
import * as THREE from 'three';
import { CATALOG } from './case-data.js';
import { createFpRig } from '../kit/fp-voxel.js';
import { fpParts } from '../kit/fp-voxel-parts.js';
// how far each gun kicks (1 = the pistol); how each weapon strikes (the guns: a shove with the gun)
const KICK = { nailgun: 0.4, pistol: 1, rifle: 1.5, shotgun: 2.2 };
const STRIKE = { scalpel: 'stab', pipe: 'chop', axe: 'chop', hands: 'shove' };
const FP_IDS = ['hands', 'scalpel', 'pipe', 'axe', 'nailgun', 'pistol', 'shotgun', 'rifle'];
import { KINDS, isRead } from '../kit/toast-lane.js';

// few notices (UI rule): one at a time at the top, short, then gone
KINDS.toast.ttl = 2600; KINDS.card.ttl = 3000; KINDS['quest-note'].ttl = 3400;

// 1.2.0 (play test #5 「ゾンビに手を向けると～になりますとかの表示は不要」): no tag under the sights; the parts are told once in the monologue (talk 'lesson')

export function installCombat(ext, G) {
  let ctx = null;
  G.hp = 100;
  G.equip = null;
  G.gore = (() => { try { return localStorage.getItem('yk-gore') || 'full'; } catch (e) { return 'full'; } })();
  G.setGore = (g) => { G.gore = g; try { localStorage.setItem('yk-gore', g); } catch (e) { /* private mode */ } G.emit('gore', g); };
  const ray = new THREE.Raycaster();
  let muzzle = null;
  let reloadMax = 1;
  // 1.2.0 #7: the hand sways - it lags the look and bobs with the steps (px of the 320 x 192 picture)
  const sway = { x: 0, y: 0, yaw: null, phase: 0, px: null, pz: null };
  let beatT = 0, breathT = 0, lastSat = '', beatK = 0;
  let hintT = 0, cool = 0, reloading = 0, swing = 0, kick = 0, flashT = 0, grab = null, hurtFlash = 0, regen = 0;
  const heldNow = () => { const it = G.equip && G.case.byUid(G.equip); return it ? { it, c: CATALOG[it.id] } : { it: null, c: CATALOG.hands }; };
  G.held = heldNow;
  // a line about the weapon in the hand: tagged with the weapon's id, and dropped (shown or still waiting) as soon as another is held
  G.weaponHint = (id, text, sec = 6) => { if (ctx) ctx.ui.say(`<span hidden data-wh="${id}"></span>${text}`, sec); };
  const whOf = (html) => { const m = /data-wh="([a-z]+)"/.exec(html || ''); return m ? m[1] : null; };
  function dropStaleHints() {
    const S = ctx && ctx.ui && ctx.ui.sayLine; if (!S) return;
    const held = heldNow().it ? heldNow().it.id : 'hands';
    S.q = S.q.filter((x) => { const w = whOf(x.html); return !w || w === held; });
    const w = S.cur && whOf(S.cur.html);
    if (w && w !== held) { S.cur = null; S.clear(S.hideT); S.hide(); S.next(); }
  }
  G.equipUid = (uid, o = {}) => { G.equip = uid; reloading = 0; const h = heldNow(); if (ctx && h.it && !o.quiet) ctx.ui.toast(`構えた：${h.c.name}`); G.emit('equip'); hud(); dropStaleHints(); };
  G.heal = (it) => {
    const c = CATALOG[it.id]; if (!c.heal) return false;
    if (G.hp >= 100) { ctx.ui.say('今は、手当ての必要はない。', 3); return false; }
    G.hp = Math.min(100, G.hp + c.heal); it.n -= 1; if (it.n <= 0) G.case.items.splice(G.case.items.indexOf(it), 1);
    ctx.sound && ctx.sound('pickup'); ctx.ui.toast(`${c.name}を使った（体力 ${Math.round(G.hp)}）`); G.emit('case:change'); G.emit('healed', { id: it.id }); hud(); return true;
  };
  const quickHeal = () => {
    const meds = G.case.items.filter((i) => CATALOG[i.id].heal).sort((a, b) => CATALOG[a.id].heal - CATALOG[b.id].heal);
    if (!meds.length) return ctx.ui.say('手当てに使える物がない。包帯や救急箱を探す。', 3, { urgent: true });
    const need = 100 - G.hp, pick = meds.find((m) => CATALOG[m.id].heal >= need * 0.7) || meds[meds.length - 1];
    G.heal(pick);
  };

  // ---------------------------------------------------------------- HUD: body, weapon, ammo; the weapon in the hand; the part under the sights
  const el = document.createElement('div'); el.id = 'yk-status'; el.className = 'yk-status';
  // 1.4.0 (play test #3 「体力の減り具合をわかりやすく大きく」): the body is a big bar with its number, the lost part lingers a moment
  // (so a bite reads as a chunk); (#9 「武器の切り替え方がわからない」): under the weapon, the next one and how to change to it
  el.innerHTML = '<div class="yk-hpbox"><span class="yk-hpl">体力</span><b class="yk-hpn">100</b><div class="yk-hp"><s></s><i></i></div></div><div class="yk-w"><b class="yk-wn"></b><span class="yk-wa"></span></div><button type="button" class="yk-wnext" tabindex="-1"><span class="yk-wk"></span><span class="yk-wnx"></span></button>';
  // 1.4.0 (play test #1 「手や武器も3Dドットで作成してください」): the hand and the weapon are 3D dot models in the scene, on the camera
  // (kit js/fp-voxel.js + js/fp-voxel-parts.js: 4 mm voxels, the doctor's white coat sleeve, the fingers round each grip), lit by the
  // world and the light, under the dot post-process; the motions are the 1.2.0 ones in 3D (sway, recoil, reload, strike, the light hand)
  let rig = null, rigId = '', bloodT = 0, buildRig = () => {};
  const blood = document.createElement('div'); blood.id = 'yk-blood'; blood.className = 'yk-blood';
  // 1.4.1: low on life the view goes DARK and red, not pale - a dark rim, a red ring that swells on every heartbeat, and blood smeared at
  // the edges (as the blood setting allows); the picture itself loses its colour and its light (a white wash read as a flash, not danger)
  const dying = document.createElement('div'); dying.id = 'yk-dying'; dying.className = 'yk-dying'; dying.innerHTML = '<i class="yk-dk"></i><i class="yk-rd"></i><i class="yk-sm"></i>';
  const grabTag = document.createElement('div'); grabTag.id = 'yk-grab'; grabTag.className = 'yk-grab';
  // 1.2.1 (tougher zombies: the hits must read): four hard ticks round the sights for a moment on every hit - white on the body,
  // red and wider on the head, red and wide on a kill; with a crisp tick sound of its own (the 3D thud comes from the zombie)
  const mark = document.createElement('div'); mark.id = 'yk-hitmark'; mark.className = 'yk-hitmark'; mark.innerHTML = '<i></i><i></i><i></i><i></i>';
  let markT = 0;
  // 1.4.0 #13: the weapon drops while it points at a person who is not hostile, with a word under the sights
  const aimTag = document.createElement('div'); aimTag.id = 'yk-aimtag'; aimTag.className = 'yk-aimtag';
  let lowK = 0, aimAt = null, aimT = 0;
  function hitMark(res) {
    if (res.armor) { mark.className = 'yk-hitmark on armor'; markT = 0.14; return; }   // a glance off armour: grey ticks, no crack
    const kind = res.killed ? 'kill' : res.part === 'head' ? 'head' : 'body';
    mark.className = `yk-hitmark on ${kind}`; markT = kind === 'body' ? 0.12 : 0.2;
    G.sfx(kind === 'body' ? 'hit-tick' : 'hit-crack');
  }
  const bestRes = (a, b) => { const r = (x) => (!x || !x.part ? 0 : x.killed ? 3 : x.part === 'head' ? 2 : 1); return r(b) > r(a) ? b : a; };
  let shownHp = -1, lagHp = 100, lagT = 0, hudKey = '';
  const nextWeapon = () => { const ws = G.case ? G.case.weapons() : []; if (ws.length < 2) return null; const i = ws.findIndex((w) => w.uid === G.equip); return ws[(i + 1 + ws.length) % ws.length]; };
  function hud() {
    const h = heldNow();
    const hp = Math.max(0, Math.round(G.hp));
    if (hp !== shownHp) {
      if (hp < shownHp) { lagT = 0.9; lagHp = Math.max(lagHp, shownHp); } else if (hp > lagHp) lagHp = hp;
      shownHp = hp;
      el.querySelector('.yk-hp i').style.width = `${hp}%`;
      el.querySelector('.yk-hpn').textContent = String(hp);
      el.classList.toggle('yk-mid', hp < 60 && hp > 30); el.classList.toggle('yk-low', hp <= 30);
      el.querySelector('.yk-hp').classList.toggle('low', hp <= 30);
    }
    el.querySelector('.yk-hp s').style.width = `${Math.max(hp, lagHp)}%`;
    const nx = nextWeapon(), key = `${nx ? nx.uid : ''}|${G.equip}`;
    if (key !== hudKey) {
      hudKey = key;
      const b = el.querySelector('.yk-wnext'); b.hidden = !nx;
      if (nx) { el.querySelector('.yk-wk').textContent = ctx && ctx.isTouch ? '持ち替え' : '[Q]・ホイール'; el.querySelector('.yk-wnx').textContent = `次：${CATALOG[nx.id].name}`; }
    }
    el.querySelector('.yk-wn').textContent = h.c.name;
    el.querySelector('.yk-wa').textContent = h.c.gun ? `${h.it.loaded} / ${G.case.count(h.c.gun.ammo)}${reloading > 0 ? '　装填中' : ''}` : '';
    const wid = h.it ? h.it.id : 'hands';
    if (rig && wid !== rigId) { rigId = wid; rig.set(FP_IDS.includes(wid) ? wid : 'hands'); rig.bloody(bloodT > 0 ? 1 : 0); }
  }
  G.hud = hud;
  G.buildFpRig = async (report) => {
    if (!ctx) return; buildRig();
    for (let k = 0; k < FP_IDS.length; k++) { try { rig.prebuild([FP_IDS[k]]); } catch (e) { console.warn('[yakinake] fp', FP_IDS[k], e); } if (report) report((k + 1) / FP_IDS.length); await new Promise((r) => setTimeout(r, 0)); }
  };
  ext.on('game:ready', (c) => {
    ctx = c;
    if (ctx.lane && ctx.lane.model) {
      // one notice at a time, and no queue of old ones: a new notice drops the ones still waiting and cuts the one on screen short
      // (a reading card, which the player closes, is never touched)
      const M = ctx.lane.model, push0 = M.push.bind(M), card = (i) => isRead(i.cls) || i.ttl === 0;
      M.setMax(1);
      M.push = (spec) => {
        M.items = M.items.filter((i) => i.shown || card(i));
        for (const i of M.items) if (i.shown && !card(i) && i.key !== (spec.key || '')) i.left = Math.min(i.left, 600);
        return push0(spec);
      };
    }
    muzzle = new THREE.PointLight(0xffc070, 0, 14, 1.6); muzzle.name = 'yk-muzzle'; ctx.scene.add(muzzle);
    document.body.append(dying, blood, grabTag, mark, aimTag);
    // the hands are built behind the first block card, not behind the title (1.4.0: building them and the weapons at game:ready made
    // the title slower and its heap 24 MB bigger on a throttled phone), and every weapon with them, one step at a time (a weapon built
    // when it is picked up stalled play for a moment); a game without that card builds them as play starts
    buildRig = () => {
      if (rig) return;
      rig = createFpRig(THREE, ctx.camera, { ...fpParts({ sleeve: '#b4bbb8', cuff: '#98a19d' }), self: 0.16 });
      rig.visible = false;
      if (ctx.isTouch) rig.root.position.x = -0.035;   // a phone's buttons stand on the right: the hand a little in from the edge
      rig.set('hands'); rigId = '';
      G.fpRig = rig;
      rig.prebuild(['hands']);
    };
    if (ctx.isTouch) {   // a phone has no 装填 / 持ち替え / 手当て buttons (the right column stays short): the status panel takes them
      el.classList.add('yk-tap');
      const tap = (sel, f) => el.querySelector(sel).addEventListener('click', (e) => { e.stopPropagation(); if (!ctx.blocked || !ctx.blocked()) f(); });
      tap('.yk-hpbox', () => quickHeal()); tap('.yk-wn', () => cycle(1)); tap('.yk-wa', () => reload()); tap('.yk-wnext', () => cycle(1));
    }
    el.append(lesson);
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
  ext.on('game:start', () => { document.body.classList.add('yk-playing'); buildRig(); if (rig) { rig.visible = true; rigId = ''; } place(); hud(); });

  // ---------------------------------------------------------------- input
  const want = { fire: false, melee: false };
  ext.on('input:key', (k) => {
    if (!ctx) return;
    const c = k.code;
    if (c === 'Fire') { k.handled = true; want.fire = true; }
    else if (c === 'KeyV') { k.handled = true; want.melee = true; }
    else if (c === 'KeyR') { k.handled = true; reload(); }
    else if (c === 'KeyQ') { k.handled = true; cycle(1); }
    else if (grab && c === 'Space') { k.handled = true; want.melee = true; }
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
  // #9: the wheel changes the weapon too (one step a notch, not faster than every 0.15 s)
  let wheelAt = 0;
  addEventListener('wheel', (e) => {
    if (!ctx || !ctx.state.started || !document.pointerLockElement || (ctx.blocked && ctx.blocked())) return;
    const now = performance.now(); if (now - wheelAt < 150 || !e.deltaY) return; wheelAt = now; cycle(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
  // #9: the first time there are two weapons to change between, how to change them (once a game)
  G.on('case:change', () => {
    if (!ctx || !ctx.state.started || !G.case || G.case.weapons().length < 2 || !G.flags || G.flags['hint:switch']) return;
    G.flags['hint:switch'] = true;
    setTimeout(() => ctx.ui.say(ctx.isTouch ? '武器が二つになった。持ち替えは、左上の「持ち替え」を押す。' : '武器が二つになった。持ち替えは [Q] かマウスのホイール、数字の 1〜5。', 7), 900);
  });
  function cycle(d) {
    const ws = G.case.weapons(); if (!ws.length) return ctx.ui.say('構える物がない。', 2);
    const i = ws.findIndex((w) => w.uid === G.equip); G.equipUid(ws[(i + d + ws.length) % ws.length].uid);
  }
  function reload() {
    const h = heldNow(); if (!h.c.gun || reloading > 0) return;
    if (h.it.loaded >= h.c.gun.mag) return;
    if (!G.case.count(h.c.gun.ammo)) return ctx.ui.say(`${CATALOG[h.c.gun.ammo].name}がない。`, 3, { urgent: true });
    reloading = reloadMax = h.c.gun.mag > 6 ? 1.3 : 0.6 * (h.c.gun.mag - h.it.loaded); G.sfx('reload'); hud();
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
  let wallNormal = null, wallObj = null, wallPoint = null;
  const wallHit = (r, far) => {
    ray.ray.copy(r); ray.far = far;
    const hits = ray.intersectObjects(G.solidMeshes(), false);
    wallNormal = hits.length && hits[0].face ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld) : null;
    wallObj = hits.length ? hits[0].object : null; wallPoint = hits.length ? hits[0].point.clone() : null;
    return hits.length ? hits[0].distance : far;
  };
  // 1.4.0 #13: the person under the sights (the first thing the centre ray meets before a wall), if any
  function personAimed(maxD) {
    const cam = ctx.camera; cam.getWorldDirection(fwd);
    const r = new THREE.Ray(cam.getWorldPosition(new THREE.Vector3()), fwd.clone());
    const wall = wallHit(r, maxD); let best = null;
    for (const t of G.targets()) { if (!t.alive) continue; const q = t.raycast(r); if (q && q.dist < wall && (!best || q.dist < best.q.dist)) best = { t, q }; }
    return best && best.t.kind === 'person' ? best : null;
  }
  // the first shot or blow at a person who is not hostile asks 「撃つ？」 (and once more at one who has given up): a stray click never
  // hurts anyone, and the violence is plainly the player's choice
  let asking = false;
  function askFirst(melee) {
    const a = personAimed(melee ? 2.6 : 30); if (!a || !a.t.guard) return false;
    want.fire = false; want.melee = false; if (asking) return true; asking = true;
    const down = a.t.guard === 'ask-down', act = melee ? '殴る' : '撃つ';
    const text = down ? `${a.t.name}さんは、降参している。それでも、${act}？` : `${a.t.name}さんに、武器を向けている。本当に${act}？`;
    ctx.choose({ who: '私', text, options: [{ id: 'no', label: 'やめる', primary: true }, { id: 'yes', label: down ? `それでも、${act}` : act }] }).then((v) => {
      asking = false;
      if (v === 'yes') { G.personOk(a.t.id, down); G.emit('person:confirmed', { id: a.t.id, down }); ctx.ui.say(down ? 'もう、止まれない。' : '撃てば、もう戻れない。', 2.4); }
      try { ctx.fp.lock(); } catch (e) { /* no lock */ }
    });
    return true;
  }
  G.askFirst = askFirst;
  function shoot() {
    const h = heldNow(), g = h.c.gun;
    if (h.it.loaded <= 0) { G.sfx('empty'); cool = 0.25; if (G.case.count(g.ammo)) reload(); else ctx.ui.say(`弾がない。${CATALOG[g.ammo].name}を探す。`, 3, { urgent: true }); return; }
    h.it.loaded -= 1; cool = g.rate; kick = 1; flashT = 0.07;
    // the recoil: the view climbs a little (the heavier the gun, the more) and the room lights up for a frame or two
    if (ctx.fp) ctx.fp.pitch = Math.min(1.2, (ctx.fp.pitch || 0) + 0.018 * (KICK[h.it.id] || 1));
    if (muzzle) { muzzle.position.copy(ctx.camera.position); muzzle.intensity = 26 * (KICK[h.it.id] || 1); }
    G.sfx(h.it.id); G.noise(ctx.camera.position, g.noise);
    const base = aimRay().clone(), n = g.pellets || 1;
    let anyHit = false, best = null;
    for (let i = 0; i < n; i++) {
      const r = base.clone(); r.direction.x += (Math.random() - 0.5) * g.spread * 2; r.direction.y += (Math.random() - 0.5) * g.spread * 2; r.direction.z += (Math.random() - 0.5) * g.spread * 2; r.direction.normalize();
      const wall = wallHit(r, 40);
      const hits = [];
      for (const t of G.targets()) { if (!t.alive && !t.corpse) continue; const q = t.raycast(r); if (q && q.dist < wall) hits.push({ t, q }); }
      hits.sort((a, b) => a.q.dist - b.q.dist);
      const pierce = g.pierce || 1;
      // 1.7.0 #5: the round's path for js/ext/impacts.js - the panes it passes crack, the wall it stops in keeps a hole
      const stopAt = hits.length >= pierce ? hits[pierce - 1].q.dist : wall;
      G.emit('shot:ray', { ray: r.clone(), stop: stopAt, toWall: hits.length < pierce && wall < 40, wallObj, wallNormal, wallPoint, weapon: h.it.id });
      for (const { t, q } of hits.slice(0, pierce)) {
        const res = t.hit(r, g.dmg, { force: n > 1 ? 0.5 : 1, dir: [r.direction.x, r.direction.y, r.direction.z], weapon: h.it.id });
        if (res && res.part) {
          anyHit = true; best = bestRes(best, res);
          // 1.4.0 #12: a body shot close to a wall splashes it (the blood setting decides how much)
          if (!res.armor && t.kind === 'zombie' && wallNormal && wall - q.dist < 2.2 && G.zfx && G.zfx.wallDecal && Math.abs(wallNormal.y) < 0.5) G.zfx.wallDecal(r.at(wall - 0.01, new THREE.Vector3()), [wallNormal.x, wallNormal.y, wallNormal.z], (KICK[h.it.id] || 0.6) * 0.32);
        }
      }
      if (!hits.length && wall < 40) G.emit('shot:wall', { point: r.at(wall - 0.02, new THREE.Vector3()) });
    }
    if (anyHit) { G.emit('shot:hit'); hitMark(best); }
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
    if (!best) return;
    const res = best.t.hit(best.q.point ? r : best.q.part, m.dmg, { force: m.knock, dir: [r.direction.x, 0, r.direction.z], melee: true, sever: m.sever, weapon: h.it ? h.it.id : 'hands' });
    if (res && res.part) {
      G.sfx(h.it && h.it.id === 'scalpel' ? 'stab' : 'thud'); G.noise(ctx.camera.position, 3); hitMark(res);
      // 1.4.0 #12: blood on the blade / the knuckles after a strike that drew it (with the blood setting on), for a while
      if (!res.armor && best.t.kind === 'zombie' && G.gore !== 'off') { bloodT = G.gore === 'low' ? 15 : 45; if (rig) rig.bloody(1); }
    }
  }

  // ---------------------------------------------------------------- the body: hurt by zombies and people
  // 1.4.0 #3 「襲われたらヤバい感じ」: a grab is a struggle - press 殴る ([V] / right button / Space) three times before the teeth
  // come down, or the bite takes a big chunk (22). Every hurt shakes the view (less with 揺れを抑える), and the edges go red.
  const NEED = 3, BITE = 28;   // 1.6.0 (play test 2 #5): 22 -> 28
  const paintGrab = () => { grabTag.innerHTML = `<b>つかまれた！</b><span>${ctx.isTouch ? '「殴る」を連打' : '[V]・右クリック・スペースを連打'}</span><i>${'●'.repeat(grab.n)}${'○'.repeat(NEED - grab.n)}</i><u style="--k:${Math.max(0, grab.t / grab.t0).toFixed(3)}"></u>`; };
  const freeGrab = (won) => {
    if (!grab) return; const by = grab.by; grab = null; grabTag.classList.remove('on');
    if (won) { G.sfx('shove'); ctx.ui.say('振りほどいた。', 2); if (by && by.z && !by.z.dead) { try { by.z.hit('chest', 1, { force: 1, dir: [by.z.pos[0] - ctx.camera.position.x, 0, by.z.pos[2] - ctx.camera.position.z] }); } catch (e) { /* the body is gone */ } } G.emit('grab:free', {}); }
  };
  let shakeT = 0, shakeK = 0; const shakeOff = { y: 0, p: 0 };
  G.shake = (k, t = 0.35) => { shakeK = Math.max(shakeK, k * (ctx && ctx.calm ? 0.3 : 1)); shakeT = Math.max(shakeT, t); };
  G.hurt = (dmg, o = {}) => {
    if (!ctx || ctx.state.ended || G.dead) return;
    // 1.8.0: o.soft - a slow loss (bleeding, the spew): a faint flash, no cry, no shake
    G.hp -= dmg; hurtFlash = o.soft ? Math.max(hurtFlash, 0.3) : 1; regen = 0; if (!o.soft) G.sfx('hurt');
    if (dmg > 0 && !o.soft) { G.shake(Math.min(1, 0.25 + dmg / 30)); if (dmg >= 15) G.sfx('gasp'); }
    if (dmg > 0) G.emit('hurt', { dmg, reason: o.reason });
    if (o.grab && !grab) { const t0 = Math.max(1.7, o.grab + 1.1); grab = { t: t0, t0, by: o.by, n: 0 }; paintGrab(); grabTag.classList.add('on'); G.sfx('gasp'); G.emit('grab:start', {}); }
    hud();
    if (G.hp <= 0) { G.dead = true; G.hp = 0; grab = null; grabTag.classList.remove('on'); ctx.die(o.reason || 'bitten'); }
  };
  // 1.7.0 (2026-11-27 #7 「ダメージを食らったら回復方法のチュートリアルを入れるべき」): the first time the body is hurt, a small card opens under
  // the body bar (the bar itself glows): how to mend - [H] on a computer, a tap on the body bar on a phone - what it uses (bandages, the aid set,
  // the medkit, smallest first) and that the body barely mends by itself. It stays until the player mends once (then a word of what it did),
  // and comes back once more on the next hurt if it was never used. It does not stop play (a fight goes on) and is not on a timer while needed.
  const lesson = document.createElement('div'); lesson.id = 'yk-heal-lesson'; lesson.className = 'yk-heal-lesson'; lesson.hidden = true;
  let lessonN = 0, lessonOpen = false;
  const paintLesson = () => {
    const meds = G.case ? G.case.items.filter((i) => CATALOG[i.id].heal) : [];
    const how = ctx && ctx.isTouch ? '<b class="yk-hl-key">体力の帯を押す</b>' : '<b class="yk-hl-key">[H]</b> キー';
    const have = meds.length ? `今は<em>${CATALOG[meds[0].id].name}</em>を持っている。` : '<em>手当ての物を持っていない。</em>包帯や救急箱を拾っておく。';
    lesson.innerHTML = `<p class="yk-hl-t">手当てのしかた</p><p>${how}で手当てする（包帯・手当てセット・救急箱の、足りる物から使う）。</p><p>${have}</p><p class="yk-hl-s">体力は、ほとんど自然には戻らない（30 まで）。</p>`;
  };
  const openLesson = () => {
    if (lessonOpen || lessonN >= 2 || (G.flags && G.flags['lesson:heal'])) return;
    lessonOpen = true; lessonN++; paintLesson(); lesson.hidden = false; el.classList.add('yk-teach'); G.emit('lesson:heal', { n: lessonN });
  };
  const closeLesson = (used) => {
    if (!lessonOpen) return; lessonOpen = false; lesson.hidden = true; el.classList.remove('yk-teach');
    if (used) { if (G.flags) G.flags['lesson:heal'] = true; }
  };
  G.healLesson = () => ({ open: lessonOpen, n: lessonN, done: !!(G.flags && G.flags['lesson:heal']) });
  G.on('hurt', () => { if (G.hp > 0 && !G.dead) setTimeout(() => { if (!grab && !G.dead) openLesson(); else { const w = setInterval(() => { if (!grab || G.dead) { clearInterval(w); if (!G.dead) openLesson(); } }, 200); } }, 500); });
  G.on('healed', () => closeLesson(true));
  G.on('case:change', () => { if (lessonOpen) paintLesson(); });
  ext.on('player:respawn', () => { G.dead = false; G.hp = Math.max(G.hp, 100); grab = null; grabTag.classList.remove('on'); lagHp = 100; hud(); });
  G.grabbed = () => (grab ? { n: grab.n, need: NEED, t: grab.t } : null);

  // ---------------------------------------------------------------- every frame
  ext.registerSystem('yk-combat', {
    update(dt, c) {
      if (!ctx || !ctx.state.started || ctx.state.ended) return;
      const busy = ctx.blocked && ctx.blocked();
      cool -= dt; flashT -= dt;
      if (markT > 0) { markT -= dt; if (markT <= 0) mark.classList.remove('on'); }
      if ((hintT -= dt) <= 0) { hintT = 0.25; dropStaleHints(); }
      if (muzzle && muzzle.intensity > 0) muzzle.intensity = flashT > 0 ? muzzle.intensity : Math.max(0, muzzle.intensity - dt * 400);
      swing = Math.max(0, swing - dt * 3); kick = Math.max(0, kick - dt * 6);
      if (bloodT > 0) { bloodT -= dt; if (bloodT <= 0 && rig) rig.bloody(0); }
      { const cam = ctx.camera.position, yaw = ctx.fp ? ctx.fp.yaw : 0;
        if (sway.yaw == null) { sway.yaw = yaw; sway.px = cam.x; sway.pz = cam.z; }
        let dy = yaw - sway.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
        const sp = Math.min(8, Math.hypot(cam.x - sway.px, cam.z - sway.pz) / Math.max(dt, 1e-3));
        sway.yaw = yaw; sway.px = cam.x; sway.pz = cam.z;
        sway.phase += dt * (sp > 0.3 ? 2.2 + sp * 0.9 : 0.8);
        const lagX = Math.max(-18, Math.min(18, (dy / Math.max(dt, 1e-3)) * 6)), step = sp > 0.3 ? Math.min(1, sp / 4) : 0.15;
        const k = 1 - Math.exp(-dt * 10);
        sway.x += (lagX + Math.sin(sway.phase) * 7 * step - sway.x) * k;
        sway.y += (Math.abs(Math.cos(sway.phase)) * 9 * step - sway.y) * k; }
      if ((aimT -= dt) <= 0) { aimT = 0.12; const a = !busy && personAimed(14); aimAt = a && a.t.guard ? a.t : null;
        aimTag.textContent = aimAt ? (aimAt.guard === 'ask-down' ? `${aimAt.name}さんは、降参している` : `${aimAt.name}さん（撃たない）`) : ''; aimTag.classList.toggle('on', !!aimAt); }
      lowK += ((aimAt ? 1 : 0) - lowK) * Math.min(1, dt * 8);
      if (rig) { rig.root.position.y = -0.11 * lowK; rig.root.rotation.x = -0.6 * lowK; }
      if (rig) { const h = heldNow(), id = h.it ? h.it.id : 'hands'; rig.update(dt, { swayX: sway.x, swayY: sway.y, kick: kick * (KICK[id] || 1) / 1.6, swing, strike: STRIKE[id] || 'shove', reload: reloading > 0 ? 1 - reloading / reloadMax : 0, light: !!ctx.lightOn, flash: flashT > 0, level: ctx.lightOn ? 0.92 : 0.62 }); }
      // the red edge: a flash on every hurt, and a rim that deepens as the life goes (pulsing with the heart under 30)
      hurtFlash = Math.max(0, hurtFlash - dt * 1.4);
      { const low = Math.max(0, (60 - G.hp) / 60), pulse = G.hp < 30 ? Math.sin(performance.now() / 260) * 0.08 : 0;
        blood.style.opacity = String(Math.min(0.95, hurtFlash * 0.75 + low * 0.7 + pulse)); }
      if (reloading > 0) { reloading -= dt; if (reloading <= 0) { const h = heldNow(); if (h.c.gun) { const need = h.c.gun.mag - h.it.loaded; h.it.loaded += G.case.take(h.c.gun.ammo, need); G.sfx('reloaded'); } } }
      if (grab) {
        grab.t -= dt; G.hp -= dt * 4; if (G.hp <= 0) G.hurt(0, { reason: 'bitten' });
        if (grab && grab.t <= 0) { freeGrab(false); G.hurt(BITE, { reason: 'bitten' }); G.shake(1, 0.5); if (!G.dead) ctx.ui.say('噛まれた。', 2, { urgent: true }); }
        else if (grab) paintGrab();
      }
      lagT -= dt; if (lagT <= 0 && lagHp > G.hp) lagHp = Math.max(G.hp, lagHp - dt * 60);
      // the shake: a jolt of the look that dies away (taken back every frame, so the aim does not drift)
      if (ctx.fp) {
        ctx.fp.yaw -= shakeOff.y; ctx.fp.pitch -= shakeOff.p; shakeOff.y = shakeOff.p = 0;
        if (shakeT > 0) { shakeT -= dt; const a = shakeK * Math.max(0, shakeT) * 0.12; shakeOff.y = (Math.random() - 0.5) * a; shakeOff.p = (Math.random() - 0.5) * a; ctx.fp.yaw += shakeOff.y; ctx.fp.pitch += shakeOff.p; if (shakeT <= 0) shakeK = 0; }
      }
      // low on life: the heart is heard (faster the lower), the breath under 30, the colour drains from the view
      beatT -= dt;
      if (G.hp < 45 && beatT <= 0) { beatT = 60 / (72 + (45 - G.hp) * 2.2); G.sfx('heart', { g: 0.5 + (45 - G.hp) / 60 }); beatK = 1; }
      beatK = Math.max(0, beatK - dt * 3.2);
      breathT -= dt;
      if (G.hp < 30 && breathT <= 0) { breathT = 2.1 + Math.random() * 0.5; G.sfx('breath', { g: 0.35 + (30 - G.hp) / 60 }); }
      { const k = G.dead ? 0 : Math.max(0, Math.min(1, (45 - G.hp) / 35));   // 0 at 45, 1 at 10 and below
        const calm = document.documentElement.hasAttribute('data-gf-calm') || document.documentElement.hasAttribute('data-gf-no-flash');
        const beat = calm ? 0.4 : beatK * beatK;
        dying.style.opacity = k > 0 ? '1' : '0';
        dying.style.setProperty('--k', k.toFixed(3)); dying.style.setProperty('--b', beat.toFixed(3));
        dying.classList.toggle('smear', G.gore !== 'off'); dying.classList.toggle('low', G.gore === 'low');
        const f = k > 0 ? `saturate(${(1 - k * 0.8).toFixed(2)}) brightness(${(1 - k * 0.5 - beat * k * 0.1).toFixed(2)}) contrast(${(1 + k * 0.12).toFixed(2)})` : '';
        // on the cover's backdrop, not on the canvas: the kit's approach effect owns the canvas filter and clears it every frame
        if (f !== lastSat) { lastSat = f; dying.style.backdropFilter = f; dying.style.webkitBackdropFilter = f; } }
      // slow mending while nothing hurts (to 40 at most: real healing needs the case)
      regen += dt; if (regen > 10 && G.hp < 30) G.hp = Math.min(30, G.hp + dt * 0.5);   // 1.6.0 (play test 2 #5): the slow mend after a fight stops at 30 (was 40, 0.8/s after 8 s)
      // a struggle press counts at once, even while the last swing is still recovering (and does not swing)
      if (grab && want.melee && !busy) { want.melee = false; grab.n++; G.sfx('shove'); G.shake(0.3, 0.15); if (grab.n >= NEED) freeGrab(true); else paintGrab(); }
      if (!busy && cool <= 0) {
        const h = heldNow();
        if (want.melee) { if (!askFirst(true)) { want.melee = false; strike(); } }
        else if (want.fire) { if (h.c.gun) { if (!askFirst(false)) { shoot(); if (!(h.c.gun.rate < 0.35)) want.fire = false; } } else if (!askFirst(true)) { want.fire = false; strike(); } }
      } else if (busy) { want.fire = false; want.melee = false; }
      hud();
    },
  });
}
