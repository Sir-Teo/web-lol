/** Execute external stages at real float32 birth-time rounding boundaries.
 * These are isolated function cases, not a full native emitter execution. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const base = '.cache/baron-emission-readers/';
const readers = [
  [
    'engine/utils/sampleCurve.ts',
    '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  ],
  ['engine/utils/basis.ts', '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e'],
  [
    'engine/simulation/particleRead.ts',
    '1c2ac421e97d350cc1758785bab1f841fb95064c31ac9b81ebe214447bb811ab',
  ],
  [
    'engine/simulation/integrate.ts',
    '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
  ],
  ['engine/simulation/emit.ts', '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58'],
  [
    'rendering/utils/uvTransform.ts',
    '7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',
  ],
  [
    'engine/model/systemModel.ts',
    '20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad',
  ],
].map(([path, sha256]) => ({ path: base + path, sha256 }));
function text(index) {
  const r = readers[index],
    raw = fs.readFileSync(r.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), r.sha256);
  return raw.toString();
}
function selected(index, names, constants = []) {
  const source = ts.createSourceFile(
      readers[index].path,
      text(index),
      ts.ScriptTarget.Latest,
      true
    ),
    out = [];
  for (const s of source.statements) {
    if (ts.isFunctionDeclaration(s) && names.includes(s.name?.text)) out.push(s.getText(source));
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations)
        if (constants.includes(d.name.getText(source))) out.push(`const ${d.getText(source)};`);
  }
  assert.equal(out.length, names.length + constants.length);
  return out.join('\n');
}
function compile(code, dependencies = {}) {
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
      if (name.endsWith('/space')) return { AXIS_SIGN: [1, 1, 1] };
      if (name.endsWith('/enums'))
        return { ADDRESS_MODE: { wrap: 0, mirror: 1, clamp: 2, border: 3 } };
      if (name.endsWith('/pool')) return poolApi;
      if (name.endsWith('/sampleCurve')) return curves;
      throw Error('Unexpected clock fixture import ' + name);
    },
    dependencies
  );
  return exports;
}
const curves = compile(text(0)),
  basis = compile(text(1));
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
const poolApi = { UV, uvAt: (index, which) => index * 20 + which * 10, flexChannel: () => 0 };
const read = compile(
  `const {sampleCurveInto,flickerInto,integratedInto,turnInto}=dependencies;
const QUAD_TYPE={cameraQuad:0,cameraUnitQuad:8,arbitraryQuad:1,mesh:3,attachedMesh:11},NOT_LINGERING=-1,FRAME_SLOTS=9;
const SAMPLED=new Float32Array(4),PUSHED=new Float32Array(3);const instanceScaleOf=()=>1;
function linger01(){throw Error('Unexpected linger replacement');}
` +
    selected(
      2,
      [
        'appearance',
        'age01',
        'clamp01',
        'sampled',
        'sampleScalar',
        'drawnPlaceInto',
        'standingFrameInto',
      ],
      ['UNIFORMLY_SCALED']
    ),
  { ...curves, ...basis }
);
const clock = compile(
  selected(
    6,
    ['emissionEnd', 'stopWaitSeconds', 'lingerSeconds', 'curveMaximum'],
    ['LINGER_GRACE', 'NEVER_EXPIRES']
  )
);
const integrate = compile(
  `const {turnInto,sampleScalar,sampleCurveInto,integratedInto,emissionEnd,stopWaitSeconds,lingerSeconds}=dependencies;
const FRAME_SLOTS=9,ROTATION_RATE=60,NOT_LINGERING=-1,PLACED=new Float32Array(3),TRAVEL=new Float32Array(3),ORBIT=new Float32Array(9),OVER_LIFE=new Float32Array(3);
const LINGER_TYPE={maxLifetimeAfterEmitterDies:0,fixedLifetimeAfterEmitterStops:2,none:3};const orbitInto=()=>false;
` +
    selected(3, ['turn', 'place', 'carry', 'settle', 'finished']) +
    '\nexport {turn,place,carry,settle};',
  { ...curves, ...basis, ...clock, sampleScalar: read.sampleScalar }
);
const born = compile(
  `const {drawCurve,UV,uvAt}=dependencies;const UV_LAYERS=2,scalar=v=>v[0]??0,channelOf=()=>0;` +
    selected(4, ['bornUv']),
  { ...poolApi, drawCurve: curves.drawCurve }
);
const uv = compile(text(5));
const fixture = {
  path: 'docs/reference/source-uv-samples.json',
  sha256: '1e4d8fab54ccdf23c68e4ffec52b4eacb8e49faa63c8bf998f0054c38c09e1e9',
};
const uvRaw = fs.readFileSync(fixture.path);
assert.equal(createHash('sha256').update(uvRaw).digest('hex'), fixture.sha256);
const uvDefinition = JSON.parse(uvRaw).definitions.find((d) => d.name === 'hit-9-base').definition;
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const keyed = (values) => ({ ...constant(values[0]), times: [0, 1], values, authoredKeyCount: 2 });
const definitions = {
  uv: uvDefinition,
  spin: { enabled: false, rotation: constant([0, 0, 0]) },
  appearance: {
    scale: keyed([
      [0, 1, 2],
      [3, 4, 5],
    ]),
    color: keyed([
      [1, 2, 3, 0],
      [1, 1, 1, 1],
    ]),
    uniform: false,
    geometry: 'mesh',
    modulation: [1, 1, 1, 1],
  },
  frame: {
    emitterSpace: false,
    particleLocalOrientation: false,
    bindWeight: constant([1]),
    worldAcceleration: constant([0, 0, 0]),
  },
  lifetime: {
    kind: 0,
    particleLinger: 0.5,
    window: {
      lifetime: 3,
      particleLifetimeMaximum: 1,
      simple: false,
      singleParticle: false,
      overridesMaterials: false,
      delay: 0,
      emitterLinger: 0,
      period: null,
    },
  },
};
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: d.probabilities.map((p, channel) => ({
    channel,
    single: p.single,
    keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
  })),
});
const layer = { ...uvDefinition };
for (const key of [
  'scale',
  'rotation',
  'birthOffset',
  'birthScrollRate',
  'birthRotateRate',
  'scrollRate',
  'rotateRate',
])
  layer[key] = value(uvDefinition[key]);
layer.book = { ...uvDefinition.book, birthRate: value(uvDefinition.birthFrameRate) };
const I = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex'),
  samples = [];
for (const now of [1 / 60, 1 / 30, 0.1, 0.2, 0.3, 0.6, 1.1, 2]) {
  const birthTime = Math.fround(now),
    age = now - birthTime,
    life = Math.fround(0.3);
  const pool = {
    birthTime: new Float32Array([birthTime]),
    lifetime: new Float32Array([life]),
    lingerFrom: new Float32Array([-1]),
    serial: new Uint32Array([0]),
    emitter: new Uint16Array([0]),
    count: 1,
    uv: new Float32Array(20),
    flex: new Float32Array(0),
    birthScale: new Float32Array([1, 1, 1]),
    birthColor: new Float32Array([1, 1, 1, 1]),
    birthRotation: new Float32Array(3),
    angularVelocity: new Float32Array([0, 0, 1000]),
    angularAcceleration: new Float32Array(3),
    rotation: new Float32Array(3),
    position: new Float32Array([1, 2, 3]),
    placed: new Float32Array(3),
    drift: new Float32Array(3),
    travel: new Float32Array(3),
    bound: new Float32Array(3),
    anchor: new Float32Array([100, 200, 300]),
    frame: I,
  };
  const p = definitions.lifetime,
    w = p.window,
    emitter = {
      ...w,
      lingerType: p.kind,
      particleLinger: p.particleLinger,
      particleLifetime: value(constant([1])),
      rotationEnabled: false,
      rotation0: value(definitions.spin.rotation),
      legacySimple: null,
      linger: null,
      scale0: value(definitions.appearance.scale),
      color: value(definitions.appearance.color),
      modulation: [1, 1, 1, 1],
      uniformScale: false,
      quadType: 3,
      emitterSpace: false,
      particleLocalOrientation: false,
      bindWeight: value(definitions.frame.bindWeight),
      worldAcceleration: value(definitions.frame.worldAcceleration),
      uv: layer,
      multUv: null,
    };
  const state = { age: now, lastSpawn: now, emitted: true, finishedAt: null };
  integrate.settle(pool, emitter, 0, state, { now, stopped: true });
  integrate.turn(pool, 0, emitter, age, 0);
  integrate.place(
    pool,
    0,
    emitter,
    { position: [0, 0, 0] },
    { yaw: I, world: { basis: I, offset: [0, 0, 0], hud: false } },
    age,
    0
  );
  integrate.carry(pool, 0, emitter, { moved: [1, 0, 0] }, 0, 0);
  const appearance = { scale: new Float32Array(3), color: new Float32Array(4) };
  read.appearance(pool, 0, emitter, now, appearance);
  const position = { place: new Float32Array(3) };
  read.drawnPlaceInto(pool, 0, { emitter, now }, position);
  born.bornUv(pool, 0, emitter, 0, 0.375, 0.375);
  const uvDraw = uv.uvDraw();
  uv.uvTransformInto(pool, 0, layer, 0, age, 0, now, uvDraw);
  samples.push({
    now,
    birthTime,
    age,
    life,
    expected: {
      rotation: hex(pool.rotation),
      scale: hex(appearance.scale),
      color: hex(appearance.color),
      position: hex(position.place),
      uv: hex(new Float64Array(Object.values(uvDraw))),
      lifetime: hex(pool.lifetime),
      lingerFrom: hex(pool.lingerFrom),
      finishedAt: state.finishedAt,
    },
  });
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  fixture,
  definitions,
  scope:
    'Isolated external function cases at positive system clocks with float32 birth timestamps; signed age retained, no full native execution.',
  samples,
};
const output = 'docs/reference/particle-clock-boundary-samples.json',
  encoded = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), encoded);
else fs.writeFileSync(output, encoded, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    samples: samples.length,
    negativeAges: samples.filter((s) => s.age < 0).length,
    nativeExecuted: false,
  })
);
