import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { Random } from '../src/simulation/math';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ITEMS } from '../src/content/rules';
import pin from '../docs/reference/critical-attacks.json';
import lux from '../docs/reference/lux-character.json';
import passive from '../docs/reference/ashe-passive.json';
import { CRITICAL_ATTACKS } from '../src/content/critical-attacks';

function setup(champion: 'ashe' | 'lux' = 'lux', critical = true) {
  const w = new World(false, PRACTICE_FIXTURE, champion);
  w.nextWaveTick = Infinity;
  w.player.gold = 5000;
  expect(w.buy('agility')).toBeNull();
  let seed = 0;
  while (new Random(seed).next() < 0.15 !== critical) seed++;
  w.random.state = seed;
  const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
  target.hp = target.maxHp = 5000;
  target.armor = 100;
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  return { w, target };
}
function release(w: World) {
  w.step();
  w.step(w.hero.releaseTick! - w.tick);
}

test('critical constants and item match the pinned current source', () => {
  const item = ITEMS.find((i) => i.id === 'agility')!;
  expect([item.price, item.sell, 'criticalChance' in item && item.criticalChance]).toEqual([
    pin.item.data.gold.total,
    pin.item.data.gold.sell,
    pin.item.data.stats.FlatCritChanceMod,
  ]);
  expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  expect(CRITICAL_ATTACKS.ordinaryMultiplier).toBe(
    lux.records['Characters/Lux/CharacterRecords/Root'].critDamageMultiplier
  );
  const formula = passive.data.mSpell.mSpellCalculations.DamageBonus.mFormulaParts;
  expect(formula[0]).toEqual({
    mNumber: CRITICAL_ATTACKS.asheBaseMultiplier,
    __type: 'NumberCalculationPart',
  });
  expect((formula[1] as any).mSubpart.mSubparts[0].mNumber).toBe(
    CRITICAL_ATTACKS.asheChanceCoefficient
  );
  expect(pin.luxCritSpell.mSpell.mAnimationName).toBe('Crit');
});

test('crit chance follows inventory ownership and survives checkpoint restoration', () => {
  const { w } = setup();
  expect(w.criticalChance()).toBe(0.15);
  expect(w.buy('agility')).toBeNull();
  expect(w.criticalChance()).toBe(0.3);
  expect(w.sell(0)).toBeNull();
  expect(w.criticalChance()).toBe(0.15);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).criticalChance()).toBe(0.15);
});

for (const critical of [false, true])
  test(`Lux ${critical ? 'critical' : 'ordinary'} damage is snapshotted before travel`, () => {
    const { w, target } = setup('lux', critical);
    release(w);
    expect(w.hero.attackCycle?.critical === true).toBe(critical);
    expect(w.projectiles[0].critical === true).toBe(critical);
    expect(w.projectiles[0].damage).toBe(w.hero.damage * (critical ? 2 : 1));
    const damage = w.projectiles[0].damage;
    w.setOrder(w.hero, { type: 'idle' });
    expect(w.sell(0)).toBeNull();
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(20);
    restored.step(20);
    expect(w.snapshot()).toBe(restored.snapshot());
    expect(target.hp).toBeCloseTo(5000 - damage / 2);
  });

test('windup roll and subsequent PRNG sequence restore exactly', () => {
  const { w } = setup();
  w.step();
  expect(w.hero.attackCycle?.critical).toBe(true);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(250);
  restored.step(250);
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('Lux critical multiplier does not multiply Illumination magic damage', () => {
  const { w, target } = setup();
  target.magicResist = 100;
  target.illumination.push({ sourceId: w.hero.id, endTick: 360 });
  release(w);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(20);
  expect(target.hp).toBeCloseTo(5000 - (w.hero.damage * 2) / 2 - 30 / 2);
  expect(target.illumination).toEqual([]);
});

test('Ashe crit changes slow instead of attack damage, including Q flurry', () => {
  for (const empowered of [false, true]) {
    const results = [false, true].map((critical) => {
      const { w, target } = setup('ashe', critical);
      if (empowered) {
        w.player.qUntil = 200;
        w.player.spellRanks.q = 1;
      }
      release(w);
      const payload = [...w.projectiles, ...w.pendingAttackProjectiles];
      expect(payload.every((p) => (p.critical === true) === critical)).toBe(true);
      const damage = payload.reduce((sum, p) => sum + p.damage, 0);
      expect(damage).toBeCloseTo(w.hero.damage * 1.15 * (empowered ? 1.1 : 1));
      w.setOrder(w.hero, { type: 'idle' });
      for (
        let tick = 0;
        tick < 60 && (w.projectiles.length || w.pendingAttackProjectiles.length);
        tick++
      )
        w.step();
      expect(w.projectiles).toHaveLength(0);
      expect(target.criticalSlow !== null).toBe(critical);
      expect(target.hp).toBeCloseTo(5000 - damage / 2);
      return damage;
    });
    expect(results[0]).toBe(results[1]);
  }
});

test('structures and zero-chance attacks consume no critical random draw', () => {
  const { w, target } = setup();
  target.kind = 'turret';
  const seed = w.random.state;
  release(w);
  expect(w.random.state).toBe(seed);
  expect(w.projectiles[0].critical).toBeUndefined();
  expect(w.projectiles[0].damage).toBe(w.hero.damage);
  const zero = new World(false);
  zero.nextWaveTick = Infinity;
  const dummy = zero.spawn('dummy', 'red', { x: zero.hero.x + 300, y: zero.hero.y });
  zero.setOrder(zero.hero, { type: 'attack', target: dummy.id });
  const state = zero.random.state;
  release(zero);
  expect(zero.random.state).toBe(state);
});

test('snapshot rejects invalid critical metadata', () => {
  const { w } = setup();
  release(w);
  for (const invalid of [false, 1, 'true']) {
    const saved = JSON.parse(w.snapshot());
    saved.projectiles[0].critical = invalid;
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  const saved = JSON.parse(w.snapshot());
  saved.projectiles[0].type = 'volley';
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
