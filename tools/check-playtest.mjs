#!/usr/bin/env node
// Playtest findings as checks (standard 1.17.0, docs/playtest-findings.md). What players found by playing, looked for in every game, headless:
//   node tools/check-playtest.mjs [game-dir] [--scene <id>] [--json] [--strict] [--root public --path dot/]   (a built layer, e.g. a dot version)
// Opens the game in test mode (?test: no save is touched), starts it, closes the opening windows, and audits the built world:
//   P1  an [E] target (a thing to look at, a station) with nothing visible in its box: you can read a notice that is not there (#3) or
//       talk to someone who has left (#2)
//   P2  a flat rectangle lying on the floor that is see-through or glossy: a square puddle / a square hand print (#4, #19). Not flagged:
//       a material with an alphaMap (the map gives the shape), a mesh with userData.rectOk = true (a rectangle on purpose: a tank, a mat)
//   P3  a corridor narrowed below 1.2 m, or by more than 30 %, by furniture or a hiding place, away from its ends (#14)
//   P4  a low zone a standing body can walk into (#18)
//   P5  a person who jumped more than 1.2 m between two frames while visible (a teleport, #13): window.__gfNpcJumps (js/character.js)
//   P6  an item with no picture; a speaker of the talks with no portrait (#8, #9)
//   P7  the death card of each game.json "deaths" reason: it must cover the screen, have its button, and give play back (#23)
//   P8  a things.json ひとこと that repeats the text (#6)
//   P9  the menu has 操作方法 (#16)
//   P10 a flat paper / charm / poster whose middle is inside a wall, a post or a door frame (札の家 #2 #4 #14): use js/wall-paste.js
//   P11 a plain box with no texture, 0.25-2.4 m (札の家 #9)    P12 something standing in a doorway (札の家 #3)
//   P13 a thing to look at with nothing under it: floating (札の家 #1 #6)
//   P14 a paper high on a wall (a doc at 1 m or more) still lying flat: a sheet sticking out of the plaster (鏡屋 #1; the kit stands it since 1.18.0)
//   P15 a reason the game passes to ctx.die / ctx.hurt with no card of its own in game.json "deaths" (鏡屋: the hands and the woman of the
//       washroom said the same words)    P16 a room on the map too small for three characters of its name (鏡屋: 地下室 clipped)
//   1.20.0 (水無瀬病院 2nd play test, 15 items):
//   P17 a person in a wall / floating / standing on furniture (js/npc-audit.js: bones with radius vs colliders; window.__gfNpcBad while play runs)
//   P18 a control hint card that overlaps another notice or HUD part, or a second hint that replaced the first instead of waiting (#7)
//   P19 standing up under a low ceiling (C inside a low zone must keep the body crouched) (#9)
//   P20 a ladder / flight that moves the player at once (no climb) (#13)
//   P21 two opaque faces in the same plane, overlapping (z-fighting: the flicker of squares on the wall behind ひなた) (#1)
//   P22 a voice played around the one voice channel (new Audio / decodeAudioData in the game's own code) (#3)
//   1.20.2 (札の家 ドット版):
//   P23 a framed box whose text comes closer than 12 px to its frame (a button 8 px left / right), at 390 x 844 and 375 x 667 (tools/frame-padding.mjs)
//   P24 every thing card and document opened at 390 x 844 and 375 x 667: a line cut off by a box that cannot scroll (an error)
//   1.20.3 (札の家 ドット版, the user's phone play 2026-11-21):
//   P25 a card / document in the reading panel (js/toast-lane.js #gf-reader): HUD, touch controls or the say band on it (an error), no large
//       閉じる, less than half of a phone screen, or past the screen edge (「他のUIの邪魔にならないように広く場所を取るべき」)
//   P26 a document whose comment (monologue / talk) starts while the document is still open (「しっかりとテキストを見せた後に感想を」)
//   P27 a room that reads as black: mean luminance round the player under tools/scene-luma.mjs LUMA_DARK (「地下室が真っ暗で見えず」)
//   P28 a thing hanging on the wall where a door opens or slides (tools/wall-door.mjs: 「スライドする戸のところに壁掛け時計」)
//   P29 a person ("talk": true station) that the pick misses from the 1.0 / 1.8 m rings (tools/talk-ring.mjs: 「婆さんに話しかけづらい」)
//   P30 a picture shown outside the reading panel when an item or a thing is opened (「画像が画面中央の上部に出てきて邪魔」)
//   1.21.1 (水無瀬病院 ドット版, the user's iPhone play 2026-11-21; tools/hud-checks.mjs), at 390 x 844, 375 x 667 and 844 x 390:
//   P35 a close button that a finger cannot tap: something else is on top at its centre, or a real tap leaves its box there (an error)
//       (「上の通知でしゃがむの案内を閉じるで閉じられないです」)
//   P45 (1.27.0, 鏡屋 「ライトの土がズレている」) a lamp whose light (pooled or its own) is more than 5 cm from its bulb (a warning)
//   P46 (1.27.0, 鏡屋 「画像を全面に出して、ジョイスティックを重ねる」) photo-focus cfg.full: the picture fills the screen and the controls over it are
//       on the screen and do not overlap (an error), at every phone size of the pass (portrait too)
//   P44 (1.26.0) a mini game that scrolls or has a control off the screen on a landscape phone (844x390, 667x375, 844x340) (an error)
//   P36 a library mini game whose controls move when a caption / message gets longer (an error) (「文字が改行されると回す位置が変わってハンチングする」)
//   1.21.3 (鏡屋, the user's play 2026-11-21; tools/menu-checks.mjs):
//   P37 every entry of the menu opened (所持品, 気になること・写真, 覚え書き ...): a picture that does not load, a no-picture box taller than
//       100 px, letters standing in for a picture (an error) (「画像がない場合におかしくないですか？」)
//   P38 the window header's ⓘ / ×: the icon off the middle of its button, the button outside the header or over the frame (an error),
//       PC and the phone sizes (「一時停止のインフォメーションマークやバツボタンがズレています」)
//   P39 (1.21.4) the picture of a card / document as large as the room its text leaves (1366x768, 1920x1080, 390x844, 844x390, 844x340): grown one step
//       it would still fit and get larger = an error; its share of the free room under 0.6 = a warning (tools/menu-checks.mjs pictureRoomSource)
//   P40 (1.21.5) a picture in a reading panel / document smaller than the room allows, or words that do not fit or one cut out of its own shape (the talk picture too, beside its words) (an error), at 390 x 844,
//       375 x 667, 844 x 390, 844 x 340, 1366 x 768 and 1920 x 1080 (「十分に画面が大きい場合は大きな画像で表示するべきです」)
//   P41 (1.21.5) a sprite-stack body holding one pose other than idle / walk / run / crouch / sit for 3 s or more (「ひなたがずっと手をあげてます」)
//   1.22.0 (the 鏡屋 dot play test rolled out): P42 a mark (▼, arrow, the next-place pointer, a glow) drawn through a wall, every room
//   (tools/mark-sight.mjs; js/mark-sight.js markSight().clear() fixes it); P43 a pickup cut into by another thing - a wall clock over an
//   item (tools/pick-overlap.mjs)
//   1.28.0 (夜勤明けの街 play test 2026-11-22; tools/rest-check.mjs): P47 a placed thing floating - nothing under it within 4 cm, not a thin wall
//   thing against a wall, not hanging (「空中にものが浮いています（ラジオや紙）」); P48 a thing of a known kind out of body size - desks 0.66-0.8 m,
//   counters 0.82-1.05, doors 1.9-2.25, eyes 1.5-1.72, cars 3.6-5.4 long ... (「自分の体のサイズに合わせてサイズを考え直してください」).
//   Warnings until the fleet is cleared; game.json "checks": { "rest": "error" } makes them errors (夜勤明けの街 does).
//   P21+ a wall paper that flickers on a still picture (tools/frame-flicker.mjs, the dot layers too: 「張り紙よりも大きな枠が見えて、ちらついている」)
//   1.21.0: P33 (dot games) a visible material in a room that is not dot: a photo texture, a plain material, a smooth texture - walls,
//     floors and ceilings included (tools/dot-scene.mjs; js/dot-world.js dotifyScene draws them as dot tiles in the palette) (error)
//   1.21.0: P34 (dot games) a person or monster figure built at res 1 (people and monsters are res 2, 1.25 cm a voxel; game.json
//     "sprites": { "res": 1 } keeps the old one, with a warning) (error)
//   1.21.0: P32 framed panels on a phone (844x390, 667x375, 844x340): the inner frame inside its panel, no frame line across the text, no
//     content spilling out of a frame (error); an inner line drawn as a negative outline, a squashed picture (warning) (tools/frame-nest.mjs)
//   1.21.0: P31 phone layout at 844x390 / 667x375 (landscape) and 390x844 (portrait): the HUD covers more than PHONE_HUD_MAX of the screen,
//       two panels overlap (errors), the portrait notice is missing (tools/phone-layout.mjs: 「メッセージや通知で領域を使いすぎている」)
// Exit 1 on an error (P4, P7, P9, P19, P24, P25 overlap, P26, P30, P31, P32, P33, P34, P35, P36, P37, P38, P39, P40, P41, P42, P43, P44, P46, P47 / P48 with checks.rest = "error") or, with --strict, on a warning. The play scripts of a game check the rest (contact, speed, softlocks).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';
import { framePaddingSource, clippedTextSource } from './frame-padding.mjs';
import { frameNestSource } from './frame-nest.mjs';
import { dotSceneSource } from './dot-scene.mjs';
import { lumaSource, LUMA_DARK } from './scene-luma.mjs';
import { wallDoorSource } from './wall-door.mjs';
import { talkRingSource, TALK_RING_MIN } from './talk-ring.mjs';
import { flickerSource, FLICKER_MAX } from './frame-flicker.mjs';
import { phoneLayoutSource, PHONE_HUD_MAX } from './phone-layout.mjs';
import { closeTapSource, mgFitSource, mgStableSource, picFitSource } from './hud-checks.mjs';
import { menuPicturesSource, headButtonsSource, pictureRoomSource } from './menu-checks.mjs';
import { markSightSource } from './mark-sight.mjs';
import { pickOverlapSource } from './pick-overlap.mjs';
import { restSource, sizeSource } from './rest-check.mjs';
// P26: in ctx.readLog order, a 'say' / 'talk' after an 'open' and before its 'close'
const docOpenSay = (lg) => { let open = 0; for (const k of lg) { if (k === 'open') open++; else if (k === 'close') open = Math.max(0, open - 1); else if ((k === 'say' || k === 'talk') && open) return true; } return false; };

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['--scene', '--root', '--path'].includes(args[i - 1]))) || '.');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], warns = [];
const E = (id, m) => errors.push(`${id} ${m}`), Wn = (id, m) => warns.push(`${id} ${m}`);
const game = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')); } catch { return null; } };
const data = game.data || {};

// ---- static (no browser) ----
{
  const items = data.items ? readJson(data.items) : null;
  for (const it of (Array.isArray(items) ? items : (items && items.items) || [])) if (!it.photo && !it.img && !it.image) Wn('P6', `item "${it.id}" (${it.name || ''}) has no picture`);
  const talk = data.talk ? readJson(data.talk) : null, portraits = game.portraits || {};
  const who = new Set();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.who === 'string') who.add(v.who); Object.values(v).forEach(walk); } };
  walk(talk);
  const self = new Set(['私', '僕', '俺', 'わたし', '', game.player || '', ...(game.selfNames || [])]);
  for (const w of who) { const base = w.replace(/[（(].*$/, '').trim(); if (!self.has(w) && !self.has(base) && !portraits[w] && !portraits[base] && !/声|放送|無線の雑音|アナウンス|？/.test(w)) Wn('P6', `speaker "${w}" has no portrait (game.json portraits)`); }
  const things = data.things ? readJson(data.things) : null;
  const n = (x) => String(x || '').replace(/[\s「」『』（）()、。・…！？!?\-ー―*]/g, '');
  for (const t of (Array.isArray(things) ? things : (things && things.things) || [])) {   /* 1.17.2: things.json may be { photos, things } */ const tx = [].concat(t.text || []); if (t.feeling && tx.some((x) => n(x) && (n(x) === n(t.feeling) || (n(t.feeling).length > 8 && n(x).includes(n(t.feeling)))))) Wn('P8', `thing "${t.id}": ひとこと repeats the text`); }
}

// P15: every death reason in the game's code has its own card (the default card says nothing about what caught you)
if (game.deaths) {
  const reasons = new Map(), walkJs = (d) => { for (const f of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const q = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'kit' && f.name !== 'vendor') walkJs(q); } else if (/\.m?js$/.test(f.name)) { const src = fs.readFileSync(q, 'utf8'); for (const m of src.matchAll(/\b(?:die|hurt)\(\s*['"]([\w-]+)['"]/g)) reasons.set(m[1], path.relative(dir, q)); } } };
  walkJs(path.join(dir, 'js'));
  for (const [r, f] of reasons) if (!game.deaths[r]) Wn('P15', `death reason "${r}" (${f}) has no card in game.json "deaths": the player is not told what caught them`);
}
// P22: voices that do not go through the voice channel (ctx.voiceLine / ctx.playVoice, js/voice-queue.js): two voices at once
{
  const walk = (d) => { for (const f of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const q = path.join(d, f.name); if (f.isDirectory()) { if (!['kit', 'vendor', 'node_modules'].includes(f.name)) walk(q); } else if (/\.m?js$/.test(f.name)) { const src = fs.readFileSync(q, 'utf8'); if (/new Audio\([^)]*voice|voice[^\n]{0,80}decodeAudioData|createBufferSource\(\)[^\n]{0,200}voice/i.test(src)) Wn('P22', `${path.relative(dir, q)} plays a voice by itself: use ctx.voiceLine(src, null, { prio }) so two voices never overlap`); } } };
  walk(path.join(dir, 'js'));
}
// P16: room names that do not fit their room on the map
{
  const plan = data.plan ? readJson(data.plan) : null;
  const ms = [path.join(dir, 'js', 'kit', 'map-svg.js'), path.join(import.meta.dirname, '..', 'js', 'map-svg.js')].find((f) => fs.existsSync(f));
  if (plan && ms) {
    const { fitLabel, roomSpan } = await import(pathToFileURL(ms).href);
    // a game whose js/kit/map-svg.js is kept older (edited in the game, skipped by kit-sync) has no fitLabel: P16 is left out there
    if (typeof fitLabel === 'function' && typeof roomSpan === 'function') for (const r of plan.rooms || []) { const name = String(r.name || ''), fit = fitLabel(name, roomSpan(r, 16), 12); if ([...name].length > 3 && [...fit].length < 4) Wn('P16', `room "${r.id}" (${name}) shows as 「${fit}」 on the map: too small for its name (a shorter name, or "mapName")`); }
  }
}

// ---- in the page ----
const port = 47900 + Math.floor(Math.random() * 90);
const serve = path.join(dir, 'tools', 'serve.js');
const server = spawn(process.execPath, [fs.existsSync(serve) ? serve : path.join(import.meta.dirname, 'serve.js'), '--port', String(port), '--root', path.resolve(dir, arg('--root', '.'))], { stdio: 'ignore', cwd: dir });
const base = `http://127.0.0.1:${port}/${arg('--path', '')}`;
for (let i = 0; i < 60; i++) { if (await fetch(base).then((r) => r.ok).catch(() => false)) break; await sleep(100); }
const p = await launch({ width: 1280, height: 720 });
const G = async (expr) => { const s = await p.eval(`(async () => { const g = window.__game; return JSON.stringify(await (${expr})); })()`); return s === undefined ? undefined : JSON.parse(s); };
try {
  const sc = arg('--scene', null);
  await p.goto(`${base}?test=1${sc ? `&scene=${sc}` : ''}`);
  await p.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled || (window.__game && window.__game.state && window.__game.state.started)", 120000);
  if (!(await G('g.state.started'))) await G(`(document.getElementById('start-btn').click(), 1)`);
  for (let i = 0; i < 40 && !(await G('g.state.started')); i++) { await G(`([...document.querySelectorAll('button')].filter((b) => b.offsetParent && /始める|はじめる|タップ|クリック|OK|わかった/.test(b.textContent)).slice(0, 1).forEach((b) => b.click()), 1)`); await sleep(300); }
  await sleep(2000);
  for (let i = 0; i < 30 && (await G('g.blocked ? g.blocked() : false')); i++) { await G(`([...document.querySelectorAll('.wm-layer .btn.primary, .wm-layer button, [role=dialog] .btn.primary')].filter((b) => b.offsetParent).slice(0, 1).forEach((b) => b.click()), 1)`); await sleep(350); }
  const audit = await G(`(() => {
    const T = g.THREE, W = g.world, out = { p1: [], p2: [], p3: [], p4: [] };
    const shown = (o) => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };
    const drawn = (m) => { const mats = [].concat(m.material || []); return mats.some((mt) => mt && mt.visible !== false && mt.colorWrite !== false && !(mt.opacity === 0 && mt.transparent)); };
    const meshes = []; g.scene.updateMatrixWorld(true);
    g.scene.traverse((m) => {
      if (!(m.isMesh || m.isInstancedMesh || m.isSprite) || !shown(m) || !drawn(m)) return;
      if (m.isInstancedMesh && m.count > 0 && m.count < 20000) {   // batched props (racks, cabinets): one box per instance
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const M4 = new T.Matrix4(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M4); M4.premultiply(m.matrixWorld); const b = m.geometry.boundingBox.clone().applyMatrix4(M4), s = b.getSize(new T.Vector3()); if (isFinite(s.x)) meshes.push({ m, b, s, inst: true }); }
        return;
      }
      const b = new T.Box3().setFromObject(m); const s = b.getSize(new T.Vector3()); if (!isFinite(s.x)) return; meshes.push({ m, b, s });
    });
    const floorYs = [...new Set(((g.data.plan && g.data.plan.rooms) || []).map((r) => (W.floorY ? W.floorY(r.floor || 0) : 0)))]; if (!floorYs.length) floorYs.push(0);
    // P1: an [E] target with nothing visible inside its box (walls, floors and ceilings - anything over 2.5 m in two directions - do not count)
    for (const it of W.interactables || []) {
      const u = it.userData && it.userData.interact; if (!u || !shown(it) || it.userData.off) continue;
      if (u.kind === 'door' || u.kind === 'hide' || u.kind === 'pickup' || u.kind === 'item') continue;
      const b = new T.Box3().setFromObject(it).expandByScalar(0.12);
      const own = meshes.some(({ m, b: mb, s }) => m !== it && !it.children.includes(m) && [s.x, s.y, s.z].filter((v) => v > 2.5).length < 2 && mb.intersectsBox(b));
      const self = drawn(it) && it.material && it.material.visible !== false && it.material.colorWrite !== false;
      if (!own && !self) out.p1.push(u.kind + ':' + u.id + ' at ' + [b.getCenter(new T.Vector3())].map((c) => c.x.toFixed(1) + ',' + c.y.toFixed(1) + ',' + c.z.toFixed(1)));
    }
    // P2: flat see-through / glossy rectangles on the floor
    for (const { m, s, b } of meshes) {
      const geo = m.geometry; if (!geo || m.isInstancedMesh || !floorYs.some((y) => Math.abs(b.min.y - y) < 0.12)) continue;   // on a floor, not a shelf
      const mt = [].concat(m.material)[0]; if (!mt) continue;
      const flatFloor = s.y < 0.03 && s.x > 0.08 && s.z > 0.08 && s.x < 4 && s.z < 4;
      const rect = geo.type === 'PlaneGeometry' || (geo.type === 'BoxGeometry' && s.y < 0.03);
      if (flatFloor && rect && (mt.transparent || (mt.roughness != null && mt.roughness < 0.25)) && !mt.alphaMap && !(m.userData && m.userData.rectOk) && !(mt.map && mt.transparent && mt.map.image)) out.p2.push((m.name || geo.type) + ' ' + s.x.toFixed(2) + 'x' + s.z.toFixed(2) + ' at ' + b.min.x.toFixed(1) + ',' + b.min.z.toFixed(1));
    }
    // P3: corridors narrowed below 1.2 m or to less than 70 % of their width (away from their ends)
    const cols = (W.colliders || []).filter((c) => c.box && !c.off && !c.low && c.box.max.y > 0.5);
    // hiding places count by what you see (a locker narrows the way whether or not its walls are colliders)
    for (const it of W.interactables || []) { const u = it.userData && it.userData.interact; if (!u || !/hide/.test(u.kind || '')) continue; const grp = it.parent && it.parent !== W.group && it.parent !== g.scene ? it.parent : it; const box = new T.Box3().setFromObject(grp); if (isFinite(box.min.x)) cols.push({ box }); }
    for (const r of (g.data.plan && g.data.plan.rooms) || []) {
      const narrow = Math.min(r.w, r.d), long = Math.max(r.w, r.d); if (narrow > 3.2 || long < narrow * 3) continue;
      const fy = W.floorY ? W.floorY(r.floor || 0) : 0, alongX = r.w > r.d;
      for (let t = Math.max(0.5, narrow); t < long - Math.max(0.5, narrow); t += 0.25) {   // the ends (one width) are the corners: a locker belongs there
        const x = alongX ? r.x + t : null, z = alongX ? null : r.z + t; let free = narrow;
        for (const c of cols) { const B = c.box; if (B.min.y > fy + 1.6 || B.max.y < fy + 0.3) continue;
          if (alongX ? (x < B.min.x || x > B.max.x) : (z < B.min.z || z > B.max.z)) continue;
          const a0 = alongX ? r.z : r.x, a1 = a0 + narrow, lo = Math.max(a0, alongX ? B.min.z : B.min.x), hi = Math.min(a1, alongX ? B.max.z : B.max.x);
          if (hi > lo && hi - lo < narrow * 0.95) free -= hi - lo; }
        if (free < Math.max(1.2, narrow * 0.7)) { out.p3.push(r.id + ' (' + (r.name || '') + ') free ' + free.toFixed(2) + ' m at ' + (alongX ? 'x ' + x.toFixed(1) : 'z ' + z.toFixed(1))); t += 2; }
      }
    }
    // 1.17.3 (札の家 #1 #2 #3 #4 #6 #9 #14): what the eye found wrong in a built house
    const axisOk = (m) => { const e = m.matrixWorld.elements; for (const c of [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]]) { const L = Math.hypot(...c) || 1; if (Math.max(...c.map((v) => Math.abs(v) / L)) < 0.995) return false; } return true; };
    const solid = meshes.filter(({ m, s }) => !m.isSprite && !m.isInstancedMesh && Math.min(s.x, s.y, s.z) > 0.04 && axisOk(m) && ![].concat(m.material).some((mt) => mt && (mt.transparent || mt.visible === false || mt.colorWrite === false)));
    const near = (a, b) => { for (let x = a; x; x = x.parent) if (x === b) return true; for (let x = b; x; x = x.parent) if (x === a) return true; return a.parent && a.parent === b.parent && a.parent !== W.group && a.parent !== g.scene; };
    out.p10 = []; out.p11 = []; out.p12 = []; out.p13 = [];
    // P10: a paper / charm / poster (a flat mesh) with something right in front of its face (within 3 cm): it is inside a wall, a post or a door
    // frame, or another paper lies on it (#2 #4 #14). Five points of the face are tried from the front (+Z of a plane; both sides of a thin box).
    const rc10 = new T.Raycaster(), tg10 = meshes.filter(({ m }) => !m.isSprite && !m.isInstancedMesh).map(({ m }) => m);
    for (const { m, s, b } of meshes) {
      if (m.isSprite || m.isInstancedMesh || !m.geometry) continue;
      const dims = [s.x, s.y, s.z], plane = m.geometry.type === 'PlaneGeometry';
      if (!plane && (Math.min(...dims) > 0.02 || dims.filter((v) => v > 0.05 && v < 1.6).length < 2)) continue;
      if (plane && (dims.filter((v) => v > 0.05 && v < 1.6).length < 2 || dims.some((v) => v > 1.6))) continue;
      const q = new T.Quaternion(); m.getWorldQuaternion(q); const n = new T.Vector3(0, 0, 1).applyQuaternion(q).normalize();
      if (Math.abs(n.y) > 0.7) continue;   // papers on a wall; a mat or a ceiling board is not one
      const u = new T.Vector3(1, 0, 0).applyQuaternion(q), v = new T.Vector3(0, 1, 0).applyQuaternion(q), c = b.getCenter(new T.Vector3());
      const pp = m.geometry.parameters || {}, hw = (pp.width || s.x) * m.getWorldScale(new T.Vector3()).x * 0.35, hh = (pp.height || s.y) * m.getWorldScale(new T.Vector3()).y * 0.35;
      const pts = [c, c.clone().addScaledVector(u, hw).addScaledVector(v, hh), c.clone().addScaledVector(u, -hw).addScaledVector(v, hh), c.clone().addScaledVector(u, hw).addScaledVector(v, -hh), c.clone().addScaledVector(u, -hw).addScaledVector(v, -hh)];
      const others = tg10.filter((o) => o !== m && !near(m, o));
      const covered = (side) => pts.filter((pt) => { rc10.set(pt.clone().addScaledVector(n, side * 0.3), n.clone().multiplyScalar(-side)); rc10.far = 0.3 - 0.0005; const h = rc10.intersectObjects(others, false)[0]; return h && h.distance > 0.27; }).length;
      const k = plane ? covered(1) : Math.min(covered(1), covered(-1));
      if (k >= 2) out.p10.push((m.name || m.parent && m.parent.name || m.geometry.type) + ' at ' + c.x.toFixed(2) + ',' + c.y.toFixed(2) + ',' + c.z.toFixed(2) + ' (' + k + '/5 of the face covered)');
    }
    // P11: a plain box with no picture on it, bigger than a hand and smaller than a wall: reads as a placeholder (#9)
    for (const { m, s, b } of solid) {
      const grp = m.parent; if (grp && grp !== W.group && grp !== g.scene && grp.children.filter((x) => x.isMesh).length > 1) continue;   // a part of a made prop (a chest of drawers with its drawers): not a placeholder
      if (m.geometry.type !== 'BoxGeometry' || Math.min(s.x, s.y, s.z) < 0.25 || Math.max(s.x, s.y, s.z) > 2.4 || (m.userData && (m.userData.plainOk || m.userData.interact))) continue;
      const mats = [].concat(m.material); if (mats.some((mt) => mt.map || mt.isShaderMaterial || mt.isMeshBasicMaterial)) continue;
      const c = b.getCenter(new T.Vector3()); out.p11.push((m.name || 'box') + ' ' + s.x.toFixed(2) + 'x' + s.y.toFixed(2) + 'x' + s.z.toFixed(2) + ' at ' + c.x.toFixed(1) + ',' + c.z.toFixed(1));
    }
    // P12: something standing in a doorway: the middle of the opening, 0.7 m either side of the door (#3)
    const allCols = (W.colliders || []).filter((c) => c.box && !c.off && !c.low && !c.gate);
    for (const [id, d] of W.doors || new Map()) {
      if (!d.col || !d.col.box) continue; const B = d.col.box, sx = B.max.x - B.min.x, sz = B.max.z - B.min.z, alongX = sx > sz, w = Math.max(sx, sz);
      const cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2;
      const way = new T.Box3(new T.Vector3(alongX ? cx - w * 0.3 : cx - 0.7, B.min.y + 0.3, alongX ? cz - 0.7 : cz - w * 0.3), new T.Vector3(alongX ? cx + w * 0.3 : cx + 0.7, B.min.y + 1.6, alongX ? cz + 0.7 : cz + w * 0.3));
      const doorColsAll = new Set([...W.doors.values()].map((x) => x.col).filter(Boolean));
      const blk = allCols.find((c) => !doorColsAll.has(c) && c.box.intersectsBox(way) && (c.box.max.x - c.box.min.x) < 3 && (c.box.max.z - c.box.min.z) < 3);
      if (blk) out.p12.push(id + ' at ' + cx.toFixed(1) + ',' + cz.toFixed(1) + ' (something ' + (blk.box.max.x - blk.box.min.x).toFixed(2) + 'x' + (blk.box.max.z - blk.box.min.z).toFixed(2) + ' at ' + ((blk.box.min.x + blk.box.max.x) / 2).toFixed(1) + ',' + ((blk.box.min.z + blk.box.max.z) / 2).toFixed(1) + ')');
    }
    // P13: a thing to look at hanging in the air: nothing within 6 cm under it (#1 #6). userData.hangs = true for a thing that hangs on purpose.
    const rc = new T.Raycaster(); const targets = meshes.filter(({ m }) => !m.isSprite).map(({ m }) => m);
    for (const it of W.interactables || []) {
      const u = it.userData && it.userData.interact; if (!u || !shown(it) || it.userData.off || it.userData.hangs || u.kind === 'door' || u.kind === 'hide') continue;
      const b = new T.Box3().setFromObject(it); if (!isFinite(b.min.y) || floorYs.some((y) => b.min.y - y < 0.06)) continue;
      const vis = []; it.traverse((m) => { if (m !== it && targets.includes(m)) vis.push(m); }); if (!vis.length && !(it.isMesh && drawn(it))) continue; const body = vis.length ? vis : [it];   // an invisible hit box (a station, a look) is not the thing itself
      const bb = new T.Box3(); for (const m of body) bb.union(new T.Box3().setFromObject(m)); if (!isFinite(bb.min.y) || bb.max.y - bb.min.y < 0.005) continue;
      const c = bb.getCenter(new T.Vector3()); rc.set(new T.Vector3(c.x, bb.min.y + 0.002, c.z), new T.Vector3(0, -1, 0)); rc.far = 3;
      const others = targets.filter((m) => !body.includes(m) && m !== it);
      const onWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { rc.set(c.clone(), new T.Vector3(dx, 0, dz)); rc.far = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 0.08; return rc.intersectObjects(others, false).length > 0; });
      if (onWall) continue;   // a notice, a sign, a calendar: hung on the wall
      rc.set(new T.Vector3(c.x, bb.min.y + 0.002, c.z), new T.Vector3(0, -1, 0)); rc.far = 3;
      const h = rc.intersectObjects(others, false)[0];
      if (h && h.distance > 0.06 && !(h.object.userData && h.object.userData.interact)) out.p13.push(u.kind + ':' + u.id + ' ' + h.distance.toFixed(2) + ' m above ' + (h.object.name || h.object.geometry.type) + ' at ' + c.x.toFixed(1) + ',' + c.z.toFixed(1));
    }
    // P14: a paper above 1 m lying flat (a doc pickup whose model is a horizontal sheet)
    out.p14 = [];
    for (const it of W.interactables || []) {
      const u = it.userData && it.userData.interact, def = it.userData && it.userData.def; if (!u || u.kind !== 'doc' || !def || !(def.y >= 1) || def.wall === false) continue;
      const md = it.userData.model || it, b = new T.Box3().setFromObject(md), s = b.getSize(new T.Vector3());
      if (isFinite(s.y) && s.y < 0.05 && Math.max(s.x, s.z) > 0.1) out.p14.push(u.id + ' at ' + it.position.x.toFixed(1) + ',' + it.position.y.toFixed(1) + ',' + it.position.z.toFixed(1));
    }
    // P45 (1.27.0, 鏡屋 「ライトの土がズレている」): every lamp's light sits at its bulb (the pooled light's entry in world.lamps, or the room's own
    // lamp:<room> PointLight); more than 5 cm apart sideways and the lit spot on the floor and the walls is off the pendant
    out.p45 = [];
    { const bulbs = []; W.group.traverse((o) => { if (/^lampbulb:/.test(o.name || '')) bulbs.push(o); });
      for (const b of bulbs) {
        const room = b.name.slice(9), p = b.getWorldPosition(new T.Vector3()), e = (W.lamps || []).find((x) => x.room === room);
        let l = e ? { x: e.x, z: e.z } : null;
        if (!l) { const o = W.group.getObjectByName('lamp:' + room); if (o) { const q = o.getWorldPosition(new T.Vector3()); l = { x: q.x, z: q.z }; } }
        if (l) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d > 0.05) out.p45.push(room + ': the light is ' + d.toFixed(2) + ' m from its bulb'); }
      } }
    // P21 (1.20.0, 水無瀬病院 2nd #1 「チラチラ正方形の図が見えます」): two opaque faces in one plane facing the same way, overlapping - z-fighting.
    // Box faces and planes that are axis-aligned; a notice board sunk into the wall had its front face exactly on the plaster.
    out.p21 = [];
    { const faces = new Map(), key = (ax, sg, c) => ax + sg + Math.round(c * 400);
      const opaque = (m) => [].concat(m.material).every((mt) => mt && !mt.transparent && mt.visible !== false && mt.colorWrite !== false && !mt.polygonOffset);
      for (const { m, b } of meshes) {
        if (m.isSprite || m.isInstancedMesh || !m.geometry || !opaque(m) || !axisOk(m)) continue;
        const t = m.geometry.type; if (t !== 'BoxGeometry' && t !== 'PlaneGeometry') continue;
        const q = new T.Quaternion(); m.getWorldQuaternion(q);
        const add = (ax, sg, c, r) => { const k = key(ax, sg, c); if (!faces.has(k)) faces.set(k, []); faces.get(k).push({ m, c, r }); };
        const rect = (ax) => (ax === 'x' ? [b.min.y, b.max.y, b.min.z, b.max.z] : ax === 'y' ? [b.min.x, b.max.x, b.min.z, b.max.z] : [b.min.x, b.max.x, b.min.y, b.max.y]);
        if (t === 'BoxGeometry') { for (const ax of ['x', 'y', 'z']) { add(ax, '+', b.max[ax], rect(ax)); if (ax !== 'y') add(ax, '-', b.min[ax], rect(ax)); } }   // the underside of a box is never seen
        else { const n = new T.Vector3(0, 0, 1).applyQuaternion(q); const ax = Math.abs(n.x) > 0.99 ? 'x' : Math.abs(n.y) > 0.99 ? 'y' : Math.abs(n.z) > 0.99 ? 'z' : null; if (!ax) continue; add(ax, n[ax] > 0 ? '+' : '-', (b.min[ax] + b.max[ax]) / 2, rect(ax)); if (m.material.side === T.DoubleSide) add(ax, n[ax] > 0 ? '-' : '+', (b.min[ax] + b.max[ax]) / 2, rect(ax)); }
      }
      const seen21 = new Set();
      for (const list of faces.values()) {
        if (list.length < 2 || list.length > 400) continue;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const A = list[i], B = list[j]; if (A.m === B.m || near(A.m, B.m) || Math.abs(A.c - B.c) > 0.0015) continue;
          const w = Math.min(A.r[1], B.r[1]) - Math.max(A.r[0], B.r[0]), h = Math.min(A.r[3], B.r[3]) - Math.max(A.r[2], B.r[2]);
          const kitMade = (x) => /^(wall|ceil|floor|doorlook|hidelook|stair|lamp)/.test(x.m.name || (x.m.parent && x.m.parent.name) || '') || (x.m.name || '') === 'world';   // the kit's own joints (wall ends in a door frame) are left to the kit's tests
          if (w > 0.08 && h > 0.08 && w * h > 0.015 && !(kitMade(A) && kitMade(B))) { const nm = (x) => x.m.name || (x.m.parent && x.m.parent.name) || x.m.geometry.type, k2 = [nm(A), nm(B)].sort().join('|') + Math.round(A.c * 10); if (seen21.has(k2)) continue; seen21.add(k2); out.p21.push(nm(A) + ' and ' + nm(B) + ' share a face plane at ' + A.c.toFixed(3) + ' (' + (w * h).toFixed(3) + ' m2)'); }
        }
      }
    }
    // P4: low zones
    for (const Z of g.lowZones || []) if (!Z.standingBlocked()) out.p4.push(Z.id);
    out.jumps = window.__gfNpcJumps || [];
    out.menu = !!(g.pm && document) ; out.zones = (g.lowZones || []).length;
    return out;
  })()`);
  for (const x of audit.p1) Wn('P1', `[E] target with nothing visible: ${x}`);
  for (const x of audit.p2) Wn('P2', `flat rectangle on the floor (puddle / print?): ${x}`);
  for (const x of audit.p3) Wn('P3', `corridor narrowed: ${x}`);
  for (const x of audit.p4) E('P4', `low zone "${x}" lets a standing body in`);
  for (const j of audit.jumps) Wn('P5', `person jumped: ${j.name} ${j.from} -> ${j.to}`);
  for (const x of audit.p10.slice(0, 20)) Wn('P10', `a paper / charm with something on its face (inside a wall / a frame, or under another paper): ${x}`);
  for (const x of audit.p11.slice(0, 20)) Wn('P11', `a plain untextured box (a placeholder look; userData.plainOk if meant): ${x}`);
  for (const x of audit.p12) Wn('P12', `a doorway half blocked: ${x}`);
  for (const x of audit.p45 || []) Wn('P45', `a lamp's light is not at its lamp (the lit spot is off the pendant): ${x}`);
  for (const x of audit.p14) Wn('P14', `a paper on the wall lies flat (sticks out of the plaster): ${x}`);
  for (const x of audit.p13.slice(0, 20)) Wn('P13', `a thing floating in the air: ${x}`);
  for (const x of (audit.p21 || []).slice(0, 20)) Wn('P21', `z-fighting (two faces in one plane flicker): ${x}`);
  // P17: people (js/npc-audit.js, 1.20.0): what the audit saw while the game ran, and now
  {
    await sleep(1200);
    const npc = await G(`(() => ({ bad: (window.__gfNpcBad || []).map((x) => x.what + ': ' + x.detail), now: g.npcAudit ? g.npcAudit.now().map((x) => x.what + ': ' + x.detail) : null, n: g.npcAudit ? g.npcAudit.people().length : 0 }))()`);
    for (const x of [...new Set([...(npc.bad || []), ...(npc.now || [])])].slice(0, 20)) Wn('P17', `a person ${x}`);
  }
  // P19: a crouching body under a low ceiling cannot stand up (C keeps it crouched)
  {
    const r = await G(`(async () => { const out = []; if (!g.setCrouch || !(g.lowZones || []).length) return out; const c = g.camera.position, back = { x: c.x, z: c.z, floor: g.floor };
      for (const Z of g.lowZones) { g.teleport({ x: (Z.x0 + Z.x1) / 2, z: (Z.z0 + Z.z1) / 2, floor: Z.floor || 0 }); g.fp.crouching = true; await new Promise((r) => setTimeout(r, 150)); g.setCrouch(false); if (!g.fp.crouching) out.push(Z.id); g.fp.crouching = false; }
      g.teleport(back); return out; })()`);
    for (const id of r || []) E('P19', `low zone "${id}": C stands the body up under the low ceiling (ctx.setCrouch must keep it crouched: ctx.canStand)`);
  }
  // P18: a control hint lives in the notification lane, below / beside the others, never over them; a second one waits
  {
    const r = await G(`(async () => { if (!g.controlHint) return null; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      g.ui && g.ui.toast && g.ui.toast('テストの通知'); g.controlHint('__t1', { text: 'テストの操作その一', key: 'T', once: false }); g.controlHint('__t2', { text: 'テストの操作その二', key: 'U', once: false }); await wait(700);
      const card = document.querySelector('.gf-ch'); if (!card) return { none: true };
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, cr = R(card), hit = [];
      const vis = (e) => { if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05; };
      const parts = [...document.querySelectorAll('#hud-left > *, #hud-right > *, #hs-tc > *, #say, #gf-timed, .toast, #prompt')].filter((e) => e !== card && !card.contains(e) && !e.contains(card) && vis(e));
      for (const e of parts) { const r = R(e); if (r.l < cr.r - 1 && cr.l < r.r - 1 && r.t < cr.b - 1 && cr.t < r.b - 1) hit.push((e.id || e.className || e.tagName).toString().slice(0, 40)); }
      const shown = card.textContent, queued = g.controlHintQueue ? g.controlHintQueue() : null;
      card.querySelector('button') && card.querySelector('button').click(); await wait(500); const second = (document.querySelector('.gf-ch') || {}).textContent || ''; document.querySelectorAll('.gf-ch button').forEach((b) => b.click());
      return { hit, first: /その一/.test(shown), queued, second: /その二/.test(second) }; })()`);
    if (r && !r.none) {
      for (const x of r.hit || []) Wn('P18', `the control hint card overlaps "${x}" (it belongs in the notification lane, js/control-help.js 1.20.0)`);
      if (!r.first || !r.second) Wn('P18', `two control hints at once: the first ${r.first ? 'showed' : 'did not show'}, the second ${r.second ? 'waited and showed' : 'was lost'} (queue: ${JSON.stringify(r.queued)})`);
    }
  }
  // P20: a ladder / flight is climbed (the floor changes after a short climb, not at once)
  {
    const r = await G(`(async () => { const st = (g.world.interactables || []).find((o) => o.userData.interact && /stairs|ladder/.test(o.userData.interact.kind) && o.userData.interact.to && o.userData.interact.look !== 'lift' && (o.userData.interact.to.floor || 0) !== (g.floor || 0)); if (!st || !g.useStairs) return null;
      const o = st.userData.interact, back = { x: g.camera.position.x, z: g.camera.position.z, floor: g.floor }, f0 = g.floor, t0 = performance.now(); g.useStairs(o);
      const at0 = g.floor; let t1 = null; for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 100)); if (g.floor !== f0 && t1 == null) t1 = performance.now(); if (!(g.climbing && g.climbing())) break; }   // the end on the player's floor
      await new Promise((r) => setTimeout(r, 300)); const moved = g.floor !== f0; g.teleport(back); return { id: o.id, look: o.look, instant: at0 !== f0, ms: t1 == null ? null : Math.round(t1 - t0), moved }; })()`);
    if (r && r.instant) Wn('P20', `stairs "${r.id}" (${r.look}) move the player at once: no climb (game-core useStairs 1.20.0, game.json controls.climb)`);
    else if (r && !r.moved) Wn('P20', `stairs "${r.id}": the climb did not reach the other floor`);
  }
  // P28: nothing hangs where a door opens or slides
  { const hits = await G(wallDoorSource()); for (const x of (hits || []).slice(0, 12)) Wn('P28', `door "${x.door}": "${x.mesh}" at ${JSON.stringify(x.at)} ${x.why} (move it off the door's opening / slide; a charm meant for the door: userData.doorItem)`); }
  // P29: a person is easy to speak to
  { const r = await G(talkRingSource({ radii: [1.0, 1.8] })); for (const x of r || []) if (x.error || (x.spots && x.share < TALK_RING_MIN)) Wn('P29', `station "${x.id}" ("talk": true): picked from ${x.hits}/${x.spots} spots on the 1.0 / 1.8 m rings${x.error ? ` (${x.error})` : ''} (plan station "reach", world-from-plan TALK_REACH)`); }
  // P27: no room reads as black (the player in the middle of each room)
  {
    const rooms = await G(`(g.data.plan.rooms || []).map((r) => ({ id: r.id, x: r.x + r.w / 2, z: r.z + r.d / 2, floor: r.floor || 0 }))`);
    const back = await G(`({ x: g.camera.position.x, z: g.camera.position.z, floor: g.floor || 0, light: !!g.lightOn })`);
    const isDot = await G(`!!(g.manifest && (g.manifest.dot || g.manifest.dotPost))`), seenDot = new Set();
    await G(`(g.setLight && g.setLight(true), 1)`);   // the player's own light on (a dark beat before it is lit is the game's choice; the play scripts check it)
    for (const r of (rooms || []).slice(0, 40)) {
      await G(`(g.teleport({ x: ${r.x}, z: ${r.z}, floor: ${r.floor} }), g.fp.pitch = -0.25, 1)`); await sleep(350);
      const L = await G(lumaSource({ camera: '(window.__dot && window.__dot.topCam) || g.camera', points: { player: '[g.camera.position.x, g.world.floorY(g.floor || 0) + 0.6, g.camera.position.z]' } }));
      const m = L && L.points && L.points.player && L.points.player.on ? L.points.player.mean : null;
      if (L && L.frame < LUMA_DARK.frame) Wn('P27', `room "${r.id}": the picture is black (frame mean ${L.frame.toFixed(1)} < ${LUMA_DARK.frame}): a dim floor light, a lit radius round the player, a glow at the goal`);
      else if (m != null && m < LUMA_DARK.player) Wn('P27', `room "${r.id}": black round the player (mean ${m.toFixed(1)} < ${LUMA_DARK.player})`);
      // P42 (1.22.0): no mark draws through a wall from the middle of this room
      { const M = await G(markSightSource('g.scene', '(window.__dot && window.__dot.mode === "top" && window.__dot.topCam) || g.camera')); for (const x of ((M && M.through) || []).slice(0, 4)) E('P42', `room "${r.id}": the mark "${x.name}" at ${JSON.stringify(x.at)} shows through "${x.wall}" (depthTest on, or js/mark-sight.js markSight().clear())`); }
      // P33 (1.21.0, dot games): every visible material in this room is a sprite stack or a dot tile (no photo texture, walls included)
      if (isDot) {
        await sleep(400);
        const D = await G(dotSceneSource());
        for (const [k, c] of ((D && D.bad) || []).slice(0, 6)) if (!seenDot.has(k)) { seenDot.add(k); E('P33', `room "${r.id}": ${k} (x${c}) - not dot: draw it with js/dot-world.js dotifyScene (a dot tile / quantized picture in the palette) or as a sprite stack`); }
      }
    }
    // P34 (1.21.0, dot games): people and monsters are built at the fine resolution (res 2), unless game.json "sprites": { "res": 1 } chose the old one
    if (isDot) {
      const want = await G(`((g.manifest && g.manifest.sprites && g.manifest.sprites.res) || 2)`);
      const figs = await G(`(() => { const out = []; g.scene.traverse((o) => { if (/^figure:/.test(o.name || '')) out.push([o.name, o.userData.res || 1]); }); return out; })()`);
      for (const [n, rs] of figs || []) if (rs < want) E('P34', `${n} is built at res ${rs}; dot games draw people and monsters at res 2 (tools/sprite-stacks/motion_frames.py --res 2; game.json "sprites": { "res": 1 } keeps the old one)`);
      if (want < 2) Wn('P34', 'game.json "sprites": { "res": 1 }: the people are at the old (coarse) resolution');
    }
    await G(`(g.teleport(${JSON.stringify(back)}), g.setLight && g.setLight(${back.light}), 1)`);
  }
  // P21 (the dot layers too): a wall paper that flickers on a still picture
  {
    const ps = await G(`(() => { const T = g.THREE, out = []; g.world.group.traverse((o) => { if (!o.isMesh || !o.visible || out.length >= 12) return; if (!(o.userData.pasted || /^fuda:|paper|poster/i.test(o.name || ''))) return; const c = new T.Box3().setFromObject(o).getCenter(new T.Vector3()); out.push({ n: o.name || o.uuid.slice(0, 8), c: [c.x, c.y, c.z] }); }); return out; })()`);
    for (const w of ps || []) {
      const f = await G(flickerSource({ camera: '(window.__dot && window.__dot.topCam) || g.camera', points: { paper: JSON.stringify(w.c) }, frames: 6 }));
      if (f && f.paper && f.paper.on && f.paper.share > FLICKER_MAX) Wn('P21', `wall paper "${w.n}" flickers on a still picture (${f.paper.share} of its square jumps between frames: polygonOffset / one plane)`);
    }
  }
  // P37 (1.21.3): every entry of the menu opened - no broken picture, no big empty picture box, no letters standing in for a picture
  {
    const r = await G(menuPicturesSource());
    for (const [k, d] of ((r && r.bad) || []).slice(0, 8)) E('P37', `menu: ${k}: ${d} (js/inventory-ui.js picHtml: a missing picture is a small mark beside the name)`);
    if (r && r.skip) Wn('P37', r.skip);
  }
  // P38 (1.21.3): the window header's ⓘ / × centred in their buttons and inside the header and the frame (the menu open)
  {
    await G(`(g.tm && g.tm.open && g.tm.open('tasks'), 1)`); await sleep(400);
    const r = await G(headButtonsSource());
    for (const [k, d] of ((r && r.bad) || []).slice(0, 6)) E('P38', `the menu window: ${k}: ${d}`);
    await G(`(g.tm && g.tm.close && g.tm.close(), 1)`); await sleep(200);
  }
  // P41 (1.21.5): a sprite-stack body that held a pose other than idle / walk / run / crouch / sit for 3 s or more during the run
  // (js/sprite-stack-anim.js keeps the longest hold of each pose; a body's own holdOk poses are left out)
  const held = (await G(`globalThis.__gfMotionHeld || {}`)) || {};
  for (const [k, t] of Object.entries(held)) if (t >= 3) E('P41', `${k.replace('|', ' held the pose "')}" for ${t} s (a held pose looks stuck: back to idle after a moment)`);
  // P9: 操作方法 in the menu
  const ctl = await G(`(async () => { if (!g.pm) return 'no menu'; g.pm.open(); await new Promise((r) => setTimeout(r, 400)); const ok = [...document.querySelectorAll('.wm-layer button, .pm button')].some((b) => /操作方法/.test(b.textContent)); g.pm.close && g.pm.close(); return ok; })()`);
  if (ctl !== true) E('P9', `the menu has no 操作方法 (${ctl})`);
  // P7: each death card
  for (const reason of Object.keys(game.deaths || {})) {
    await G(`(g.die(${JSON.stringify(reason)}), 1)`);
    let seen = null;
    for (let i = 0; i < 40 && !seen; i++) { await sleep(150); seen = await G(`(() => { const c = document.querySelector('.gf-mo-card'); if (!c) return null; const r = c.getBoundingClientRect(), top = document.elementFromPoint(innerWidth / 2, innerHeight / 2); const b = c.querySelector('button'); return { covers: r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.95, onTop: !!(top && c.contains(top)), button: !!(b && b.offsetParent) }; })()`); }
    if (!seen) { Wn('P7', `death "${reason}": no death card showed (the game's own death sequence?)`); continue; }
    if (!seen.covers || !seen.onTop || !seen.button) E('P7', `death "${reason}": the card is not on screen (covers ${seen.covers}, on top ${seen.onTop}, button ${seen.button}) - play is held behind an invisible card`);
    await sleep(500); await G(`((document.querySelector('.gf-mo-card button') || { click() {} }).click(), 1)`); await sleep(1200);
    if (await G('g.blocked ? g.blocked() : false')) { await G(`([...document.querySelectorAll('.wm-layer .btn.primary')].filter((b) => b.offsetParent).forEach((b) => b.click()), 1)`); await sleep(800); }
    if (await G('g.blocked ? g.blocked() : false')) E('P7', `death "${reason}": still held after the retry button`);
  }
  // P23 / P24 (1.20.2, 札の家 ドット版): the UI on a phone. P23 text too close to its frame (warning); P24 every card and document opened at
  // 390 x 844 and 375 x 667: a line of text cut off by a box that cannot scroll is an error (「スクロールできないので文字が見られません」)
  for (const [w, h] of [[390, 844], [375, 667], [844, 390]]) {
    const q = await launch({ width: w, height: h, mobile: true, dpr: 2 });
    const Q = async (expr) => { const s = await q.eval(`(async () => { const g = window.__game; return JSON.stringify(await (${expr})); })()`); return s === undefined ? undefined : JSON.parse(s); };
    const closeAll = () => Q(`(g.lane && g.lane.clear && g.lane.clear('card'), g.wm && g.wm.isOpen && g.wm.close(), [...document.querySelectorAll('.wm-layer .btn.primary')].filter((b) => b.offsetParent).forEach((b) => b.click()), 1)`);
    try {
      await q.goto(`${base}?test=1`);
      await q.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled || (window.__game && window.__game.state && window.__game.state.started)", 120000);
      if (!(await Q('g.state.started'))) await Q(`(document.getElementById('start-btn').click(), 1)`);
      await sleep(2500);
      for (let i = 0; i < 30 && (await Q('g.blocked ? g.blocked() : false')); i++) { await closeAll(); await sleep(400); }
      await sleep(600);
      // P35 (1.21.1): a control hint up, then every close button on screen by a real tap
      await Q(`(g.controlHint && g.controlHint('crouch', { why: 'できるようになった。', once: false }), 1)`); await sleep(1200);
      for (const c of await Q(closeTapSource())) {
        if (!c.on) { E('P35', `${w}x${h}: the close button of ${c.id} is under ${c.top} (a finger on it hits that instead)`); continue; }
        if (c.id !== '#gf-ch') continue;
        await q.tap(c.x, c.y); await sleep(900);
        if (await Q(`!!document.querySelector('#gf-ch')`)) E('P35', `${w}x${h}: a tap on 閉じる of ${c.id} did not close it`);
        else { await sleep(2000); if (await Q(`!!document.querySelector('#gf-ch')`)) E('P35', `${w}x${h}: ${c.id} came back after it was closed`); }
      }
      for (let i = 0; i < 10 && (await Q('g.blocked ? g.blocked() : false')); i++) { await closeAll(); await sleep(400); }
      // P36 (1.21.1): each library mini game once (at the first size)
      if (w === 390) for (const t of (await Q(`g.data.tasks.filter((t) => t.minigame && t.minigame.type).map((t) => t.id)`)) || []) {
        const r = await Q(mgStableSource(t)); if (!r || !r.open) continue;
        for (const m of r.moved) E('P36', `${w}x${h} task "${t}" (${r.type}): a longer text moves a control: ${m}`);
        for (let i = 0; i < 10 && (await Q('g.blocked ? g.blocked() : false')); i++) { await closeAll(); await sleep(400); }
      }
      { await Q(`(g.tm && g.tm.open && g.tm.open('tasks'), 1)`); await sleep(400); const hb = await Q(headButtonsSource()); for (const [k, d] of ((hb && hb.bad) || []).slice(0, 4)) E('P38', `${w}x${h} the menu window: ${k}: ${d}`); await Q(`(g.tm && g.tm.close && g.tm.close(), 1)`); await sleep(200); }
      for (const x of (await Q(framePaddingSource())).slice(0, 12)) Wn('P23', `${w}x${h} ${x.sel} 「${x.text}」: text ${x.min} px from its frame (needs ${x.need[0]} px, gaps l${x.gap.l} r${x.gap.r} t${x.gap.t} b${x.gap.b})`);
      if (!(await Q('typeof g.useInteract === "function"'))) { Wn('P24', 'ctx.useInteract is missing (kit < 1.20.2): the cards and documents were not opened'); continue; }
      const list = await Q(`g.world.interactables.map((o) => o.userData.interact).filter((ia) => ia && (ia.kind === 'look' || ia.kind === 'thing' || ia.kind === 'doc')).map((ia) => ({ kind: ia.kind, id: ia.id }))`);
      let n = 0;
      for (const ia of list.slice(0, 80)) {
        await Q(`(g.useInteract(g.world.interactables.map((o) => o.userData.interact).find((x) => x && x.kind === ${JSON.stringify(ia.kind)} && x.id === ${JSON.stringify(ia.id)})), 1)`);
        await sleep(700);
        const rd = await Q(`(() => { const r = document.querySelector('#gf-reader > .tl-read'); if (!r) return null; const R = r.getBoundingClientRect(), vis = (e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; }, hit = [];
          for (const e of document.querySelectorAll('#hud *, #touch *, #say, #prompt')) { if (r.contains(e) || !vis(e)) continue; const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue; if (q.right > R.left + 1 && q.left < R.right - 1 && q.bottom > R.top + 1 && q.top < R.bottom - 1 && (e.textContent.trim() || e.matches('button'))) hit.push((e.id || e.className || e.tagName).toString().slice(0, 40)); }
          const c = r.querySelector('.tl-close'), cr = c && c.getBoundingClientRect();
          return { hit: [...new Set(hit)].slice(0, 5), share: +(R.width * R.height / (innerWidth * innerHeight)).toFixed(2), inView: R.left >= 0 && R.top >= 0 && R.right <= innerWidth + 0.5 && R.bottom <= innerHeight + 0.5, close: cr ? Math.round(Math.min(cr.width, cr.height)) : 0 }; })()`);
        if (rd) {
          if (rd.hit.length) E('P25', `${w}x${h} ${ia.kind} "${ia.id}": HUD on the reading panel: ${rd.hit.join(', ')}`);
          if (rd.close < 44) Wn('P25', `${w}x${h} ${ia.kind} "${ia.id}": the reading panel has no large 閉じる (${rd.close} px)`);
          if (rd.share < 0.5 || !rd.inView) Wn('P25', `${w}x${h} ${ia.kind} "${ia.id}": the reading panel takes ${rd.share} of the screen${rd.inView ? '' : ', past the edge'}`);
        }
        const fl = await Q(`[...document.querySelectorAll('#look img, .tl-lane img, .tl-lane .tl-photocard, #hud .tl-photocard')].filter((e) => !e.closest('#gf-reader') && e.getBoundingClientRect().width > 8 && getComputedStyle(e).visibility !== 'hidden').length`);
        if (fl) E('P30', `${w}x${h} ${ia.kind} "${ia.id}": a picture shown outside the reading panel (${fl})`);
        if (ia.kind === 'doc') {
          await sleep(1800);
          const lg = await Q(`(g.readLog || []).map((x) => x[0])`);
          if (Array.isArray(lg) && docOpenSay(lg)) E('P26', `${w}x${h} doc "${ia.id}": a comment started while the document was open (${lg.join(' ')})`);
        }
        const cut = await Q(clippedTextSource('body'));
        for (const x of cut.slice(0, 3)) E('P24', `${w}x${h} ${ia.kind} "${ia.id}": 「${x.text}」 cut off by ${x.sel} (${x.out.b ? `${x.out.b} px below` : `${x.out.t} px above`}; overflow ${x.scroll.y}, cannot scroll to it)`);
        n++;
        await closeAll(); await sleep(250);
      }
      if (!n) Wn('P24', `${w}x${h}: no thing or document to open`);
    } catch (e) { Wn('P24', `${w}x${h}: the phone pass could not run: ${e.message}`); }
    finally { await q.close(); }
  }
  // P43 (1.22.0): pickups clear of other things
  { const O = await G(pickOverlapSource()); for (const x of (Array.isArray(O) ? O : []).slice(0, 12)) E('P43', `pickup "${x[0]}": "${x[1]}" cuts into it by ${JSON.stringify(x[2])} m at ${JSON.stringify(x[3])}`); }
  // P47 / P48 (1.28.0, 夜勤明けの街): every placed thing rests on something; known kinds have a body-sized size (tools/rest-check.mjs).
  // Warnings in 1.28.0 (errors with --strict) until the fleet is cleared; game.json "checks": { "rest": "error" } makes them errors.
  { let ck = {}; try { ck = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8')).checks || {}; } catch {} const R = ck.rest === 'error' ? E : Wn;
    const F = await G(restSource()); if (F && F.error) Wn('P47', F.error); else for (const x of (Array.isArray(F) ? F : []).slice(0, 20)) R('P47', `"${x.name}" floats: its bottom is ${x.above == null ? 'over nothing' : x.above + ' m over what is under it'} at ${JSON.stringify(x.at)} (size ${JSON.stringify(x.size)})`);
    const S = await G(sizeSource({ extraRules: ck.sizeRules || [] })); if (S && S.error) Wn('P48', S.error); else for (const x of (Array.isArray(S) ? S : []).slice(0, 20)) R('P48', `"${x.name}" (${x.kind}) ${x.measure} ${x.value} m, not ${x.min}-${x.max} m, at ${JSON.stringify(x.at)}`); }
  // P39 (1.21.4, 鏡屋): the picture of a card / document as large as the room its text leaves, on a PC and on a phone
  for (const [w, h, mob] of [[1366, 768], [1920, 1080], [390, 844, 1], [844, 390, 1], [844, 340, 1]]) {
    const q = await launch(mob ? { width: w, height: h, mobile: true, dpr: 2 } : { width: w, height: h });
    const Q = async (expr) => { const s = await q.eval(`(async () => { const g = window.__game; return JSON.stringify(await (${expr})); })()`); return s === undefined ? undefined : JSON.parse(s); };
    const closeAll = () => Q(`(g.lane && g.lane.clear && g.lane.clear('card'), g.wm && g.wm.isOpen && g.wm.close(), [...document.querySelectorAll('.wm-layer .btn.primary')].filter((b) => b.offsetParent).forEach((b) => b.click()), 1)`);
    try {
      await q.goto(`${base}?test=1`);
      await q.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled || (window.__game && window.__game.state && window.__game.state.started)", 120000);
      if (!(await Q('g.state.started'))) await Q(`(document.getElementById('start-btn').click(), 1)`);
      await sleep(2500);
      for (let i = 0; i < 30 && (await Q('g.blocked ? g.blocked() : false')); i++) { await closeAll(); await sleep(400); }
      if (!(await Q('typeof g.useInteract === "function"'))) break;
      const list = await Q(`g.world.interactables.map((o) => o.userData.interact).filter((ia) => ia && (ia.kind === 'look' || ia.kind === 'thing' || ia.kind === 'doc')).map((ia) => ({ kind: ia.kind, id: ia.id }))`);
      let n = 0, low = 0;
      for (const ia of list.slice(0, 60)) {
        if (n >= 10) break;
        await Q(`(g.useInteract(g.world.interactables.map((o) => o.userData.interact).find((x) => x && x.kind === ${JSON.stringify(ia.kind)} && x.id === ${JSON.stringify(ia.id)})), 1)`);
        await sleep(800);
        const r = await Q(pictureRoomSource());
        if (r && r.n) {
          n++;
          for (const [k, d] of r.bad.slice(0, 2)) E('P39', `${w}x${h} ${ia.kind} "${ia.id}": ${k}: ${d}`);
          for (const x of r.info) if (x.share < 0.6 && low++ < 4) Wn('P39', `${w}x${h} ${ia.kind} "${ia.id}": the picture fills ${x.share} of the free room (${x.where}, ${x.at})`);
        }
        // P40 (1.21.5, 水無瀬病院 ドット版): a picture cut out of its own shape (object-fit against a width cap), or smaller than the room
        // beside / under its words (the talk picture beside its words in a low wide window too); words that scroll
        for (const x of (await Q(picFitSource())) || []) {
          if (x.over) E('P40', `${w}x${h} ${ia.kind} "${ia.id}": the text does not fit its ${x.where} (it scrolls)`);
          else if (x.crop) E('P40', `${w}x${h} ${ia.kind} "${ia.id}": the picture (${x.pic.join(' x ')}) is cut out of its own shape (object-fit against a width cap)`);
        }
        await closeAll(); await sleep(250);
      }
    } catch (e) { Wn('P39', `${w}x${h}: the picture pass could not run: ${e.message}`); }
    finally { await q.close(); }
  }
  // P31 (1.21.0): the phone layout, landscape and portrait, with a notice on screen (the worst case the player meets)
  for (const [w, h] of [[844, 390], [667, 375], [844, 340], [390, 844]]) {
    const q = await launch({ width: w, height: h, mobile: true, dpr: 2 });
    const Q = async (expr) => { const s = await q.eval(`(async () => { const g = window.__game; return JSON.stringify(await (${expr})); })()`); return s === undefined ? undefined : JSON.parse(s); };
    try {
      await q.goto(`${base}?test=1`);
      await q.waitFor("window.__game && document.getElementById('start-btn') && !document.getElementById('start-btn').disabled || (window.__game && window.__game.state && window.__game.state.started)", 120000);
      if (h > w) { await sleep(800); const r0 = await Q(phoneLayoutSource()); if (r0.phone && !r0.rotate) E('P31', `${w}x${h}: no 横向き notice in portrait (js/phone-play.js)`); await Q(`((document.querySelector('#gf-rotate .gf-rot-ok') || { click() {} }).click(), 1)`); }
      if (!(await Q('g.state.started'))) await Q(`(document.getElementById('start-btn').click(), 1)`);
      await sleep(2500);
      for (let i = 0; i < 30 && (await Q('g.blocked ? g.blocked() : false')); i++) { await Q(`(g.lane && g.lane.clear && g.lane.clear('card'), g.wm && g.wm.isOpen && g.wm.close(), [...document.querySelectorAll('.wm-layer .btn.primary, #gf-reader .tl-close')].filter((b) => b.offsetParent).forEach((b) => b.click()), 1)`); await sleep(400); }
      await sleep(5500);   // past the goal's flash
      await Q(`(g.ui && g.ui.toast && g.ui.toast('テストの通知'), g.ui && g.ui.toast && g.ui.toast('二つ目の通知'), 1)`); await sleep(700);
      const r = await Q(phoneLayoutSource());
      if (!r.phone) { Wn('P31', `${w}x${h}: not treated as a phone (body.gf-phone missing: kit < 1.21.0 or game.json ui.phone false)`); continue; }
      const max = r.portrait ? PHONE_HUD_MAX.portrait : PHONE_HUD_MAX.landscape;
      if (r.cover > max) E('P31', `${w}x${h}: the HUD covers ${Math.round(r.cover * 100)}% of the screen (max ${Math.round(max * 100)}%): ${r.parts.join(', ')}`);
      for (const o of r.overlaps) E('P31', `${w}x${h}: "${o[0]}" and "${o[1]}" overlap (${o[2]}x${o[3]} px)`);
      // the crowded moment (水無瀬病院 「通知が多すぎます」): a thought line, a notice, a control hint and the goal flash at once -> one box shows
      await Q(`(g.phone && g.phone.flashGoal && g.phone.flashGoal(4), g.controlHint && g.controlHint('custom', { key: 'G', touch: '［テスト］', text: 'テストの操作', once: false }), g.ui && g.ui.toast && g.ui.toast('三つ目の通知'), g.ui && g.ui.say && g.ui.say('テストの独り言。'), 1)`); await sleep(700);
      const r2 = await Q(phoneLayoutSource());
      if (r2.msgs.length > 1) E('P31', `${w}x${h}: ${r2.msgs.length} message boxes at once (${r2.msgs.join(', ')}); a phone shows one (js/phone-play.js gf-saying / gf-hinting)`);
      for (const o of r2.overlaps) E('P31', `${w}x${h} (crowded): "${o[0]}" and "${o[1]}" overlap (${o[2]}x${o[3]} px)`);
      // P44 (1.26.0): every mini game fits a landscape phone (844x390, 667x375, 844x340): no scroll, every control on screen
      if (w > h) for (const t of (await Q(`g.data.tasks.filter((t) => t.minigame && t.minigame.type).map((t) => t.id)`)) || []) {
        const m = await Q(mgFitSource(t)); if (!m || !m.open) continue;
        if (m.scroll > 2) E('P44', `${w}x${h} task "${t}" (${m.type}): the mini game scrolls by ${m.scroll} px`);
        for (const [c, by] of m.off) E('P44', `${w}x${h} task "${t}" (${m.type}): "${c}" is ${by} px off the screen`);
        for (let i = 0; i < 10 && (await Q('g.blocked ? g.blocked() : false')); i++) { await Q(`(g.wm && g.wm.isOpen && g.wm.close(), 1)`); await sleep(300); }
      }
      // P46 (1.27.0, 鏡屋 「画像を全面に出して、ジョイスティックを重ねる」): a full-screen viewfinder covers the screen, its controls are on it and apart
      for (const t of ((await Q(`g.data.tasks.filter((t) => t.minigame && t.minigame.type === 'photo-focus' && t.minigame.cfg && t.minigame.cfg.full).map((t) => t.id)`)) || []).slice(0, 1)) {
        const m = await Q(mgFitSource(t)); if (!m || !m.open || !m.full) { if (m && m.open) E('P46', `${w}x${h} task "${t}": cfg.full but the viewfinder is not full-screen (kit < 1.27.0?)`); continue; }
        if (m.full.cover < 0.95) E('P46', `${w}x${h} task "${t}": the picture covers ${Math.round(m.full.cover * 100)}% of the screen (95% or more)`);
        if (m.full.helpCut) E('P46', `${w}x${h} task "${t}": the help is cut (more than two lines or 「…」): shorten 「${m.full.help}」`);
        for (const o of m.full.overlaps) E('P46', `${w}x${h} task "${t}": "${o[0]}" and "${o[1]}" overlap (${o[2]}x${o[3]} px)`);
        for (const [c, by] of m.off) E('P46', `${w}x${h} task "${t}": "${c}" is ${by} px off the screen`);
        for (let i = 0; i < 10 && (await Q('g.blocked ? g.blocked() : false')); i++) { await Q(`(g.wm && g.wm.isOpen && g.wm.close(), 1)`); await sleep(300); }
      }
      // P32 (1.21.0): framed panels in a short landscape (the address bar showing: 844x340 is checked below too)
      for (const x of await Q(frameNestSource())) (x.kind === 'squash' || x.kind === 'inset' ? Wn : E)('P32', `${w}x${h} ${x.sel}: ${x.kind}${x.text ? ` 「${x.text}」` : ''} ${JSON.stringify(x.by)}`);
    } catch (e) { Wn('P31', `${w}x${h}: the phone layout pass could not run: ${e.message}`); }
    finally { await q.close(); }
  }
  if (p.errors.length) for (const e of [...new Set(p.errors)].filter((x) => !/favicon/.test(x)).slice(0, 5)) Wn('P0', `page error: ${e.slice(0, 200)}`);
} catch (e) { E('P0', `the check could not run: ${e.message}`); }
finally { await p.close(); server.kill(); }
if (args.includes('--json')) console.log(JSON.stringify({ errors, warns }, null, 1));
else { for (const w of warns) console.log(`WARN  ${w}`); for (const e of errors) console.log(`ERROR ${e}`); console.log(`check-playtest: ${errors.length} error(s), ${warns.length} warning(s) (docs/playtest-findings.md)`); }
process.exit(errors.length || (args.includes('--strict') && warns.length) ? 1 : 0);
