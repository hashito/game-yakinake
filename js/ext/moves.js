// 1.8.0 (2026-11-27 #3 「攻撃パターンを10個ほど追加」「攻撃は必ず予兆を出して」): the ten attacks a body can have on top of its walk and bite.
// Every one is told before it lands, three ways at once: a pose (it crouches, draws back an arm, bends over...), a sound of its own, and,
// the first time the player sees it, a line in the thought band saying what it means and how to get out of the way. A hit during the tell
// stops it (it flinches instead). The game's frame loop (js/ext/zombies.js) asks G.moveTick each frame; while a move runs, the body is in the
// state 'yk-move' and the kit's state machine leaves it alone. The fast parts are short bursts (a dash 5 m/s for at most a second): the
// sustained speed stays at the runners' 2.6 m/s (FR-08).
//   dash 突進 / pounce 跳びかかり / swipe 薙ぎ払い / vomit 嘔吐 / ankle 足首つかみ / throw 投げつけ / frenzy 連続噛み / rake 引っかき (bleeding) /
//   ambush 待ち伏せ / tackle 押し倒し
import { MOVES } from './profiles.js';

export function installMoves(ext, G) {
  let ctx = null, THREE = null;
  ext.on('game:ready', (c) => { ctx = c; THREE = c.THREE; });
  const P = () => ctx.camera.position;
  const flat = (L) => { const p = P(); return Math.hypot(p.x - L.z.pos[0], p.z - L.z.pos[2]); };
  const yawTo = (L) => { const p = P(); return Math.atan2(p.x - L.z.pos[0], p.z - L.z.pos[2]); };
  const facing = (L, cone = 0.7) => { let a = yawTo(L) - L.z.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < cone; };
  const sameFloor = (L) => (ctx.floor || 0) === L.floor;
  const snd = (k, L) => G.sfx3d && G.sfx3d(k, L.z.root.position);
  const dmg = (L, k) => Math.round((L.z.stats.damage || 18) * k);
  const HINT = {
    dash: '身を低くして、息を吐いた――まっすぐ突っ込んでくる。横へよける。',
    pounce: 'かがんで、甲高く叫んだ――跳びかかってくる。跳ぶ前に撃つか、下がる。',
    swipe: '腕を大きく引いた――横に払う。腕が長い。一歩、下がる。',
    vomit: '体を折って、えずいている――吐きかけてくる。正面から離れる。',
    ankle: '床の手が、ぴくりと動いた――足首をつかむ。倒れた体の横は、離れて通る。',
    throw: '物を拾って、振りかぶった――投げてくる。投げた瞬間に横へ動く。',
    frenzy: '歯を鳴らしている――続けて噛みつく。歯の音が聞こえたら、下がる。',
    rake: '両腕を高く上げた――爪で引っかく。傷から血が出る（手当てで止まる）。',
    ambush: '物陰から、湿った息の音がする――待ち伏せている。近づかない。',
    tackle: '頭を下げて、床を蹴っている――体当たりしてくる。横へよける。',
  };
  const seenMove = new Set();
  const tellOnce = (k, L) => {
    if (seenMove.has(k)) return; if (flat(L) > 12 || !sameFloor(L)) return;
    seenMove.add(k); G.flags[`move:${k}`] = true; ctx.ui.say(HINT[k], 5.5, { urgent: true }); G.emit('move:first', { kind: k, id: L.def.id });
  };
  G.movesSeen = () => [...seenMove];

  // ---------------------------------------------------------------- the ten
  // each: can(L, d) - may it start now; tell (s) and the pose / sound; act(L, dt, M) -> true while it goes on
  const DEF = {
    dash: {
      can: (L, d) => d > 3 && d < 7 && facing(L, 0.5), tell: 0.75, cool: [6, 9],
      pose: (L) => { L.z.play('kneel', { restart: true }); snd('z-groan-3', L); },
      start: (L, M) => { M.yaw = yawTo(L); M.t = 1.0; L.z.play('run', { restart: true }); snd('z-attack-1', L); },
      act: (L, dt, M) => {
        M.t -= dt; L.z.yaw = M.yaw; L.z.pos[0] += Math.sin(M.yaw) * 5 * dt; L.z.pos[2] += Math.cos(M.yaw) * 5 * dt;
        if (!M.hit && flat(L) < 1.0) { M.hit = true; G.hurt(dmg(L, 1.1), { reason: 'bitten', by: L }); return false; }
        return M.t > 0;
      },
    },
    pounce: {
      can: (L, d) => d > 2.4 && d < 4.6 && facing(L, 0.6), tell: 0.85, cool: [7, 10],
      pose: (L) => { L.z.play('kneel', { restart: true }); snd('z-scream', L); },
      start: (L, M) => { const p = P(); M.from = [L.z.pos[0], L.z.pos[2]]; M.to = [p.x, p.z]; M.t = 0; M.dur = Math.hypot(p.x - L.z.pos[0], p.z - L.z.pos[2]) / 6; M.y0 = L.z.root.position.y; L.z.yaw = yawTo(L); L.z.play('lunge', { restart: true }); },
      act: (L, dt, M) => {
        M.t += dt; const k = Math.min(1, M.t / M.dur);
        L.z.pos[0] = M.from[0] + (M.to[0] - M.from[0]) * k * 0.92; L.z.pos[2] = M.from[1] + (M.to[1] - M.from[1]) * k * 0.92;
        L.z.root.position.y = M.y0 + Math.sin(k * Math.PI) * 0.55;
        if (k >= 1) { L.z.root.position.y = M.y0; if (flat(L) < 1.25) G.hurt(dmg(L, 0.9), { grab: 1.2, reason: 'bitten', by: L }); else snd('fall', L); return false; }
        return true;
      },
    },
    swipe: {
      can: (L, d) => d < 2.3 && d > 1.0 && facing(L, 0.8), tell: 0.6, cool: [4, 6],
      pose: (L) => { L.z.play('grab1', { restart: true }); snd('z-groan-5', L); },
      start: (L, M) => { L.z.play('swing', { restart: true }); M.t = 0.5; snd('swing', L); },
      act: (L, dt, M) => { M.t -= dt; if (!M.hit && M.t < 0.25) { M.hit = true; if (flat(L) < 2.35 && facing(L, 1.0)) G.hurt(dmg(L, 1.0), { reason: 'bitten', by: L }); } return M.t > 0; },
    },
    vomit: {
      can: (L, d) => d < 2.6 && facing(L, 0.6), tell: 0.95, cool: [8, 11],
      pose: (L) => { L.z.play('stagger', { restart: true }); snd('retch', L); },
      start: (L, M) => { M.t = 0.9; spew(L); if (flat(L) < 2.8 && facing(L, 0.55)) sick(5); },
      act: (L, dt, M) => { M.t -= dt; return M.t > 0; },
    },
    ankle: {
      can: (L, d) => d < 1.7, tell: 0.5, cool: [5, 7],
      pose: (L) => { if (L.z.motion !== 'crawl' && L.z.motion !== 'crawl1') L.z.play('kneel', { restart: true }); else L.z.play('crawl-bite', { restart: true }); snd('z-groan-2', L); },
      start: (L, M) => { M.t = 0.4; },
      act: (L, dt, M) => { M.t -= dt; if (!M.hit) { M.hit = true; if (flat(L) < 1.6) G.hurt(dmg(L, 0.5), { grab: 1.0, reason: 'bitten', by: L, ankle: true }); } return M.t > 0; },
    },
    throw: {
      can: (L, d) => d > 4.5 && d < 11 && L.same, tell: 1.0, cool: [6, 9],
      pose: (L) => { L.z.play('kneel', { restart: true }); snd('chip', L); },
      start: (L, M) => { L.z.yaw = yawTo(L); L.z.play('swing', { restart: true }); snd('swing', L); toss(L); M.t = 0.6; },
      act: (L, dt, M) => { M.t -= dt; return M.t > 0; },
    },
    frenzy: {
      can: (L, d) => d < 1.45 && facing(L, 0.9), tell: 0.55, cool: [5, 7],
      pose: (L) => { L.z.play('twitch', { restart: true }); snd('teeth', L); },
      start: (L, M) => { M.n = 0; M.t = 0; },
      act: (L, dt, M) => {
        M.t -= dt;
        if (M.t <= 0) {
          if (M.n >= 2) return false;
          M.n++; M.t = 0.45; L.z.play('bite', { restart: true }); snd(`z-attack-${1 + M.n}`, L);
          if (flat(L) < 1.5) G.hurt(dmg(L, 0.65), { reason: 'bitten', by: L });
        }
        return true;
      },
    },
    rake: {
      can: (L, d) => d < 1.7 && facing(L, 0.8), tell: 0.6, cool: [5, 8],
      pose: (L) => { L.z.play('grab', { restart: true }); snd('z-groan-4', L); },
      start: (L, M) => { L.z.play('swing', { restart: true }); M.t = 0.5; snd('swing', L); },
      act: (L, dt, M) => { M.t -= dt; if (!M.hit && M.t < 0.3) { M.hit = true; if (flat(L) < 1.75) { G.hurt(dmg(L, 0.7), { reason: 'bitten', by: L }); bleed(); } } return M.t > 0; },
    },
    ambush: {
      // waits where it stands (no wandering, no chase) until the player is close, breathing; then a short rush and a grab
      can: (L, d) => d < 2.6, tell: 0.35, cool: [99, 99],
      pose: (L) => { L.z.play('lunge', { restart: true }); snd('z-scream', L); },
      start: (L, M) => { M.yaw = yawTo(L); M.t = 0.45; },
      act: (L, dt, M) => {
        M.t -= dt; L.z.yaw = M.yaw; L.z.pos[0] += Math.sin(M.yaw) * 4 * dt; L.z.pos[2] += Math.cos(M.yaw) * 4 * dt;
        if (!M.hit && flat(L) < 1.1) { M.hit = true; G.hurt(dmg(L, 0.9), { grab: 1.1, reason: 'bitten', by: L }); return false; }
        return M.t > 0;
      },
    },
    tackle: {
      can: (L, d) => d > 2.4 && d < 6 && facing(L, 0.5), tell: 0.9, cool: [8, 11],
      pose: (L) => { L.z.play('stagger', { restart: true }); snd('scrape', L); },
      start: (L, M) => { M.yaw = yawTo(L); M.t = 1.2; L.z.play('run', { restart: true }); snd('z-attack-3', L); },
      act: (L, dt, M) => {
        M.t -= dt; L.z.yaw = M.yaw; L.z.pos[0] += Math.sin(M.yaw) * 4.5 * dt; L.z.pos[2] += Math.cos(M.yaw) * 4.5 * dt;
        if (!M.hit && flat(L) < 1.1) { M.hit = true; G.hurt(dmg(L, 1.0), { grab: 1.6, reason: 'bitten', by: L, down: true }); G.shake && G.shake(0.8, 0.4); return false; }
        return M.t > 0;
      },
    },
  };
  G.MOVE_DEF = DEF;

  // ---------------------------------------------------------------- what a move leaves: bleeding, sickness, the thrown thing, the spew
  let bleedT = 0, sickT = 0, dotAcc = 0;
  const bleed = () => { if (bleedT <= 0 && !G.flags['hint:bleed']) { G.flags['hint:bleed'] = true; ctx.ui.say('引っかかれた傷から、血が出ている。手当てをすれば止まる。', 5); } bleedT = 14; G.emit('bleed', {}); };
  const sick = (s) => { sickT = Math.max(sickT, s); G.emit('sick', {}); if (!G.flags['hint:sick']) { G.flags['hint:sick'] = true; ctx.ui.say('吐きかけられた。しばらく、体が蝕まれる。', 4.5); } };
  G.on('healed', () => { bleedT = 0; });
  ext.on('game:start', () => { bleedT = 0; sickT = 0; dotAcc = 0; for (const o of objs) { o.on = false; o.m.visible = false; } for (const s of spews) { s.on = false; s.m.visible = false; } });   // 1.10.0 #1
  G.bleeding = () => ({ bleed: +bleedT.toFixed(1), sick: +sickT.toFixed(1) });
  const objs = [];
  function toss(L) {
    const p = P(), from = new THREE.Vector3(L.z.pos[0], L.z.root.position.y + 1.5, L.z.pos[2]);
    let o = objs.find((q) => !q.on);
    if (!o) { if (objs.length >= 4) o = objs[0]; else { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x6d6457, roughness: 0.9 })); m.name = 'yk-thrown'; ctx.scene.add(m); o = { m }; objs.push(o); } }
    const to = new THREE.Vector3(p.x, p.y - 0.25, p.z), dur = Math.max(0.55, from.distanceTo(to) / 12);
    Object.assign(o, { on: true, t: 0, dur, from, to, by: L, dmg: dmg(L, 0.8) }); o.m.visible = true; o.m.position.copy(from);
  }
  const spews = [];
  function spew(L) {
    if (G.gore === 'off') return;
    const n = ctx.isTouch ? 10 : 18, yaw = L.z.yaw;
    for (let i = 0; i < n; i++) {
      let s = spews.find((q) => !q.on);
      if (!s) { if (spews.length >= 36) break; const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0x8a8d3a })); m.name = 'yk-spew'; ctx.scene.add(m); s = { m }; spews.push(s); }
      const a = yaw + (Math.random() - 0.5) * 0.5, v = 2.4 + Math.random() * 1.6;
      Object.assign(s, { on: true, t: 1.1, v: [Math.sin(a) * v, 0.6 + Math.random(), Math.cos(a) * v], floor: L.z.root.position.y + 0.02 });
      s.m.visible = true; s.m.position.set(L.z.pos[0] + Math.sin(yaw) * 0.3, L.z.root.position.y + 1.45, L.z.pos[2] + Math.cos(yaw) * 0.3);
    }
  }
  ext.registerSystem('yk-moves', {
    update(dt) {
      if (!ctx || !ctx.state.started || ctx.state.ended || G.dead) return;
      if ((ctx.blocked && ctx.blocked()) || dt <= 0) return;
      if (bleedT > 0 || sickT > 0) {
        dotAcc += dt * ((bleedT > 0 ? 1.1 : 0) + (sickT > 0 ? 2 : 0)); bleedT = Math.max(0, bleedT - dt); sickT = Math.max(0, sickT - dt);
        if (dotAcc >= 1 && G.hp > 1) { const k = Math.floor(dotAcc); dotAcc -= k; G.hurt(Math.min(k, G.hp - 1), { reason: 'bleed', soft: true }); }
      }
      for (const o of objs) {
        if (!o.on) continue; o.t += dt; const k = Math.min(1, o.t / o.dur);
        o.m.position.lerpVectors(o.from, o.to, k); o.m.position.y += Math.sin(k * Math.PI) * 0.9; o.m.rotation.x += dt * 9; o.m.rotation.z += dt * 5;
        if (k >= 1) {
          const p = P(); o.on = false; o.m.visible = false;
          if (Math.hypot(p.x - o.to.x, p.z - o.to.z) < 0.7) G.hurt(o.dmg, { reason: 'bitten' }); G.sfx3d && G.sfx3d('chip', o.m.position);
        }
      }
      for (const s of spews) {
        if (!s.on) continue; s.t -= dt; s.v[1] -= 9 * dt;
        s.m.position.x += s.v[0] * dt; s.m.position.y = Math.max(s.floor, s.m.position.y + s.v[1] * dt); s.m.position.z += s.v[2] * dt;
        if (s.m.position.y <= s.floor) { s.v[0] *= 0.6; s.v[2] *= 0.6; }
        if (s.t <= 0) { s.on = false; s.m.visible = false; }
      }
    },
  });

  // ---------------------------------------------------------------- per body, per frame (called by js/ext/zombies.js)
  const HOLD = new Set(['chase', 'idle', 'yk-move']);
  const rr = (L, [a, b]) => a + L.r() * (b - a);
  // returns true while a move owns the body this frame (the caller only settles it against the walls)
  G.moveTick = (L, d, dt, same) => {
    const z = L.z, ks = L.moves; if (!ks || !ks.length || !L.alive || z.dead) return false;
    L.same = same;
    let M = L.mv;
    if (M) {
      if (z.state !== 'yk-move') { if (M.y0 != null) z.root.position.y = M.y0; L.mv = null; L.mvCool = 2.5; return false; }   // hit in the tell or the act: it flinched, the move is off
      if (M.ph === 'tell') {
        z.yaw = M.lock != null ? M.lock : yawTo(L); M.t -= dt; z.update(dt, null);
        if (M.t <= 0) { M.ph = 'act'; DEF[M.k].start(L, M); }
        return true;
      }
      if (M.ph === 'rec') {   // after it lands or misses: a breath with its guard down (the opening to hit back or get away)
        M.t -= dt; z.update(dt, null);
        if (M.t <= 0) { L.mv = null; z.state = 'chase'; z.do('move'); L.mvCool = rr(L, DEF[M.k].cool); }
        return true;
      }
      const go = DEF[M.k].act(L, dt, M); z.update(dt, null);
      if (!go) { M.ph = 'rec'; M.t = 0.8; z.play('idle', { restart: true }); }
      return true;
    }
    // the ambusher waits: stands still breathing while the player is not close; a hit or a loud noise near wakes it into a normal chase
    if (ks.includes('ambush') && !L.sprung) {
      if (L.alert > 9 || z.life < z.maxLife) { L.sprung = true; return false; }
      L.breath = (L.breath || 0) - dt;
      if (d < 6 && sameFloor(L) && L.breath <= 0) { L.breath = 2.2 + L.r(); snd('wetbreath', L); if (d < 5) tellOnce('ambush', L); }
      if (d < 2.6 && sameFloor(L)) { L.sprung = true; begin(L, 'ambush'); return true; }
      if (z.state === 'chase') { z.state = 'idle'; z.do('idle'); }
      z.update(dt, null); return true;
    }
    L.mvCool = (L.mvCool ?? 2 + L.r() * 3) - dt;
    if (L.mvCool > 0 || !sameFloor(L) || !HOLD.has(z.state) || (G.grabbed && G.grabbed()) || !(same || d < 4)) return false;
    for (const k of ks) { if (k === 'ambush') continue; if (DEF[k].can(L, d)) { begin(L, k); return true; } }
    return false;
  };
  function begin(L, k) {
    const D = DEF[k], z = L.z;
    L.mv = { k, ph: 'tell', t: D.tell, lock: null };
    z.state = 'yk-move'; z.yaw = yawTo(L); D.pose(L);
    if (k !== 'ambush') tellOnce(k, L);
    G.emit('move:tell', { kind: k, id: L.def.id });
  }
  G.forceMove = (id, k) => { const L = G.liveZombies().find((q) => q.def.id === id); if (!L || !DEF[k]) return false; L.moves = [...new Set([...(L.moves || []), k])]; begin(L, k); return true; };
  G.MOVE_NAMES = Object.fromEntries(Object.entries(MOVES).map(([k, v]) => [k, v.name]));
}
