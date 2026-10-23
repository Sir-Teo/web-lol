import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_COMBAT_POLICY as POLICY } from '../src/content/leona-combat-policy';
import { leonaEclipseValues } from '../src/simulation/leona-spell-values';
import { experienceToNextLevel } from '../src/simulation/progression';
import { requestWard } from '../src/simulation/wards';
import { companionDps } from '../src/simulation/owned-companions';
import { GAREN_E } from '../src/content/garen-e';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  const state = w.championState(leona.id)!;
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.magicResist = 0;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: leona.id, ability: 'w', point: leona });
    w.step();
  };
  const learn = () => expect(w.learnSpell('w', leona.id)).toBeNull();
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, leona, state, target, cast, learn, restore };
}

test('Eclipse validates resources and controls, starts a hasted cooldown and preserves roots', () => {
  const f = setup();
  f.cast();
  expect(f.state.leonaW).toBeNull();
  f.learn();
  f.leona.mana = 59;
  f.cast();
  expect(f.state.leonaW).toBeNull();
  f.leona.mana = 302;
  f.leona.stunUntil = f.w.tick + 3;
  f.cast();
  expect(f.state.leonaW).toBeNull();
  f.w.step(3);
  f.w.applySilence(f.leona, 3);
  f.cast();
  expect(f.state.leonaW).toBeNull();
  f.w.step(3);
  f.leona.rootUntil = f.w.tick + 90;
  f.state.inventory.push('chapter');
  f.state.recallEnd = f.w.tick + 480;
  const mana = f.leona.mana,
    root = f.leona.rootUntil;
  f.cast();
  expect(f.state.leonaW).toEqual({
    startTick: f.w.tick,
    rank: 1,
    detonationTick: f.w.tick + 180,
    endTick: f.w.tick + 180,
    detonated: false,
  });
  expect(f.state.cooldowns.w).toBe(f.w.tick + Math.ceil(((14 * 100) / 110) * 60));
  expect(f.leona.mana).toBeCloseTo(mana - 60 + 0.02, 6);
  expect(f.state.recallEnd).toBeNull();
  expect(f.leona.rootUntil).toBe(root);
  expect(f.state.pendingCast).toBeNull();
  const before = structuredClone(f.state.leonaW),
    cooldown = f.state.cooldowns.w;
  f.cast();
  expect(f.state.leonaW).toEqual(before);
  expect(f.state.cooldowns.w).toBe(cooldown);
  expect(() => f.restore()).not.toThrow();
});

test('instant local activation preserves ordinary and committed Daybreak attacks and their orders', () => {
  for (const empowered of [false, true]) {
    const f = setup();
    f.w.gainExperience(280, f.leona.id);
    f.learn();
    if (empowered) {
      f.w.learnSpell('q', f.leona.id);
      f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: f.target });
    }
    f.w.setOrder(f.leona, { type: 'attack', target: f.target.id });
    f.w.step();
    const release = f.leona.releaseTick,
      next = f.leona.nextAttackTick,
      cycle = structuredClone(f.leona.attackCycle),
      order = structuredClone(f.leona.order);
    f.cast();
    expect(f.leona.releaseTick).toBe(release);
    expect(f.leona.nextAttackTick).toBe(next);
    expect(f.leona.attackCycle).toEqual(cycle);
    expect(f.leona.order).toEqual(order);
    f.w.step(release! - f.w.tick);
    expect(f.target.hp).toBeLessThan(1500);
    expect(f.state.leonaW).not.toBeNull();
    expect(() => f.restore()).not.toThrow();
  }
});

test('resistances recompute from equipment and level without self scaling or stored-stat residue', () => {
  const f = setup();
  f.learn();
  f.cast();
  expect(f.w.effectiveArmor(f.leona)).toBe(63);
  expect(f.w.effectiveMagicResist(f.leona)).toBe(52);
  expect(f.leona.armor).toBe(43);
  expect(f.leona.magicResist).toBe(32);
  Object.assign(f.leona, f.w.battlefield.spawns.blue);
  f.state.gold = 5000;
  expect(f.w.buy('cloth', f.leona.id)).toBeNull();
  expect(f.w.buy('mantle', f.leona.id)).toBeNull();
  expect(f.w.effectiveArmor(f.leona)).toBe(81);
  expect(f.w.effectiveMagicResist(f.leona)).toBe(76);
  for (let i = 0; i < 20; i++) expect(f.w.effectiveArmor(f.leona)).toBe(81);
  const copy = f.restore();
  for (const w of [f.w, copy]) w.gainExperience(280, f.leona.id);
  expect(f.w.effectiveArmor(f.leona) - f.leona.armor).toBe(23);
  expect(f.w.effectiveMagicResist(f.leona) - f.leona.magicResist).toBe(24);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(f.w.sell(0, f.leona.id)).toBeNull();
  expect(f.w.sell(1, f.leona.id)).toBeNull();
  expect(f.w.effectiveArmor(f.leona) - f.leona.armor).toBe(20);
  const raw = { armor: f.leona.armor, magicResist: f.leona.magicResist };
  f.w.step(f.state.leonaW!.endTick - f.w.tick);
  expect(f.state.leonaW).toBeNull();
  expect(f.w.effectiveArmor(f.leona)).toBe(raw.armor);
  expect(f.w.effectiveMagicResist(f.leona)).toBe(raw.magicResist);
  expect(() => f.restore()).not.toThrow();
});

test('flat reduction precedes resistance and shields, is capped per instance and excludes true damage', () => {
  for (const kind of ['physical', 'magic', 'true'] as const) {
    for (const raw of [10, 100]) {
      const f = setup();
      f.learn();
      f.cast();
      const resistance = kind === 'physical' ? 63 : 52;
      const expected =
        kind === 'true' ? raw : ((raw - Math.min(8, raw / 2)) * 100) / (100 + resistance);
      f.w.applyShield(f.leona, f.leona, 3, 100);
      const hp = f.leona.hp;
      expect(f.w.mitigatedDamage(f.leona, raw, kind)).toBeCloseTo(expected, 8);
      f.w.damage(f.target, f.leona, raw, kind);
      expect(hp - f.leona.hp).toBeCloseTo(Math.max(0, expected - 3), 8);
      expect(f.w.shieldAmount(f.leona)).toBeCloseTo(Math.max(0, 3 - expected), 8);
      expect(() => f.restore()).not.toThrow();
    }
  }
});

test('armor shred applies to total Eclipse armor while companion scaling uses its unshredded bonus', () => {
  const f = setup();
  const base = companionDps(f.w, f.leona);
  f.learn();
  f.cast();
  expect(companionDps(f.w, f.leona) - base).toBe(10);
  const garen = f.w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  f.leona.garenEShreds.push({ sourceId: garen.id, startTick: f.w.tick, endTick: f.w.tick + 360 });
  expect(f.w.effectiveArmor(f.leona)).toBeCloseTo(63 * (1 - GAREN_E.armorReduction), 8);
  expect(f.w.armorWithBuffs(f.leona)).toBe(63);
  expect(companionDps(f.w, f.leona) - base).toBe(10);
});

test('one burst lands on its deadline, marks survivors and extends both defenses exactly once', () => {
  const f = setup();
  f.learn();
  f.cast();
  const end = f.state.leonaW!.detonationTick;
  f.w.step(end - f.w.tick - 1);
  expect(f.target.hp).toBe(1500);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(f.target.hp).toBe(1445);
  expect(f.target.sunlight).toEqual({ sourceId: f.leona.id, startTick: end, endTick: end + 150 });
  expect(f.state.leonaW).toMatchObject({ detonated: true, endTick: end + 180 });
  expect(f.w.snapshot()).toBe(copy.snapshot());
  expect(f.w.mitigatedDamage(f.leona, 10, 'magic')).toBeCloseTo((5 * 100) / 152, 8);
  f.w.step(179);
  copy.step(179);
  expect(f.state.leonaW).not.toBeNull();
  expect(f.target.hp).toBe(1445);
  const extended = f.restore();
  f.w.step();
  copy.step();
  extended.step();
  expect(f.state.leonaW).toBeNull();
  expect(f.w.effectiveArmor(f.leona)).toBe(43);
  expect(f.w.snapshot()).toBe(copy.snapshot());
  expect(extended.snapshot()).toBe(f.w.snapshot());
  expect(f.w.projectiles).toEqual([]);
});

test('a miss expires with no extension or repeat and allocates no gameplay entity or RNG', () => {
  const f = setup();
  f.target.x = 1000;
  f.learn();
  f.cast();
  const id = f.w.nextId,
    random = f.w.random.state;
  const copy = f.restore();
  f.w.step(180);
  copy.step(180);
  expect(f.state.leonaW).toBeNull();
  expect(f.target.hp).toBe(1500);
  expect(f.w.nextId).toBe(id);
  expect(f.w.random.state).toBe(random);
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('burst uses captured rank and current AP, including a shielded hit and lethal minion', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.w.gainExperience(10000, f.leona.id);
  f.w.learnSpell('w', f.leona.id);
  f.state.inventory.push('tome');
  const victim = f.w.spawn('champion', 'red', { x: 0, y: 100 }, 'lux');
  victim.magicResist = 0;
  f.w.applyShield(victim, victim, 1000, 500);
  const minion = f.w.spawn('melee', 'red', { x: 0, y: 200 });
  minion.hp = 1;
  const expected = leonaEclipseValues(1, f.w.abilityPower(f.leona), 0, 0).magicDamage;
  f.w.step(f.state.leonaW!.detonationTick - f.w.tick);
  expect(f.target.hp).toBeCloseTo(1500 - expected, 6);
  expect(f.w.shieldAmount(victim)).toBeCloseTo(1000 - expected, 6);
  expect(victim.sunlight).not.toBeNull();
  expect(minion.deadAt).toBe(f.w.tick);
  expect(minion.sunlight).toBeNull();
  expect(f.state.cs).toBe(1);
  expect(f.state.leonaW?.rank).toBe(1);
  expect(f.state.leonaW?.detonated).toBe(true);
  expect(f.w.effectiveArmor(f.leona) - f.leona.armor).toBeCloseTo(20, 6);
  expect(() => f.restore()).not.toThrow();
});

test('local collision includes edge overlap and unseen enemies but excludes structures, wards and returning monsters', () => {
  const f = setup();
  f.target.x = POLICY.eclipseRadius + f.target.radius;
  const outside = f.w.spawn('dummy', 'red', { x: f.target.x + 0.001, y: 0 });
  const ally = f.w.spawn('dummy', 'blue', { x: 0, y: 0 });
  const tower = f.w.spawn('turret', 'red', { x: 0, y: 0 });
  const monster = f.w.spawnMonster({ x: 100, y: 0 });
  // Keep recovery active past the burst without exposing an invalid snapshot.
  monster.monster.phase = 'returning';
  monster.monster.home.x = 3000;
  monster.speed = 0;
  f.learn();
  f.cast();
  const enemy = f.w.spawn('champion', 'red', { x: 1000, y: 0 }, 'lux');
  Object.assign(enemy, { x: 0, y: 0 });
  expect(requestWard(f.w, enemy, { x: 0, y: 0 })).toBeNull();
  enemy.x = 1000;
  f.w.step(20);
  const ward = f.w.units.find((u) => u.kind === 'ward')!;
  expect(ward).toBeDefined();
  const unchanged = [outside, ally, tower, monster, ward].map((u) => u.hp);
  f.w.battlefield.lineOfSight = () => false;
  expect(f.w.visible(f.target, 'blue')).toBe(false);
  f.w.step(f.state.leonaW!.detonationTick - f.w.tick);
  expect(f.target.hp).toBe(1445);
  expect([outside, ally, tower, monster, ward].map((u) => u.hp)).toEqual(unchanged);
  expect(monster.sunlight).toBeNull();
});

test('post-cast crowd control cannot cancel the burst and its origin follows Flash', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.target.x = 900;
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 400, y: 0 } });
  f.w.step();
  expect(f.leona.x).toBe(400);
  f.leona.stunUntil = f.w.tick + 200;
  f.leona.silenceUntil = f.w.tick + 200;
  f.target.x = f.leona.x + POLICY.eclipseRadius;
  const copy = f.restore();
  f.w.step(f.state.leonaW!.detonationTick - f.w.tick);
  copy.step(f.w.tick - copy.tick);
  expect(f.target.hp).toBe(1445);
  expect(f.w.snapshot()).toBe(copy.snapshot());
});

test('death cancels an unburst Eclipse and victory clears active defenses for every owner', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.w.damage(f.target, f.leona, 1e6, 'true');
  expect(f.state.leonaW).toBeNull();
  const copy = f.restore();
  f.w.step(181);
  copy.step(181);
  expect(f.target.hp).toBe(1500);
  expect(f.w.snapshot()).toBe(copy.snapshot());
  const end = setup();
  end.learn();
  end.cast();
  const nexus = end.w.spawn('nexus', 'red', { x: 1000, y: 0 });
  end.w.damage(end.leona, nexus, 1e6, 'true');
  expect(end.state.leonaW).toBeNull();
  expect(end.w.effectiveArmor(end.leona)).toBe(43);
  const saved = end.w.snapshot();
  end.w.step(500);
  expect(end.w.snapshot()).toBe(saved);
  expect(() => end.restore()).not.toThrow();
});

test('strict snapshots reject foreign, dead, unlearned and inconsistent Eclipse clocks in either phase', () => {
  const f = setup();
  f.learn();
  f.cast();
  const forge = (change: (s: any, o: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      o = s.otherChampions.find((o: any) => o.id === f.leona.id);
    change(s, o);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((_s, o) => o.leonaW.detonationTick++);
  forge((_s, o) => o.leonaW.endTick++);
  forge((_s, o) => o.leonaW.startTick++);
  forge((_s, o) => (o.leonaW.detonated = true));
  forge((_s, o) => (o.spellRanks.w = 0));
  forge((s, o) => {
    s.player.leonaW = o.leonaW;
    o.leonaW = null;
  });
  const captured = structuredClone(f.state.leonaW);
  f.w.step(180);
  forge((_s, o) => (o.leonaW.detonated = false));
  forge((_s, o) => o.leonaW.endTick++);
  f.w.damage(f.target, f.leona, 1e6, 'true');
  forge((_s, o) => (o.leonaW = captured));
  expect(() => f.restore()).not.toThrow();
});

test('growth at every playable level contributes no phantom Eclipse bonus resistance', () => {
  const f = setup();
  f.learn();
  f.cast();
  for (let level = 1; level <= 18; level++) {
    if (level > 1) f.w.gainExperience(experienceToNextLevel(level - 1), f.leona.id);
    expect(f.state.level).toBe(level);
    expect(f.w.effectiveArmor(f.leona) - f.leona.armor).toBeCloseTo(20, 10);
    expect(f.w.effectiveMagicResist(f.leona) - f.leona.magicResist).toBeCloseTo(20, 10);
    expect(() => f.restore()).not.toThrow();
  }
});

test('burst resolves before commands on its deadline and does not interrupt the following Flash', () => {
  const f = setup();
  f.learn();
  f.cast();
  f.target.x = 850;
  f.w.step(f.state.leonaW!.detonationTick - f.w.tick - 1);
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'd', point: { x: 400, y: 0 } });
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(f.leona.x).toBe(400);
  expect(f.target.hp).toBe(1500); // It was outside the burst before Flash.
  expect(f.state.leonaW).toBeNull();
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('a real neutral hit gains aggro and Sunlight while preserving restored retaliation futures', () => {
  const f = setup();
  f.target.x = 1000;
  const monster = f.w.spawnMonster({ x: 100, y: 0 });
  f.learn();
  f.cast();
  f.w.step(179);
  const before = f.restore(),
    hp = monster.hp;
  f.w.step();
  before.step();
  expect(monster.hp).toBeLessThan(hp);
  expect(monster.monster.phase).toBe('engaged');
  expect(monster.monster.targetId).toBe(f.leona.id);
  expect(monster.sunlight?.sourceId).toBe(f.leona.id);
  expect(before.snapshot()).toBe(f.w.snapshot());
  const after = f.restore();
  f.w.step(90);
  before.step(90);
  after.step(90);
  expect(before.snapshot()).toBe(f.w.snapshot());
  expect(after.snapshot()).toBe(f.w.snapshot());
});
