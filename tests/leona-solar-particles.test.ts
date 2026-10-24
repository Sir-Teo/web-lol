import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  solarParticles,
  SOLAR_PROFILES,
  type SolarRole,
} from '../src/render/leona-solar-particles';
import { solarDrawPoint, solarDrawDirection } from '../src/render/leona-solar-frame';
import data from '../src/content/leona-r-particles.json';
import audit from '../docs/reference/leona-r-particle-profiles.json';
const roles: SolarRole[] = ['buff', 'cast', 'contact', 'area-green', 'area-red', 'impact'];
const nearVector = (a: number[], b: number[]) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
test('all53 source declarations retain exact field routes, disabled definitions and new binding boundaries', () => {
  const raw = readFileSync('docs/reference/leona-r-particles.json'),
    pin = JSON.parse(raw.toString());
  expect(audit.sourcePinSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(SOLAR_PROFILES).toHaveLength(44);
  expect(data.disabled).toHaveLength(9);
  expect(data.systems).toHaveLength(6);
  for (const p of SOLAR_PROFILES) {
    const source = pin.resources[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.sourceFields).toEqual(Object.keys(source).sort());
    expect(p.sourceFields.every((f) => Object.hasOwn(audit.fieldRoutes, f))).toBe(true);
  }
  for (const p of data.disabled)
    expect(p.definition).toEqual(
      pin.resources[p.system].definition.complexEmitterDefinitionData[p.index]
    );
  expect(SOLAR_PROFILES.filter((p) => p.kind === 'projection').map((p) => p.projection)).toEqual([
    { mYRange: 500, mFading: 500, __type: 'VfxProjectionDefinitionData' },
    { mYRange: 500, mFading: 500, __type: 'VfxProjectionDefinitionData' },
  ]);
  expect(SOLAR_PROFILES.find((p) => p.name === 'Activate')?.texture).toBeNull();
  expect(SOLAR_PROFILES.find((p) => p.name === 'Ground_1')).toMatchObject({
    lingerType: 1,
    stencilRef: 7,
    stencilMode: null,
  });
  expect(SOLAR_PROFILES.filter((p) => p.distortion?.mode === 2)).toHaveLength(3);
  expect(SOLAR_PROFILES.find((p) => p.kind === 'skin')).toMatchObject({
    lockMeshToAttachment: true,
  });
});
test('every enabled family is seekable with finite attributes, repeatable hashes and no profile mutation', () => {
  const before = JSON.stringify(data),
    seen = new Set<number>();
  for (const role of roles)
    for (const time of [1 / 60, 0.05, 0.1, 0.2, 0.4, 0.75, 1.2, 2]) {
      const particles = solarParticles(role, 2718, time);
      expect(solarParticles(role, 2718, time)).toEqual(particles);
      for (const p of particles) {
        seen.add(p.profileIndex);
        expect(
          [
            ...p.offset,
            ...p.accelerationOffset,
            ...p.size,
            ...p.color,
            ...p.travel,
            ...p.rotation,
            ...p.orbitTurn,
            p.life,
            p.phase,
          ].every(Number.isFinite)
        ).toBe(true);
        expect(p.age).toBeGreaterThanOrEqual(0);
        expect(p.age).toBeLessThan(p.life);
      }
    }
  expect(seen.size).toBe(44);
  expect(JSON.stringify(data)).toBe(before);
});
test('authored lookup scales/offsets and multiplier UV streams are preserved independently', () => {
  const glows = SOLAR_PROFILES.filter((p) => p.role === 'buff' && p.name.startsWith('Beamsword'));
  expect(glows.every((p) => p.lookupScales[1] === 0.5 && p.lookupOffsets[1] === 0.5)).toBe(true);
  expect(
    SOLAR_PROFILES.filter((p) => p.kind === 'projection').every((p) =>
      p.lookupScales.every((v) => v === 0.5)
    )
  ).toBe(true);
  const p = solarParticles('buff', 13, 0.2).find(
    (p) => SOLAR_PROFILES[p.profileIndex].name === 'BeamswordGlow'
  )!;
  expect(p.multUv).not.toBeNull();
  expect(p.multUv?.offset).not.toEqual(p.uv.offset);
  expect(
    SOLAR_PROFILES.find((p) => p.name === 'BeamswordGlow')?.multiplier?.uv.offset.probabilities
  ).toHaveLength(2);
});
test('Bokeh cylinder is a zero-height, signed-uniform-radius disk rather than uniform area', () => {
  const radii: number[] = [];
  for (let seed = 1; seed <= 32; seed++)
    for (const p of solarParticles('impact', seed, 1 / 60)) {
      if (SOLAR_PROFILES[p.profileIndex].name !== 'Bokeh') continue;
      expect(p.age).toBe(0);
      expect(p.offset[1]).toBe(0);
      const r = Math.hypot(p.offset[0], p.offset[2]);
      expect(r).toBeLessThanOrEqual(220);
      radii.push(r);
    }
  expect(radii).toHaveLength(1280);
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length / 220;
  expect(mean).toBeGreaterThan(0.46);
  expect(mean).toBeLessThan(0.54);
});
test('orbital probability axes share one chance while omitted noise binds to explicit external zero', () => {
  expect(data.noiseDefaults).toMatchObject({
    origin: [0, 0, 0],
    frequency: 0,
    radius: 0,
    velocityDelta: 0,
  });
  expect(SOLAR_PROFILES.filter((p) => p.noise)).toHaveLength(2);
  let nonzero = 0;
  for (const p of solarParticles('impact', 73, 0.2)) {
    const source = SOLAR_PROFILES[p.profileIndex];
    if (!source.noise) continue;
    const rate = source.orbitalVelocity.constant;
    expect(p.orbitalVelocity[0] / rate[0]).toBeCloseTo(p.orbitalVelocity[1] / rate[1], 12);
    expect(p.orbitalVelocity[0] / rate[0]).toBeCloseTo(p.orbitalVelocity[2] / rate[2], 12);
    expect(Math.abs(p.orbitalVelocity[0])).toBeLessThanOrEqual(rate[0]);
    if (Math.abs(p.orbitalVelocity[0]) > 1e-6) nonzero++;
  }
  expect(nonzero).toBeGreaterThan(1);
});
test('draw placement orbits about an explicit current origin before unturned acceleration', () => {
  const p = solarParticles('impact', 23, 0.4).find(
    (p) => SOLAR_PROFILES[p.profileIndex].name === 'Bokeh'
  )!;
  p.accelerationOffset = [10, 20, 30];
  const angles = p.orbitalVelocity.map((v) => v * p.age);
  const rotate = (v: number[]) => {
    const [x, y, z] = angles,
      [a, b, c] = v,
      zTurn = [a * Math.cos(z) - b * Math.sin(z), a * Math.sin(z) + b * Math.cos(z), c],
      xTurn = [
        zTurn[0],
        zTurn[1] * Math.cos(x) - zTurn[2] * Math.sin(x),
        zTurn[1] * Math.sin(x) + zTurn[2] * Math.cos(x),
      ];
    return [
      xTurn[0] * Math.cos(y) + xTurn[2] * Math.sin(y),
      xTurn[1],
      -xTurn[0] * Math.sin(y) + xTurn[2] * Math.cos(y),
    ];
  };
  const origin = [2, 1, 7],
    point = [4, 9, -2],
    turned = rotate(point.map((v, i) => v - origin[i]));
  nearVector(
    solarDrawPoint(p, point, origin),
    turned.map((v, i) => v + origin[i] + p.accelerationOffset[i])
  );
  const travel = [3, 4, 5],
    copy = [...p.travel];
  nearVector(solarDrawDirection(p, travel), rotate(travel));
  expect(p.travel).toEqual(copy);
  expect(Math.hypot(...solarDrawDirection(p, travel))).toBeCloseTo(Math.hypot(...travel), 12);
});
test('type1 linger extends only resident particles after external stop and never revives dead singles', () => {
  const ground = (time: number, stop = Infinity) =>
    solarParticles('cast', 1, time, stop).find(
      (p) => SOLAR_PROFILES[p.profileIndex].name === 'Ground_1'
    );
  expect(ground(0.7)).toBeUndefined();
  expect(ground(0.7, 0.5)).toBeDefined();
  expect(ground(0.7, 0.5)?.life).toBeCloseTo(0.5 - 1 / 60 + 0.25, 12);
  expect(ground(0.75, 0.5)).toBeUndefined();
  expect(ground(0.81, 0.8)).toBeUndefined();
  expect(ground(10.3)).toBeUndefined();
  expect(
    solarParticles('cast', 1, 0.1, 0.1).some(
      (p) => SOLAR_PROFILES[p.profileIndex].name === 'Ground_'
    )
  ).toBe(false);
});
test('zero/invalid windows and long stopped seeks remain empty and bounded', () => {
  for (const role of roles) {
    expect(solarParticles(role, 1, 1, 0)).toEqual([]);
    expect(solarParticles(role, 1, 600, 0.25)).toEqual([]);
    expect(solarParticles(role, 1, -1)).toEqual([]);
    expect(solarParticles(role, 1, NaN)).toEqual([]);
    expect(solarParticles(role, 1, 1, Infinity, 0)).toEqual([]);
  }
});
