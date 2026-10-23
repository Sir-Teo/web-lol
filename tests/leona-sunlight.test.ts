import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { grantBlueBuff } from '../src/simulation/blue-buff';
import { MONSTERS } from '../src/content/monsters';

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
  const ally = w.spawn('champion', 'blue', { x: -200, y: 0 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.armor = target.magicResist = 0;
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  const mark = () => expect(w.applySunlight(leona, target)).toBe(true);
  return { w, leona, ally, target, mark, restore };
}

test('Q applies and refreshes a source-duration Sunlight mark, while ordinary self attacks cannot consume it', () => {
  const f = setup();
  f.w.learnSpell('q', f.leona.id);
  f.w.setOrder(f.leona, { type: 'attack', target: f.target.id });
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: f.target });
  f.w.step();
  f.w.step(f.leona.releaseTick! - f.w.tick);
  expect(f.target.sunlight).toEqual({
    sourceId: f.leona.id,
    startTick: f.w.tick,
    endTick: f.w.tick + 150,
  });
  expect(f.target.hp).toBe(1430);
  f.w.setOrder(f.leona, { type: 'idle' });
  f.w.damage(f.leona, f.target, 10, 'physical');
  expect(f.target.hp).toBe(1420);
  expect(f.target.sunlight).not.toBeNull();
  f.w.step(5);
  f.mark();
  expect(f.target.sunlight?.startTick).toBe(21);
  expect(f.target.sunlight?.endTick).toBe(171);
  expect(() => f.restore()).not.toThrow();
});

test('allied damage consumes exactly once, preserves source ownership and uses magic resistance', () => {
  const f = setup();
  f.target.magicResist = 100;
  const id = f.w.nextId;
  f.mark();
  expect(f.w.nextId).toBe(id);
  const random = f.w.random.state;
  f.w.damage(f.ally, f.target, 2, 'physical');
  expect(f.target.hp).toBe(1500 - 2 - 16);
  expect(f.target.sunlight).toBeNull();
  f.w.damage(f.ally, f.target, 2, 'physical');
  expect(f.target.hp).toBe(1480);
  expect(f.w.nextId - id).toBe(3); // Two ordinary hits and one bonus damage event.
  expect(f.w.projectiles).toEqual([]);
  expect(f.w.random.state).toBe(random);
  expect(() => f.restore()).not.toThrow();
});

test('real allied basic projectile release consumes the mark and produces identical restored futures', () => {
  const f = setup();
  f.mark();
  f.w.setOrder(f.ally, { type: 'attack', target: f.target.id });
  f.w.step();
  const copy = f.restore();
  f.w.step(45);
  copy.step(45);
  expect(f.target.hp).toBe(1500 - 54 - 32);
  expect(f.target.sunlight).toBeNull();
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('Sunlight expires at its deadline before commands, and samples current caster level when triggered', () => {
  const f = setup();
  f.mark();
  f.w.step(149);
  expect(f.target.sunlight?.endTick).toBe(150);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(f.target.sunlight).toBeNull();
  expect(copy.snapshot()).toBe(f.w.snapshot());
  f.w.damage(f.ally, f.target, 1, 'physical');
  expect(f.target.hp).toBe(1499);
  f.mark();
  f.w.gainExperience(1e6, f.leona.id);
  f.w.damage(f.ally, f.target, 1, 'physical');
  expect(f.target.hp).toBe(1347); // 1 + level-18 151.
});

test('positive shield absorption triggers the mark; zero, cleanup and non-champion damage do not', () => {
  const f = setup();
  const victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.armor = victim.magicResist = 0;
  f.w.applySunlight(f.leona, victim);
  f.w.applyShield(victim, victim, 1000, 300);
  const hp = victim.hp;
  f.w.damage(f.ally, victim, 1, 'physical');
  expect(victim.hp).toBe(hp);
  expect(f.w.shieldAmount(victim)).toBe(967);
  expect(victim.sunlight).toBeNull();
  f.mark();
  f.w.damage(f.ally, f.target, 0, 'magic');
  expect(f.target.sunlight).not.toBeNull();
  f.w.damage(f.ally, f.target, 1, 'magic', 'cleanup');
  expect(f.target.sunlight).not.toBeNull();
  const minion = f.w.spawn('melee', 'blue', { x: 0, y: 0 });
  f.w.damage(minion, f.target, 1, 'physical');
  expect(f.target.sunlight).not.toBeNull();
  const enemy = f.w.spawn('champion', 'red', { x: 200, y: 0 }, 'lux');
  f.w.damage(enemy, f.target, 1, 'magic');
  expect(f.target.sunlight).not.toBeNull();
});

test('lethal Sunlight credits the triggering ally while Leona receives damage participation and an assist', () => {
  const f = setup(),
    victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.hp = 20;
  victim.armor = victim.magicResist = 0;
  const a = f.w.championState(f.ally.id)!,
    l = f.w.championState(f.leona.id)!,
    gold = a.gold;
  grantBlueBuff(f.w.championState(victim.id)!, f.w.tick);
  f.w.applySunlight(f.leona, victim);
  f.w.damage(f.ally, victim, 1, 'physical');
  expect(victim.deadAt).toBe(0);
  expect(a.kills).toBe(1);
  expect(a.gold - gold).toBe(400);
  expect(l.kills).toBe(0);
  expect(l.gold).toBe(500);
  expect(l.assists).toBe(1);
  expect(a.blueBuff).not.toBeNull();
  expect(l.blueBuff).toBeNull();
  expect(f.w.championState(victim.id)!.damageContributors).toEqual([
    { sourceId: f.ally.id, lastDamageTick: 0 },
    { sourceId: f.leona.id, lastDamageTick: 0, creditSourceId: f.ally.id },
  ]);
  expect(() => f.restore()).not.toThrow();
});

test('caster-side omnivamp belongs to Leona rather than the triggering ally', () => {
  const f = setup(),
    victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.armor = victim.magicResist = 0;
  f.w.championState(f.leona.id)!.inventory.push('blade');
  f.w.championState(f.ally.id)!.inventory.push('blade');
  f.leona.hp -= 100;
  f.ally.hp -= 100;
  const l = f.leona.hp,
    a = f.ally.hp;
  f.w.applySunlight(f.leona, victim);
  f.w.damage(f.ally, victim, 1, 'physical');
  expect(f.leona.hp - l).toBeCloseTo(0.8, 6);
  expect(f.ally.hp - a).toBeCloseTo(0.025, 6);
});

test('delegated credit survives a nonlethal proc, checkpoint and later turret execution', () => {
  const f = setup(),
    victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.armor = victim.magicResist = 0;
  f.w.applySunlight(f.leona, victim);
  f.w.damage(f.ally, victim, 1, 'physical');
  const turret = f.w.spawn('turret', 'blue', { x: 300, y: 0 });
  const copy = f.restore();
  for (const world of [f.w, copy])
    world.damage(world.unit(turret.id)!, world.unit(victim.id)!, 1e6, 'true');
  expect(f.w.championState(f.ally.id)!.kills).toBe(1);
  expect(f.w.championState(f.leona.id)!.kills).toBe(0);
  expect(f.w.championState(f.leona.id)!.assists).toBe(1);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('Sunlight remains usable after caster death but clears on target death, reset and victory', () => {
  const f = setup();
  f.mark();
  f.w.damage(f.ally, f.leona, 1e6, 'true');
  expect(f.target.sunlight).not.toBeNull();
  const copy = f.restore();
  for (const world of [f.w, copy])
    world.damage(world.unit(f.ally.id)!, world.unit(f.target.id)!, 1, 'physical');
  expect(f.target.hp).toBe(1467);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  const end = setup();
  end.mark();
  end.w.damage(end.ally, end.target, 1e6, 'true');
  expect(end.target.sunlight).toBeNull();
  const monster = end.w.spawnMonster({ x: 100, y: 0 });
  end.w.applySunlight(end.leona, monster);
  monster.monster.phase = 'returning';
  end.w.step();
  expect(monster.sunlight).toBeNull();
  const terminal = setup();
  terminal.mark();
  const nexus = terminal.w.spawn('nexus', 'red', { x: 400, y: 0 });
  terminal.w.damage(terminal.ally, nexus, 1e6, 'true');
  expect(terminal.target.sunlight).toBeNull();
  const saved = terminal.w.snapshot();
  terminal.w.step(150);
  expect(terminal.w.snapshot()).toBe(saved);
  expect(() => terminal.restore()).not.toThrow();
});

test('one local mark refreshes or replaces ownership, and an allied Leona can consume another caster mark', () => {
  const f = setup();
  const other = f.w.spawn('champion', 'blue', { x: -100, y: 0 }, 'leona');
  f.mark();
  expect(f.w.applySunlight(other, f.target)).toBe(true);
  expect(f.target.sunlight?.sourceId).toBe(other.id);
  f.w.damage(other, f.target, 1, 'physical');
  expect(f.target.hp).toBe(1499);
  expect(f.target.sunlight).not.toBeNull();
  f.w.damage(f.leona, f.target, 1, 'physical');
  expect(f.target.hp).toBe(1466);
  expect(f.target.sunlight).toBeNull();
});

test('marks and delegation reject invalid saved ownership, deadlines and wrong-team credit', () => {
  const f = setup();
  f.mark();
  const raw = JSON.parse(f.w.snapshot());
  const forge = (mutate: (saved: typeof raw) => void) => {
    const saved = structuredClone(raw);
    mutate(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
  };
  forge((s) => s.units.find((u: any) => u.id === f.target.id).sunlight.endTick++);
  forge((s) => (s.units.find((u: any) => u.id === f.target.id).sunlight.startTick = 1));
  forge((s) => (s.units.find((u: any) => u.id === f.target.id).sunlight.sourceId = f.ally.id));
  const tower = f.w.spawn('turret', 'red', { x: 400, y: 0 });
  expect(f.w.applySunlight(f.leona, tower)).toBe(false);
  expect(f.w.applySunlight(f.ally, f.target)).toBe(false);
  expect(f.w.applySunlight(f.leona, f.ally)).toBe(false);
  const victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.armor = victim.magicResist = 0;
  f.w.applySunlight(f.leona, victim);
  f.w.damage(f.ally, victim, 1, 'physical');
  const credited = JSON.parse(f.w.snapshot());
  const owner = credited.otherChampions.find((o: any) => o.id === victim.id);
  owner.damageContributors.find((c: any) => c.sourceId === f.leona.id).creditSourceId = victim.id;
  expect(() => World.fromSnapshot(JSON.stringify(credited), f.w.battlefield)).toThrow(
    /damage contributions/
  );
});

test('minion and monster last-hit rewards belong to the triggering ally', () => {
  for (const species of ['minion', 'gromp'] as const) {
    const f = setup();
    const target =
      species === 'minion'
        ? f.w.spawn('melee', 'red', { x: 150, y: 0 })
        : f.w.spawnMonster({ x: 150, y: 0 });
    target.hp = 20;
    target.armor = target.magicResist = 0;
    const a = f.w.championState(f.ally.id)!,
      l = f.w.championState(f.leona.id)!;
    const before = a.gold;
    expect(f.w.applySunlight(f.leona, target)).toBe(true);
    f.w.damage(f.ally, target, 1, 'physical');
    expect(target.deadAt).toBe(0);
    expect(a.gold).toBeGreaterThan(before);
    expect(a.cs).toBe(species === 'minion' ? 1 : MONSTERS.gromp.minionScore);
    expect(l.cs).toBe(0);
    expect(l.gold).toBe(500);
    expect(() => f.restore()).not.toThrow();
  }
});

test('ordinary damage replaces old delegation, and an invalid credit override changes nothing', () => {
  const f = setup(),
    victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.armor = victim.magicResist = 0;
  f.w.applySunlight(f.leona, victim);
  f.w.damage(f.ally, victim, 1, 'physical');
  f.w.damage(f.leona, victim, 1, 'magic');
  expect(f.w.championState(victim.id)!.damageContributors.at(-1)).toEqual({
    sourceId: f.leona.id,
    lastDamageTick: 0,
  });
  const hp = victim.hp;
  f.w.damage(f.ally, victim, 1000, 'magic', 'proc', f.leona); // Only Sunlight can delegate.
  f.w.damage(f.leona, victim, 1000, 'magic', 'proc', victim); // Opposing credit is invalid.
  expect(victim.hp).toBe(hp);
  const turret = f.w.spawn('turret', 'blue', { x: 300, y: 0 });
  f.w.damage(turret, victim, 1e6, 'true');
  expect(f.w.championState(f.leona.id)!.kills).toBe(1);
  expect(f.w.championState(f.ally.id)!.assists).toBe(1);
});

test('posthumous Sunlight keeps a neutral monster engaged with a living attacker', () => {
  const f = setup(),
    monster = f.w.spawnMonster({ x: 150, y: 0 });
  monster.armor = monster.magicResist = 0;
  f.w.applySunlight(f.leona, monster);
  f.w.damage(f.ally, f.leona, 1e6, 'true');
  f.w.damage(f.ally, monster, 1, 'physical');
  expect(monster.monster.targetId).toBe(f.ally.id);
  f.w.damage(f.leona, monster, 1, 'magic', 'proc');
  expect(monster.monster.targetId).toBe(f.ally.id);
  const copy = f.restore();
  f.w.step(10);
  copy.step(10);
  expect(monster.monster.phase).toBe('engaged');
  expect(monster.monster.targetId).toBe(f.ally.id);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('a dead source cannot leave a freshly damaged idle monster without a target or recovery', () => {
  const f = setup(),
    monster = f.w.spawnMonster({ x: 150, y: 0 });
  f.w.damage(f.ally, f.leona, 1e6, 'true');
  f.w.damage(f.leona, monster, 10, 'magic', 'proc');
  expect(monster.monster.phase).toBe('returning');
  expect(monster.monster.targetId).toBeNull();
  expect(monster.order).toEqual({ type: 'move', point: monster.monster.home });
  const copy = f.restore();
  f.w.step(60);
  copy.step(60);
  expect(monster.monster.phase).toBe('idle');
  expect(monster.hp).toBe(monster.maxHp);
  expect(monster.order.type).toBe('idle');
  expect(copy.snapshot()).toBe(f.w.snapshot());
});
