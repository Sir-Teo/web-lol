import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function scout(ordinarySight = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => ordinarySight,
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const target = w.spawn('champion', 'red', { x: 1600, y: 0 });
  const killer = w.spawn('champion', 'blue', { x: 1500, y: 0 });
  target.ai = killer.ai = false;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 2000, y: 0 } });
  return { w, target, killer, state: w.championState(target.id)! };
}

test('Hawkshot reveals grant assist credit without damage, without continuous refresh or duplicate credit', () => {
  const { w, target, killer, state } = scout();
  for (let i = 0; i < 100 && !state.revealContributors.length; i++) w.step();
  expect(state.revealContributors).toHaveLength(1);
  const tick = state.revealContributors[0].lastRevealTick;
  w.step(60);
  expect(state.revealContributors[0].lastRevealTick).toBe(tick);
  expect(w.visionAreas.find((a) => a.kind === 'scout')?.sourceId).toBe(w.hero.id);
  w.damage(w.hero, target, 1, 'true');
  w.damage(killer, target, 10000, 'true');
  expect(w.player.assists).toBe(1);
});

test('Hawkshot does not grant reveal credit for an enemy already seen by an ally', () => {
  const { w, state } = scout(true);
  w.step(100);
  expect(state.revealContributors).toEqual([]);
});

test('Hawkshot credit expires after its separate ten-second window and survives checkpoint restoration', () => {
  for (const elapsed of [600, 601]) {
    const { w, target, killer, state } = scout();
    for (let i = 0; i < 100 && !state.revealContributors.length; i++) w.step();
    const tick = state.revealContributors[0].lastRevealTick;
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(tick + elapsed - world.tick);
      world.damage(world.unit(killer.id)!, world.unit(target.id)!, 10000, 'true');
      expect(world.player.assists).toBe(elapsed === 600 ? 1 : 0);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  }
});

test('an enemy moving into landed scout vision gains credit from the retained caster', () => {
  const { w, target, state } = scout();
  target.x = 3000;
  target.previous = { x: 3000, y: 0 };
  w.step(100);
  expect(state.revealContributors).toEqual([]);
  w.setOrder(target, { type: 'move', point: { x: 2000, y: 0 } });
  w.step(100);
  expect(state.revealContributors).toHaveLength(1);
  expect(state.revealContributors[0].sourceId).toBe(w.hero.id);
});

test('reveal checkpoint validation rejects foreign owners and future contributions', () => {
  const { w, target, state } = scout();
  w.step(120);
  expect(state.revealContributors).toHaveLength(1);
  for (const mutate of [
    (s: any) => (s.visionAreas[0].sourceId = target.id),
    (s: any) =>
      (s.otherChampions.find((p: any) => p.id === target.id).revealContributors[0].lastRevealTick =
        s.tick + 1),
    (s: any) =>
      (s.otherChampions.find((p: any) => p.id === target.id).revealContributors[0].sourceId =
        999999),
  ]) {
    const saved = JSON.parse(w.snapshot());
    mutate(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});

test('red Hawkshot credits the red caster without changing human assists', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => false });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 1600, y: 0, previous: { x: 1600, y: 0 } });
  const caster = w.spawn('champion', 'red', { x: 0, y: 0 });
  const killer = w.spawn('champion', 'red', { x: 0, y: 0 });
  caster.ai = killer.ai = false;
  w.enqueue({ type: 'cast', unit: caster.id, ability: 'e', point: { x: 2000, y: 0 } });
  w.step(120);
  expect(w.player.revealContributors[0].sourceId).toBe(caster.id);
  w.damage(killer, w.hero, 10000, 'true');
  expect(w.championState(caster.id)!.assists).toBe(1);
  expect(w.player.assists).toBe(0);
});
