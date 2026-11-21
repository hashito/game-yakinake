/* game-kit e962dd12: js/mg-code-drums.js — edit in game-kit and run tools/kit-sync.js */
// Library mini game "code-drums" (from 撤去通知 / 浦川: the flap drums of the panels): turn the drums of a lock to the code found
// elsewhere, then open it. A wrong code says so and leaves the drums where they are. Uses drum() of js/mg-widgets.js.
//   cfg: title, help, code ('317' or [3, 1, 7]), values (0-9, or a list like ['子','丑',...]), labels (['一','二','三']),
//        button ('開ける'), ok / wrong (the lines), hint (shown from the 3rd wrong try)
//        choices (standard 1.25.2, 鏡屋 「ダイヤル錠は選択式にして、数字をアイテムで解析する」): one list per place, e.g. [[1, 6, 7, 9], [1, 2, 3], [2, 3, 4]]
//        - each place is a row of buttons to pick from instead of a drum; clues: one line per place (what the number is: 「止まった時計の
//        短い針」), shown beside its row. Nothing is picked at first (the button stays until every place has a pick).
//   hooks: { sound(name, ctx) }  name = 'turn' | 'ok' | 'wrong'
import { mgFrame, esc } from './mg-frame.js';
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
      const row = document.createElement('div'); row.className = cfg.choices ? 'mgx-code-pick' : 'mg-row'; f.body.append(row);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn primary mgx-code-btn'; btn.textContent = cfg.button || '開ける';
      if (cfg.choices) {
        set.fill(null);
        const ready = () => { btn.disabled = set.some((v) => v === null); };
        code.forEach((_, i) => {
          const r = document.createElement('div'); r.className = 'mgx-code-row'; r.setAttribute('role', 'radiogroup');
          r.innerHTML = `<div class="mgx-code-q"><b>${esc((cfg.labels || [])[i] || `${i + 1}`)}</b>${cfg.clues && cfg.clues[i] ? `<span>${esc(cfg.clues[i])}</span>` : ''}</div><div class="mgx-code-opts"></div>`;
          const opts = r.querySelector('.mgx-code-opts');
          for (const v of cfg.choices[i] || values) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'btn mgx-code-opt'; b.textContent = String(v); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
            b.onclick = () => { set[i] = v; for (const o of opts.children) { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); } snd('turn'); f.say(''); ready(); };
            opts.append(b);
          }
          row.append(r);
        });
        ready();
      } else code.forEach((_, i) => drum(row, { label: (cfg.labels || [])[i] || `${i + 1}`, values, value: set[i], onChange: (v) => { set[i] = v; f.say(''); }, sound: () => snd('turn') }));
      f.body.append(btn);
      btn.onclick = () => {
        if (f.done) return;
        if (codeOk(set, code)) { f.say(cfg.ok || '手応えがあった。'); snd('ok'); f.win(650); return; }
        wrong++; snd('wrong'); f.miss(); f.say(wrong >= 3 && cfg.hint ? cfg.hint : cfg.wrong || '動かない。番号が違うようだ。');
      };
      if (ctx.qa) return f.end(true);
      (row.querySelector('[tabindex], button'))?.focus();
    });
  },
};
