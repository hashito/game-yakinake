/* game-kit 10af67dd: js/mg-read.js — edit in game-kit and run tools/kit-sync.js */
// The reading panel of the library mini games that end in a document (standard 1.24.0: steam-letter, torn-paper): the stage gives way to the
// document drawn as paper (js/paper-doc.js), fitted into a big panel without scrolling (picture first, then the text: js/panel-fit.js), and the
// help line steps aside. The player reads, then presses the frame's 次へ (cfg.next, here 「読み終えた」).
//   readPanel(f, { title, text, paper: 'note', photo }, hooks)   hooks.read(doc) lets the game keep the document too (its journal)
import { paperDocHtml, fitDoc } from './paper-doc.js';
import { keepFitted } from './panel-fit.js';

export function readPanel(f, doc = {}, hooks = {}) {
  if (hooks && typeof hooks.read === 'function') hooks.read(doc);
  f.root.classList.add('mgx--reading');
  const box = document.createElement('div');
  box.className = 'mgx-read gf-doc-main';
  box.innerHTML = paperDocHtml({ paper: 'note', id: doc.id || doc.title || 'mg-read', ...doc }, { feeling: false });
  const st = f.body.querySelector('.mgx-st');
  if (st) st.replaceWith(box); else f.body.prepend(box);
  const stamp = f.body.querySelector('.mgx-stamp'); if (stamp) stamp.remove();
  keepFitted(box, () => fitDoc(box));
  return box;
}
