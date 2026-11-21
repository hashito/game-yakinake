// Run with "node --test test.mjs". Only temporary copies of the renderer are executed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

const sample = {
  width: 2, height: 2, palette: { A: '#cf4312', B: '#173db4' }, pivot: [1, 0], loop: false,
  frames: [
    { duration: 90, rows: ['A.', '.B'] },
    { duration: 210, rows: ['BA', 'A.'] }
  ]
};

function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'dot-workshop-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const app = join(dir, 'workshop');
  mkdirSync(join(app, 'recipes'), { recursive: true });
  copyFileSync(new URL('./render.mjs', import.meta.url), join(app, 'render.mjs'));
  return {
    dir, app,
    recipe(data) {
      writeFileSync(join(app, 'recipes', 'sample.json'), JSON.stringify(data));
    },
    run(...args) {
      const p = spawnSync(process.execPath, [join(app, 'render.mjs'), ...args], {
        cwd: dir, encoding: 'utf8', timeout: 5000
      });
      assert.ifError(p.error);
      assert.notEqual(p.status, null, 'renderer terminated by signal');
      return p;
    },
    out(ext) { return join(app, 'out', 'sample.' + ext); }
  };
}

// Read the pixels independently from the writer. PNG filters use reconstructed
// bytes from the row above or the previous pixel in the same row.
function pngPixels(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false;
  const chunks = [];
  for (let p = 8; p < png.length;) {
    const length = png.readUInt32BE(p);
    assert.ok(p + length + 12 <= png.length, 'incomplete PNG chunk');
    const kind = png.toString('ascii', p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + length);
    p += length + 12;
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0], 'expected 8-bit non-interlaced RGBA');
    } else if (kind === 'IDAT') {
      chunks.push(data);
    } else if (kind === 'IEND') {
      assert.equal(length, 0);
      assert.equal(p, png.length);
      ended = true;
    }
  }
  assert.ok(ended);
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  assert.equal(raw.length, height * (stride + 1));
  const rgba = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    const filter = raw[row];
    assert.ok(filter <= 4, 'unknown PNG row filter');
    for (let i = 0; i < stride; i++) {
      const pos = y * stride + i;
      const a = i >= 4 ? rgba[pos - 4] : 0;
      const b = y > 0 ? rgba[pos - stride] : 0;
      const c = i >= 4 && y > 0 ? rgba[pos - stride - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      if (filter === 2) pred = b;
      if (filter === 3) pred = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c;
        const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
        pred = da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      rgba[pos] = raw[row + 1 + i] + pred;
    }
  }
  return { width, height, rgba };
}

test('PNGの寸法・透明画素・色と、横並びのコマ位置・時間・支点・繰返し', t => {
  const s = workspace(t);
  s.recipe(sample);
  const result = s.run('sample');
  assert.equal(result.status, 0, result.stderr);
  const { width, height, rgba } = pngPixels(readFileSync(s.out('png')));
  assert.deepEqual([width, height], [4, 2]);
  const expected = ['A', '.', 'B', 'A', '.', 'B', 'A', '.'];
  for (const [i, symbol] of expected.entries()) {
    const actual = rgba.subarray(i * 4, i * 4 + 4);
    if (symbol === '.') assert.equal(actual[3], 0);
    else assert.equal(actual.toString('hex'), sample.palette[symbol].slice(1) + 'ff');
  }
  const atlas = JSON.parse(readFileSync(s.out('json'), 'utf8'));
  assert.deepEqual(atlas, {
    image: 'sample.png', width: 2, height: 2, pivot: [1, 0], loop: false,
    frames: [
      { x: 0, y: 0, w: 2, h: 2, duration: 90 },
      { x: 2, y: 0, w: 2, h: 2, duration: 210 }
    ]
  });
  const first = [s.out('png'), s.out('json')].map(p => readFileSync(p));
  for (const ext of ['png', 'json']) rmSync(s.out(ext));
  assert.equal(s.run('sample').status, 0);
  assert.deepEqual([s.out('png'), s.out('json')].map(p => readFileSync(p)), first);
});

test('片方だけ既にある場合も元のデータを保護する', t => {
  const s = workspace(t);
  s.recipe(sample);
  mkdirSync(join(s.app, 'out'), { recursive: true });
  for (const [ext, other] of [['png', 'json'], ['json', 'png']]) {
    writeFileSync(s.out(ext), 'keep-this');
    assert.notEqual(s.run('sample').status, 0);
    assert.equal(readFileSync(s.out(ext), 'utf8'), 'keep-this');
    assert.ok(!existsSync(s.out(other)));
    rmSync(s.out(ext));
  }
});

test('不正なID・パストラバーサル・壊れたJSONを拒否する', t => {
  const s = workspace(t);
  const json = JSON.stringify(sample);
  writeFileSync(join(s.app, 'outside.json'), json);
  s.recipe(sample);
  for (const id of ['../outside', 'sample.json', 'Sample', 'abc/def', 'x'.repeat(49)]) {
    assert.notEqual(s.run(id).status, 0, id);
  }
  assert.ok(!existsSync(join(s.app, 'outside.png')));
  assert.equal(readFileSync(join(s.app, 'outside.json'), 'utf8'), json);
  writeFileSync(join(s.app, 'recipes', 'sample.json'), '{');
  assert.notEqual(s.run('sample').status, 0);
  for (const ext of ['png', 'json']) assert.ok(!existsSync(s.out(ext)));
});

test('画素・パレット・コマ時間・資源上限と未知フィールドを検査する', t => {
  const s = workspace(t);
  const cases = {
    'zero width': { width: 0 }, 'height over 64': { height: 65 },
    'non-integer width': { width: 1.5 }, 'invalid loop': { loop: 1 },
    'pivot off frame': { pivot: [2, 0] }, 'unknown root key': { metadata: {} },
    'invalid palette color': { palette: { A: '#oops', B: '#ffffff' } },
    'reserved transparent symbol': { palette: { ...sample.palette, '.': '#ffffff' } },
    'empty frame list': { frames: [] },
    'more than 32 frames': { frames: Array(33).fill(sample.frames[0]) }
  };
  for (const [name, frame] of Object.entries({
    'unknown frame key': { surprise: 7 }, 'missing row': { rows: ['AA'] },
    'wrong row width': { rows: ['A', 'BB'] }, 'undefined symbol': { rows: ['AZ', 'BA'] },
    'duration below min': { duration: 19 }, 'duration above max': { duration: 5001 }
  })) cases[name] = { frames: [{ ...sample.frames[0], ...frame }] };
  for (const [name, change] of Object.entries(cases)) {
    s.recipe({ ...sample, ...change });
    assert.notEqual(s.run('sample').status, 0, name);
    for (const ext of ['png', 'json']) assert.ok(!existsSync(s.out(ext)), name);
  }
});

test('リンク経由のレシピ読み取り・出力・既存リンクの置換を拒否する', t => {
  const s = workspace(t);
  const extDir = join(s.dir, 'elsewhere');
  const inbound = join(s.app, 'recipes');
  const outbound = join(s.app, 'out');
  mkdirSync(extDir);
  writeFileSync(join(extDir, 'sample.json'), JSON.stringify(sample));
  // Creating a symbolic link can require an additional OS privilege on Windows.
  try {
    symlinkSync(join(extDir, 'sample.json'), join(inbound, 'sample.json'), 'file');
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      t.skip('OS does not permit creating a test symlink');
      return;
    }
    throw e;
  }
  assert.notEqual(s.run('sample').status, 0, 'linked recipe file');
  rmSync(inbound, { recursive: true });
  symlinkSync(extDir, inbound, 'dir');
  assert.notEqual(s.run('sample').status, 0, 'linked recipes directory');
  rmSync(inbound);
  mkdirSync(inbound);
  s.recipe(sample);

  const sink = join(s.dir, 'sink');
  mkdirSync(sink);
  rmSync(outbound, { recursive: true, force: true });
  symlinkSync(sink, outbound, 'dir');
  assert.notEqual(s.run('sample').status, 0, 'linked output directory');
  assert.ok(!existsSync(join(sink, 'sample.png')));
  assert.ok(!existsSync(join(sink, 'sample.json')));
  rmSync(outbound);
  mkdirSync(outbound);
  const absent = join(sink, 'missing-file');
  symlinkSync(absent, s.out('json'), 'file');
  assert.notEqual(s.run('sample').status, 0, 'output would replace dangling link');
  assert.ok(!existsSync(s.out('png')));
  assert.ok(!existsSync(absent));
});
