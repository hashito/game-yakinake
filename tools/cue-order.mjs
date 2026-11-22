// A line about a sound comes after the sound (standard 1.37.0; 水無瀬病院 2026-11-22 #6 「音が聞こえたの前にしっかり音を出してください」: the
// thought 「うしろで、水がはねた」 showed while the splash was quiet, far, or not yet played). js/game-core.js keeps ctx.cueLog: [kind, text,
// ms] for every ctx.sound / ctx.audio.noise / tone / noiseBurst / hum and every ctx.monologue / ctx.answer. A thought that names a sound
// (音, 鳴った, 聞こえ, はねた, 叩く, きしむ, 鼻歌, 声がした ...) needs a sound 0.35 s to 4 s before it. ctx.cueThenSay(play, text, { lead }) does it.
// Page code (check-playtest P55, a game's play scripts after a playthrough): cueOrderSource() -> [{ text, why }]
export const SOUND_WORDS = /(音が|音を|音だ|音。|水音|鳴っ|鳴る|聞こえ|はねた|叩く|叩いた|きしむ|きしん|鼻歌|声がし|ノック|ぶつかる音|触れ合う)/;
export const NOT_SOUND = /(聞こえない|音がしない|音もしない|無音)/;
export function cueOrderSource(o = {}) {
  const lead = o.lead ?? 350, within = o.within ?? 4000;
  return `(() => {
    const L = (window.__game && window.__game.cueLog) || null; if (!L) return { missing: true };
    const W = ${SOUND_WORDS}, N = ${NOT_SOUND}, out = [];
    L.forEach(([k, text, t], i) => {
      if (k !== 'say' || !W.test(text) || N.test(text)) return;
      const before = L.slice(0, i).filter((x) => x[0] === 'sound' && t - x[2] >= ${lead} && t - x[2] <= ${within});
      if (!before.length) { const near = L.filter((x) => x[0] === 'sound' && Math.abs(t - x[2]) < ${lead}); out.push({ text, why: near.length ? 'the sound starts with the line (' + near.map((x) => x[1]).join(', ') + '): play it first (ctx.cueThenSay)' : 'no sound before the line' }); }
    });
    return out;
  })()`;
}
