import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN } from '../src/content/garen-progression';
function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  return { w, garen, target, state: w.championState(garen.id)! };
}
test('Garen spawns with his own melee profile and deals damage only at release without missiles', () => {
  const { w, garen, target, state } = setup();
  expect(garen).toMatchObject({
    name: 'Garen',
    hp: 690,
    maxMana: 0,
    damage: 69,
    armor: 38,
    magicResist: 32,
    range: 175,
    speed: 340,
    missileSpeed: 0,
  });
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  const release = garen.releaseTick!;
  expect(release).toBe(1 + GAREN.windupTicks);
  w.step(release - w.tick - 1);
  expect(target.hp).toBe(1500);
  w.step();
  expect(target.hp).toBe(1431);
  expect(w.projectiles).toHaveLength(0);
  expect(state.qStacks).toBe(0);
  expect(target.slows).toEqual([]);
  expect(garen.animationTimeline?.primary.clip).toBe('attack1');
});
test('melee critical hits use ordinary damage, and cancelling a windup prevents its hit', () => {
  const { w, garen, target, state } = setup();
  state.inventory.push(...Array(5).fill('agility'), 'infinity-edge');
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  expect(garen.attackCycle?.critical).toBe(true);
  w.step(garen.releaseTick! - w.tick);
  expect(target.hp).toBeCloseTo(1500 - 69 * w.basicAttackDamageMultiplier(garen, true));
  const next = setup();
  next.w.setOrder(next.garen, { type: 'attack', target: next.target.id });
  next.w.step();
  next.w.setOrder(next.garen, { type: 'move', point: { x: -200, y: 0 } });
  next.w.step(60);
  expect(next.target.hp).toBe(1500);
});
test('Garen progression, regeneration and pending melee attacks survive restoration', () => {
  const { w, garen, target } = setup();
  garen.hp -= 100;
  w.step(60);
  expect(garen.hp).toBeCloseTo(591.6);
  w.gainExperience(1e6, garen.id);
  expect(garen.maxHp).toBe(2356);
  expect(garen.maxMana).toBe(0);
  expect(garen.damage).toBe(145.5);
  expect(garen.windupTicks).toBe(14);
  expect(garen.attackPeriod).toBe(59);
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  restored.step(180);
  expect(restored.snapshot()).toBe(w.snapshot());
});
test('levelling during a melee windup preserves committed deadlines and changes the following attack', () => {
  const { w, garen, target } = setup();
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  const release = garen.releaseTick!;
  const next = garen.nextAttackTick;
  w.gainExperience(1e6, garen.id);
  expect(garen.releaseTick).toBe(release);
  expect(garen.nextAttackTick).toBe(next);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(release - w.tick - 1);
  expect(target.hp).toBe(1500);
  w.step();
  expect(target.hp).toBe(1354.5);
  w.step(next - w.tick);
  expect(garen.releaseTick).toBe(next + 14);
  expect(garen.nextAttackTick).toBe(next + 59);
  w.step(14);
  expect(target.hp).toBe(1209);
  restored.step(w.tick - restored.tick);
  expect(restored.snapshot()).toBe(w.snapshot());
});
test('Garen cannot inherit Ashe abilities or player selection through saved state', () => {
  const { w, garen, state } = setup();
  for (const ability of ['w', 'e', 'r'] as const) {
    expect(w.learnSpell(ability, garen.id)).toContain('development');
    w.enqueue({ type: 'cast', unit: garen.id, ability, point: { x: 600, y: 0 } });
  }
  w.step();
  expect(state.pendingCast).toBeNull();
  expect(w.projectiles).toHaveLength(0);
  const invalid = JSON.parse(w.snapshot());
  const owner = invalid.otherChampions.find((s: { id: number }) => s.id === garen.id);
  owner.spellRanks.w = 1;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  const crossed = JSON.parse(w.snapshot());
  crossed.units.find((u: { id: number }) => u.id === w.hero.id).champion = 'garen';
  expect(() => World.fromSnapshot(JSON.stringify(crossed), w.battlefield)).toThrow();
});
