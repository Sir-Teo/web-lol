/** Publish the verified transport closure without changing any authored bytes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const programSha = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
const args = process.argv.slice(2);
assert(
  args.every((arg) => arg === '--check'),
  'Unknown publication argument'
);
const check = args.includes('--check');
const root = 'public/assets/effects/baron-attack';
const raw = fs.readFileSync('.cache/baron-attack-program-v2/program.json');
assert.equal(sha(raw), programSha, 'Baron program differs');
const program = JSON.parse(raw);
assert.equal(program.format, 2);
assert.equal(program.textures.length, 25);
assert.equal(program.meshes.length, 2);
const files = [{ name: 'program.json', raw, sha256: programSha }];
for (const row of program.textures)
  files.push({
    name: row.path,
    raw: fs.readFileSync(path.join('.cache/baron-attack-textures-packed', row.path)),
    bytes: row.bytes,
    sha256: row.sha256,
  });
for (const row of program.meshes)
  files.push({
    name: row.name,
    raw: fs.readFileSync(path.join('.cache/baron-attack-packed', row.name)),
    bytes: row.bytes,
    sha256: row.sha256,
  });
assert.equal(new Set(files.map((f) => f.name)).size, 28);
// Validate the entire source and destination closure before creating any file.
for (const file of files) {
  assert.equal(path.basename(file.name), file.name, 'Unsafe transport path');
  assert.equal(file.raw.length, file.bytes ?? raw.length, 'Transport extent differs');
  assert.equal(sha(file.raw), file.sha256, 'Transport checksum differs');
  const target = path.join(root, file.name);
  assert(!fs.existsSync(target) || !fs.lstatSync(target).isSymbolicLink(), 'Transport symlink');
  if (fs.existsSync(target))
    assert(fs.readFileSync(target).equals(file.raw), 'Conflicting public transport');
  else assert(!check, `Missing public transport: ${target}`);
}
if (fs.existsSync(root))
  assert(
    fs.readdirSync(root).every((name) => files.some((f) => f.name === name)),
    'Unexpected public transport'
  );
if (!check) {
  fs.mkdirSync(root, { recursive: true });
  for (const file of files) {
    const target = path.join(root, file.name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, file.raw, { flag: 'wx' });
  }
}
console.log(
  JSON.stringify({
    status: 'passed',
    files: files.length,
    bytes: files.reduce((sum, f) => sum + f.raw.length, 0),
    textures: 25,
    authoredMips: 214,
    meshes: 2,
    programSha256: programSha,
    rendererBound: false,
  })
);
