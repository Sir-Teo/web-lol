import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';

function fixture() {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  return w;
}
function cast(w: World) {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step();
}

test('Hawkshot spends two charges five seconds apart without restarting serial recharge', () => {
  const w = fixture();
  expect(w.player.eCharges).toBe(2);
  cast(w);
  expect(w.player.eCharges).toBe(1);
  expect(w.player.eRechargeTick).toBe(5401);
  expect(w.abilityCooldownTicks('e')).toBe(300);
  w.step(298);
  cast(w); // tick 300: still one tick before the cast cooldown ends.
  expect(w.player.eCharges).toBe(1);
  expect(w.visionAreas.find((a) => a.kind === 'scout')!.endTick).toBe(301);
  cast(w); // tick 301: the second charge is available.
  expect(w.player.eCharges).toBe(0);
  expect(w.player.eRechargeTick).toBe(5401);
  expect(w.abilityCooldownTicks('e')).toBe(5100);
  w.step(5099);
  expect(w.player.eCharges).toBe(0);
  w.step();
  expect(w.player.eCharges).toBe(1);
  expect(w.player.eRechargeTick).toBe(10801);
  expect(w.abilityCooldownTicks('e')).toBe(0);
  w.step(5399);
  expect(w.player.eCharges).toBe(1);
  w.step();
  expect(w.player.eCharges).toBe(2);
  expect(w.player.eRechargeTick).toBeNull();
  w.step(5400);
  expect(w.player.eCharges).toBe(2);
  cast(w);
  expect(w.player.eRechargeTick).toBe(w.tick + 5400);
});

test('empty charges reject casts without refreshing reveal or cancelling recall', () => {
  const w = fixture();
  cast(w);
  w.step(299);
  cast(w);
  w.step(300);
  w.player.recallEnd = w.tick + 480;
  const end = w.player.recallEnd;
  const reveals = structuredClone(w.visionAreas);
  cast(w);
  expect(w.player.eCharges).toBe(0);
  expect(w.player.eRechargeTick).toBe(5401);
  expect(w.player.recallEnd).toBe(end);
  expect(w.visionAreas).toEqual(reveals);
  expect(w.events.some((e) => e.tick === w.tick && e.type === 'cast' && e.text === 'e')).toBe(
    false
  );
});

test('recharge resolves before same-tick commands but never bypasses the five-second gate', () => {
  const w = fixture();
  cast(w);
  w.step(5349);
  cast(w); // Second charge spent shortly before the first replenishes.
  w.step(49);
  cast(w); // tick 5401 restores a charge, but the cast gate still blocks.
  expect(w.player.eCharges).toBe(1);
  expect(w.abilityCooldownTicks('e')).toBe(250);
  w.step(249);
  cast(w);
  expect(w.player.eCharges).toBe(0);
  w.step(5149);
  cast(w); // tick 10801: replenish and consume in the same simulation update.
  expect(w.player.eCharges).toBe(0);
  expect(w.player.eRechargeTick).toBe(16201);
  expect(w.player.cooldowns.e).toBe(11101);
});

test('Hawkshot recharge survives death and save/restore without granting respawn charges', () => {
  const w = fixture();
  cast(w);
  w.step(299);
  cast(w);
  w.step(4900);
  const enemy = w.spawn('champion', 'red', { x: 2000, y: 2000 });
  enemy.ai = false;
  w.damage(enemy, w.hero, w.hero.maxHp, 'true');
  w.step(199);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step();
    expect(world.hero.hp).toBe(0);
    expect(world.player.eCharges).toBe(1);
    expect(world.player.eRechargeTick).toBe(10801);
    world.step(400);
    expect(world.hero.hp).toBeGreaterThan(0);
    expect(world.player.eCharges).toBe(1);
    expect(world.player.eRechargeTick).toBe(10801);
  }
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('disabled or invalid casts do not consume charges and saves reject inconsistent ammunition', () => {
  const w = fixture();
  w.hero.stunUntil = 10;
  cast(w);
  expect(w.player.eCharges).toBe(2);
  expect(w.player.eRechargeTick).toBeNull();
  w.hero.stunUntil = 0;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: NaN, y: 0 } });
  w.step();
  expect(w.player.eCharges).toBe(2);
  for (const patch of [
    { eCharges: -1 },
    { eCharges: 3 },
    { eCharges: 0.5 },
    { eCharges: 0 },
    { eRechargeTick: 100 },
    { eCharges: 1, eRechargeTick: -1 },
    { eCharges: 1, eRechargeTick: 'Infinity' },
    { eCharges: undefined },
  ]) {
    const saved = JSON.parse(w.snapshot());
    Object.assign(saved.player, patch);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
});
