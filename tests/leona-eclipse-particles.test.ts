import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  eclipseParticles,
  ECLIPSE_PROFILES,
  type EclipseRole,
} from '../src/render/leona-eclipse-particles';
import { eclipseValue, eclipseUv } from '../src/render/leona-eclipse-values';
import data from '../src/content/leona-w-particles.json';
import timing from '../src/content/leona-w-presentation.json';

const roles: EclipseRole[] = ['buff-initial', 'buff-extended', 'cast-miss', 'cast-hit', 'target'];
const profile = (p: ReturnType<typeof eclipseParticles>[number]) =>
  ECLIPSE_PROFILES[p.profileIndex];

test('all fifty Eclipse declarations rebuild with thirty complete profiles and twenty untouched disabled definitions', () => {
  execFileSync('python3', ['tools/assets/export-leona-w-particles.py', '--check']);
  const source = JSON.parse(readFileSync('docs/reference/leona-w-particles.json', 'utf8'));
  const audit = JSON.parse(readFileSync('docs/reference/leona-w-particle-profiles.json', 'utf8'));
  expect(data.profiles).toHaveLength(30);
  expect(data.disabled).toHaveLength(20);
  for (const p of data.profiles) {
    const e = source.resources[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.sourceFields).toEqual(Object.keys(e).sort());
    expect(p.sourceFields.every((k) => Object.hasOwn(audit.fieldRoutes, k))).toBe(true);
  }
  for (const p of data.disabled)
    expect(p.definition).toEqual(
      source.resources[p.system].definition.complexEmitterDefinitionData[p.index]
    );
  expect(timing).toMatchObject({
    initialTailTicks: 212,
    extendedTailTicks: 242,
    missHistoryTicks: 77,
    hitHistoryTicks: 77,
    targetHistoryTicks: 81,
  });
});

test('every enabled family emits on seeks, and no disabled family is substituted', () => {
  const seen = new Set<number>();
  for (const role of roles)
    for (const time of [1 / 60, 0.05, 0.1, 0.3, 0.8, 1.2, 1.3, 2, 3.2]) {
      const particles = eclipseParticles(role, 17, time);
      for (const p of particles) {
        seen.add(p.profileIndex);
        expect([
          ...p.offset,
          ...p.size,
          ...p.color,
          ...p.rotation,
          ...p.travel,
          ...p.uv.offset,
        ]).toSatisfy((v: number[]) => v.every(Number.isFinite));
        expect(p.phase).toBeGreaterThanOrEqual(0);
        expect(p.phase).toBeLessThanOrEqual(1);
      }
    }
  expect([...seen].sort((a, b) => a - b)).toEqual(data.profiles.map((_p, i) => i));
});

test('source singles retain two continuous skins, five/ten mesh births and three delayed target flares', () => {
  expect(eclipseParticles('buff-initial', 1, 0)).toEqual([]);
  expect(
    eclipseParticles('buff-initial', 1, 1 / 60).filter(
      (p) => profile(p).name === 'Avatar_Continuous'
    )
  ).toHaveLength(2);
  expect(
    eclipseParticles('cast-miss', 1, 1 / 60).filter((p) => profile(p).index === 3)
  ).toHaveLength(5);
  expect(
    eclipseParticles('cast-hit', 1, 1 / 60).filter((p) => profile(p).index === 4)
  ).toHaveLength(10);
  expect(
    eclipseParticles('cast-hit', 1, 1 / 60).filter((p) => profile(p).index === 17)
  ).toHaveLength(10);
  expect(
    eclipseParticles('target', 1, 2 / 60).filter((p) => profile(p).name === 'CenterFlare')
  ).toHaveLength(0);
  expect(
    eclipseParticles('target', 1, 3 / 60).filter((p) => profile(p).name === 'CenterFlare')
  ).toHaveLength(3);
});

test('negative source lives remain phase-owned and inherited type-zero stops cap absolute lives without extending them', () => {
  const skin = (time: number, stop = Infinity) =>
    eclipseParticles('buff-initial', 7, time, stop).filter(
      (p) => profile(p).name === 'Avatar_Continuous'
    );
  expect(skin(2)).toHaveLength(2);
  expect(skin(2).every((p) => p.life === Infinity && p.phase === 0)).toBe(true);
  expect(skin(2.1, 2).every((p) => p.life === 3 && Number.isFinite(p.life))).toBe(true);
  expect(skin(3.1, 3)).toEqual([]);
  for (const role of roles) expect(eclipseParticles(role, 7, 20, 3)).toEqual([]);
  expect(eclipseParticles('buff-initial', 7, 1 / 60, 0)).toEqual([]);
});

test('birth color reads the emitter phase and early stop can use the authored separate linger color', () => {
  const rays = data.profiles.find((p) => p.role === 'buff-initial' && p.kind === 'ray')!;
  expect(eclipseValue(rays.birthColor, 0)[3]).toBeCloseTo(0.12600243091583252, 12);
  expect(eclipseValue(rays.birthColor, 1)[3]).toBeCloseTo(0.45000380277633667, 12);
  const corona = (time: number) =>
    eclipseParticles('buff-extended', 12, time, 0.1).find((p) => profile(p).name === 'solarcorona');
  expect(corona(0.2)?.color[3]).toBeGreaterThan(corona(0.3)!.color[3]);
  expect(corona(0.3)?.color[3]).toBeGreaterThan(0);
  expect(corona(0.5)).toBeUndefined();
});

test('a target Ember box keeps authored half extents and independent cosmetic offsets', () => {
  const positions = [];
  for (let seed = 1; seed <= 20; seed++) {
    const p = eclipseParticles('target', seed, 1 / 60).find((p) => profile(p).name === 'Embers')!;
    const origin = eclipseValue(profile(p).position, 0);
    const offset = p.offset.map((v, i) => v - origin[i]);
    expect(Math.abs(offset[0])).toBeLessThanOrEqual(35);
    expect(Math.abs(offset[1])).toBeLessThanOrEqual(25);
    expect(offset[2]).toBe(0);
    positions.push(offset.join(','));
  }
  expect(new Set(positions).size).toBe(20);
});

test('integrated UV rates use the fixed grid and preserve independent multiplier coordinates', () => {
  const p = data.profiles.find((p) => p.role === 'cast-miss' && p.index === 3)!;
  const empty = { constant: [0, 0], times: [0], values: [[0, 0]], probabilities: [] };
  const layer = { ...p.uv, offset: empty, birthScroll: empty, address: 2 };
  const uv = eclipseUv(layer, 0.5, 1, 0, 0.5, 0, 0);
  expect(uv.offset[0]).toBeCloseTo(-0.18541666666666667, 12);
  expect(p.multiplier?.uv.clamp).toBe(true);
  expect(p.multiplier?.texture).not.toBe(p.texture);
});

test('random seeks are stateless and long continuous seeks visit only potentially live births', () => {
  const initial = roles.map((r) => eclipseParticles(r, 123, 0.3));
  for (const r of roles) eclipseParticles(r, 789, 2.8, 1.5);
  expect(roles.map((r) => eclipseParticles(r, 123, 0.3))).toEqual(initial);
  const late = eclipseParticles('buff-extended', 123, 100000000);
  expect(late.length).toBeLessThan(80);
  expect(late.filter((p) => profile(p).kind === 'skin')).toHaveLength(2);
  expect(eclipseParticles('buff-extended', 123, 100000000, 3)).toEqual([]);
});
