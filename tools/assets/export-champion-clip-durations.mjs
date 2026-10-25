import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  durations = {},
  sources = [];
for (const champion of ['ashe', 'lux', 'garen', 'leona', 'ahri', 'masteryi']) {
  const path = `public/assets/models/${champion}-base.glb`,
    raw = await readFile(path),
    meta = JSON.parse(await readFile(path.replace('.glb', '.json')));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  assert.equal(sha256, meta.output.sha256);
  assert.equal(raw.length, meta.output.bytes);
  const doc = await io.read(path);
  durations[champion] = {};
  for (const clip of doc.getRoot().listAnimations()) {
    const duration = Math.max(
      0,
      ...clip.listSamplers().map((s) =>
        s
          .getInput()
          .getArray()
          .reduce((max, v) => Math.max(max, v), 0)
      )
    );
    assert(duration > 0);
    durations[champion][clip.getName()] = duration;
  }
  sources.push({ path, sha256 });
}
await writeFile(
  'src/content/champion-clip-durations.json',
  JSON.stringify(durations, null, 2) + '\n'
);
await writeFile(
  'docs/reference/champion-clip-durations.json',
  JSON.stringify({ sources, durations }, null, 2) + '\n'
);
console.log(`Exported exact GLTF clip endpoints for ${sources.length} champion rigs`);
