#!/usr/bin/env node
// Voices and the zombies' voices through the local media queue (http://127.0.0.1:8765, kind "voice"; never VOICEVOX directly):
//   - every spoken line of data/talk.json -> assets/voice/<line id>.mp3 (mono)
//   - the protagonist's short thoughts said in game code (ctx.ui.say with a fixed text) -> assets/voice/t-<n>.mp3 + thoughts.json
//   - the zombies' groans, attacks, deaths and scream, and the protagonist's hurt sounds -> assets/sfx/<name>.mp3: a VOICEVOX
//     voice made rough with ffmpeg (pitch down, crushed, reverb); the burst and the spit are noise made by ffmpeg alone
// Lines with a file already are skipped; --force redoes them, --only ID,ID does a few, --dry counts.
//   node tools/gen-voice.mjs [--force] [--only opening-1,z-groan-1] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:8765';
const args = process.argv.slice(2), force = args.includes('--force'), dry = args.includes('--dry');
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
// VOICEVOX speakers (the queue's numbers) per character; women's voices for the women, the old for the old
export const VOICES = {
  '私': { speaker: 14, speed: 1.0 },        // 早坂遥, 31, the night-shift doctor
  '宮下': { speaker: 20, speed: 1.05 },     // 宮下千里, nurse
  '戸川': { speaker: 42, speed: 0.9 },      // 戸川源三, the old patient
  '権藤': { speaker: 13, speed: 0.95 },     // 権藤, the mart's man
  '仁科': { speaker: 12, speed: 1.05 },     // 仁科, the young mart clerk
  '白坂': { speaker: 53, speed: 0.85 },     // 白坂, the leader of the group in the shrine office
  '妙子': { speaker: 16, speed: 1.0 },      // 妙子, of 白坂's group
  '片桐': { speaker: 23, speed: 1.0 },      // 片桐, police officer (woman)
  '森': { speaker: 21, speed: 1.0 },        // 森, police officer
  '無線': { speaker: 29, speed: 1.0 },
  '市の放送': { speaker: 30, speed: 0.95 },
  '野口': { speaker: 52, speed: 0.95 },     // 野口, the office tower's security guard
  '早瀬': { speaker: 11, speed: 1.0 },      // 早瀬, the engineer on the server floor
};
const talk = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/talk.json'), 'utf8'));
const lines = new Map();
const add = (L) => { if (L && L.id && L.text && VOICES[L.who] && !lines.has(L.id)) lines.set(L.id, { ...L, dir: 'voice' }); };
for (const seq of Object.values(talk)) for (const L of seq) { add(L); for (const o of L.options || []) for (const r of o.reply || []) add(r); }
// the protagonist's own short thoughts in game code (not the control hints)
const thoughts = [];
for (const f of fs.readdirSync(path.join(ROOT, 'js/ext'))) {
  const src = fs.readFileSync(path.join(ROOT, 'js/ext', f), 'utf8');
  for (const m of src.matchAll(/ui\.say\('([^'$]{6,})'/g)) if (!/［|クリック|スマホ|\[/.test(m[1]) && !thoughts.includes(m[1])) thoughts.push(m[1]);
}
thoughts.forEach((text, i) => lines.set(`t-${i + 1}`, { id: `t-${i + 1}`, who: '私', text, dir: 'voice' }));
// the zombies' voices: a voice line, then a filter (ffmpeg -af)
const ROUGH = 'asetrate=24000*0.62,aresample=44100,acrusher=bits=6:mix=0.35,aecho=0.7:0.6:60|130:0.35|0.2,highpass=f=70,lowpass=f=3200,volume=1.6';
const SFX = {
  'z-groan-1': { text: 'うぅ……あぁぁ……', speaker: 13, speed: 0.6, af: ROUGH },
  'z-groan-2': { text: 'おぉぉ……ぉぉ', speaker: 53, speed: 0.55, af: ROUGH },
  'z-groan-3': { text: 'あぁ……ぅぅぅ', speaker: 42, speed: 0.6, af: ROUGH },
  'z-groan-4': { text: 'ぐぅ……ぅ……', speaker: 21, speed: 0.6, af: ROUGH },
  'z-groan-5': { text: 'ああぁ……ぁ', speaker: 20, speed: 0.6, af: ROUGH.replace('0.62', '0.7') },   // a woman's
  'z-groan-6': { text: 'ぅぅぅ……ん', speaker: 16, speed: 0.55, af: ROUGH.replace('0.62', '0.72') },
  'z-attack-1': { text: 'があっ！', speaker: 13, speed: 1.2, af: ROUGH.replace('0.62', '0.7') },
  'z-attack-2': { text: 'ぐあぁっ！', speaker: 21, speed: 1.2, af: ROUGH.replace('0.62', '0.68') },
  'z-attack-3': { text: 'ぎゃあっ！', speaker: 20, speed: 1.2, af: ROUGH.replace('0.62', '0.75') },
  'z-die-1': { text: 'ぐ……ぅ', speaker: 13, speed: 0.7, af: ROUGH },
  'z-die-2': { text: 'あ……ぁ', speaker: 53, speed: 0.7, af: ROUGH },
  'z-die-3': { text: 'ぉ……', speaker: 16, speed: 0.7, af: ROUGH.replace('0.62', '0.7') },
  'z-scream': { text: 'きゃあああああああっ！', speaker: 23, speed: 0.9, af: 'asetrate=24000*0.85,aresample=44100,acrusher=bits=5:mix=0.4,aecho=0.8:0.7:90|200:0.4|0.25,volume=1.4' },
  'hurt-1': { text: 'うっ！', speaker: 14, speed: 1.1, af: 'volume=1.2' },
  'hurt-2': { text: 'あぅっ！', speaker: 14, speed: 1.1, af: 'volume=1.2' },
};
for (const [id, s] of Object.entries(SFX)) lines.set(id, { id, who: null, text: s.text, voice: s, dir: 'sfx' });
const outOf = (L) => path.join(ROOT, 'assets', L.dir, `${L.id}.mp3`);
for (const d of ['voice', 'sfx']) fs.mkdirSync(path.join(ROOT, 'assets', d), { recursive: true });
// noise-only sounds (no voice): the burst of a bloated one, the spit
const NOISE = {
  'z-burst': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.9:c=brown:a=0.9', '-af', 'afade=t=out:st=0.05:d=0.85,lowpass=f=900,aecho=0.8:0.5:40:0.4,volume=2.2'],
  'z-spit': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.5:c=pink:a=0.7', '-af', 'afade=t=in:d=0.05,afade=t=out:st=0.1:d=0.4,bandpass=f=1800:w=1200,volume=1.6'],
};
for (const [id, a] of Object.entries(NOISE)) { const dst = path.join(ROOT, 'assets/sfx', `${id}.mp3`); if (!dry && (force || !fs.existsSync(dst)) && (!only || only.has(id))) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a, '-ac', '1', '-b:a', '64k', dst]); }
const todo = [...lines.values()].filter((L) => (!only || only.has(L.id)) && (force || !fs.existsSync(outOf(L))));
console.log(`${lines.size} lines and voices, ${todo.length} to make`);
if (dry) process.exit(0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (t) => t.replace(/遥/g, 'はるか').replace(/千里/g, 'ちさと').replace(/源三/g, 'げんぞう').replace(/白坂/g, 'しらさか').replace(/片桐/g, 'かたぎり').replace(/早瀬/g, 'はやせ')
  .replace(/（[^）]*）/g, '').replace(/[「」『』]/g, '').replace(/……/g, '、').replace(/―/g, '、').replace(/[\[［][^\]］]*[\]］]\s*/g, '');
// jobs already in the queue for the same text and speaker (an earlier run that stopped) are reused, not made twice
const known = new Map();
for (const j of (await fetch(`${API}/v1/jobs?limit=400`).then((r) => r.json()).catch(() => ({ jobs: [] }))).jobs || []) {
  if (j.kind === 'voice' && ['queued', 'running', 'done'].includes(j.status) && !known.has(`${j.params.speaker}|${j.params.text}`)) known.set(`${j.params.speaker}|${j.params.text}`, j.id);
}
const textOf = (L) => (L.dir === 'sfx' ? L.text : say(L.text).trim() || say(L.text.replace(/[（）]/g, '')));
const post = async (L) => {
  const v = L.voice || VOICES[L.who];
  if (known.has(`${v.speaker}|${textOf(L)}`)) return known.get(`${v.speaker}|${textOf(L)}`);
  const r = await fetch(`${API}/v1/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'voice', params: { text: textOf(L), speaker: v.speaker, speed: v.speed } }) });
  const j = await r.json(); if (!j.id) throw new Error(JSON.stringify(j)); return j.id;
};
let n = 0;
const pending = [];
for (const L of todo) { if (!textOf(L).trim()) { console.log('nothing to say', L.id); continue; } pending.push({ L, id: await post(L) }); }
for (const job of pending) {
  for (;;) {
    const j = await (await fetch(`${API}/v1/jobs/${job.id}`)).json();
    if (j.status === 'done') {
      const src = j.files[0].path, dst = outOf(job.L), af = job.L.voice && job.L.voice.af;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, ...(af ? ['-af', af] : []), '-ac', '1', '-b:a', '56k', dst]);
      await fetch(`${API}/v1/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
      if (++n % 20 === 0) console.log(`${n} / ${pending.length}`);
      break;
    }
    if (j.status === 'failed' || j.status === 'cancelled' || j.status === 'deleted') { console.log('failed', job.L.id, j.error || ''); break; }
    await sleep(800);
  }
}
console.log(`made ${n}`);
const th = {};
thoughts.forEach((text, i) => {
  const f = `t-${i + 1}.mp3`, p = path.join(ROOT, 'assets/voice', f); if (!fs.existsSync(p)) return;
  let sec = text.length * 0.13; try { sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString().trim()) || sec; } catch {}
  th[`t${i + 1}`] = { text, file: f, sec: Math.round(sec * 10) / 10 };
});
fs.writeFileSync(path.join(ROOT, 'assets/voice/thoughts.json'), JSON.stringify(th, null, 1) + '\n');
console.log('thoughts.json', Object.keys(th).length);
