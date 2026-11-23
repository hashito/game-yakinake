// The guide follows the objective (札の家 2.4.0, 2026-11-23: on the walk to the front door the guide still said 「作業台で、考えをまとめる」 -
// a task of the other branch, open since the start of the last stage and never needed by the ending the player took, came first in
// tasks.json and took the STEP card and the HUD's 次 from 「表の戸を開ける」).
// staleGuideSource() is page code for check-playtest P59. For every "end task" (a required task of the last stage with steps and needs
// that no other task needs, at the end of the longest chain of needs: the walk out, the last door), it puts the save on the shortest route to it - every required task of the earlier stages and the
// end task's own needs done, the other tasks of its stage left open - and asks the game:
//   error  ctx.nextTask() (the STEP card and the map's 次) is another task, not the end task: the guide shows a stale step
//   warn   another required task still starts there (a branch the player already decided against): it pins the map, takes [E], and a
//          later guide change can bring it back - give it a canStart that closes it once the branch is decided
// The save is put back afterwards. An end task that wants more than tasks (an item, a flag in its canStart) is not judged.
export function staleGuideSource() {
  return `(() => {
    const g = window.__game; if (!g || !g.nextTask || !g.canStart || !g.prog || !g.prog.s || !g.levelIndex) return { missing: true };
    const T = (g.data && g.data.tasks) || [], by = new Map(T.map((t) => [t.id, t]));
    const req = T.filter((t) => !t.optional && t.steps && t.steps.length);
    const needed = new Set(T.flatMap((t) => t.needs || []));
    const lastL = Math.max(-1, ...req.map((t) => g.levelIndex(t.stage)));   // the last stage: earlier stages end at a level gate that wants all their tasks
    const close = (t, acc) => { for (const n of t.needs || []) if (!acc.has(n) && by.has(n)) { acc.add(n); close(by.get(n), acc); } return acc; };
    // the walk out is at the end of the longest chain of needs; a short chain (考える -> 返す) is a branch step, not an end
    const ends0 = req.filter((t) => !needed.has(t.id) && (t.needs || []).length && g.levelIndex(t.stage) === lastL);
    const depth = Math.max(0, ...ends0.map((t) => close(t, new Set()).size));
    const ends = ends0.filter((t) => close(t, new Set()).size === depth), endIds = new Set(ends0.map((t) => t.id));
    const s0 = g.state.tasks.slice(), L0 = g.prog.s.level, out = [];
    try {
      for (const F of ends) {
        const C = close(F, new Set()), last = g.levelIndex(F.stage);
        const done = T.filter((t) => !t.optional && t.id !== F.id && (g.levelIndex(t.stage) < last || C.has(t.id))).map((t) => t.id);
        g.state.tasks.splice(0, g.state.tasks.length, ...done); g.prog.s.level = Math.max(L0, last);
        if (g.canStart(F) !== true) continue;
        const nx = g.nextTask();
        const left = req.filter((t) => t.id !== F.id && !endIds.has(t.id) && !done.includes(t.id) && g.canStart(t) === true).map((t) => t.id);
        if (nx && nx.id !== F.id && !endIds.has(nx.id)) out.push({ end: F.id, guide: nx.id, left, error: true });
        else if (left.length) out.push({ end: F.id, guide: nx && nx.id, left });
      }
    } catch (e) { out.push({ error: true, end: '?', guide: 'exception: ' + e.message, left: [] }); }
    finally { g.state.tasks.splice(0, g.state.tasks.length, ...s0); g.prog.s.level = L0; if (g.refreshGuide) g.refreshGuide(); }
    return out;
  })()`;
}
