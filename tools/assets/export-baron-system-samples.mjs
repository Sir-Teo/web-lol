/** Execute the pinned external pool/emit/stepEmitters/read stack. Neutral bound
 * factors, no fields/children/build-up; source units and supplied motion only. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import ts from 'typescript';
const root = '.cache/baron-emission-readers/';
const pins = {
  'engine/model/enums.ts': 'fdad53c133ef6c59162131d8b7e1763d8aa29594ba330a65e8372f493d8160fc',
  'engine/model/systemModel.ts': '20d28acc69370fb15ac5a644620297e04fd8bd95a215eae6e42593e7b18808ad',
  'engine/utils/basis.ts': '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e',
  'engine/utils/sampleCurve.ts': '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  'engine/utils/Rng.ts': '6cad16e5c8bfcb6e751bce6644c707b5064782bb51b4f1315ce396144221c108',
  'engine/utils/analyticDrag.ts':
    'e0a5e7d8cc4fe7c965a00a06953b1c5dfcb6bd55c1ebd35cdda3e1345df4086c',
  'engine/simulation/pool.ts': 'ed2744cdc1114f4897c5af526b16181159515fbb401cd042e75567daccef5f49',
  'engine/simulation/flex.ts': 'a1fef2f2fc54e63348107932d2ce1a5f75fd3e26eb6f95fdd2e7d087e0f400d6',
  'engine/simulation/spawnShape.ts':
    '28a9f0b0a3bd61887564f6b77241317ed2242433691ff45fe2c29ddea392472d',
  'engine/simulation/particleRead.ts':
    '1c2ac421e97d350cc1758785bab1f841fb95064c31ac9b81ebe214447bb811ab',
  'engine/simulation/emit.ts': '2dc3483c8359820eae4f3c329e30935dbe03a3d87fbeb2aa53a33abe775e1f58',
  'engine/simulation/integrate.ts':
    '35e332547a4697558f93f4d5a91f295bcd6d8e9b299ccb8d7331ad873de96587',
  'rendering/utils/emissionSurface.ts':
    '880e6df1f4d06ae6a74198059d45ef2de15b87d4a1c44e898fbf9b7bc602effe',
  'rendering/utils/uvTransform.ts':
    '7d213bad1f7a4d443c0f136fedd21c433be8bc4b6822d2a2f410209efb370d0d',
};
const cache = new Map(),
  unsupported = () => {
    throw Error('External path outside the current Baron closure');
  };
function load(name) {
  if (cache.has(name)) return cache.get(name);
  assert(name in pins, 'Unpinned external module ' + name);
  const raw = fs.readFileSync(root + name);
  assert.equal(createHash('sha256').update(raw).digest('hex'), pins[name]);
  const exports = {};
  cache.set(name, exports);
  new Function(
    'exports',
    'require',
    ts.transpileModule(raw.toString(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(exports, (specifier) => {
    if (specifier === 'three') return THREE;
    if (specifier.startsWith('@/modules/viewport'))
      return { AXIS_SIGN: [1, 1, 1], createPose: unsupported };
    if (specifier.endsWith('/binHash')) return { nameHash: unsupported };
    if (specifier.endsWith('/submeshes')) return { drawnIndices: unsupported };
    const resolved =
      path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)) + '.ts';
    if (resolved === 'engine/simulation/forceFields.ts')
      return { prepareFields: unsupported, applyFields: unsupported };
    return load(resolved);
  });
  return exports;
}
const enums = load('engine/model/enums.ts'),
  model = load('engine/model/systemModel.ts'),
  basis = load('engine/utils/basis.ts'),
  curves = load('engine/utils/sampleCurve.ts');
const { Rng } = load('engine/utils/Rng.ts'),
  poolApi = load('engine/simulation/pool.ts'),
  read = load('engine/simulation/particleRead.ts'),
  integrate = load('engine/simulation/integrate.ts');
const surface = load('rendering/utils/emissionSurface.ts'),
  uv = load('rendering/utils/uvTransform.ts');
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const program = JSON.parse(programRaw);
const constant = (constant) => ({ constant, keys: [], tables: [] });
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: d.probabilities.map((p, channel) => ({
    channel,
    single: p.single,
    keys: p.times.map((time, i) => ({ time, values: [p.values[i]] })),
  })),
});
const flag = (v, fallback = false) => (v === undefined ? fallback : v === true || v === 1);
function layer(p) {
  const c = p.curves,
    s = p.settings;
  return {
    book: {
      divisions: s.texDiv ?? [1, 1],
      frames: s.numFrames ?? 1,
      start: s.startFrame ?? 0,
      rate: s.frameRate ?? 0,
      randomStart: flag(s.isRandomStartFrame),
      birthRate: constant([1]),
    },
    scale: c.uvScale ? value(c.uvScale) : constant([1, 1]),
    rotation: c.uvRotation ? value(c.uvRotation) : constant([0]),
    birthOffset: c.birthUVOffset ? value(c.birthUVOffset) : constant([0, 0]),
    birthScrollRate: c.birthUvScrollRate ? value(c.birthUvScrollRate) : constant([0, 0]),
    birthRotateRate: constant([0]),
    scrollRate: constant([0, 0]),
    rotateRate: constant([0]),
    emitterScrollRate: [0, 0],
    center: [0.5, 0.5],
    flipU: false,
    flipV: false,
    scrollClamp: false,
    addressMode: 0,
  };
}
function emitter(p) {
  const c = p.curves,
    s = p.settings,
    curve = (key, fallback) => (c[key] ? value(c[key]) : constant(fallback)),
    base = layer(p);
  const shape =
    p.shape.kind === 'legacy'
      ? {
          ...p.shape,
          offset: value(p.shape.offset),
          translation: constant([0, 0, 0]),
          angles: p.shape.angles.map(value),
        }
      : p.shape;
  const mult = p.material.multiplier
    ? {
        ...base,
        book: { ...base.book, divisions: [1, 1] },
        scale: constant([1, 1]),
        rotation: constant([0]),
        birthOffset: value(p.material.multiplier.offset),
        birthScrollRate: value(p.material.multiplier.scroll),
      }
    : null;
  return {
    index: p.index,
    name: p.name,
    simple: false,
    disabled: false,
    chanceToNotExist: 0,
    singleParticle: flag(s.isSingleParticle),
    hasVariableStartTime: false,
    lifetime: s.lifetime ?? null,
    particleLifetime: curve('particleLifetime', [3]),
    particleLinger: s.particleLinger ?? 0,
    emitterLinger: s.emitterLinger ?? 0,
    lingerType: 0,
    linger: null,
    overridesMaterials: false,
    timeBeforeFirstEmission: s.timeBeforeFirstEmission ?? 0,
    period:
      s.period === undefined && s.timeActiveDuringPeriod === undefined
        ? null
        : { length: s.period ?? null, active: s.timeActiveDuringPeriod ?? null },
    rate: curve('rate', [0]),
    rateByVelocity: null,
    maximumRateByVelocity: 0,
    rateScale: 1,
    sharedRandom: flag(s.ParticlesShareRandomValue),
    flex: null,
    fields: null,
    legacySimple: null,
    emitterPosition: curve('EmitterPosition', [0, 0, 0]),
    emitterSpace: false,
    localOrientation: flag(s.isLocalOrientation, true),
    particleLocalOrientation: flag(s.particleIsLocalOrientation),
    rotationOverride: [0, 0, 0],
    scaleOverride: [1, 1, 1],
    translationOverride: [0, 0, 0],
    birthVelocity: curve('birthVelocity', [0, 0, 0]),
    birthAcceleration: constant([0, 0, 0]),
    birthRotation0: curve('birthRotation0', [0, 0, 0]),
    birthRotationalVelocity0: curve('birthRotationalVelocity0', [0, 0, 0]),
    birthRotationalAcceleration: constant([0, 0, 0]),
    birthOrbitalVelocity: constant([0, 0, 0]),
    birthScale0: curve('birthScale0', [1, 1, 1]),
    birthDrag: curve('birthDrag', [0, 0, 0]),
    birthColor: curve('birthColor', [1, 1, 1, 1]),
    velocity: constant([0, 0, 0]),
    acceleration: constant([0, 0, 0]),
    drag: constant([0, 0, 0]),
    rotation0: constant([0, 0, 0]),
    rotationEnabled: flag(s.isRotationEnabled),
    worldAcceleration: curve('worldAcceleration', [0, 0, 0]),
    bindWeight: curve('bindWeight', [0]),
    offsetLifetimeScaling: [0, 0, 0],
    offsetLifeSymmetry: 0,
    shape,
    emissionMesh: p.emissionMesh,
    emissionSurface: null,
    quadType: { billboard: 0, quad: 1, mesh: 3, 'camera-trail': 4, 'arbitrary-trail': 5 }[
      p.geometry.kind
    ],
    beam: null,
    trail:
      'tiling' in p.geometry ? { tiling: value(p.geometry.tiling), maxAddedPerFrame: 0 } : null,
    uv: base,
    multUv: mult,
    scale0: curve('scale0', [1, 1, 1]),
    color: curve('Color', [1, 1, 1, 1]),
    uniformScale: flag(s.isUniformScale),
    modulation: [1, 1, 1, 1],
    postRotate: null,
    erosion: p.material.erosion
      ? {
          drive: value(p.material.erosion.drive),
          mixer: value(p.material.erosion.mixer),
          lingerDrive: null,
        }
      : null,
  };
}
const canonical = (v) => {
  if (ArrayBuffer.isView(v))
    return {
      typed: v.constructor.name,
      hex: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('hex'),
    };
  if (typeof v === 'number') {
    const bytes = Buffer.alloc(8);
    bytes.writeDoubleLE(v);
    return { number: bytes.toString('hex') };
  }
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])])
    );
  return v;
};
const digest = (v) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
const vector = (array, index, width = 3) => array.slice(index * width, (index + 1) * width);
function uvBirth(pool, index, which) {
  const at = poolApi.uvAt(index, which),
    u = poolApi.UV;
  return {
    offset: new Float32Array([pool.uv[at + u.birthOffsetX], pool.uv[at + u.birthOffsetY]]),
    scroll: new Float32Array([pool.uv[at + u.birthScrollX], pool.uv[at + u.birthScrollY]]),
    rotation: pool.uv[at + u.birthRotate],
    phase: pool.uv[at + u.phase],
    rate: pool.uv[at + u.frameRate],
  };
}
function reading(role, now, steps, pool, states, emitters, orientation, rng) {
  const particles = [],
    packets = [];
  for (let at = 0; at < pool.count; at++) {
    const e = emitters[pool.emitter[at]],
      age = now - pool.birthTime[at],
      phase = read.age01(pool, at, now),
      frame = { emitter: e, now, orientation, world: integrate.NO_TRANSFORM };
    const drawn = { place: new Float32Array(3) };
    read.drawnPlaceInto(pool, at, frame, drawn);
    const standing = new Float32Array(9);
    read.standingFrameInto(pool, at, e, frame, standing);
    const particle = {
      emitter: pool.emitter[at],
      serial: pool.serial[at],
      ordinal: pool.ordinal[at],
      birthTime: pool.birthTime[at],
      lifetime: pool.lifetime[at],
      lingerFrom: pool.lingerFrom[at] === poolApi.NOT_LINGERING ? null : pool.lingerFrom[at],
      fresh: pool.fresh[at] === 1,
      roll: pool.roll[at],
      position: vector(pool.position, at),
      velocity: vector(pool.velocity, at),
      acceleration: vector(pool.birthAcceleration, at),
      birthRotation: vector(pool.birthRotation, at),
      angularVelocity: vector(pool.angularVelocity, at),
      birthScale: vector(pool.birthScale, at),
      birthDrag: vector(pool.birthDrag, at),
      birthColor: vector(pool.birthColor, at, 4),
      anchor: vector(pool.anchor, at),
      frame: vector(pool.frame, at, 9),
      placed: vector(pool.placed, at),
      bound: vector(pool.bound, at),
      rotation: vector(pool.rotation, at),
      worldPosition: drawn.place,
      travel: vector(pool.travel, at),
      standingFrame: standing,
      uv: uvBirth(pool, at, 0),
      multUv: e.multUv ? uvBirth(pool, at, 1) : null,
      tiling: vector(pool.tiling, at, 2),
      odometer: pool.odometer[at],
    };
    particles.push(particle);
    const appearance = { scale: new Float32Array(3), color: new Float32Array(4) };
    read.appearance(pool, at, e, now, appearance);
    const base = uv.uvDraw();
    uv.uvTransformInto(pool, at, e.uv, 0, age, phase, now, base, e.quadType !== 3);
    let mult = null;
    if (e.multUv) {
      mult = uv.uvDraw();
      uv.uvTransformInto(pool, at, e.multUv, 1, age, phase, now, mult, e.quadType !== 3);
    }
    packets.push({
      emitter: particle.emitter,
      serial: particle.serial,
      ordinal: particle.ordinal,
      birthTime: particle.birthTime,
      lifetime: particle.lifetime,
      age,
      phase,
      roll: particle.roll,
      position: drawn.place,
      rotation: particle.rotation,
      standingFrame: standing,
      travel: particle.travel,
      scale: appearance.scale,
      color: appearance.color,
      uv: base,
      multUv: mult,
      erosion: read.erosionDrive(pool, at, e, now),
      erosionMixer: e.erosion ? new Float32Array(curves.sampleCurve(e.erosion.mixer, 0)) : null,
      tiling: particle.tiling,
      odometer: particle.odometer,
    });
  }
  const copy = rng.clone();
  return {
    version: 1,
    role,
    now,
    steps,
    born: pool.born,
    emitters: states.map((s) => ({
      schedule: { now: s.age, lastSpawn: s.lastSpawn, emitted: s.emitted, spawned: s.spawned },
      chance: s.chance,
      travelled: s.travelled,
      spawnedAt: s.spawnedAt,
      finishedAt: s.finishedAt,
    })),
    particles,
    packets,
    rngPeek: new Float32Array(Array.from({ length: 8 }, () => copy.unitFloat())),
  };
}
const traces = [];
for (const role of ['missile', 'hit'])
  for (const mode of ['natural', 'stopped', 'pressure']) {
    const profiles = program.profiles.filter((p) => p.role === role),
      emitters = profiles.map(emitter),
      system = {
        emitters,
        dragMotion: enums.DRAG_MOTION.stepped,
        transform: null,
        hudLayer: false,
      };
    const capacity = mode === 'pressure' ? 1 : 512,
      seed = mode === 'natural' ? 12345 : mode === 'stopped' ? 777 : 1,
      rng = new Rng(seed),
      pool = poolApi.createPool(capacity),
      states = integrate.createEmitterStates(emitters, rng),
      surfaces = new Map();
    for (const [i, p] of profiles.entries())
      if (p.emissionMesh) {
        const m = program.emissionSurfaces[p.emissionMesh.asset];
        surfaces.set(i, {
          mesh: surface.staticMeshSurface({
            positions: new Float32Array(m.positions),
            indices: new Uint32Array(m.indices),
          }),
        });
      }
    const rows = [];
    let now = 0,
      previous = [0, 20, 0];
    for (let tick = 1; tick <= (mode === 'natural' ? 120 : 60); tick++) {
      const dt = 1 / 30;
      now += dt;
      const origin = [tick * 10, 20, Math.sin(tick / 10) * 30],
        moved = origin.map((v, i) => v - previous[i]),
        orientation = new Float32Array(9);
      basis.standingInto(new Float32Array([0, tick * 3, 0]), 0, 0, orientation);
      // JSON step inputs cannot retain signed zero; run the reference with exactly
      // the same transported input the independent consumer receives.
      for (let axis = 0; axis < orientation.length; axis++)
        if (orientation[axis] === 0) orientation[axis] = 0;
      const stopped = mode === 'stopped' && tick >= 15;
      integrate.stepEmitters(
        pool,
        system,
        {
          now,
          dt,
          origin,
          moved,
          yaw: orientation,
          world: integrate.NO_TRANSFORM,
          stopped,
          surfaces,
        },
        rng,
        states
      );
      const value = reading(role, now, tick, pool, states, emitters, orientation, rng),
        sha256 = digest(value);
      const debugAt = process.argv.indexOf('--debug-step');
      if (debugAt >= 0 && tick === Number(process.argv[debugAt + 1])) {
        const file = `artifacts/baron-system-reference-${role}-${mode}-${tick}-${sha256.slice(0, 12)}.json`;
        const encoded = JSON.stringify(canonical(value), null, 2) + '\n';
        if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), encoded);
        else fs.writeFileSync(file, encoded, { flag: 'wx' });
      }
      rows.push({
        input: { dt, origin, moved, orientation: Array.from(orientation), stopped },
        expectedSha256: sha256,
        count: pool.count,
        born: pool.born,
      });
      previous = origin;
    }
    traces.push({ name: `${role}-${mode}`, role, capacity, seed, rows });
  }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers: Object.entries(pins).map(([name, sha256]) => ({ path: root + name, sha256 })),
  programSha256,
  scope:
    'Full selected external pool/emit/stepEmitters/read stack with independently normalized format-2 profiles, neutral bound factors, explicit motion/rate scale; no fields, children, build-up or native execution.',
  runtime: { node: process.version, v8: process.versions.v8 },
  traces,
};
const output = 'docs/reference/baron-system-samples.json',
  encoded = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), encoded);
else fs.writeFileSync(output, encoded, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    traces: traces.length,
    steps: traces.reduce((n, t) => n + t.rows.length, 0),
    nativeExecuted: false,
  })
);
