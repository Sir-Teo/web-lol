import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_PASSIVE } from '../src/content/garen-passive';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
  const enemy = w.spawn('champion', 'red', { x: 300, y: 0 }, 'lux');
  const state = w.championState(garen.id)!;
  return { w, garen, enemy, state };
}

test('Perseverance follows the source breakpoints and adds to base regeneration without exceeding max health', () => {
  expect(
    [1, 6, 7, 13, 14, 18].map((level) => GAREN_PASSIVE.maxHealthFractionByLevel[level - 1])
  ).toEqual([0.015, 0.025, 0.033, 0.081, 0.085, 0.101]);
  const { w, garen } = setup();
  garen.hp -= 100;
  expect(w.perseveranceRegenPerSecond(garen)).toBeCloseTo(2.07);
  w.step(300);
  expect(garen.hp).toBeCloseTo(608.35);
  w.gainExperience(1e6, garen.id);
  garen.hp = garen.maxHp - 1000;
  expect(w.perseveranceRegenPerSecond(garen)).toBeCloseTo(47.5912);
  w.step(300);
  expect(garen.hp).toBeCloseTo(1610.456);
  garen.hp = garen.maxHp - 1;
  w.step(60);
  expect(garen.hp).toBe(garen.maxHp);
});

test('champion damage interrupts only passive regeneration and a repeated hit restarts the full timer', () => {
  const { w, garen, enemy, state } = setup();
  w.damage(enemy, garen, 100, 'true');
  expect(state.garenPassiveReadyTick).toBe(480);
  expect(w.perseveranceRegenPerSecond(garen)).toBe(0);
  w.step(60);
  expect(garen.hp).toBeCloseTo(591.6);
  w.damage(enemy, garen, 10, 'true');
  expect(state.garenPassiveReadyTick).toBe(540);
  w.step(479);
  const before = garen.hp;
  expect(w.perseveranceRegenPerSecond(garen)).toBe(0);
  w.step();
  expect(w.perseveranceRegenPerSecond(garen)).toBeCloseTo(2.07);
  expect(garen.hp - before).toBeCloseTo(3.67 / 60);
});

test('lane-minion and allied damage leave the passive active, but shielded champion hits and turrets interrupt it', () => {
  const { w, garen, enemy, state } = setup();
  const minion = w.spawn('melee', 'red', { x: 500, y: 0 });
  w.damage(minion, garen, 20, 'true');
  w.damage(w.hero, garen, 10, 'true');
  expect(state.garenPassiveReadyTick).toBe(0);
  w.applyShield(garen, garen, 100, 120);
  const hp = garen.hp;
  w.damage(enemy, garen, 30, 'true');
  expect(garen.hp).toBe(hp);
  expect(state.garenPassiveReadyTick).toBe(480);
  w.step(30);
  const tower = w.spawn('turret', 'red', { x: 4000, y: 4000 });
  w.damage(tower, garen, 10, 'true');
  expect(state.garenPassiveReadyTick).toBe(510);
});

test('non-damaging hostile slow and binding contacts interrupt, while rejected effects do not', () => {
  const { w, garen, enemy, state } = setup();
  expect(w.applySlow(enemy, garen, 'lucent', 120, 0.8)).toBe(true);
  expect(state.garenPassiveReadyTick).toBe(480);
  w.step(20);
  expect(w.applySlow(w.hero, garen, 'frost', 120, 0.8)).toBe(false);
  expect(state.garenPassiveReadyTick).toBe(480);
  w.releaseLightBinding(enemy, garen, 0);
  w.step(30);
  expect(garen.rootUntil).toBeGreaterThan(w.tick);
  expect(state.garenPassiveReadyTick).toBeGreaterThan(500);
});

test('the interrupted timer survives save/restore and turret removal, with exact recovery continuation', () => {
  const { w, garen, state } = setup();
  const tower = w.spawn('turret', 'red', { x: 4000, y: 4000 });
  w.damage(tower, garen, 100, 'true');
  w.step(100);
  w.units = w.units.filter((u) => u !== tower);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(500);
  restored.step(500);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(state.garenPassiveReadyTick).toBe(480);
  expect(w.perseveranceRegenPerSecond(garen)).toBeCloseTo(2.07);
});

test('death clears the timer and passive healing resumes with the respawned champion', () => {
  const { w, garen, enemy, state } = setup();
  w.damage(enemy, garen, 10000, 'true');
  expect(state.garenPassiveReadyTick).toBe(0);
  expect(w.perseveranceRegenPerSecond(garen)).toBe(0);
  w.step(garen.respawnTick! - w.tick);
  expect(garen.deadAt).toBeNull();
  expect(state.garenPassiveReadyTick).toBe(0);
  expect(w.perseveranceRegenPerSecond(garen)).toBeCloseTo(2.07);
});

test('saved timers cannot belong to other champions or extend beyond one interruption period', () => {
  const { w, garen, enemy } = setup();
  w.damage(enemy, garen, 100, 'true');
  for (const value of [-1, 0.5, 481, null]) {
    const invalid = JSON.parse(w.snapshot());
    invalid.otherChampions.find((s: any) => s.id === garen.id).garenPassiveReadyTick = value;
    expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  }
  const crossed = JSON.parse(w.snapshot());
  crossed.player.garenPassiveReadyTick = 10;
  expect(() => World.fromSnapshot(JSON.stringify(crossed), w.battlefield)).toThrow();
});

test('a hostile impact on the recovery tick restarts interruption before regeneration runs', () => {
  const { w, garen, enemy, state } = setup();
  garen.hp -= 100;
  enemy.x = 50;
  state.garenPassiveReadyTick = 1;
  w.releaseLightBinding(enemy, garen, 10);
  w.step();
  expect(state.garenPassiveReadyTick).toBe(481);
  expect(w.perseveranceRegenPerSecond(garen)).toBe(0);
  expect(garen.hp).toBeCloseTo(590 - 10 / 1.32 + 1.6 / 60);
});
