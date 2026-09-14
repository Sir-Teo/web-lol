import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const ordinaryPath = 'docs/reference/lux-attack-variants.json',
  criticalPath = 'docs/reference/critical-attacks.json';
const ordinaryBytes = await readFile(ordinaryPath),
  criticalBytes = await readFile(criticalPath);
const ordinary = JSON.parse(ordinaryBytes),
  critical = JSON.parse(criticalBytes);
const spells = [
  ...Object.values(ordinary.records).map((r) => r.mSpell),
  critical.luxCritSpell.mSpell,
];
assert(spells.every((s) => s.bHaveHitBone));
assert.equal(spells[0].mHitBoneName, spells[1].mHitBoneName);
const bones = { normal: spells[0].mHitBoneName, critical: spells[2].mHitBoneName };
await writeFile('src/content/lux-hit-bones.json', JSON.stringify(bones, null, 2) + '\n');
const names = [
  'ashe-base',
  'lux-base',
  ...['blue', 'red'].flatMap((t) =>
    ['melee', 'caster', 'siege', 'super', 'turret', 'nexus', 'inhibitor'].map((k) => t + '-' + k)
  ),
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  models = [];
for (const name of names) {
  const path = `public/assets/models/${name}.glb`,
    raw = await readFile(path),
    meta = JSON.parse(await readFile(`public/assets/models/${name}.json`));
  assert.equal(raw.length, meta.output.bytes);
  assert.equal(hash(raw), meta.output.sha256);
  const doc = await io.read(path),
    root = doc.getRoot(),
    attachments = {};
  for (const [kind, boneName] of Object.entries(bones)) {
    const found = root
      .listNodes()
      .filter((n) => n.getName().toLowerCase() === boneName.toLowerCase());
    assert(found.length <= 1);
    if (!found.length) {
      attachments[kind] = null;
      continue;
    }
    const node = found[0],
      chain = [];
    let parent = node;
    while (parent) {
      chain.unshift(parent);
      parent = parent.getParentNode();
    }
    const varyingClips = root
      .listAnimations()
      .filter((animation) =>
        animation.listChannels().some((channel) => {
          if (!chain.includes(channel.getTargetNode())) return false;
          const output = channel.getSampler().getOutput(),
            data = output.getArray(),
            size = output.getElementSize();
          return data.some((v, i) => Math.abs(v - data[i % size]) > 1e-7);
        })
      )
      .map((a) => a.getName());
    attachments[kind] = {
      node: node.getName(),
      restPosition: node.getWorldTranslation(),
      ancestors: chain.map((n) => n.getName()),
      varyingClips,
    };
  }
  models.push({ name, path, sha256: hash(raw), attachments });
}
const report = {
  sources: [
    { path: ordinaryPath, sha256: hash(ordinaryBytes) },
    { path: criticalPath, sha256: hash(criticalBytes) },
  ],
  bones,
  models,
  limitations: [
    'Case-folded name lookup is an adapter policy',
    'Rest positions are model-local world transforms, not animated hit positions',
    'Missing bones require a separately validated native fallback',
    'Varying clips identify changing ancestor channels, not their sampled positional range',
  ],
};
await writeFile('docs/reference/lux-hit-attachments.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    models.map((m) => ({
      model: m.name,
      normal: m.attachments.normal?.varyingClips.length ?? null,
      critical: m.attachments.critical?.varyingClips.length ?? null,
    }))
  )
);
