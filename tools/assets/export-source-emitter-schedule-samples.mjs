/** Selected external clock/rate/count functions joined by the documented emit
 * gates and birth-time formula. No application scheduler or native client runs. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/model/systemModel.ts',
    sha256: '20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad',
  },
  {
    path: '.cache/baron-emission-readers/engine/utils/sampleCurve.ts',
    sha256: '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/emit.ts',
    sha256: '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58',
  },
];
function load(row, functions, constants, extra = '', dependencies = {}) {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  let code = raw.toString();
  if (functions) {
    const source = ts.createSourceFile(row.path, code, ts.ScriptTarget.Latest, true),
      selected = [];
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && functions.includes(statement.name?.text))
        selected.push(statement.getText(source));
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (constants.includes(declaration.name.getText(source)))
            selected.push(`const ${declaration.getText(source)};`);
    }
    assert.equal(selected.length, functions.length + constants.length);
    code = selected.join('\n');
  }
  const exports = {};
  new Function(
    'exports',
    'dependencies',
    ts.transpileModule(code + '\n' + extra, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(exports, dependencies);
  return exports;
}
const clock = load(
  readers[0],
  [
    'emissionEnd',
    'emissionEnded',
    'stopWaitSeconds',
    'periodActive',
    'emitterPhase',
    'curveMaximum',
  ],
  ['LINGER_GRACE', 'NEVER_EXPIRES', 'LEAST_PHASE_SPAN']
);
const curve = load(readers[1]);
const count = load(
  readers[2],
  ['spawnCount', 'segmentsLeft', 'burstCap', 'capped', 'rateOf'],
  ['BURST_SHARE', 'MOST_PER_STEP', 'COUNT_MASK'],
  'const QUAD_TYPE={cameraSegmentBeam:9}; const scalar=v=>v[0]??0; const flexTerm=()=>0; const {sampleCurve,tableValue}=dependencies; export {spawnCount};',
  curve
);
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json');
const programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const program = JSON.parse(programRaw);
const definitions = program.profiles.map((p) => {
  const s = p.settings,
    life = p.curves.particleLifetime;
  return {
    name: `${p.role}-${p.index}-${p.name}`,
    definition: {
      rate: p.curves.rate,
      window: {
        lifetime: s.lifetime ?? null,
        particleLifetimeMaximum: life.authoredKeyCount
          ? Math.max(...life.values.map((v) => v[0]))
          : life.constant[0],
        simple: false,
        singleParticle: !!s.isSingleParticle,
        overridesMaterials: false,
        delay: s.timeBeforeFirstEmission ?? 0,
        emitterLinger: s.emitterLinger ?? 0,
        period:
          s.period === undefined && s.timeActiveDuringPeriod === undefined
            ? null
            : { length: s.period ?? null, active: s.timeActiveDuringPeriod ?? null },
      },
      variableStart: false,
      maxPerFrame: 0,
      segmentLimit: null,
      rateScale: 1,
    },
  };
});
definitions.push({
  name: 'variable-rate-probability',
  definition: {
    ...definitions[0].definition,
    rate: {
      constant: [10],
      times: [0, 1],
      values: [[10], [100]],
      authoredKeyCount: 2,
      probabilities: [{ times: [0, 1], values: [0.5, 1.5], single: 1 }],
    },
  },
});
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: d.probabilities.map((p, channel) => ({
    channel,
    single: p.single,
    keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
  })),
});
const samples = [];
for (const [definition, row] of definitions.entries())
  for (const stopAt of [null, 0.2, 0.6]) {
    const d = row.definition,
      w = d.window,
      emitter = {
        ...w,
        period: w.period,
        timeBeforeFirstEmission: w.delay,
        hasVariableStartTime: d.variableStart,
        rate: value(d.rate),
        particleLifetime: { constant: [w.particleLifetimeMaximum], keys: [] },
        rateByVelocity: null,
        rateScale: d.rateScale,
        flex: null,
        trail: { maxAddedPerFrame: d.maxPerFrame },
        quadType: 0,
      };
    const state = { age: 0, lastSpawn: 0, emitted: false, spawned: 0 };
    let now = 0,
      draws = 0;
    const steps = [];
    for (let tick = 1; tick <= 60; tick++) {
      const dt = 1 / 30;
      now += dt;
      state.age = now;
      const stopped = stopAt !== null && now >= stopAt,
        births = [];
      if (
        !(w.singleParticle && state.emitted) &&
        !(stopped && now > clock.stopWaitSeconds(emitter)) &&
        now >= w.delay &&
        !clock.emissionEnded(emitter, now) &&
        clock.periodActive(w.period, now)
      ) {
        const phase = clock.emitterPhase(emitter, now);
        const planned = count.spawnCount(
          emitter,
          state,
          { dt, moved: [0, 0, 0] },
          phase,
          {
            unitFloat() {
              draws++;
              return 0.25;
            },
          },
          new Float32Array()
        );
        for (let i = 0; i < planned; i++) {
          const share = (i + 1) / planned;
          births.push({ ordinal: state.spawned, time: now - dt * (1 - share), share, phase });
          state.spawned = (state.spawned + 1) & 0xffff;
        }
        if (planned > 0) {
          state.emitted = true;
          state.lastSpawn = now;
        }
      }
      steps.push({
        now,
        dt,
        stopped,
        births,
        state: { now, lastSpawn: state.lastSpawn, emitted: state.emitted, spawned: state.spawned },
        draws,
      });
    }
    samples.push({ definition, stopAt, steps });
  }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Selected external clock/rate/count functions with emit gates and birth-time formula; explicit 30-Hz inputs, no pool pressure, no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-emitter-schedule-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    schedules: samples.length,
    steps: samples.length * 60,
    nativeExecuted: false,
  })
);
