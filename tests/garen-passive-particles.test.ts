import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pin from '../docs/reference/garen-passive-particles.json';
import decoded from '../docs/reference/garen-passive-particles-decoded.json';
import profile from '../src/content/garen-passive-particles.json';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { garenPassiveParticles } from '../src/render/garen-passive-particles';
import { GAREN_PASSIVE_TAIL_TICKS } from '../src/content/garen-passive-presentation';
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const unit = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
  const enemy = w.spawn('champion', 'red', { x: 300, y: 0 }, 'lux');
  return { w, unit, enemy, state: w.championState(unit.id)! };
}

test('the recovery profile and lossless textures retain the frozen three-resource provenance', () => {
  expect(Object.keys(pin.resources).sort()).toEqual([
    'Garen_Heal',
    'Garen_P_Boost',
    'Garen_P_Heal',
  ]);
  expect(hash('docs/reference/garen-passive-particles.json')).toBe(decoded.sourcePinSha256);
  expect(hash(decoded.profile.path)).toBe(decoded.profile.sha256);
  for (const f of pin.extraction.files)
    expect(
      hash(
        `.cache/garen-passive-particle-sources/${f.wadPathHash}${f.path.slice(f.path.lastIndexOf('.'))}`
      )
    ).toBe(f.sha256);
  for (const t of decoded.textures) expect(hash(t.path)).toBe(t.sha256);
  const source = pin.resources.Garen_P_Heal.definition.complexEmitterDefinitionData[0];
  expect(profile.rate).toBe(source.rate.constantValue);
  expect(profile.drag).toEqual(source.birthDrag.constantValue);
  expect(profile.color).toEqual({
    times: source.Color.dynamics.times,
    values: source.Color.dynamics.values,
  });
  expect(profile.scale).toEqual({
    times: source.scale0.dynamics.times,
    values: source.scale0.dynamics.values,
  });
  expect(decoded.rendered).toHaveLength(1);
  expect(decoded.filtered).toHaveLength(1);
  expect(decoded.deferred).toHaveLength(1);
});

test('recovery epochs preserve exact continuation, stop births on damage/full health and consume no IDs or random draws', () => {
  const { w, unit, enemy, state } = setup();
  const rng = w.random.state,
    id = w.nextId;
  unit.hp -= 200;
  w.step(90);
  const interval = state.garenPassiveVisuals[0];
  expect(interval).toEqual({ startTick: 1, stopTick: null, point: null });
  expect(w.random.state).toBe(rng);
  expect(w.nextId).toBe(id);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.damage(enemy, unit, 1, 'true');
  restored.damage(restored.unit(enemy.id)!, restored.unit(unit.id)!, 1, 'true');
  expect(interval.stopTick).toBe(90);
  const stopPoint = { ...interval.point! };
  unit.x = 50;
  restored.unit(unit.id)!.x = 50;
  w.step(480);
  restored.step(480);
  expect(w.snapshot()).toBe(restored.snapshot());
  expect(interval.point).toEqual(stopPoint);
  expect(state.garenPassiveVisuals.at(-1)?.startTick).toBe(570);
  unit.hp = unit.maxHp - 0.01;
  w.step();
  expect(state.garenPassiveVisuals.at(-1)?.stopTick).toBe(571);
  w.step(GAREN_PASSIVE_TAIL_TICKS);
  expect(state.garenPassiveVisuals).toEqual([]);
});

test('lethal contacts and victory freeze the root and drain particles without changing a terminal save', () => {
  const { w, unit, enemy, state } = setup();
  unit.hp -= 200;
  w.step(100);
  w.damage(enemy, unit, 1e6, 'true');
  expect(state.garenPassiveVisuals[0].stopTick).toBe(w.tick);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  const before = garenPassiveParticles(unit.id, state.garenPassiveVisuals, w.tick);
  expect(before.length).toBeGreaterThan(0);
  expect(
    garenPassiveParticles(unit.id, state.garenPassiveVisuals, w.tick + GAREN_PASSIVE_TAIL_TICKS)
  ).toEqual([]);
  const other = setup();
  other.unit.hp -= 200;
  other.w.step(100);
  const nexus = other.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  // Test the real terminal branch without changing its ordinary eligibility rules.
  other.w.damage(other.unit, nexus, 1e6, 'true');
  expect(other.w.winner).toBe('blue');
  expect(other.state.garenPassiveVisuals[0].stopTick).toBe(other.w.tick);
  expect(World.fromSnapshot(other.w.snapshot(), other.w.battlefield).snapshot()).toBe(
    other.w.snapshot()
  );
});

test('saved recovery intervals reject foreign owners, overlapping clocks, malformed stops and expired tails', () => {
  const { w, unit, enemy } = setup();
  unit.hp -= 200;
  w.step(100);
  w.damage(enemy, unit, 1, 'true');
  const good = JSON.parse(w.snapshot());
  const mutations = [
    (r: any) => (r.startTick = -1),
    (r: any) => (r.startTick = 100.5),
    (r: any) => (r.startTick = 101),
    (r: any) => (r.stopTick = 0),
    (r: any) => (r.stopTick = 101),
    (r: any) => (r.point = null),
    (r: any) => (r.point = { x: 0, y: 0, extra: 1 }),
    (r: any) => (r.point = { x: null, y: 0 }),
    (r: any) => {
      r.stopTick = null;
      r.point = { x: 0, y: 0 };
    },
    (r: any) => {
      r.stopTick = null;
      r.point = null;
    },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(good),
      owner = bad.otherChampions.find((s: any) => s.id === unit.id);
    mutate(owner.garenPassiveVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
  for (const mode of ['duplicate', 'foreign', 'old-schema', 'missing']) {
    const bad = structuredClone(good),
      owner = bad.otherChampions.find((s: any) => s.id === unit.id);
    if (mode === 'duplicate') owner.garenPassiveVisuals.push({ ...owner.garenPassiveVisuals[0] });
    if (mode === 'foreign') bad.player.garenPassiveVisuals = owner.garenPassiveVisuals;
    if (mode === 'old-schema') bad.version = 110;
    if (mode === 'missing') delete owner.garenPassiveVisuals;
    expect(() => World.fromSnapshot(JSON.stringify(bad), w.battlefield)).toThrow();
  }
  w.step(GAREN_PASSIVE_TAIL_TICKS);
  const expired = JSON.parse(w.snapshot());
  expired.otherChampions.find((s: any) => s.id === unit.id).garenPassiveVisuals =
    good.otherChampions.find((s: any) => s.id === unit.id).garenPassiveVisuals;
  expect(() => World.fromSnapshot(JSON.stringify(expired), w.battlefield)).toThrow();
});

test('indefinite emission stays bounded, seeks backwards exactly and never emits on the stop boundary', () => {
  const records = [{ startTick: 1, stopTick: null, point: null }];
  const sample = garenPassiveParticles(3, records, 121);
  expect(sample.length).toBeGreaterThan(4);
  garenPassiveParticles(3, records, 2e8);
  expect(garenPassiveParticles(3, records, 121)).toEqual(sample);
  const late = garenPassiveParticles(3, records, 2e8);
  expect(late.length).toBeLessThanOrEqual(19);
  expect(late.every((p) => p.life >= 1 && p.life <= 3 && p.age >= 0 && p.age < p.life)).toBe(true);
  const stopped = [{ startTick: 1, stopTick: 11, point: { x: 4, y: 5 } }];
  expect(garenPassiveParticles(3, stopped, 12).map((p) => p.ordinal)).toEqual([1]);
  expect(garenPassiveParticles(3, stopped, 194)).toEqual([]);
  expect(garenPassiveParticles(3, records, NaN)).toEqual([]);
  expect(garenPassiveParticles(3, records, 0)).toEqual([]);
});
