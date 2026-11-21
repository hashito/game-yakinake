// The case: a grid bag the player packs like a puzzle (往診かばん 6x4, later the 登山リュック 8x5), the storage box of the safe rooms,
// the things lying in the world (loot) and the boxes that give several at once. [B] / the ケース button / [I] opens it.
//   PC: drag a thing to a cell ([R] or the wheel turns it while held); a click picks it up and a second click puts it down.
//   Phone: tap a thing (it is held), tap a cell to put it; 回す turns it. The buttons under the grid use, equip, combine or store it.
import * as THREE from 'three';
import { CATALOG, BAGS, STORE, fits, findPlace, dims, comboOf } from './case-data.js';

let UID = 1;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function installCase(ext, G) {
  const C = G.case = { bag: 'doctor', items: [], store: [], held: null, sel: null };
  const bagDim = () => BAGS[C.bag];
  const make = (id, n = 1, o = {}) => ({ uid: UID++, id, n, x: 0, y: 0, rot: 0, ...(CATALOG[id].gun ? { loaded: 0 } : {}), ...o });
  const stackOf = (id) => CATALOG[id].stack || 1;
  let ctx = null;
  ext.on('game:ready', (c) => { ctx = c; });

  /** put n of id into the bag (stacks first, then free places); returns what did not fit */
  C.add = (id, n = 1, o = {}) => {
    let left = n;
    const max = stackOf(id);
    if (max > 1) for (const it of C.items) if (it.id === id && it.n < max && left > 0) { const k = Math.min(max - it.n, left); it.n += k; left -= k; }
    while (left > 0) {
      const it = make(id, Math.min(max, left), o), W = bagDim();
      const at = findPlace(C.items, W.w, W.h, it);
      if (!at) break;
      Object.assign(it, at); C.items.push(it); left -= it.n;
    }
    G.emit && G.emit('case:change');
    return left;
  };
  C.count = (id) => C.items.filter((i) => i.id === id).reduce((s, i) => s + i.n, 0);
  C.take = (id, n) => { let k = n; for (const it of [...C.items]) { if (it.id !== id || k <= 0) continue; const t = Math.min(it.n, k); it.n -= t; k -= t; if (it.n <= 0) C.items.splice(C.items.indexOf(it), 1); } G.emit && G.emit('case:change'); return n - k; };
  C.weapons = () => C.items.filter((i) => CATALOG[i.id].kind === 'weapon');
  C.byUid = (uid) => C.items.find((i) => i.uid === uid) || null;
  C.snapshot = () => JSON.parse(JSON.stringify({ bag: C.bag, items: C.items, store: C.store, uid: UID, equip: G.equip || null }));
  C.restore = (s) => { if (!s) return; C.bag = s.bag || 'doctor'; C.items = s.items || []; C.store = s.store || []; UID = Math.max(UID, s.uid || 1); G.equip = s.equip || null; G.emit && G.emit('case:change'); };

  /** a box or a person gives several things: what does not fit is left on the floor in front of the player as loot */
  C.give = (list, where = '') => {
    const got = [], left = [];
    for (const [id, n, o] of list) { const r = C.add(id, n, o || {}); if (n - r > 0) got.push(`${CATALOG[id].name}${n - r > 1 ? `×${n - r}` : ''}`); if (r > 0) left.push([id, r, o]); }
    if (got.length && ctx) ctx.ui.toast(`入手：${esc(got.join('、'))}`);
    if (left.length && ctx) {
      const p = ctx.camera.position, f = new THREE.Vector3(); ctx.camera.getWorldDirection(f); f.y = 0; f.normalize();
      left.forEach(([id, n, o], i) => dropLoot({ id: `drop-${UID++}`, item: id, n, o, x: p.x + f.x * 0.8 + (i % 3 - 1) * 0.3, z: p.z + f.z * 0.8, floor: ctx.floor || 0, y: 0.05 }));
      ctx.ui.say(`ケースに入りきらない物は、足もとに置いた${where ? `（${where}）` : ''}。ケースを詰め直すか、保管箱へ。`, 6);
    }
    return { got, left };
  };

  // ---------------------------------------------------------------- loot lying in the world
  const LOOT = G.lootDefs || [];
  const lootMeshes = new Map();
  const taken = new Set();
  const lootMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false });
  function lootMesh(def) {
    const c = CATALOG[def.item];
    const g = new THREE.Group();
    // a small dot-looking block in the thing's colour (the dot layer swaps it for a sprite-stack part when one exists)
    const col = { weapon: 0x8a8f96, ammo: 0xd0a040, med: 0xe8e4dc, part: 0x9aa08a }[c.kind] || 0xb0b0b0;
    const w = Math.max(0.14, c.w * 0.09), d = Math.max(0.14, c.h * 0.09);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.18 }));
    m.position.y = 0.04; m.name = `loot-model:${def.item}`; g.add(m);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.36, w + 0.15), 0.3, Math.max(0.36, d + 0.15)), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.12; g.add(hit);
    g.name = `loot:${def.id}`;
    g.userData.interact = { kind: 'loot', id: def.id, label: `${c.name}${def.n > 1 ? `×${def.n}` : ''}` };
    g.userData.def = def;
    g.userData.model = m;
    return g;
  }
  function dropLoot(def) {
    if (!ctx) return;
    const W = ctx.world, g = lootMesh(def);
    g.position.set(def.x, W.floorY(def.floor || 0) + (def.y || 0), def.z);
    W.group.add(g); W.interactables.push(g); lootMeshes.set(def.id, g);
    G.emit && G.emit('loot:placed', { def, mesh: g });
  }
  function removeLoot(id) {
    const g = lootMeshes.get(id); if (!g || !ctx) return;
    g.removeFromParent(); const i = ctx.world.interactables.indexOf(g); if (i >= 0) ctx.world.interactables.splice(i, 1); lootMeshes.delete(id);
  }
  C.placeLoot = () => {
    for (const [id] of lootMeshes) removeLoot(id);
    const plan = ctx.data.plan;
    for (const def of LOOT) {
      if (taken.has(def.id)) continue;
      const R = plan.rooms.find((r) => r.id === def.room); if (!R) continue;
      dropLoot({ ...def, floor: R.floor || 0, x: def.x, z: def.z });
    }
  };
  ext.on('game:ready', () => C.placeLoot());
  ext.registerInteract('loot', {
    prompt: (o) => `[E] 拾う：${o.label}`,
    run: (o) => {
      const g = lootMeshes.get(o.id); if (!g) return;
      const def = g.userData.def, r = C.add(def.item, def.n, def.o || {});
      if (r === def.n) { ctx.ui.say(`ケースに入らない。ケースを開いて（${ctx.isTouch ? '「ケース」' : '[B]'}）、詰め直すか、何かを置いていく。`, 5, { urgent: true }); return; }
      ctx.sound && ctx.sound('pickup');
      ctx.ui.toast(`入手：${esc(CATALOG[def.item].name)}${def.n - r > 1 ? `×${def.n - r}` : ''}`);
      if (r > 0) { def.n = r; g.userData.interact.label = `${CATALOG[def.item].name}×${r}`; ctx.ui.say('全部は入らなかった。残りは、そこに置いてある。', 4); }
      else { taken.add(def.id); removeLoot(def.id); }
      G.emit && G.emit('loot:taken', { id: def.id, item: def.item });
      ctx.save();
    },
  });

  // ---------------------------------------------------------------- the window
  // The grid fills the window: the cell size comes from the room the window has (pictures large when there is room), the chosen
  // thing's picture, name, words and buttons stand beside it (under it on an upright phone). A held thing shows where it would go
  // (a ghost, green when it fits, red when not); 回転 turns it ([R] or the wheel too).
  let host = null, cs = 40;
  const side = () => !!host && host.clientWidth >= 520;
  function cellSize(cols, rows) {
    const w = host ? host.clientWidth : innerWidth - 40, short = innerHeight < 480;
    const sideW = side() ? Math.max(190, Math.min(300, w * 0.32)) : 0;
    const availW = w - sideW - (sideW ? 18 : 0) - 28;
    // the height left under the window's top, less the help line, the grid's name and the window's own bottom padding
    const top = host ? host.getBoundingClientRect().top : 120;
    const availH = side() ? innerHeight - top - (short ? 74 : 90) : Math.max(160, (innerHeight - top - 260) * 0.7);
    return Math.max(22, Math.min(84, Math.floor(Math.min(availW / cols, availH / rows))));
  }
  C.open = (o = {}) => {
    if (!ctx || ctx.wm.isOpen && ctx.wm.current === 'case') return;
    C.atStore = !!o.store;
    ctx.wm.open('case', { title: o.store ? '保管箱とケース' : `ケース（${bagDim().name}）`, size: 'l', render: (el) => { host = el; draw(); requestAnimationFrame(draw); }, onClose: () => { C.held = null; C.sel = null; host = null; G.emit && G.emit('case:change'); } });
  };
  ext.on('input:key', (k) => {
    if (!ctx || !ctx.state.started) return;
    if (k.code === 'KeyB' || k.code === 'KeyI' || k.code === 'Tab') { k.handled = true; k.event && k.event.preventDefault && k.event.preventDefault(); C.open(); }
  });
  const turnHeld = () => { if (C.held) { C.held.rot = C.held.rot ? 0 : 1; draw(); return true; } return false; };
  document.addEventListener('keydown', (e) => { if (host && e.code === 'KeyR' && turnHeld()) e.preventDefault(); });
  addEventListener('wheel', (e) => { if (host && C.held && e.target.closest && e.target.closest('.yk-case')) { turnHeld(); e.preventDefault(); } }, { passive: false });
  addEventListener('resize', () => { if (host) draw(); });

  // the item's pixel picture (assets/icons, tools/dot/icons.py): drawn the long way; turned when the item stands
  const ICON = new URL('../../assets/icons/', import.meta.url).href;
  function iconHtml(id, w, h, size) {
    if (id === 'hands') return '';
    const W = w * size - 6, H = h * size - 6, turn = h > w;
    const st = turn ? `width:${H}px;height:${W}px;transform:translate(-50%,-50%) rotate(90deg)` : `width:${W}px;height:${H}px;transform:translate(-50%,-50%)`;
    return `<img class="yk-ic" src="${ICON}${id}.png" alt="" style="${st}">`;
  }
  function gridHtml(list, W, H, which) {
    let h = `<div class="yk-grid" data-which="${which}" style="width:${W * cs}px;height:${H * cs}px;--cs:${cs}px">`;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h += `<i class="yk-cell" style="left:${x * cs}px;top:${y * cs}px"></i>`;
    for (const it of list) {
      const [w, hh] = dims(it), c = CATALOG[it.id];
      const eq = G.equip === it.uid ? ' yk-eq' : '', sel = C.sel && C.sel.uid === it.uid ? ' yk-sel' : '', held = C.held === it ? ' yk-held' : '';
      const gun = c.gun ? `<b class="yk-ammo">${it.loaded}/${c.gun.mag}</b>` : it.n > 1 ? `<b class="yk-ammo">×${it.n}</b>` : '';
      h += `<button class="yk-it yk-k-${c.kind}${eq}${sel}${held}" data-uid="${it.uid}" style="left:${it.x * cs + 2}px;top:${it.y * cs + 2}px;width:${w * cs - 4}px;height:${hh * cs - 4}px" aria-label="${esc(c.name)}">${iconHtml(it.id, w, hh, cs)}${gun}</button>`;
    }
    return h + '<div class="yk-ghost" hidden></div></div>';
  }
  function draw() {
    if (!host) return;
    const B = bagDim(), sel = C.held || C.sel, c = sel && CATALOG[sel.id];
    cs = C.atStore ? cellSize(B.w + STORE.w + 1, Math.max(B.h, STORE.h) + 0.6) : cellSize(B.w, B.h + 0.5);
    const partner = sel && C.items.find((o) => o !== sel && comboOf(o.id, sel.id));
    const acts = sel ? [
      c.kind === 'weapon' ? `<button data-act="equip" class="${G.equip === sel.uid ? 'on' : ''}">${G.equip === sel.uid ? '構えている' : '構える'}</button>` : '',
      c.kind === 'med' ? '<button data-act="use">使う</button>' : '',
      partner ? `<button data-act="combo">${esc(CATALOG[partner.id].name)}と組み合わせる</button>` : '',
      C.atStore ? `<button data-act="move">${C.store.includes(sel) ? 'ケースへ' : '保管箱へ'}</button>` : '<button data-act="drop">ここに置いていく</button>',
    ].join('') : '';
    const [sw, sh] = sel ? dims({ ...sel, rot: 0 }) : [1, 1];
    const big = sel ? Math.min(side() ? 64 : 48, Math.floor((side() ? 230 : 300) / Math.max(sw, sh))) : 0;
    const help = C.held ? `「${esc(CATALOG[C.held.id].name)}」を持っている。置きたい所を押す。` : '物を押すと持ち上がる。置きたい所を押すと置ける。';
    const info = sel
      ? `<div class="yk-pic yk-k-${c.kind}" style="width:${sw * big + 8}px;height:${sh * big + 8}px">${iconHtml(sel.id, sw, sh, big)}</div>
          <p class="yk-name"><b>${esc(c.name)}</b><small>${sw}×${sh}${c.gun ? `　弾 ${sel.loaded}/${c.gun.mag}（${esc(CATALOG[c.gun.ammo].name)} 残り ${C.count(c.gun.ammo)}）` : sel.n > 1 ? `　×${sel.n}` : ''}</small></p>
          <p class="yk-desc">${esc(c.desc || '')}</p>`
      : `<p class="yk-name"><b>体力 ${Math.round(G.hp)} / 100</b><small>${G.equip && C.byUid(G.equip) ? `構えている物：${esc(CATALOG[C.byUid(G.equip).id].name)}` : '素手'}</small></p><p class="yk-desc">物を押すと、ここに名前と使い道が出る。</p>`;
    host.innerHTML = `<div class="yk-case${side() ? ' yk-wide' : ''}">
      <div class="yk-cmain"><p class="yk-help">${help}</p>
        <div class="yk-grids"><div><h4>${esc(B.name)}（${B.w}×${B.h}）</h4>${gridHtml(C.items, B.w, B.h, 'bag')}</div>
        ${C.atStore ? `<div><h4>保管箱（${STORE.w}×${STORE.h}）</h4>${gridHtml(C.store, STORE.w, STORE.h, 'store')}</div>` : ''}</div></div>
      <div class="yk-cside">${info}
        <div class="yk-acts"><button data-act="rot" class="yk-rot"${sel ? '' : ' disabled'}>回転${ctx.isTouch ? '' : '（R）'}</button>${acts}</div>
      </div>
    </div>`;
    const listOf = (w) => (w === 'store' ? C.store : C.items);
    const dimOf = (w) => (w === 'store' ? STORE : B);
    const spot = (g, e) => {   // the cells the held thing would take under the pointer
      const r = g.getBoundingClientRect(), [w, h] = dims(C.held), D = dimOf(g.dataset.which);
      const x = Math.round((e.clientX - r.left) / cs - w / 2), y = Math.round((e.clientY - r.top) / cs - h / 2);
      const cx = Math.max(0, Math.min(D.w - w, x)), cy = Math.max(0, Math.min(D.h - h, y));
      return { cx, cy, w, h, ok: fits(listOf(g.dataset.which), D.w, D.h, C.held, cx, cy, C.held.rot, C.held) };
    };
    const ghost = (g, p) => {
      for (const q of host.querySelectorAll('.yk-ghost')) q.hidden = true;
      if (!g || !p) return;
      const el = g.querySelector('.yk-ghost'); el.hidden = false;
      Object.assign(el.style, { left: `${p.cx * cs}px`, top: `${p.cy * cs}px`, width: `${p.w * cs}px`, height: `${p.h * cs}px` });
      el.classList.toggle('bad', !p.ok);
    };
    if (C.held) {
      const g = host.querySelector(`.yk-grid[data-which="${C.heldFrom || 'bag'}"]`), [w, h] = dims(C.held), D = dimOf(C.heldFrom || 'bag');
      if (g) ghost(g, { cx: Math.min(C.held.x, D.w - w), cy: Math.min(C.held.y, D.h - h), w, h, ok: fits(listOf(C.heldFrom || 'bag'), D.w, D.h, C.held, Math.min(C.held.x, D.w - w), Math.min(C.held.y, D.h - h), C.held.rot, C.held) });
    }
    function tryPlaceOn(g, e) {
      const p = spot(g, e), L = listOf(g.dataset.which);
      if (!p.ok) { ghost(g, p); ctx.ui.say('そこには入らない。回すか、ほかの物を動かす。', 3, { urgent: true }); return; }
      const from = listOf(C.heldFrom);
      if (from !== L) { from.splice(from.indexOf(C.held), 1); L.push(C.held); if (L === C.store && G.equip === C.held.uid) G.equip = null; }
      C.held.x = p.cx; C.held.y = p.cy; C.held = null; ctx.sound && ctx.sound('pickup'); G.emit && G.emit('case:change'); draw();
    }
    host.querySelectorAll('.yk-grid').forEach((g) => {
      g.addEventListener('pointermove', (e) => { if (C.held) ghost(g, spot(g, e)); });
      g.addEventListener('click', (e) => { if (C.held) tryPlaceOn(g, e); });
    });
    host.querySelectorAll('.yk-it').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = +b.dataset.uid, it = C.items.find((i) => i.uid === uid) || C.store.find((i) => i.uid === uid);
      if (C.held && C.held !== it) { tryPlaceOn(b.closest('.yk-grid'), e); return; }
      if (C.held === it) { C.held = null; draw(); return; }
      C.sel = it; C.held = it; C.heldFrom = b.closest('.yk-grid').dataset.which; draw();
    }));
    host.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); const a = b.dataset.act, it = C.held || C.sel; if (!it) return;
      if (a === 'equip') { if (C.store.includes(it)) return ctx.ui.say('保管箱の中の物は構えられない。', 3); G.equipUid(it.uid); }
      else if (a === 'use') { G.heal(it); }
      else if (a === 'rot') {
        const inStore = C.store.includes(it), L = inStore ? C.store : C.items, D = inStore ? STORE : B;
        if (C.held === it || fits(L, D.w, D.h, it, it.x, it.y, it.rot ? 0 : 1, it)) it.rot = it.rot ? 0 : 1;
        else { C.held = it; C.heldFrom = inStore ? 'store' : 'bag'; it.rot = it.rot ? 0 : 1; ctx.ui.say('ここでは回せない。回したまま持っているので、入る所を押す。', 3); }
      }
      else if (a === 'combo') {
        const p = C.items.find((o) => o !== it && comboOf(o.id, it.id)), cb = comboOf(p.id, it.id);
        for (const x of [it, p]) { x.n -= 1; if (x.n <= 0) C.items.splice(C.items.indexOf(x), 1); }
        C.sel = null; C.held = null; const left = C.add(cb.make.id, cb.make.n); ctx.ui.say(cb.say + (left ? '（入りきらない分は、足もとに）' : ''), 4); if (left) C.give([[cb.make.id, left]]);
      }
      else if (a === 'move') {
        const toStore = !C.store.includes(it), L = toStore ? C.store : C.items, D = toStore ? STORE : B, at = findPlace(L, D.w, D.h, it);
        if (!at) return ctx.ui.say('入る場所がない。', 3);
        (toStore ? C.items : C.store).splice((toStore ? C.items : C.store).indexOf(it), 1); Object.assign(it, at); L.push(it); if (toStore && G.equip === it.uid) G.equip = null; C.held = null;
      }
      else if (a === 'drop') {
        C.items.splice(C.items.indexOf(it), 1); if (G.equip === it.uid) G.equip = null; C.held = null; C.sel = null;
        const p = ctx.camera.position; dropLoot({ id: `drop-${UID++}`, item: it.id, n: it.n, o: it.loaded != null ? { loaded: it.loaded } : {}, x: p.x, z: p.z, floor: ctx.floor || 0, y: 0.05 });
      }
      G.emit && G.emit('case:change'); draw();
    }));
  }
  C.redraw = draw;

  // the blood setting lives in the menu's 設定 (not in the case)
  ext.registerUi('pause', {
    renderSettings: (el) => {
      const row = document.createElement('div'); row.className = 'pm-row yk-gore-row';
      const paint = () => {
        row.innerHTML = `<span><b>血の表現</b><small>ゾンビを撃ったときの血と、取れた腕や脚の見え方。</small></span><span class="yk-gore">${['full', 'low', 'off'].map((g) => `<button type="button" data-gore="${g}" class="${(G.gore || 'full') === g ? 'on' : ''}">${{ full: 'あり', low: '控えめ', off: 'なし' }[g]}</button>`).join('')}</span>`;
        row.querySelectorAll('[data-gore]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); G.setGore(b.dataset.gore); paint(); }; });
      };
      paint(); el.append(row);
    },
  });

  // the save: the case, the storage box, the loot taken
  ext.registerPersist('yk-case', {
    serialize: () => ({ ...C.snapshot(), taken: [...taken] }),
    restore: (s, c) => { if (s) { C.restore(s); taken.clear(); for (const t of s.taken || []) taken.add(t); } else { C.items = []; C.store = []; C.bag = 'doctor'; taken.clear(); G.equip = null; } if (ctx) C.placeLoot(); },
  });
}
