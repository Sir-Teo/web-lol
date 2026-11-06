import { expect, test } from 'vitest';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import type { Unit } from '../src/simulation/types';
import { Random } from '../src/simulation/math';
import { grantRedBuff } from '../src/simulation/red-buff';

const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
function setup(champion: 'ashe' | 'lux' = 'ashe') {
  const w = createBaronEncounter(field, champion);
  const b = w.units.find((u) => u.monster?.species === 'baron')!;
  return { w, b };
}
const expectUnslowed = (w: World, b: Unit) => {
  expect(w.slowFactor(b)).toBe(1);
  expect(b.slowUntil).toBe(0);
  expect(b.criticalSlow).toBeNull();
  expect(b.slows).toEqual([]);
};

test('Baron rejects an otherwise valid slow application without altering the snapshot', () => {
  const { w, b } = setup(),
    before = w.snapshot();
  expect(w.applySlow(w.hero, b, 'frost', 120, 0.8)).toBe(false);
  expect(w.snapshot()).toBe(before);
  expectUnslowed(w, b);
});

for (const critical of [false, true])
  test(`Ashe ${critical ? 'critical' : 'ordinary'} attacks damage Baron without attaching Frost slow state`, () => {
    const { w, b } = setup();
    if (critical) {
      w.player.inventory.push('agility');
      let seed = 0;
      while (new Random(seed).next() >= 0.15) seed++;
      w.random.state = seed;
    }
    const hp = b.hp;
    w.setOrder(w.hero, { type: 'attack', target: b.id });
    w.step();
    expect(w.hero.attackCycle?.critical === true).toBe(critical);
    for (let i = 0; i < 90 && b.hp === hp; i++) w.step();
    expect(b.hp).toBeLessThan(hp);
    expect(hp - b.hp).toBeCloseTo(
      (w.hero.damage * w.basicAttackDamageMultiplier(w.hero, critical)) / (1 + b.armor / 100)
    );
    expectUnslowed(w, b);
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, field);
    expect(copy.snapshot()).toBe(saved);
    w.step(180);
    copy.step(180);
    expect(copy.snapshot()).toBe(w.snapshot());
  });

test('an armed Lux zone leaves Baron unslowed and its recast still damages him', () => {
  const { w, b } = setup('lux'),
    hp = b.hp;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: b });
  w.step(60);
  expect(w.singularities[0]?.arrivalTick).not.toBeNull();
  expectUnslowed(w, b);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: b });
  w.step();
  expect(b.hp).toBeLessThan(hp);
  expectUnslowed(w, b);
});

test('Crystal Arrow splash damages Baron without bypassing slow immunity through legacy fields', () => {
  const { w, b } = setup(),
    hp = b.hp;
  const primary = w.spawn('champion', 'red', { x: b.x, y: b.y + 250 }, 'lux');
  primary.ai = false;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: primary });
  for (let i = 0; i < 90 && !primary.stunUntil; i++) w.step();
  expect(primary.stunUntil).toBeGreaterThan(w.tick);
  expect(b.hp).toBeLessThan(hp);
  expectUnslowed(w, b);
});

test('ordinary monsters retain independent Frost contributions', () => {
  const { w } = setup();
  const ordinary = w.spawnMonster({ x: -500, y: 0 }, null, 'gromp');
  expect(w.applySlow(w.hero, ordinary, 'frost', 120, 0.8)).toBe(true);
  expect(w.slowFactor(ordinary)).toBe(0.8);
  expect(ordinary.slows).toHaveLength(1);
});

for (const fieldName of ['slowUntil', 'criticalSlow', 'slows'] as const)
  test(`Baron rejects forged ${fieldName} in a saved match`, () => {
    const { w, b } = setup();
    const ordinary = w.spawnMonster({ x: -500, y: 0 }, null, 'gromp');
    w.applySlow(w.hero, ordinary, 'frost', 120, 0.8);
    const raw = JSON.parse(w.snapshot()),
      row = raw.units.find((u: any) => u.id === b.id);
    row[fieldName] =
      fieldName === 'slowUntil'
        ? 120
        : fieldName === 'slows'
          ? ordinary.slows
          : { startTick: 0, endTick: 60, startMultiplier: 0.6, endMultiplier: 0.8 };
    expect(() => World.fromSnapshot(JSON.stringify(raw), field)).toThrow('Baron cannot carry');
  });

test('Volley damages Baron while every arrow leaves slow state empty', () => {
  const { w, b } = setup(),
    hp = b.hp;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: b });
  w.step(60);
  expect(b.hp).toBeLessThan(hp);
  expectUnslowed(w, b);
});

test('the complete Q flurry retains all five damage packets against slow-immune Baron', () => {
  const { w, b } = setup(),
    hp = b.hp;
  w.player.qStacks = 4;
  w.player.qStackExpiry = 360;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: b });
  w.step();
  w.setOrder(w.hero, { type: 'attack', target: b.id });
  w.step();
  w.step(w.hero.releaseTick! - w.tick);
  const shots = [...w.projectiles, ...w.pendingAttackProjectiles];
  expect(shots).toHaveLength(5);
  const damage = shots.reduce((sum, p) => sum + p.damage, 0);
  w.setOrder(w.hero, { type: 'idle' });
  for (let i = 0; i < 90 && (w.projectiles.length || w.pendingAttackProjectiles.length); i++)
    w.step();
  expect(hp - b.hp).toBeCloseTo(damage / (1 + b.armor / 100));
  expectUnslowed(w, b);
  expect(World.fromSnapshot(w.snapshot(), field).snapshot()).toBe(w.snapshot());
});

test('Cinders burn still deals damage while its associated slow is resisted', () => {
  const { w, b } = setup();
  grantRedBuff(w.player, w.tick);
  w.setOrder(w.hero, { type: 'attack', target: b.id });
  for (let i = 0; i < 90 && !b.cinderBurn; i++) w.step();
  expect(b.cinderBurn).not.toBeNull();
  w.setOrder(w.hero, { type: 'idle' });
  expectUnslowed(w, b);
  const hp = b.hp;
  w.step(b.cinderBurn!.nextTick - w.tick);
  expect(b.hp).toBeLessThan(hp);
  expectUnslowed(w, b);
  expect(World.fromSnapshot(w.snapshot(), field).snapshot()).toBe(w.snapshot());
});
