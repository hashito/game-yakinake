#!/usr/bin/env node
// 1.7.0 #8 「金庫を開ける時に開けられるようになったら開けるボタンが強調される」: the real safe (no ?qa), turned with the arrow keys:
// the 開ける button is quiet before the third number, lit and pulsing once it clicks, and the safe opens only when it is pressed.
//   node tools/play/v170-safe.mjs [--phone] [--shots D:/yakinake-stages/170]
import { open, sleep } from './lib.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const T = await open({ phone: args.includes('--phone'), shots: arg('--shots', null) && arg('--shots') + '/safe' });
const { G, expect, shot, p, log } = T;
try {
  await T.start(false);
  await sleep(1500); await T.talkThrough();
  await T.toStage('L2', ['T_CART', 'T_TOOLBOX', 'T_POWER', 'T_CHISATO', 'T_RADIO'], true);
  for (let i = 0; i < 8; i++) { await sleep(700); await T.dismiss(); if (!(await G('!!(g.wm.isOpen || g.ui.open)'))) break; }
  await G("(y.liveZombies().forEach((L) => L.alive && L.z.kill()), 1)");
  const ok = await G("(() => { g.runTask ? 0 : 0; return !!g.world.interactables.find((o) => o.name === 'station:S_SAFE'); })()");
  log('station', ok);
  await G("(() => { const t = g.data.tasks.find((t) => t.id === 'T_SAFE'); g.runMinigame(t); return 1; })()");
  await sleep(1500);
  const btn = () => G("(() => { const b = document.querySelector('.mgx-sf-open'); return b ? { cls: b.className, text: b.textContent } : null; })()");
  const heard = (k) => G(`!!document.querySelector('.mgx-sf-slot[data-k="${k}"].heard')`);
  const turn = async (code, until, max = 110) => { for (let i = 0; i < max; i++) { if (await until()) return true; await p.eval(`(() => { const c = document.querySelector('.mgx-sf-cv'); c.focus(); c.dispatchEvent(new KeyboardEvent('keydown', { code: ${JSON.stringify(code)}, key: ${JSON.stringify(code)}, bubbles: true })); return 1; })()`); await sleep(25); } return until(); };
  let b = await btn();
  expect(b && /mgx-quiet/.test(b.cls), `before the numbers, 開ける is quiet (${b && b.cls})`);
  await shot('safe_quiet');
  for (const [k, code] of [[0, 'ArrowRight'], [1, 'ArrowLeft'], [2, 'ArrowRight']]) {
    let got = await turn(code, () => heard(k));
    if (!got) got = await turn(code === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight', () => heard(k));
    log('number', k + 1, got);
    if (k < 2) { await turn(code === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight', () => G(`!!document.querySelector('.mgx-sf-slot[data-k="${k}"].done')`), 3); }
    b = await btn();
    if (k < 2) expect(!/mgx-ready/.test(b.cls), `after number ${k + 1}, 開ける stays quiet`);
  }
  b = await btn();
  expect(b && /mgx-ready/.test(b.cls) && /！/.test(b.text), `the third number lights 開ける up (${b && b.cls} / ${b && b.text})`);
  await shot('safe_ready');
  await sleep(2500);
  expect(!(await G("g.state.tasks.includes('T_SAFE')")), 'nothing opens by itself (no auto-advance)');
  await p.eval("document.querySelector('.mgx-sf-open').click()"); await sleep(1600);
  await shot('safe_opened');
} catch (e) { expect(false, 'ERROR ' + e.message); }
process.exitCode = (await T.done()) ? 1 : 0;
