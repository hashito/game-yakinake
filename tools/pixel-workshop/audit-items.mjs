import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error('使い方: node audit-items.mjs <pixel-items.json>');
  process.exit(2);
}

const abs = path.resolve(file);
const base = path.dirname(abs);
let data;
try {
  data = JSON.parse(fs.readFileSync(abs, 'utf8'));
} catch {
  console.error('FAIL: 台帳をUTF-8 JSONとして読めません。');
  process.exit(1);
}

const errors = [];
const warnings = [];
const seen = new Set();
if (data?.version !== 1) errors.push('version は 1 にしてください。');
if (data?.policy !== 'all-gameplay-items-pixel') errors.push('policy は all-gameplay-items-pixel にしてください。');
if (!Array.isArray(data?.items)) errors.push('items 配列が必要です。');

function checkAsset(p, key, value) {
  if (typeof value !== 'string' || !value.trim()) return;
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    errors.push(`${p}: ${key} は台帳と同じ作品フォルダ配下の相対パスにしてください。`);
    return;
  }
  if (!/\.(png|webp)$/i.test(value)) errors.push(`${p}: ${key} は PNG または WebP のドット絵にしてください。`);
  const target = path.resolve(base, value);
  if (target !== base && !target.startsWith(base + path.sep)) {
    errors.push(`${p}: ${key} が作品フォルダ外を参照しています。`);
    return;
  }
  try {
    const st = fs.lstatSync(target);
    if (!st.isFile() || st.isSymbolicLink()) errors.push(`${p}: ${key} は通常ファイルを参照してください。`);
  } catch {
    errors.push(`${p}: ${key} のファイルがありません: ${value}`);
  }
}

for (const [i, item] of (data?.items ?? []).entries()) {
  const p = `items[${i}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`${p}: オブジェクトではありません。`); continue; }
  if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(item.id)) errors.push(`${p}: id が不正です。`);
  else if (seen.has(item.id)) errors.push(`${p}: id ${item.id} が重複しています。`);
  else seen.add(item.id);
  if (item.pixelArt !== true) errors.push(`${p}: pixelArt:true が必要です。`);
  if (typeof item.world !== 'string' || !item.world.trim()) errors.push(`${p}: world のドット絵表現が必要です。`);
  if (item.collectable === true && (typeof item.inventory !== 'string' || !item.inventory.trim())) errors.push(`${p}: collectable=true なので inventory が必要です。`);
  if (item.examinable === true && (typeof item.examine !== 'string' || !item.examine.trim())) errors.push(`${p}: examinable=true なので examine が必要です。`);
  if (!Array.isArray(item.states) || item.states.length === 0) warnings.push(`${p}: states が空です。最低1状態を明示してください。`);
  checkAsset(p, 'world', item.world);
  checkAsset(p, 'inventory', item.inventory);
  checkAsset(p, 'examine', item.examine);
}

if (warnings.length) {
  console.log('WARN');
  for (const w of warnings) console.log('- ' + w);
}
if (errors.length) {
  console.error('FAIL');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log(`PASS: ${data.items.length} 件。全アイテムの必須ドット絵表現と実ファイルを確認しました。`);
