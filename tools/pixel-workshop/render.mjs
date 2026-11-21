// Offline renderer for the workshop's data-only recipes. All paths are relative to this file.
import { constants as F } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

let root;
const maxBytes = 256 * 1024;
class WorkshopError extends Error {}
const fail = message => { throw new WorkshopError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const between = (value, min, max) => Number.isInteger(value) && min <= value && value <= max;
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;

function fields(value, keys, name) {
  if (!object(value) || Object.keys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(value, key))) {
    fail(name + ' の項目は ' + keys.join(', ') + ' を指定してください。');
  }
}

function validate(recipe) {
  fields(recipe, ['width', 'height', 'palette', 'pivot', 'loop', 'frames'], '原画');
  const { width, height, palette, pivot, loop, frames } = recipe;
  if (!between(width, 1, 64) || !between(height, 1, 64)) fail('幅と高さは1〜64の整数です。');
  if (!object(palette)) fail('palette は記号と色の組を持つオブジェクトです。');
  for (const [key, color] of Object.entries(palette)) {
    if (key.length !== 1 || key < '!' || key > '~' || key === '.') fail('palette の記号が使えません。');
    if (typeof color !== 'string' || color.length !== 7 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      fail('palette の色は #RRGGBB で指定してください。');
    }
  }
  if (!Array.isArray(pivot) || pivot.length !== 2 || !between(pivot[0], 0, width - 1) ||
      !between(pivot[1], 0, height - 1)) fail('pivot はコマの内側の整数座標 [x,y] です。');
  if (typeof loop !== 'boolean') fail('loop は true / false です。');
  if (!Array.isArray(frames) || !between(frames.length, 1, 32)) fail('コマ数は1〜32です。');
  for (const [i, frame] of frames.entries()) {
    const name = 'コマ' + (i + 1);
    fields(frame, ['duration', 'rows'], name);
    if (!between(frame.duration, 20, 5000)) fail(name + ' のdurationは20〜5000の整数（ms）です。');
    if (!Array.isArray(frame.rows) || frame.rows.length !== height) fail(name + ' の行数が違います。');
    for (const [y, row] of frame.rows.entries()) {
      if (typeof row !== 'string' || row.length !== width) fail(name + ' の' + (y + 1) + '行目の幅が違います。');
      for (const symbol of row) {
        if (symbol !== '.' && !Object.hasOwn(palette, symbol)) fail(name + ' の' + (y + 1) + '行目に未定義の記号があります。');
      }
    }
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let k = 0; k < 8; k++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function chunk(name, bytes) {
  const data = Buffer.alloc(12 + bytes.length);
  data.writeUInt32BE(bytes.length, 0);
  data.write(name, 4, 4, 'ascii');
  bytes.copy(data, 8);
  let crc = 0xffffffff;
  for (const b of data.subarray(4, 8 + bytes.length)) crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 255];
  data.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + bytes.length);
  return data;
}

function sheet({ width, height, palette, frames }) {
  const stride = width * frames.length * 4 + 1;
  const raw = Buffer.alloc(stride * height); // filter 0 and transparent black are both zero
  const rgba = new Map(Object.entries(palette).map(([s, c]) => [s, parseInt(c.slice(1) + 'ff', 16)]));
  for (const [i, frame] of frames.entries()) {
    for (const [y, row] of frame.rows.entries()) {
      const start = y * stride + 1 + i * width * 4;
      for (let x = 0; x < width; x++) {
        if (row[x] !== '.') raw.writeUInt32BE(rgba.get(row[x]), start + x * 4);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width * frames.length, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6; // RGBA
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function directory(name, create = false) {
  const target = path.join(root, name);
  if (create) {
    try { await fs.mkdir(target); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  const stat = await fs.lstat(target);
  if (!stat.isDirectory() || await fs.realpath(target) !== target) fail(name + ' は作品内の実ディレクトリを使用してください。');
  return target;
}

async function load(id) {
  const target = path.join(await directory('recipes'), id + '.json');
  const before = await fs.lstat(target);
  if (!before.isFile() || before.size > maxBytes) fail('原画は256 KiB以下の通常ファイルにしてください。');
  const handle = await fs.open(target, F.O_RDONLY | (F.O_NOFOLLOW ?? 0) | (F.O_NONBLOCK ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !sameFile(before, stat) || stat.size > maxBytes) fail('原画を開けません。');
    const bytes = Buffer.alloc(maxBytes + 1);
    let end = 0;
    while (end < bytes.length) {
      const { bytesRead } = await handle.read(bytes, end, bytes.length - end, null);
      if (!bytesRead) break;
      end += bytesRead;
    }
    if (end > maxBytes) fail('原画が256 KiBを超えています。');
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end)));
    } catch {
      fail('UTF-8のJSONとして読み込めません。原画の文字コードと書式を確認してください。');
    }
  } finally { await handle.close(); }
}

async function save(id, png, meta) {
  const out = await directory('out', true);
  const files = [[id + '.png', png], [id + '.json', JSON.stringify(meta, null, 2) + '\n']];
  for (const [name] of files) {
    try { await fs.lstat(path.join(out, name)); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    fail('出力が既にあります。別のIDを使用するか、以前の出力を移動してください。');
  }
  // Prepare both files before publishing. link() publishes complete bytes without replacing a name.
  const work = await fs.mkdtemp(path.join(out, '.render-'));
  const published = [];
  try {
    for (const [name, data] of files) await fs.writeFile(path.join(work, name), data, { flag: 'wx' });
    if (await directory('out') !== out || await fs.realpath(work) !== work) fail('出力先が変更されました。');
    for (const [name, data] of files) {
      const temp = path.join(work, name);
      const dest = path.join(out, name);
      const owner = await fs.lstat(temp);
      try {
        await fs.link(temp, dest);
        published.push({ dest, owner });
      } catch (error) {
        if (!['ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EPERM', 'EACCES', 'EMLINK', 'EINVAL'].includes(error.code)) throw error;
        // FAT and some shared folders do not support hard links. Create exclusively before writing.
        const file = await fs.open(dest, 'wx');
        try {
          let stat;
          try { stat = await file.stat(); } catch (e) { await fs.unlink(dest); throw e; }
          published.push({ dest, owner: stat });
          await file.writeFile(data);
        } finally { await file.close(); }
      }
    }
  } catch (e) {
    for (const { dest, owner } of published) {
      if (sameFile(owner, await fs.lstat(dest).catch(() => ({})))) await fs.unlink(dest);
    }
    throw e;
  } finally {
    for (const [name] of files) await fs.unlink(path.join(work, name)).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await fs.rmdir(work);
  }
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('使い方: node render.mjs <id>\n隣の recipes/<id>.json から out/<id>.png と out/<id>.json を生成します。\nIDは英小文字・数字で始まる1〜48文字（以降はハイフンも可）。Windowsの予約名は使えません。既存の出力は上書きしません。');
    return;
  }
  const id = args[0];
  if (args.length !== 1 || !id || id.length > 48 || !/^[a-z0-9]/.test(id) || /[^a-z0-9-]/.test(id) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id)) fail('IDを確認してください。使い方は --help で表示できます。');
  root = path.dirname(await fs.realpath(fileURLToPath(import.meta.url)));
  const recipe = await load(id);
  validate(recipe);
  const { width, height, pivot, loop, frames } = recipe;
  const meta = { image: id + '.png', width, height, pivot, loop,
    frames: frames.map(({ duration }, i) => ({ x: i * width, y: 0, w: width, h: height, duration })) };
  await save(id, sheet(recipe), meta);
  console.log('生成しました: out/' + id + '.png, out/' + id + '.json');
}

main(process.argv.slice(2)).catch(error => {
  const ioMessage = {
    ENOENT: '原画またはフォルダが見つかりません。',
    EEXIST: '同名の出力が既にあります。',
    EACCES: 'ファイルの読み書きが許可されていません。',
    EPERM: 'ファイル操作が許可されていません。',
    ENOSPC: '出力先の空き容量が不足しています。',
    EROFS: '出力先が読み取り専用です。',
  };
  const message = error instanceof WorkshopError ? error.message :
    Object.hasOwn(ioMessage, error.code) ? ioMessage[error.code] : 'ファイルの読み書きに失敗しました。';
  console.error('生成を中止しました。', message);
  process.exitCode = 1;
});
