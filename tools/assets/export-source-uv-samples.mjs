/** Selected external UV birth/transform/row functions, zero UV flex channels.
 * Fixture pool slot numbers are local; no native pool-layout certificate. */
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
    path: '.cache/baron-emission-readers/engine/simulation/emit.ts',
    sha256: '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58',
  },
  {
    path: '.cache/baron-emission-readers/rendering/utils/uvTransform.ts',
    sha256: '7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',
  },
];
const checked = (row) => {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw.toString();
};
const compile = (code, dependencies = {}) => {
  const exports = {};
  new Function(
    'exports',
    'require',
    'dependencies',
    ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(
    exports,
    (name) => {
      if (name.endsWith('/sampleCurve')) return curve;
      if (name.endsWith('/pool')) return poolApi;
      if (name.endsWith('/enums'))
        return { ADDRESS_MODE: { wrap: 0, mirror: 1, clamp: 2, border: 3 } };
      throw Error('Unexpected UV fixture dependency ' + name);
    },
    dependencies
  );
  return exports;
};
const curve = compile(checked(readers[0]));
const UV = {
  birthOffsetX: 0,
  birthOffsetY: 1,
  birthScrollX: 2,
  birthScrollY: 3,
  flexOffsetX: 4,
  flexOffsetY: 5,
  flexChannel: 6,
  birthRotate: 7,
  phase: 8,
  frameRate: 9,
};
const uvAt = (index, which) => index * 20 + which * 10;
const poolApi = { UV, uvAt, flexChannel: () => 0 };
const source = ts.createSourceFile(
  readers[1].path,
  checked(readers[1]),
  ts.ScriptTarget.Latest,
  true
);
const born = source.statements.filter(
  (s) => ts.isFunctionDeclaration(s) && s.name?.text === 'bornUv'
);
assert.equal(born.length, 1);
const birth = compile(
  born[0].getText(source) +
    '\nconst {UV,uvAt,drawCurve}=dependencies;const UV_LAYERS=2;const scalar=v=>v[0]??0;const channelOf=()=>0;',
  { ...poolApi, drawCurve: curve.drawCurve }
);
const live = compile(checked(readers[2]));
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const base = () => ({
  scale: constant([1, 1]),
  rotation: constant([0]),
  birthOffset: constant([0, 0]),
  birthScrollRate: constant([0, 0]),
  birthRotateRate: constant([0]),
  birthFrameRate: constant([1]),
  scrollRate: constant([0, 0]),
  rotateRate: constant([0]),
  book: { divisions: [1, 1], frames: 1, start: 0, rate: 0, randomStart: false },
  center: [0.5, 0.5],
  emitterScrollRate: [0, 0],
  flipU: false,
  flipV: false,
  scrollClamp: false,
  addressMode: 0,
});
const definitions = [];
for (const p of JSON.parse(programRaw).profiles) {
  const s = p.settings,
    d = base();
  d.scale = p.curves.uvScale ?? d.scale;
  d.rotation = p.curves.uvRotation ?? d.rotation;
  d.birthOffset = p.curves.birthUVOffset ?? d.birthOffset;
  d.birthScrollRate = p.curves.birthUvScrollRate ?? d.birthScrollRate;
  d.book = {
    divisions: s.texDiv ?? [1, 1],
    frames: s.numFrames ?? 1,
    start: s.startFrame ?? 0,
    rate: s.frameRate ?? 0,
    randomStart: !!s.isRandomStartFrame,
  };
  definitions.push({ name: `${p.role}-${p.index}-base`, definition: d });
  if (p.material.multiplier) {
    const m = base();
    m.book = { ...d.book, divisions: [1, 1] };
    m.birthOffset = p.material.multiplier.offset;
    m.birthScrollRate = p.material.multiplier.scroll;
    definitions.push({ name: `${p.role}-${p.index}-mult`, definition: m });
  }
}
for (const addressMode of [0, 1, 2, 3]) {
  const d = base();
  d.addressMode = addressMode;
  d.flipU = true;
  d.flipV = addressMode === 1;
  d.scrollClamp = addressMode === 2;
  d.birthOffset = constant([-0.25, 0.125]);
  d.birthScrollRate = constant([-3, 2]);
  d.birthRotateRate = constant([25]);
  d.rotation = { ...constant([0]), times: [0, 1], values: [[10], [100]], authoredKeyCount: 2 };
  d.scrollRate = {
    ...constant([0, 0]),
    times: [0, 1],
    values: [
      [0, 2],
      [4, -1],
    ],
    authoredKeyCount: 2,
  };
  d.rotateRate = constant([12]);
  d.emitterScrollRate = [100, -20];
  d.center = [0.25, 0.75];
  d.book = { divisions: [2, 2], frames: 2, start: 3, rate: 20, randomStart: true };
  definitions.push({ name: `synthetic-address-${addressMode}`, definition: d });
}
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: d.probabilities.map((p, channel) => ({
    channel,
    single: p.single,
    keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
  })),
});
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex');
const samples = [];
for (const [definition, row] of definitions.entries()) {
  const d = row.definition,
    layer = {
      ...d,
      scale: value(d.scale),
      rotation: value(d.rotation),
      birthOffset: value(d.birthOffset),
      birthScrollRate: value(d.birthScrollRate),
      birthRotateRate: value(d.birthRotateRate),
      scrollRate: value(d.scrollRate),
      rotateRate: value(d.rotateRate),
      book: { ...d.book, birthRate: value(d.birthFrameRate) },
    };
  for (const chance of [0.375, 1])
    for (const age of [0, 0.125, 0.5, 1.25])
      for (const life of [0.75, null])
        for (const emitterScroll of [false, true]) {
          const pool = {
            uv: new Float32Array(20),
            lifetime: new Float32Array([life ?? Infinity]),
            flex: new Float32Array(0),
          };
          birth.bornUv(
            pool,
            0,
            { uv: layer, multUv: null, simple: false, flex: null },
            0.25,
            chance,
            chance
          );
          const draw = live.uvDraw(),
            phase = life === null ? 0 : Math.min(Math.max(age / life, 0), 1);
          live.uvTransformInto(pool, 0, layer, 0, age, phase, 7, draw, emitterScroll);
          const rows = new Float32Array(8);
          live.uvRowsInto(draw, layer, rows);
          samples.push({
            definition,
            chance,
            birthPhase: 0.25,
            age,
            life,
            now: 7,
            emitterScroll,
            expected: {
              birthHex: hex(pool.uv.subarray(0, 10)),
              drawHex: hex(new Float64Array(Object.values(draw))),
              rowsHex: hex(rows),
            },
          });
        }
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  scope:
    'Selected external zero-flex complex UV birth/transform/row functions; local pool slots and supplied clocks, no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-uv-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    layers: definitions.length,
    samples: samples.length,
    nativeExecuted: false,
  })
);
