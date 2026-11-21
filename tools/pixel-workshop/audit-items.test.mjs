import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, 'audit-items.mjs');
const png = Buffer.from('89504e470d0a1a0a', 'hex');

async function fixture(item) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pixel-audit-'));
  await mkdir(path.join(dir, 'assets'), { recursive: true });
  for (const name of ['world.png','inventory.png','examine.png']) await writeFile(path.join(dir,'assets',name), png);
  const manifest = { version:1, policy:'all-gameplay-items-pixel', items:[item] };
  await writeFile(path.join(dir,'pixel-items.json'), JSON.stringify(manifest));
  return dir;
}

function run(file) { return spawnSync(process.execPath, [tool, file], { encoding:'utf8' }); }

test('必須のworld/inventory/examine実ファイルがそろえば合格', async () => {
  const dir = await fixture({id:'key',name:'鍵',kind:'pickup',collectable:true,examinable:true,world:'assets/world.png',inventory:'assets/inventory.png',examine:'assets/examine.png',states:['idle'],pixelArt:true});
  const r = run(path.join(dir,'pixel-items.json'));
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PASS/);
});

test('所持品画像の欠落とSVG代用を拒否', async () => {
  const dir = await fixture({id:'key',name:'鍵',kind:'pickup',collectable:true,examinable:false,world:'assets/world.svg',inventory:null,examine:null,states:['idle'],pixelArt:true});
  await writeFile(path.join(dir,'assets','world.svg'),'<svg/>');
  const r = run(path.join(dir,'pixel-items.json'));
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/inventory/);
  assert.match(r.stderr,/PNG または WebP/);
});

test('作品フォルダ外参照とシンボリックリンクを拒否', async () => {
  const dir = await fixture({id:'note',name:'紙',kind:'prop',collectable:false,examinable:false,world:'assets/link.png',inventory:null,examine:null,states:['idle'],pixelArt:true});
  await symlink(path.join(dir,'assets','world.png'), path.join(dir,'assets','link.png'));
  let r = run(path.join(dir,'pixel-items.json'));
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/通常ファイル/);
  const bad = {version:1,policy:'all-gameplay-items-pixel',items:[{id:'note',collectable:false,examinable:false,world:'../outside.png',inventory:null,examine:null,states:['idle'],pixelArt:true}]};
  await writeFile(path.join(dir,'pixel-items.json'),JSON.stringify(bad));
  r = run(path.join(dir,'pixel-items.json'));
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/相対パス/);
});
