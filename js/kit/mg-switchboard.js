/* game-kit 10af67dd: js/mg-switchboard.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "switchboard" (電話交換台, standard 1.24.0: an old hospital's exchange, a ryokan's front desk at night, a village office).
// Lamps light for incoming calls. Take a lit line, hear what the caller wants (the words are on screen), find the room in the directory and
// plug the cord into its number. Calls overlap; a caller who waits too long hangs up and rings again later (nothing is lost). One line that
// should not exist keeps lighting between the calls; at the end it asks for a room that is struck out of the directory.
//   cfg: title, help, directory ([{ no, name, gone? }]), calls ([{ line, say, to }]: line = index of the incoming lamp, to = a directory no),
//        lines (the lamps' labels, default 一..六), ghost ({ line, say, to, idle: [...] } | false), patience (30 s), gap (7 s between calls),
//        seed (3), ok, skin, stamp
//   hooks: { sound(name, ctx) }  name = 'ring' | 'pick' | 'set' | 'wrong' | 'off' | 'heard' | 'ok'
//   play scripts: host.mgSolve() answers every call with its right cord through the same rule
import { mgFrame, esc } from './mg-frame.js';
import { stageLayout, loop, solved, solvable, rng, calmOf } from './mg-stage.js';

const DIR = [{ no: '11', name: '院長室' }, { no: '12', name: '婦長室' }, { no: '21', name: '外科病棟' }, { no: '22', name: '内科病棟' }, { no: '31', name: '薬局' }, { no: '32', name: '守衛室' }, { no: '41', name: '霊安室' }, { no: '43', name: '二〇三号室', gone: true }];
const CALLS = [{ line: 0, say: '婦長さんをお願いします。', to: '12' }, { line: 2, say: '外科の病棟へ。急いで。', to: '21' }, { line: 1, say: '夜の見回りの人に代わってください。', to: '32' }, { line: 3, say: 'お薬のことで、薬局へ。', to: '31' }];
const GHOST = { line: 5, say: '……二〇三に、つないで。', to: '43', idle: ['……', '（息の音だけがする）', '……そこに、いるの？'] };
/** the rule (pure): the cord goes into the room the caller asked for */
export const plugOk = (call, no) => !!call && String(call.to) === String(no);

export default {
  type: 'switchboard',
  about: '光った回線を取り、電話帳で部屋を探して、交換台のコードを差し込む',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const snd = (k) => hooks.sound && hooks.sound(k, ctx), calm = calmOf(ctx), r = rng(cfg.seed ?? 3);
      const dir = cfg.directory || DIR, labels = cfg.lines || ['一', '二', '三', '四', '五', '六'];
      const ghost = cfg.ghost === false ? null : { ...GHOST, ...(cfg.ghost || {}) };
      const calls = (cfg.calls || CALLS).map((c, i) => ({ ...c, id: i, state: 'wait', at: 1.2 + i * (cfg.gap ?? 7) + r() * 2, left: 0 }));
      const need = calls.length + (ghost ? 1 : 0), patience = (cfg.patience ?? 30) * (calm ? 2 : 1);
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '交換台をつなぐ', help: cfg.help || '光った回線を押して用件を聞き、電話帳で探した番号の穴を押してつなぐ。' }, done);
      const lineCount = Math.max(labels.length, ...calls.map((c) => c.line + 1), ghost ? ghost.line + 1 : 0);
      const s = stageLayout(f, 'mgx-sb', {
        view: `<div class="mgx-sb-board"><div class="mgx-sb-in">${Array.from({ length: lineCount }, (_, k) => `<button type="button" class="btn mgx-sb-jack mgx-sb-injack${ghost && ghost.line === k ? ' ghost' : ''}" data-in="${k}" aria-label="回線 ${esc(labels[k] || k + 1)}"><i class="mgx-sb-lamp"></i><span>${esc(labels[k] || k + 1)}</span></button>`).join('')}</div>
          <div class="mgx-sb-out">${dir.map((d) => `<button type="button" class="btn mgx-sb-jack mgx-sb-outjack" data-out="${esc(d.no)}" aria-label="${esc(d.no)} 番の穴"><i class="mgx-sb-hole"></i><span>${esc(d.no)}</span></button>`).join('')}</div>
          <p class="mgx-sb-cap" aria-live="polite"></p><svg class="mgx-sb-cords" aria-hidden="true"></svg></div>`,
        side: `<div class="mgx-sb-dirbox"><b>電話帳</b><ol class="mgx-sb-dir">${dir.map((d) => `<li data-no="${esc(d.no)}" class="${d.gone ? 'gone' : ''}"><span>${esc(d.name)}</span><em>${esc(d.no)}</em></li>`).join('')}</ol></div>`,
      });
      const board = s.q('.mgx-sb-board'), cap = s.q('.mgx-sb-cap'), svg = s.q('.mgx-sb-cords');
      const inB = s.qa('[data-in]'), outB = s.qa('[data-out]');
      const st = { t: 0, held: null, cords: [], done: 0, misses: 0, gIdle: 0, gNext: 6 + r() * 4, gState: 'off', idleK: 0, ghostCall: null };
      const callOn = (k) => calls.find((c) => c.line === k && (c.state === 'ring' || c.state === 'held')) || (st.ghostCall && st.ghostCall.line === k && (st.ghostCall.state === 'ring' || st.ghostCall.state === 'held') ? st.ghostCall : null);
      const capSay = (t) => { cap.textContent = t; };
      const centre = (b) => { const R = b.getBoundingClientRect(), B = board.getBoundingClientRect(); return [R.left - B.left + R.width / 2, R.top - B.top + R.height * 0.42]; };
      const drawCords = () => {
        svg.innerHTML = st.cords.map((c) => { const [x1, y1] = centre(inB[c.line]), [x2, y2] = centre(outB.find((b) => b.dataset.out === c.no)); const my = Math.max(y1, y2) + 36; return `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${my} ${x2} ${y2}" class="${c.ghost ? 'ghost' : ''}"/>`; }).join('');
      };
      const paint = () => {
        inB.forEach((b, k) => {
          const c = callOn(k), lit = !!c || (ghost && ghost.line === k && st.gState === 'idle');
          b.classList.toggle('lit', lit); b.classList.toggle('held', !!st.held && st.held.line === k);
          b.style.setProperty('--p', c && c.state === 'ring' ? Math.max(0, c.left / patience).toFixed(3) : 1);
        });
        s.qa('.mgx-sb-dir li').forEach((li) => li.classList.toggle('hint', st.misses >= 2 && !!st.held && li.dataset.no === String(st.held.to)));
        f.progress(st.done, need);
      };
      const ring = (c) => { c.state = 'ring'; c.left = patience; snd('ring'); };
      const finish = (c) => {
        c.state = 'done'; st.done++;
        setTimeout(() => { st.cords = st.cords.filter((x) => x.call !== c); drawCords(); paint(); }, 1400);
        if (st.done >= need) { capSay(ghost ? `回線 ${labels[ghost.line]}：「……ありがとう。いま、行くね。」` : '最後の電話をつないだ。'); f.say(cfg.ok || 'すべての電話をつないだ。'); snd('ok'); solved(f); f.win(1200); }
      };
      const take = (k) => {
        if (f.done) return;
        const c = callOn(k);
        if (!c) {
          if (ghost && ghost.line === k && st.gState === 'idle') { capSay(`回線 ${labels[k]}：「${ghost.idle[st.idleK++ % ghost.idle.length]}」`); snd('heard'); st.gState = 'off'; paint(); return; }
          capSay(`回線 ${labels[k] || k + 1} は鳴っていない。`); snd('off'); return;
        }
        if (st.held && st.held !== c && st.held.state === 'held') st.held.state = 'ring';
        st.held = c; c.state = 'held'; snd('pick');
        capSay(`回線 ${labels[k] || k + 1}：「${c.say}」`); paint();
      };
      const plug = (no) => {
        if (f.done) return;
        const c = st.held;
        if (!c || c.state !== 'held') { capSay('先に、光っている回線を押して用件を聞く。'); snd('off'); return; }
        if (plugOk(c, no)) {
          snd('set'); st.cords.push({ call: c, line: c.line, no, ghost: c === st.ghostCall }); st.held = null; drawCords();
          f.say(c === st.ghostCall ? '……つながってしまった。' : `${(dir.find((d) => d.no === no) || {}).name || no} へつないだ。`);
          finish(c); paint(); return;
        }
        st.misses++; snd('wrong'); f.miss(); st.held = null;
        c.state = 'wait'; c.at = st.t + 4;
        f.say(`「……違います」と切られた。${(dir.find((d) => d.no === no) || {}).name || no} ではない。またかかってくる。`);
        capSay(st.misses >= 2 ? '電話帳の光っている行を見て。' : '用件の言葉と電話帳の名前を見比べて。');
        paint();
      };
      inB.forEach((b) => (b.onclick = () => take(+b.dataset.in)));
      outB.forEach((b) => (b.onclick = () => plug(b.dataset.out)));
      loop(f, (dt) => {
        if (f.done) return;
        st.t += dt;
        const active = calls.filter((c) => c.state === 'ring' || c.state === 'held').length;
        for (const c of calls) {
          if (c.state === 'wait' && st.t >= c.at && active < 2 && !calls.some((x) => x !== c && x.line === c.line && (x.state === 'ring' || x.state === 'held'))) { ring(c); break; }
        }
        for (const c of calls) if (c.state === 'ring') { c.left -= dt; if (c.left <= 0) { c.state = 'wait'; c.at = st.t + 5; f.say(`回線 ${labels[c.line]} が切れた。またかかってくる。`); snd('off'); } }
        // the line that should not exist: it lights now and then; at the end it rings for real
        if (ghost) {
          if (st.done >= calls.length && !st.ghostCall) { st.ghostCall = { ...ghost, id: 'ghost', state: 'wait', left: 0 }; st.ghostCall.at = st.t + 2; st.gState = 'off'; }
          if (st.ghostCall && st.ghostCall.state === 'wait' && st.t >= st.ghostCall.at) { ring(st.ghostCall); st.ghostCall.left = Infinity; }
          if (!st.ghostCall) { st.gNext -= dt; if (st.gState === 'idle') { st.gIdle -= dt; if (st.gIdle <= 0) st.gState = 'off'; } else if (st.gNext <= 0) { st.gState = 'idle'; st.gIdle = 3; st.gNext = 8 + r() * 6; snd('ring'); } }
        }
        paint();
      });
      f.on('resize', drawCords);
      solvable(host, () => {
        for (const c of calls) if (c.state !== 'done') { c.state = 'held'; st.held = c; plug(String(c.to)); }
        if (ghost && !f.done) { st.ghostCall = st.ghostCall || { ...ghost, id: 'ghost', left: Infinity }; st.ghostCall.state = 'held'; st.held = st.ghostCall; plug(String(ghost.to)); }
      }, () => ({ calls: [...calls, ...(st.ghostCall ? [st.ghostCall] : [])].map((c) => ({ line: c.line, to: c.to, state: c.state, say: c.say })), held: st.held ? st.held.line : -1, done: st.done, misses: st.misses, ghostIdle: st.gState === 'idle' }));
      capSay('ランプが光るのを待つ。');
      paint();
      if (ctx.qa) return f.end(true);
      inB[0].focus();
    });
  },
};
