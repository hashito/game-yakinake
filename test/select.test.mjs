// Rule W18: every interactable (doors, stations, items, documents) is easy to select: >= 85% of the reasonable approach poses, a hit region of
// >= 44 px at 1.5 m, a reach >= 1.8 m. Runs in a headless browser; skipped when there is none (CI without Edge / Chrome).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// no residuals: the checker (1.7) counts only approaches from inside a room with no wall in between
// the stairs are entered along their run; from the side the wall of the stairwell is in the way (residual, kit 1.7 counts poses inside the room)
// 1.5.0 (play test 2026-11-23 「階段は全てはしごでいい」): the lift shaft's ladder (EV12) and the cellar hatch (ST_KCHIKA) are ladders against a wall
// in a narrow place, taken from the front; from the side the shaft / the hatch rail is in the way (75-83 % of the poses)
const RESIDUALS = 'stairs:ST01,stairs:ST23,stairs:EV12,stairs:ST_KCHIKA';
const have = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', process.env.BROWSER].filter(Boolean).some((p) => fs.existsSync(p));
test('select range: every interactable passes check-select-range (--preset core --strict)', { skip: !have && 'no headless browser' }, () => {
  const r = spawnSync(process.execPath, ['tools/check-select-range.mjs', '--root', '.', '--preset', 'core', '--query', 'qa=1&autostart', '--strict', ...(RESIDUALS ? ['--allow', RESIDUALS] : [])], { encoding: 'utf8', timeout: 280000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
