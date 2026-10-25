import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import validator from 'gltf-validator';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const option = process.argv.indexOf('--raw-conversion');
assert(option >= 0 && process.argv[option + 1], 'Provide --raw-conversion');
for (const name of ['MasterYi']) {
  const outputIndex = process.argv.indexOf('--output'),
    output = outputIndex < 0 ? undefined : process.argv[outputIndex + 1];
  if (output) assert(!fs.existsSync(output));
  const metadata = JSON.parse(fs.readFileSync('public/assets/models/masteryi-base.json')),
    rawPath = process.argv[option + 1],
    path = metadata.output.path;
  assert.equal(fs.statSync(rawPath).size, metadata.rawConversion.bytes);
  assert.equal(
    createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex'),
    metadata.rawConversion.sha256
  );
  assert.equal(
    createHash('sha256').update(fs.readFileSync(path)).digest('hex'),
    metadata.output.sha256
  );
  const raw = await io.read(rawPath),
    doc = await io.read(path),
    sourceAnimations = raw.getRoot().listAnimations(),
    animations = doc.getRoot().listAnimations();
  assert.equal(animations.length, sourceAnimations.length);
  let channels = 0,
    keys = 0,
    corrections = 0;
  for (const a of sourceAnimations) {
    const b = animations.find((b) => b.getName() === a.getName());
    assert(b);
    const binding = (c) => `${c.getTargetNode().getName()}:${c.getTargetPath()}`;
    const mapped = new Map(b.listChannels().map((c) => [binding(c), c]));
    assert.equal(mapped.size, a.listChannels().length);
    for (const c of a.listChannels()) {
      const d = mapped.get(binding(c));
      assert(d);
      const original = c.getSampler(),
        exported = d.getSampler();
      assert.equal(original.getInterpolation(), exported.getInterpolation());
      assert.deepEqual(exported.getInput().getArray(), original.getInput().getArray());
      const values = original.getOutput().getArray(),
        expected = values.slice();
      if (c.getTargetPath() === 'translation')
        for (let i = 0; i < expected.length; i++) expected[i] *= metadata.unitScale;
      if (c.getTargetPath() === 'rotation')
        for (let i = 0; i < expected.length; i += 4) {
          const q = Array.from(expected.slice(i, i + 4)),
            length = Math.hypot(...q);
          if (Math.abs(length - 1) > 1e-4) {
            assert.equal(name, 'MasterYi');
            assert.equal(a.getName(), 'spell3');
            assert.equal(c.getTargetNode().getName(), 'C_Buffbone_Glb_Center_Loc');
            assert.deepEqual(q, [0, 0.8457037210464478, 0, 0]);
            for (let k = 0; k < 4; k++) expected[i + k] /= length;
            corrections++;
          }
        }
      assert.deepEqual(
        exported.getOutput().getArray(),
        expected,
        `${name} ${a.getName()} ${binding(c)}`
      );
      channels++;
      keys += original.getInput().getCount();
    }
  }
  assert.equal(corrections, name === 'MasterYi' ? 26 : 0);
  const sourceP = raw
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives()),
    targetP = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives());
  assert.equal(sourceP.length, targetP.length);
  for (let n = 0; n < sourceP.length; n++) {
    const a = sourceP[n],
      b = targetP[n];
    assert.deepEqual(b.listSemantics().toSorted(), a.listSemantics().toSorted());
    assert.deepEqual(b.getIndices().getArray(), a.getIndices().getArray());
    for (const key of a.listSemantics()) {
      const original = a.getAttribute(key).getArray(),
        expected = original.slice();
      if (key === 'POSITION')
        for (let i = 0; i < expected.length; i++) expected[i] *= metadata.unitScale;
      if (key === 'JOINTS_0') {
        const w = a.getAttribute('WEIGHTS_0').getArray();
        for (let i = 0; i < expected.length; i++) if (w[i] === 0) expected[i] = 0;
      }
      assert.deepEqual(b.getAttribute(key).getArray(), expected, `${name} ${key}`);
    }
  }
  const bytes = fs.readFileSync(path),
    validation = await validator.validateBytes(bytes);
  assert.equal(validation.issues.numErrors, 0);
  assert.equal(validation.issues.numWarnings, 0);
  const pin = (file) => {
    const bytes = fs.readFileSync(file);
    return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const result = {
    result: 'passed',
    scope:
      'Exact source-converted animation key/input comparison after declared unit conversion and targeted non-unit quaternion correction. Static validation is separate from native/visual acceptance.',
    name,
    source: pin(rawPath),
    output: pin(path),
    verifier: pin('tools/assets/verify-masteryi-keys.mjs'),
    animations: animations.length,
    channels,
    keys,
    correctedQuaternionKeys: corrections,
    geometryIndicesAndAttributesEqualAfterDeclaredConversion: true,
    sourceNormalsPreserved: true,
    gltf: { errors: 0, warnings: 0 },
    acceptance: {
      nativeEquivalent: false,
      visualReviewComplete: false,
      productionIntegrated: false,
    },
  };
  if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      name,
      output,
      animations: result.animations,
      channels,
      keys,
      correctedQuaternionKeys: corrections,
      gltf: result.gltf,
    })
  );
}
