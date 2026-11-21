#!/usr/bin/env node
// The music of the five blocks through the local media queue (http://127.0.0.1:8765, kind "bgm", ACE-Step), saved as
// assets/music/<key>.mp3 (ffmpeg: stereo 96k, faded in and out so the loop does not click). Existing files are skipped.
//   node tools/gen-music.mjs [--only hospital,street] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:8765';
const args = process.argv.slice(2), force = args.includes('--force');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const TAIL = 'instrumental, no vocals, no drums kit, horror game background loop, low and quiet, dark ambient';
const TRACKS = [
  ['hospital', 'cold hospital at night during a power cut, low drones, a distant failing fluorescent hum, slow detuned piano notes, sparse metallic hits'],
  ['street', 'empty night city street after a disaster, sodium lights, low brass drone, slow heavy pulse like a far heartbeat, wind, distant sirens implied by synth'],
  ['police', 'abandoned police station, tense low strings ostinato, muffled ticking, dark synth bass, uneasy'],
  ['tower', 'dark office tower climbing stairs, rising tension, pulsing low synth, cold electric hum, slow build'],
  ['dawn', 'the first light before dawn on a rooftop, wind, a slow sad hopeful piano and soft strings, quiet, exhausted relief'],
];
const out = path.join(ROOT, 'assets/music'); fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [key, prompt] of TRACKS) {
  if (only && !only.includes(key)) continue;
  const dst = path.join(out, `${key}.mp3`);
  if (fs.existsSync(dst) && !force) continue;
  const j = await (await fetch(`${API}/v1/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'bgm', params: { prompt: `${prompt}, ${TAIL}`, seconds: 90, seed: [...key].reduce((a, c) => a * 7 + c.charCodeAt(0), 3) % 100000 } }) })).json();
  if (!j.id) { console.log('post failed', key, JSON.stringify(j)); continue; }
  for (;;) {
    const s = await (await fetch(`${API}/v1/jobs/${j.id}`)).json();
    if (s.status === 'done') {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', s.files[0].path, '-af', 'afade=t=in:d=2,areverse,afade=t=in:d=3,areverse,loudnorm=I=-24', '-ac', '2', '-b:a', '96k', dst]);
      console.log('made', key); break;
    }
    if (['failed', 'cancelled', 'deleted'].includes(s.status)) { console.log('failed', key, s.error || ''); break; }
    await sleep(3000);
  }
}
