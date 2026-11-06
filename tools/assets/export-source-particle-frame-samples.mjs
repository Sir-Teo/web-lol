/** Selected external place/carry/draw functions, supplied orbit/world frames.
 * No application helper, actor calibration or native client is executed. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/utils/sampleCurve.ts',
    sha256: '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  },
  {
    path: '.cache/baron-emission-readers/engine/utils/basis.ts',
    sha256: '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/particleRead.ts',
    sha256: '1c2ac421e97d350cc1758785bab1f841fb95064c31ac9b81ebe214447bb811ab',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/integrate.ts',
    sha256: '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
  },
];
const checked = (row) => {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw.toString();
};
const compile = (text, dependencies = {}) => {
  const exports = {};
  new Function(
    'exports',
    'require',
    'dependencies',
    ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(
    exports,
    (name) => {
      assert.equal(name, '@/modules/viewport/shared/utils/space');
      return { AXIS_SIGN: [1, 1, 1] };
    },
    dependencies
  );
  return exports;
};
function functions(row, names) {
  const source = ts.createSourceFile(row.path, checked(row), ts.ScriptTarget.Latest, true);
  const selected = source.statements.filter(
    (s) => ts.isFunctionDeclaration(s) && names.includes(s.name?.text)
  );
  assert.equal(selected.length, names.length);
  return selected.map((s) => s.getText(source)).join('\n');
}
const curves = compile(checked(readers[0])),
  basis = compile(checked(readers[1]));
const draw = compile(
  functions(readers[2], [
    'sampled',
    'sampleScalar',
    'age01',
    'clamp01',
    'drawnPlaceInto',
    'standingFrameInto',
  ]) +
    `\nconst {sampleCurveInto,integratedInto,turnInto}=dependencies;const FRAME_SLOTS=9,SAMPLED=new Float32Array(4),PUSHED=new Float32Array(3);`,
  { ...curves, ...basis }
);
const placement = compile(
  functions(readers[3], ['place', 'carry']) +
    `\nconst {turnInto,sampleScalar}=dependencies;const FRAME_SLOTS=9,PLACED=new Float32Array(3),TRAVEL=new Float32Array(3),ORBIT=new Float32Array(9);function orbitInto(pool,at,age,out){if(!pool.fixtureOrbit)return false;out.set(pool.fixtureOrbit);return true;}export {place,carry};`,
  { ...basis, sampleScalar: draw.sampleScalar }
);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const definitions = JSON.parse(programRaw).profiles.map((p) => ({
  name: `${p.role}-${p.index}-${p.name}`,
  definition: {
    emitterSpace: false,
    particleLocalOrientation: !!p.settings.particleIsLocalOrientation,
    bindWeight: p.curves.bindWeight ?? constant([0]),
    worldAcceleration: p.curves.worldAcceleration ?? constant([0, 0, 0]),
  },
}));
for (const weight of [-1, 0, 1 / 3, 1.5])
  for (const emitterSpace of [false, true])
    for (const particleLocalOrientation of [false, true])
      for (const accelerated of [false, true])
        definitions.push({
          name: `synthetic-${weight}-${emitterSpace}-${particleLocalOrientation}-${accelerated}`,
          definition: {
            emitterSpace,
            particleLocalOrientation,
            bindWeight: constant([weight]),
            worldAcceleration: accelerated
              ? {
                  ...constant([0, 0, 0]),
                  times: [0, 1],
                  values: [
                    [0, 1, -1],
                    [2, 3, 1],
                  ],
                  authoredKeyCount: 2,
                }
              : constant([0, 0, 0]),
          },
        });
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: [],
});
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex');
const standing = (degrees) => {
  const out = new Float32Array(9);
  basis.standingInto(new Float32Array(degrees), 0, 0, out);
  return out;
};
const birthFrame = standing([10, 20, 30]),
  yaw = standing([-15, 70, 40]),
  orbit = standing([35, -20, 10]);
const samples = [];
for (const [definition, row] of definitions.entries())
  for (const worldHud of [false, true])
    for (const orbitEnabled of [false, true])
      for (const fresh of [false, true])
        for (const life of [0.75, null]) {
          const d = row.definition,
            position = new Float32Array([10, 20, 30]),
            previousPlaced = new Float32Array([7, -2, 5]),
            bound = new Float32Array([10, -20, 30]),
            anchor = new Float32Array([100, 200, 300]),
            emitterPosition = new Float32Array([1, -2, 3]),
            worldBasis = new Float32Array([1.5, 0, 0, 0, 0.75, 0, 0, 0, -1]);
          const input = {
            position: hex(position),
            previousPlaced: hex(previousPlaced),
            bound: hex(bound),
            anchor: hex(anchor),
            birthFrame: hex(birthFrame),
            currentYaw: hex(yaw),
            emitterPosition: hex(emitterPosition),
            worldBasis: hex(worldBasis),
            worldOffset: [1 / 3, -2, 3.25],
            worldHud,
            orbit: orbitEnabled ? hex(orbit) : null,
            moved: [1 / 3, 2, -3],
            dt: 1 / 30,
            fresh,
            age: 0.5,
            life,
          };
          const pool = {
            position,
            placed: previousPlaced,
            bound,
            anchor,
            frame: birthFrame,
            drift: new Float32Array(3),
            travel: new Float32Array(3),
            birthTime: new Float32Array([0]),
            lifetime: new Float32Array([life ?? Infinity]),
            fixtureOrbit: orbitEnabled ? orbit : null,
          };
          const emitter = {
            emitterSpace: d.emitterSpace,
            particleLocalOrientation: d.particleLocalOrientation,
            bindWeight: value(d.bindWeight),
            worldAcceleration: value(d.worldAcceleration),
          };
          const step = {
            yaw,
            moved: input.moved,
            world: { basis: worldBasis, offset: input.worldOffset, hud: worldHud },
          };
          const dt = fresh ? 0 : input.dt,
            phase = life === null ? 0 : Math.min(input.age / life, 1);
          placement.place(pool, 0, emitter, { position: emitterPosition }, step, input.age, dt);
          placement.carry(pool, 0, emitter, step, phase, dt);
          const out = { place: new Float32Array(3) };
          draw.drawnPlaceInto(pool, 0, { emitter, now: input.age }, out);
          const frame = new Float32Array(9);
          draw.standingFrameInto(pool, 0, emitter, { orientation: yaw }, frame);
          samples.push({
            definition,
            input,
            expected: {
              placed: hex(pool.placed),
              drift: hex(pool.drift),
              bound: hex(pool.bound),
              travel: hex(pool.travel),
              position: hex(out.place),
              standingFrame: hex(frame),
            },
          });
        }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Selected external frame/placement/travel/draw functions with supplied orbit/world frames; no native actor-size/cadence/visual certificate.',
  definitions,
  samples,
};
const output = 'docs/reference/source-particle-frame-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    definitions: definitions.length,
    samples: samples.length,
    nativeExecuted: false,
  })
);
