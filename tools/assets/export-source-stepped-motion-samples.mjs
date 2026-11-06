/** Execute selected external integrate/drag functions with explicit sampled
 * values; lifetime expiry, fields, spin/placement/carry are outside this fixture. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const reader = {
  path: '.cache/baron-emission-readers/engine/simulation/integrate.ts',
  sha256: '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
};
const raw = fs.readFileSync(reader.path);
assert.equal(createHash('sha256').update(raw).digest('hex'), reader.sha256);
const source = ts.createSourceFile(reader.path, raw.toString(), ts.ScriptTarget.Latest, true);
const selected = source.statements.filter(
  (s) => ts.isFunctionDeclaration(s) && ['integrate', 'dragInto'].includes(s.name?.text)
);
assert.equal(selected.length, 2);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(
    selected.map((s) => s.getText(source)).join('\n') +
      `
const DRAG_MOTION={analytic:1},NOT_LINGERING=-1;
const KEPT=new Float32Array(3),MOVING=new Float32Array(3);
const overLife=value=>new Float32Array(value),age01=()=>0;
const turn=()=>{},place=()=>{},carry=()=>{};
function retire(){throw Error('Lifetime retirement is outside this fixture');}
function pushInto(){throw Error('Force fields are outside this fixture');}
export {integrate,MOVING};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
  ).outputText
)(exports);
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex');
function run(input) {
  const pool = {
    count: 1,
    position: new Float32Array(input.position),
    velocity: new Float32Array(input.velocity),
    birthAcceleration: new Float32Array(input.birthAcceleration),
    birthDrag: new Float32Array(input.birthDrag),
    fresh: new Uint8Array([input.fresh ? 1 : 0]),
    birthTime: new Float32Array([0]),
    lifetime: new Float32Array([Infinity]),
    emitter: new Uint16Array([0]),
    serial: new Uint32Array([0]),
    lingerFrom: new Float32Array([-1]),
  };
  const emitter = {
    acceleration: input.acceleration,
    velocity: input.carriedVelocity,
    drag: input.drag,
    linger: null,
  };
  exports.integrate(
    pool,
    { dragMotion: 0, emitters: [emitter] },
    [],
    { now: input.dt, dt: input.dt },
    []
  );
  return {
    position: hex(pool.position),
    velocity: hex(pool.velocity),
    moving: hex(exports.MOVING),
    fresh: pool.fresh[0] === 1,
  };
}
const base = {
  position: [1 / 3, -2, 4],
  velocity: [120, -60, 10],
  birthAcceleration: [0, 0, 0],
  acceleration: [0, 0, 0],
  carriedVelocity: [0, 0, 0],
  birthDrag: [0, 3, 0],
  drag: [0, 0, 0],
};
const cases = [
  base,
  { ...base, birthDrag: [100, 100, 100] },
  { ...base, birthDrag: [-3, -2, -1] },
  { ...base, birthAcceleration: [1, -2, 3], acceleration: [4, -5, 6] },
  { ...base, velocity: [0, 0, 0], carriedVelocity: [10, -20, 30] },
  { ...base, carriedVelocity: [10, -20, 30], drag: [1, 2, 3] },
  { ...base, velocity: [0, -0, 0], birthDrag: [0, 0, 0] },
  {
    ...base,
    velocity: [1e-8, 1 / 3, Math.PI],
    birthAcceleration: [1 / 7, 0, -1 / 9],
    drag: [1 / 11, 1 / 13, 1 / 17],
  },
];
const samples = [];
for (const [index, definition] of cases.entries())
  for (const dt of [0, 1 / 60, 1 / 30, 1])
    for (const fresh of [false, true]) {
      const input = { ...definition, dt, fresh };
      const packed = Object.fromEntries(
        Object.entries(input).map(([key, v]) => [
          key,
          Array.isArray(v) ? hex(new Float32Array(v)) : v,
        ])
      );
      samples.push({ name: `${index}-${dt}-${fresh}`, input: packed, expected: run(input) });
    }
const birthPath = 'docs/reference/source-birth-value-samples.json',
  birthRaw = fs.readFileSync(birthPath),
  birthSha256 = createHash('sha256').update(birthRaw).digest('hex');
assert.equal(birthSha256, '6b707674bbcd39e350a038ee4a125c36c4bef894bf420df9b0e0d05aaba51c63');
const birth = JSON.parse(birthRaw),
  decode = (text) => {
    const b = Buffer.from(text, 'hex');
    return Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
  };
const sequences = [];
for (let definition = 0; definition < 21; definition++) {
  const sample = birth.samples.find(
    (s) => s.definition === definition && s.phase === 0 && s.pinned === null
  );
  const input = {
    ...base,
    position: [0, 0, 0],
    velocity: decode(sample.expected.velocity),
    birthDrag: decode(sample.expected.drag),
    dt: 1 / 30,
    fresh: true,
  };
  const initial = { ...input };
  const steps = [];
  for (let tick = 0; tick < 60; tick++) {
    const expected = run(input);
    steps.push(expected);
    input.position = decode(expected.position);
    input.velocity = decode(expected.velocity);
    input.fresh = false;
  }
  sequences.push({ name: birth.definitions[definition].name, input: initial, steps });
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader,
  birthValues: { path: birthPath, sha256: birthSha256 },
  scope:
    'Selected external field-free stepped local motion; supplied live values, infinite lifetime, no spin/placement/carry or native execution.',
  samples,
  sequences,
};
const output = 'docs/reference/source-stepped-motion-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    samples: samples.length,
    sequences: sequences.length,
    sequenceSteps: sequences.length * 60,
    nativeExecuted: false,
  })
);
