import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { ASSIST_WINDOW_SECONDS } from '../src/content/assist-window';

function fight() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  const victim = w.spawn('champion', 'red', { x: 0, y: 0 });
  const killer = w.spawn('champion', 'blue', { x: 0, y: 0 });
  victim.ai = killer.ai = false;
  return { w, victim, killer };
}

test('recent damage grants one assist, excludes the killer, and updates the human record', () => {
  const { w, victim, killer } = fight();
  w.damage(w.hero, victim, 1, 'true');
  w.damage(w.hero, victim, 1, 'physical');
  w.damage(killer, victim, 10000, 'true');
  expect(w.player.assists).toBe(1);
  expect(w.player.kills).toBe(0);
  expect(w.championState(killer.id)!.kills).toBe(1);
  expect(w.championState(killer.id)!.assists).toBe(0);
  w.damage(killer, victim, 10000, 'true');
  expect(w.player.assists).toBe(1);
});

test('assist window includes the 15-second boundary and excludes the next tick', () => {
  expect(ASSIST_WINDOW_SECONDS).toBe(15);
  for (const tick of [899, 900, 901]) {
    const { w, victim, killer } = fight();
    w.damage(w.hero, victim, 1, 'true');
    w.tick = tick;
    w.damage(killer, victim, 10000, 'true');
    expect(w.player.assists).toBe(tick <= 900 ? 1 : 0);
  }
});

test('distant or dead contributors retain damage-assist credit across a checkpoint', () => {
  const { w, victim, killer } = fight();
  w.damage(w.hero, victim, 1, 'true');
  w.hero.hp = 0;
  w.hero.deadAt = 0;
  w.hero.respawnTick = 1000;
  w.tick = 30;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.damage(world.unit(killer.id)!, world.unit(victim.id)!, 10000, 'true');
    expect(world.player.assists).toBe(1);
    expect(world.hero.hp).toBe(0);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('red contributors receive their own assists and nonchampion last hits do not fabricate attribution', () => {
  const { w, victim } = fight();
  const red = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(victim, w.hero, 1, 'true');
  w.damage(red, w.hero, 10000, 'true');
  expect(w.championState(victim.id)!.assists).toBe(1);
  expect(w.player.assists).toBe(0);
  const next = w.spawn('champion', 'blue', { x: 0, y: 0 });
  w.damage(victim, next, 1, 'true');
  w.damage(w.spawn('melee', 'red', next), next, 10000, 'true');
  expect(w.championState(victim.id)!.assists).toBe(1);
});
