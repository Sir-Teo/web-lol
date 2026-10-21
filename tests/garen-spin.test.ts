import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import profiles from '../src/content/garen-spin.json';
import audit from '../docs/reference/garen-spin.json';
import mesh from '../public/assets/models/garen-spin.json';
import { garenSpinParticles } from '../src/render/garen-spin-particles';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

const effect = { startTick: 100, stopTick: null, facing: 0.3 };
function setup() {
  const w = new World(false, PRACTICE_FIXTURE, 'garen');
  w.nextWaveTick = Infinity;
  w.pendingSpawns = [];
  w.learnSpell('e');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step(80);
  return w;
}
test('Judgment mesh, textures and profiles match their source export hashes', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(hash(audit.profile.path)).toBe(audit.profile.sha256);
  expect(hash('docs/reference/garen-model.json')).toBe(audit.modelPinSha256);
  expect(hash(`public${mesh.output.path}`)).toBe(mesh.output.sha256);
  expect(mesh.triangles).toBe(1224);
  expect(mesh.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  for (const t of audit.textures) expect(hash(t.path)).toBe(t.sha256);
  expect(profiles.map((p) => p.name)).toEqual([
    'Outer_mesh',
    'inner_mesh',
    'edge',
    'Top_Down_base',
  ]);
  expect(audit.deferredIndices).toEqual([4, 5]);
});
test('Judgment births honor source delays and reconstruct bounded particles without consuming simulation RNG', () => {
  expect(garenSpinParticles(2, effect, 100)).toEqual([]);
  expect(garenSpinParticles(2, effect, 101).map((p) => p.emitterIndex)).toEqual([0, 1]);
  expect(garenSpinParticles(2, effect, 113).map((p) => p.emitterIndex)).not.toContain(2);
  expect(garenSpinParticles(2, effect, 114).map((p) => p.emitterIndex)).toContain(2);
  const particles = garenSpinParticles(2, effect, 170.5);
  expect(particles.length).toBeGreaterThan(5);
  expect(particles.length).toBeLessThan(25);
  expect(new Set(particles.map((p) => p.emitterIndex)).size).toBe(4);
  for (const p of particles) {
    expect(p.life).toBeGreaterThanOrEqual(0.375);
    expect(p.life).toBeLessThanOrEqual(1.5);
    expect(p.color.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect([...p.scale, ...p.offset, ...p.rotation, ...p.scroll].every(Number.isFinite)).toBe(true);
  }
  garenSpinParticles(2, effect, 400);
  expect(garenSpinParticles(2, effect, 170.5)).toEqual(particles);
  expect(garenSpinParticles(3, effect, 170.5)).not.toEqual(particles);
});
test('stopping Judgment caps total particle life and prevents every later birth', () => {
  const stopped = { ...effect, stopTick: 180 };
  const atStop = garenSpinParticles(2, stopped, 180);
  expect(atStop.length).toBeGreaterThan(0);
  expect(atStop.every((p) => p.age < profiles[p.emitterIndex].linger)).toBe(true);
  for (const p of garenSpinParticles(2, stopped, 190))
    expect(
      atStop.some((old) => old.emitterIndex === p.emitterIndex && old.ordinal === p.ordinal)
    ).toBe(true);
  expect(garenSpinParticles(2, stopped, 232)).toEqual([]);
});
for (const stop of ['recast', 'natural', 'death'] as const) {
  test(`Judgment ${stop} retains a bounded, checkpoint-stable particle tail`, () => {
    const w = setup();
    const active = World.fromSnapshot(w.snapshot(), w.battlefield);
    expect(garenSpinParticles(w.hero.id, w.player.garenEVisual!, w.tick)).toEqual(
      garenSpinParticles(active.hero.id, active.player.garenEVisual!, active.tick)
    );
    if (stop === 'natural') w.step(101);
    else if (stop === 'death') {
      const killer = w.spawn('dummy', 'red', w.hero);
      w.damage(killer, w.hero, 1e6, 'true');
    } else {
      w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
      w.step();
    }
    expect(w.player.garenE).toBeNull();
    expect(w.player.garenEVisual?.stopTick).toBe(w.tick);
    expect(garenSpinParticles(w.hero.id, w.player.garenEVisual!, w.tick).length).toBeGreaterThan(0);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(15);
    restored.step(15);
    expect(restored.snapshot()).toBe(w.snapshot());
    expect(garenSpinParticles(w.hero.id, w.player.garenEVisual!, w.tick)).toEqual(
      garenSpinParticles(restored.hero.id, restored.player.garenEVisual!, restored.tick)
    );
    w.step(45);
    restored.step(45);
    expect(w.player.garenEVisual).toBeNull();
    expect(restored.snapshot()).toBe(w.snapshot());
  });
}
test('checkpoint decoder rejects foreign, missing, inconsistent and expired Judgment visuals', () => {
  const w = setup();
  for (const mutate of [
    (s: any) => s.player.garenEVisual.startTick++,
    (s: any) => (s.player.garenEVisual = null),
    (s: any) => (s.player.garenEVisual.stopTick = s.tick),
    (s: any) => (s.player.garenEVisual.facing = null),
  ]) {
    const data = JSON.parse(w.snapshot());
    mutate(data);
    expect(() => World.fromSnapshot(JSON.stringify(data), w.battlefield)).toThrow();
  }
  w.step(101);
  for (const mutate of [
    (s: any) => (s.player.garenEVisual.stopTick = s.tick + 1),
    (s: any) => (s.player.garenEVisual.stopTick = s.player.garenEVisual.startTick - 1),
    (s: any) => {
      s.player.garenEVisual.stopTick = s.tick - 60;
    },
  ]) {
    const data = JSON.parse(w.snapshot());
    mutate(data);
    expect(() => World.fromSnapshot(JSON.stringify(data), w.battlefield)).toThrow();
  }
  const ashe = new World(false, PRACTICE_FIXTURE);
  const data = JSON.parse(ashe.snapshot());
  data.player.garenEVisual = { startTick: 0, stopTick: 0, facing: 0 };
  expect(() => World.fromSnapshot(JSON.stringify(data), ashe.battlefield)).toThrow();
});
