import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { RiftLayout } from '../src/content/rift';

const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = {
  ...PRACTICE_FIXTURE,
  unitStats: layout.unitStats,
  unitGoldGrowth: layout.unitGoldGrowth,
};

for (const team of ['blue', 'red'] as const)
  for (const kind of ['siege', 'super'] as const)
    test(`${team} ${kind} starts at 50 gold, grows every 90 seconds, and caps at 90`, () => {
      const w = new World(false, battlefield);
      expect(battlefield.unitGoldGrowth?.[kind]?.[team]).toEqual({
        intervalSeconds: 90,
        increment: 1,
        maxTotal: 90,
      });
      for (const [tick, bounty] of [
        [0, 50],
        [90 * 60 - 1, 50],
        [90 * 60, 51],
        [180 * 60 - 1, 51],
        [180 * 60, 52],
        [30 * 60 * 60, 70],
        [60 * 60 * 60 - 1, 89],
        [60 * 60 * 60, 90],
        [120 * 60 * 60, 90],
      ]) {
        w.tick = tick;
        expect(w.spawn(kind, team, w.hero).goldBounty).toBe(bounty);
      }
      expect(battlefield.unitStats?.[kind]?.[team]?.goldBounty).toBe(50);
    });

test('a surviving minion retains its spawn bounty across an upgrade and checkpoint', () => {
  const w = new World(false, battlefield);
  w.nextWaveTick = Infinity;
  w.units = [w.hero];
  w.tick = 90 * 60 - 1;
  const older = w.spawn('siege', 'red', { x: w.hero.x + 800, y: w.hero.y });
  older.ai = false;
  w.step();
  expect(older.goldBounty).toBe(50);
  expect(w.spawn('siege', 'red', older).goldBounty).toBe(51);
  const restored = World.fromSnapshot(w.snapshot(), battlefield);
  const victim = restored.units.find((unit) => unit.id === older.id)!;
  const before = restored.player.gold;
  restored.damage(restored.hero, victim, 1e6, 'true');
  restored.damage(restored.hero, victim, 1e6, 'true');
  expect(restored.player.gold - before).toBe(50);
  expect(restored.player.cs).toBe(1);
});

test('scaled last hits award gold once while allied kills do not pay the player', () => {
  for (const kind of ['siege', 'super'] as const) {
    const w = new World(false, battlefield);
    w.tick = 30 * 60 * 60;
    const victim = w.spawn(kind, 'red', w.hero);
    const before = w.player.gold;
    w.damage(w.hero, victim, 1e6, 'true');
    w.damage(w.hero, victim, 1e6, 'true');
    expect(w.player.gold - before).toBe(70);
    expect(w.player.cs).toBe(1);
    const other = w.spawn(kind, 'red', w.hero);
    const ally = w.spawn('melee', 'blue', w.hero);
    w.damage(ally, other, 1e6, 'true');
    expect(w.player.gold - before).toBe(70);
    expect(w.player.cs).toBe(1);
  }
});

test('unconfigured ordinary minions retain their existing rewards', () => {
  const w = new World(false, battlefield);
  w.tick = 120 * 60 * 60;
  for (const team of ['blue', 'red'] as const) {
    expect(w.spawn('melee', team, w.hero).goldBounty).toBe(20);
    expect(w.spawn('caster', team, w.hero).goldBounty).toBe(14);
  }
});
