/* game-kit 10af67dd: js/mg-code-drums.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "code-drums" (from 撤去通知 / 浦川: the flap drums of the panels): turn the drums of a lock to the code found
// elsewhere, then open it. A wrong code says so and leaves the drums where they are. Uses drum() of js/mg-widgets.js.
//   cfg: title, help, code ('317' or [3, 1, 7]), values (0-9, or a list like ['子','丑',...]), labels (['一','二','三']),
//        button ('開ける'), ok / wrong (the lines), hint (shown from the 3rd wrong try)
//   hooks: { sound(name, ctx) }  name = 'turn' | 'ok' | 'wrong'
import { mgFrame } from './mg-frame.js';
import { drum } from './mg-widgets.js';

export const codeOk = (set, code) => set.length === code.length && set.every((v, i) => String(v) === String(code[i]));

export default {
  type: 'code-drums',
  about: 'ダイヤル錠の数字（文字）を、別の場所で見つけた番号にそろえて開ける',
  mount(host, cfg = {}, ctx = {}, hooks = {}) {
    return new Promise((done) => {
      const code = Array.isArray(cfg.code) ? cfg.code : String(cfg.code ?? '000').split(''), values = cfg.values || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const set = code.map(() => values[0]), snd = (n) => hooks.sound && hooks.sound(n, ctx);
      let wrong = 0;
      const f = mgFrame(host, { cfg, ctx, title: cfg.title || '番号錠', help: cfg.help || 'ドラムを上下に回して番号をそろえ、「開ける」を押してください。' }, done);
      const row = document.createElement('div'); row.className = 'mg-row'; f.body.append(row);
      code.forEach((_, i) => drum(row, { label: (cfg.labels || [])[i] || `${i + 1}`, values, value: set[i], onChange: (v) => { set[i] = v; f.say(''); }, sound: () => snd('turn') }));
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn primary mgx-code-btn'; btn.textContent = cfg.button || '開ける'; f.body.append(btn);
      btn.onclick = () => {
        if (f.done) return;
        if (codeOk(set, code)) { f.say(cfg.ok || '手応えがあった。'); snd('ok'); f.win(650); return; }
        wrong++; snd('wrong'); f.miss(); f.say(wrong >= 3 && cfg.hint ? cfg.hint : cfg.wrong || '動かない。番号が違うようだ。');
      };
      if (ctx.qa) return f.end(true);
      row.querySelector('[tabindex]')?.focus();
    });
  },
};
