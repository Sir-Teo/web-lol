import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  symlink,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const producer = resolve('tools/assets/convert-ahri-r-meshes.mjs');
const decoded = JSON.parse(await readFile('docs/reference/ahri/r-particles-decoded.json', 'utf8'));
const record = JSON.parse(await readFile('docs/reference/ahri/r-mesh-transports.json', 'utf8'));
async function fixture(fn) {
  const cwd = await mkdtemp(join(tmpdir(), 'ahri-r-mesh-'));
  try {
    await mkdir(join(cwd, 'docs/reference/ahri'), { recursive: true });
    for (const file of ['r-particles.json', 'r-particles-decoded.json'])
      await copyFile('docs/reference/ahri/' + file, join(cwd, 'docs/reference/ahri', file));
    for (const row of decoded.meshes.filter((m) =>
      record.meshes.some((r) => r.source.path === m.source.path)
    )) {
      const target = join(cwd, row.path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(row.path, target);
    }
    await fn(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
function run(cwd) {
  return spawnSync(process.execPath, [producer], { cwd, encoding: 'utf8' });
}
test('all four exact transports reproduce in an isolated output root', async () =>
  fixture(async (cwd) => {
    const r = run(cwd);
    assert.equal(r.status, 0, r.stderr);
    for (const row of record.meshes)
      assert.deepEqual(await readFile(join(cwd, row.glb.path)), await readFile(row.glb.path));
    assert.equal(run(cwd).status, 0);
  }));
test('a final ledger conflict prevents every earlier GLB write', async () =>
  fixture(async (cwd) => {
    const path = join(cwd, '.cache/ahri-r-meshes-v1/meshes.json');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'conflict');
    const r = run(cwd);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Conflicting/);
    assert.deepEqual(await readdir(dirname(path)), ['meshes.json']);
    assert.equal(await readFile(path, 'utf8'), 'conflict');
  }));
test('symlink leaf and parent reject before partial mesh publication', async () => {
  await fixture(async (cwd) => {
    const path = join(cwd, record.meshes.at(-1).glb.path),
      other = join(cwd, 'untouched');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(other, 'original');
    await symlink(other, path);
    const r = run(cwd);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /symlink/);
    assert.deepEqual(await readdir(dirname(path)), [path.split('/').at(-1)]);
    assert.equal(await readFile(other, 'utf8'), 'original');
  });
  await fixture(async (cwd) => {
    const other = join(cwd, 'untouched');
    await mkdir(other);
    await mkdir(join(cwd, '.cache'), { recursive: true });
    await symlink(other, join(cwd, '.cache/ahri-r-meshes-v1'), 'dir');
    const r = run(cwd);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /symlink/);
    assert.deepEqual(await readdir(other), []);
  });
});
test('changed source or decoder record rejects before creating output directories', async () => {
  for (const file of ['r-particles.json', 'r-particles-decoded.json'])
    await fixture(async (cwd) => {
      await writeFile(join(cwd, 'docs/reference/ahri', file), '{}');
      assert.notEqual(run(cwd).status, 0);
      await assert.rejects(readdir(join(cwd, '.cache/ahri-r-meshes-v1')), {
        code: 'ENOENT',
      });
    });
});

test('a corrupt selected native mesh rejects before publishing any transport', async () =>
  fixture(async (cwd) => {
    const row = decoded.meshes.find((m) => m.source.path === record.meshes.at(-1).source.path);
    await writeFile(join(cwd, row.path), '{}');
    assert.notEqual(run(cwd).status, 0);
    await assert.rejects(readdir(join(cwd, '.cache/ahri-r-meshes-v1')), {
      code: 'ENOENT',
    });
  }));
