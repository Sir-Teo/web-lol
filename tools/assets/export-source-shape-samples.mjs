/** Execute only the pinned external point/sphere/cylinder kernel for fixtures. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/utils/basis.ts',
    sha256: '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/spawnShape.ts',
    sha256: '28a9f0b0a3bd61887564f6b77241317ed2242433691ff45fe2c29ddea392472d',
  },
];
function load(row, resolve) {
  const bytes = fs.readFileSync(row.path);
  assert.equal(hash(bytes), row.sha256);
  const exports = {};
  new Function(
    'require',
    'exports',
    ts.transpileModule(bytes.toString(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(resolve, exports);
  return exports;
}
const basis = load(readers[0], (name) => {
  assert.equal(name, '@/modules/viewport/shared/utils/space');
  return { AXIS_SIGN: [1, 1, 1] };
});
const kernel = load(readers[1], (name) => {
  if (name.endsWith('/basis')) return basis;
  if (name.endsWith('/sampleCurve'))
    return {
      drawChannelsInto() {
        throw Error('Animated legacy shapes are outside this fixture set');
      },
    };
  throw Error('Unexpected external dependency ' + name);
});
const hex = (values) =>
  Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('hex');
const samples = [];
const cases = [
  { kind: 'point', offset: [0, 0, 0] },
  { kind: 'point', offset: [0, -150, 0] },
];
for (const kind of ['sphere', 'cylinder'])
  for (const volume of [true, false])
    for (let i = 0; i < 16; i++)
      cases.push({
        kind,
        radius: 30,
        volume,
        ...(kind === 'cylinder' ? { height: 100 } : {}),
        case: i,
      });
for (const shape of cases) {
  const draws =
    shape.kind === 'point'
      ? []
      : shape.volume
        ? [
            ((shape.case * 7) % 16) / 16,
            ((shape.case * 3) % 16) / 16,
            ((shape.case * 11) % 16) / 16,
          ]
        : [((shape.case * 3) % 16) / 16, ((shape.case * 11) % 16) / 16];
  let count = 0;
  const out = kernel.birth();
  const rng = {
    unitFloat() {
      assert(count < draws.length);
      return draws[count++];
    },
    range(min, max) {
      return min + (max - min) * this.unitFloat();
    },
  };
  const { case: index, ...input } = shape;
  kernel.sampleShape(input, rng, 0, null, out);
  assert.equal(count, draws.length);
  samples.push({
    name: `${shape.kind}-${shape.volume ?? 'point'}-${index ?? samples.length}`,
    shape: input,
    draws,
    expected: {
      raw: hex(out.raw),
      offset: hex(out.offset),
      turn: hex(out.turn),
      turned: out.turned,
    },
  });
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  samples,
  scope:
    'External JS kernel fixtures in native source units. Exact float32 bytes on this runtime; no native CPU/PRNG/scheduling or source flag-mapping certificate.',
};
const raw = JSON.stringify(record, null, 2) + '\n',
  output = 'docs/reference/source-spawn-shape-samples.json';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), raw);
else fs.writeFileSync(output, raw, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
