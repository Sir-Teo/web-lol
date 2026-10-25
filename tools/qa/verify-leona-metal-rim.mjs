/** Offline verification only: never compiles or submits Metal work. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isAbsolute, relative } from 'node:path';

const args = process.argv.slice(2),
  pinArg = args.indexOf('--pin');
const pin = JSON.parse(
  readFileSync(pinArg < 0 ? 'docs/reference/leona/metal-rim-verification.json' : args[pinArg + 1])
);
const historical = args.includes('--historical');
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const key = (file) => (isAbsolute(file) ? relative(process.cwd(), file) : file);
const byFile = new Map();
for (const r of pin.files) {
  assert(!byFile.has(r.file), r.file);
  assert.equal(readFileSync(r.archived).length, r.bytes, r.archived);
  assert.equal(sha(r.archived), r.sha256, r.archived);
  if (!historical && r.current) assert.equal(sha(r.file), r.sha256, r.file);
  byFile.set(r.file, r);
}
const frozen = (file) => {
  assert(byFile.has(key(file)), file);
  return byFile.get(key(file)).archived;
};
const json = (file) => JSON.parse(readFileSync(frozen(file)));
const difference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const digests = new Map([
  [1, '6b86adbd5b6f807e71248eff97c03fd42b5db82e9de81578dfebca0cb60dfb12'],
  [9, '6f497054a40a4ce2d84f7e217872ce4ec3a482e2c01361a70f82d546924e63f3'],
  [24, 'ae3c69a06bf883597412669be3ccd0309a7c0683d061908795fa6f96a2e80d30'],
  [33, '396edb76f948fc06da41ab4975f4697a4bdcb9621392fdfa4e3496ee3d0ab4e6'],
  [54, 'f79178c54b8fdf6e81f230ae0836204b64b6f48fee8271f1f39864a4b2dc4853'],
]);
async function verifyRun(run, reflective) {
  const path = (name) => `${run}/${name}`;
  const modulePath = `tools/qa/metal-${reflective ? 'reflection' : 'rim'}-cases.mjs`;
  const module = await import(pathToFileURL(frozen(modulePath)));
  const makeCases = reflective ? module.metalReflectionCases : module.metalRimCases;
  const expected = reflective ? module.expectedMetalReflection : module.expectedMetalRim;
  const cases = json(path('cases.json')),
    native = json(path('native.json')),
    webgl = json(path('webgl.json'));
  const comparison = json(path('comparison.json')),
    inputs = json(path('inputs.json'));
  assert.equal(cases.length, reflective ? 111 : 150);
  assert.deepEqual(cases, makeCases());
  if (!historical) {
    const current = await import(new URL(`../../${modulePath}`, import.meta.url));
    assert.deepEqual(cases, reflective ? current.metalReflectionCases() : current.metalRimCases());
  }
  assert.equal(native.device, 'Apple M1');
  assert.equal(native.results.length, cases.length);
  assert.equal(webgl.results.length, cases.length);
  assert.deepEqual(webgl.errors, []);
  for (const r of inputs) {
    const retained = byFile.get(r.path);
    assert(retained, r.path);
    assert.equal(retained.bytes, r.bytes, r.path);
    assert.equal(retained.sha256, r.sha256, r.path);
  }
  const programs = reflective ? [33, 54] : [1, 9, 24];
  assert.deepEqual(
    inputs.filter((r) => r.program).map((r) => r.program),
    programs
  );
  for (const program of programs)
    assert.equal(inputs.find((r) => r.program === program).sha256, digests.get(program));
  assert.equal(comparison.cases, cases.length);
  const computed = cases.map((o, i) => {
    const n = native.results[i],
      w = webgl.results[i],
      scalar = expected(o);
    assert.equal(n.id, o.id);
    assert.equal(w.id, o.id);
    assert.equal(n.commandStatus, 'completed');
    assert.equal(n.vertexProgram, reflective ? 33 : 1);
    assert.equal(n.fragmentProgram, reflective ? 54 : (o.alphaRef ?? 0) > 0 ? 24 : 9);
    assert.equal(w.error, 0);
    assert.equal(w.cubeResources, reflective ? 1 : 0);
    for (const pixel of [n.pixels, w.pixels]) {
      assert.equal(pixel.length, 4);
      assert(pixel.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    }
    return {
      id: o.id,
      metal: n.pixels,
      webgl: w.pixels,
      scalar,
      metalScalarMax: difference(n.pixels, scalar),
      webglScalarMax: difference(w.pixels, scalar),
      metalWebglMax: difference(n.pixels, w.pixels),
    };
  });
  assert.deepEqual(comparison.comparisons, computed);
  for (const [field, value] of [
    ['maxMetalScalar', 'metalScalarMax'],
    ['maxWebglScalar', 'webglScalarMax'],
    ['maxMetalWebgl', 'metalWebglMax'],
  ]) {
    assert.equal(comparison[field], Math.max(...computed.map((r) => r[value])));
    assert.equal(comparison[field], 0);
  }
  const pixel = (id) => native.results.find((r) => r.id === id)?.pixels;
  if (!reflective) {
    assert.deepEqual(pixel('threshold-99'), [0, 0, 0, 0]);
    assert.equal(pixel('threshold-102')[3], 5);
    assert.deepEqual(pixel('threshold-100'), [0, 0, 0, 0]);
    assert.equal(pixel('threshold-103')[3], 5);
    assert.equal(pixel('threshold-81')[0], 64);
    assert(difference(pixel('power-facing-141'), pixel('power-facing-144')) > 40);
    assert(difference(pixel('interpolation-130'), pixel('interpolation-136')) > 0);
    assert(difference(pixel('uv-148'), pixel('uv-149')) > 10);
  } else {
    assert.deepEqual(pixel('isolated-cube-107'), [0, 0, 0, 0]);
    assert.deepEqual(pixel('isolated-cube-109'), [0, 0, 0, 0]);
    assert.deepEqual(pixel('isolated-cube-108'), pixel('isolated-cube-110'));
    assert(
      pixel('isolated-cube-108')
        .slice(0, 3)
        .some((v) => v > 20)
    );
    assert.equal(pixel('isolated-cube-108')[3], 0);
    const selectedFaces = new Set(
      cases
        .filter((o) => o.id.startsWith('cube-face-'))
        .map((o) => {
          const p = expected({
            ...o,
            source: [0, 0, 0, 0],
            lookup: [255, 255, 255, 255],
            tint: [0, 0, 0, 0],
            fresnel: [0, 0, 0, 1],
            reflection: [1, 1, 1],
            reflectionColor: [1, 1, 1],
          });
          return p.slice(0, 3).join(',');
        })
    );
    assert.equal(selectedFaces.size, 6);
  }
  for (const name of ['compile', 'native']) {
    const command = json(path(`${name}-command.json`));
    assert.equal(command.status, 0);
    assert.equal(command.signal, null);
    assert.equal(readFileSync(frozen(path(`${name}-stderr.log`)), 'utf8'), '');
  }
  const binary = json(path('executable.json'));
  assert.equal(sha(frozen(binary.path)), binary.sha256);
  assert.equal(readFileSync(frozen(binary.path)).length, binary.bytes);
  assert.deepEqual(json(path('native-stdout.log')), native);
  const command = json(path('native-command.json'));
  assert.equal(command.command, binary.path);
  assert.deepEqual(command.args.map(key), [
    ...(reflective ? ['--reflective'] : []),
    ...inputs.filter((r) => r.program).map((r) => r.path),
    path('cases.json'),
  ]);
  return cases.length;
}
assert.equal(pin.nativeGameExecuted, false);
assert.equal(pin.nativeShaderExecuted, true);
assert.equal(pin.nativeGameplayFrameVerified, false);
let total = await verifyRun(pin.run, pin.mode === 'reflective');
if (pin.rimRegression) total += await verifyRun(pin.rimRegression, false);
if (pin.negativeChecks) {
  const controls = json(pin.negativeChecks);
  assert.deepEqual(
    controls.map((r) => r.case),
    ['missing-case', 'changed-pixel', 'changed-library-record']
  );
  assert(controls.every((r) => r.rejected === true && r.exitCode !== 0));
}
if (pin.independentAbi) {
  const abi = json(pin.independentAbi);
  assert.deepEqual(
    abi.programs.map((r) => r.selection.programId),
    [33, 54]
  );
  for (const input of abi.inputs) {
    const row = byFile.get(input.path);
    assert(row, input.path);
    assert.equal(row.bytes, input.bytes);
    assert.equal(row.sha256, input.sha256);
  }
}
if (pin.harnessAlphaRejection) {
  const r = json(pin.harnessAlphaRejection);
  assert.equal(r.rejected, true);
  assert.equal(r.exitCode, 1);
  const cases = json(pin.harnessAlphaRejection.replace('result.json', 'case.json'));
  assert.equal(cases.length, 1);
  assert(cases[0].alphaRef > 0);
  assert.match(
    readFileSync(frozen(pin.harnessAlphaRejection.replace('result.json', 'stderr.log')), 'utf8'),
    /PS54 has no alpha test/
  );
  assert.equal(
    readFileSync(frozen(pin.harnessAlphaRejection.replace('result.json', 'stdout.log')), 'utf8'),
    ''
  );
}
console.log(`PASS: ${total} original Metal / WebGL / scalar samples; offline verification only`);
