import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { RiftLayout } from '../src/content/rift';
import type { UnitKind } from '../src/simulation/types';
const layout: RiftLayout = JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'));
const battlefield = {
  ...PRACTICE_FIXTURE,
  unitStats: layout.unitStats,
  minionExperienceRadius: layout.minionExperienceRadius,
  lineOfSight: () => false,
};

function death(
  kind: UnitKind,
  range: number,
  options: { dead?: boolean; friendly?: boolean; ownKill?: boolean } = {}
) {
  const w = new World(false, battlefield);
  const target = w.spawn(kind, options.friendly ? 'blue' : 'red', {
    x: w.hero.x + range,
    y: w.hero.y,
  });
  const killer = options.ownKill ? w.hero : w.spawn('melee', 'blue', target);
  if (options.dead) w.damage(killer, w.hero, 1e6, 'true');
  const gold = w.player.gold;
  w.damage(killer, target, 1e6, 'true');
  return { w, gold: w.player.gold - gold };
}

test('both Rift barracks export the published 1500-unit experience radius', () => {
  expect(layout.minionExperienceRadius).toEqual({ blue: 1500, red: 1500 });
});
for (const [kind, xp] of [
  ['melee', 62],
  ['caster', 31],
  ['siege', 75],
  ['super', 75],
] as const)
  test(`${kind} awards XP through the radius boundary without requiring sight or a last hit`, () => {
    for (const range of [1399, 1400, 1499.999, 1500]) {
      const result = death(kind, range);
      expect(result.w.player.xp).toBe(xp);
      expect(result.gold).toBe(0);
      expect(result.w.player.cs).toBe(0);
    }
    expect(death(kind, 1500.001).w.player.xp).toBe(0);
    const distantKill = death(kind, 1600, { ownKill: true });
    expect(distantKill.w.player.xp).toBe(0);
    expect(distantKill.gold).toBeGreaterThan(0);
    expect(distantKill.w.player.cs).toBe(1);
  });

test('dead players, friendly minions, dummies, and structures do not grant proximity minion XP', () => {
  for (const kind of ['melee', 'caster', 'siege', 'super'] as const) {
    const dead = death(kind, 100, { dead: true });
    expect(dead.w.player.xp).toBe(0);
    expect(dead.w.hero.hp).toBe(0);
    expect(death(kind, 100, { friendly: true }).w.player.xp).toBe(0);
  }
  for (const kind of ['dummy', 'turret', 'inhibitor', 'nexus'] as const)
    expect(death(kind, 100).w.player.xp).toBe(0);
  expect(death('champion', 1450).w.player.xp).toBe(42);
  expect(death('champion', 1300).w.player.xp).toBe(42);
});

test('automatic minion XP can level the player without awarding last-hit gold', () => {
  const { w } = death('melee', 1450);
  w.gainExperience(200);
  const target = w.spawn('caster', 'red', { x: w.hero.x + 1500, y: w.hero.y });
  const killer = w.spawn('melee', 'blue', target);
  const gold = w.player.gold;
  w.damage(killer, target, 1e6, 'true');
  expect(w.player.level).toBe(2);
  expect(w.player.xp).toBe(13);
  expect(w.player.gold).toBe(gold);
});
