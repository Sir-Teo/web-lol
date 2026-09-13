import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function encounter() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
  victim.ai = false;
  const ally = w.spawn('champion', 'blue', { x: 0, y: 0 });
  ally.ai = false;
  return { w, victim, ally, state: w.championState(victim.id)! };
}

test('damage contributions retain one latest timestamp per opposing champion', () => {
  const { w, victim, ally, state } = encounter();
  w.damage(w.hero, victim, 1, 'physical');
  w.step(3);
  w.damage(ally, victim, 1, 'magic');
  w.step(2);
  w.damage(w.hero, victim, 1, 'true');
  expect(state.damageContributors).toEqual([
    { sourceId: w.hero.id, lastDamageTick: 5 },
    { sourceId: ally.id, lastDamageTick: 3 },
  ]);
  expect(w.player.damageContributors).toEqual([]);
});

test('zero damage, friendly damage and nonchampions do not create champion contributions', () => {
  const { w, victim, state } = encounter();
  w.damage(w.hero, victim, 0, 'true');
  w.damage(victim, victim, 1, 'true');
  w.damage(w.spawn('melee', 'blue', victim), victim, 1, 'true');
  expect(state.damageContributors).toEqual([]);
});

test('contributions survive lethal damage and checkpoints but clear on respawn', () => {
  const { w, victim, ally, state } = encounter();
  w.damage(w.hero, victim, 1, 'physical');
  w.step(3);
  w.damage(ally, victim, 10000, 'true');
  expect(state.damageContributors).toHaveLength(2);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(restored.championState(victim.id)!.damageContributors).toEqual(state.damageContributors);
  const respawnTick = victim.respawnTick!;
  w.step(respawnTick - w.tick);
  restored.step(respawnTick - restored.tick);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.damageContributors).toEqual([]);
  w.damage(ally, victim, 1, 'true');
  expect(state.damageContributors).toEqual([{ sourceId: ally.id, lastDamageTick: w.tick }]);
});

test('saved contributions reject duplicate, foreign, friendly, future and post-death entries', () => {
  const { w, victim } = encounter();
  w.damage(w.hero, victim, 10000, 'true');
  for (const mutate of [
    (_s: any, c: any[]) => c.push({ ...c[0] }),
    (_s: any, c: any[]) => (c[0].sourceId = 999999),
    (_s: any, c: any[]) => (c[0].sourceId = victim.id),
    (_s: any, c: any[]) => (c[0].lastDamageTick = 1),
    (s: any, c: any[]) => {
      s.tick = 2;
      c[0].lastDamageTick = 1;
    },
  ]) {
    const saved = JSON.parse(w.snapshot());
    const contributions = saved.otherChampions.find(
      (p: any) => p.id === victim.id
    ).damageContributors;
    mutate(saved, contributions);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow(
      /damage contributions/
    );
  }
});
