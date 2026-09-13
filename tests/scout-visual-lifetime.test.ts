import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { HAWKSHOT_LINGER_TAIL_SECONDS } from '../src/content/hawkshot-linger-timing';

function arrival() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 700, y: 0 } });
  w.step(45);
  return w;
}

test('scout visual survives vision expiry, restores through tail, then retires exactly', () => {
  const w = arrival();
  expect(w.scoutVisuals).toHaveLength(1);
  const effect = w.scoutVisuals[0];
  expect(effect.flight.arrivalTick).toBe(45);
  const target = w.spawn('dummy', 'red', { x: effect.x, y: effect.y });
  w.step(effect.stopTick - w.tick - 1);
  expect(w.visible(target)).toBe(true);
  w.step();
  expect(w.visionAreas).toHaveLength(0);
  expect(w.scoutVisuals).toHaveLength(1);
  expect(w.visible(target)).toBe(false);
  expect(w.visionSources('blue').some((s) => s.x === effect.x && s.y === effect.y)).toBe(false);
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: target.id } });
  w.step();
  expect(w.hero.order.type).toBe('idle');
  expect(w.hero.releaseTick).toBeNull();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.snapshot()).toBe(w.snapshot());
  while (w.tick < effect.endTick - 1) {
    w.step();
    restored.step();
  }
  expect(w.scoutVisuals).toHaveLength(1);
  expect(restored.snapshot()).toBe(w.snapshot());
  w.step();
  restored.step();
  expect(w.scoutVisuals).toHaveLength(0);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(target.hp).toBe(target.maxHp);
});

test('visual tail bound covers all sustained source particles without using particleLinger', () => {
  const p = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8'));
  const sustained = p.profiles.filter((e: any) => !e.singleParticle);
  expect(HAWKSHOT_LINGER_TAIL_SECONDS).toBe(
    Math.max(...sustained.map((e: any) => e.maximumActiveTailSeconds))
  );
});

test('snapshot rejects duplicated, expired, future or extended scout visual descriptors', () => {
  const w = arrival();
  const mutations = [
    (s: any) => s.scoutVisuals.push(s.scoutVisuals[0]),
    (s: any) => (s.scoutVisuals[0].flight.arrivalTick = s.tick + 1),
    (s: any) => (s.scoutVisuals[0].flight.launchTick = s.tick + 1),
    (s: any) => (s.scoutVisuals[0].flight.id = s.nextId),
    (s: any) => s.scoutVisuals[0].endTick++,
    (s: any) => s.scoutVisuals[0].stopTick++,
    (s: any) => (s.scoutVisuals[0].endTick = s.tick),
  ];
  for (const mutate of mutations) {
    const state = JSON.parse(w.snapshot());
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow(
      /visual lifetime/
    );
  }
});
