import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { SUMMONER_SMITE as S } from '../src/content/summoner-smite';
import { MONSTERS, type MonsterSpecies } from '../src/content/monsters';
import { equipSummoners, smiteTarget } from '../src/simulation/smite';
import { instantSpell, targetedSpell, spellTarget } from '../src/input/spell-controls';
import type { SummonerSlot } from '../src/content/summoners';
import type { Unit } from '../src/simulation/types';
function setup(slot: SummonerSlot = 'f') {
  const w = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      findPath: (_a, b) => [{ ...b }],
      reachable: (p) => ({ ...p }),
      lineOfSight: () => true,
      lineWalkable: () => true,
    },
    'lux'
  );
  w.nextWaveTick = 1_000_000_000;
  Object.assign(w.hero, { x: 0, y: 0 });
  equipSummoners(w.player, slot === 'f' ? { d: 'flash', f: 'smite' } : { d: 'smite', f: 'heal' });
  return w;
}
function monster(w: World, species: MonsterSpecies = 'gromp') {
  const u = w.spawnMonster({ x: 150, y: 0 }, undefined, species);
  u.stunUntil = 100000;
  return u;
}
function cast(w: World, target?: Unit, slot: SummonerSlot = 'f') {
  w.enqueue({
    type: 'cast',
    unit: w.hero.id,
    ability: slot,
    point: target ?? w.hero,
    ...(target ? { targetId: target.id } : {}),
  });
  w.step();
}

test('base Smite accepts source large/medium tags and rejects small monsters without consuming a charge', () => {
  for (const species of Object.keys(MONSTERS) as MonsterSpecies[]) {
    const w = setup(),
      u = monster(w, species),
      hp = u.hp;
    const allowed = [
      'gromp',
      'blue',
      'red',
      'wolf',
      'raptor',
      'krug',
      'krug-medium',
      'scuttler',
    ].includes(species);
    expect(smiteTarget(w, w.hero, u), species).toBe(allowed);
    cast(w, u);
    expect(u.hp, species).toBe(allowed ? Math.max(0, hp - 600) : hp);
    expect(w.player.smite!.charges, species).toBe(allowed ? 0 : 1);
    expect(w.player.cooldowns.f, species).toBe(allowed ? w.tick + 900 : 0);
  }
});

test('base damage remains 600 at every tested champion level and ignores target resistances', () => {
  for (const level of [1, 10, 18]) {
    const w = setup(),
      u = monster(w);
    w.player.level = level;
    u.armor = u.magicResist = 9999;
    const hp = u.hp;
    cast(w, u);
    expect(hp - u.hp).toBe(600);
  }
});

test('Smite in either slot uses targeted controls, instant true damage and an independent cooldown', () => {
  for (const slot of ['d', 'f'] as const) {
    const w = setup(slot),
      u = monster(w),
      hp = u.hp;
    expect(instantSpell(w, slot)).toBe(false);
    expect(targetedSpell(w, slot)).toBe(true);
    expect(spellTarget(w, slot, u)?.id).toBe(u.id);
    cast(w, u, slot);
    expect(hp - u.hp).toBe(600);
    expect(w.player.cooldowns[slot]).toBe(w.tick + 900);
    expect(w.player.cooldowns[slot === 'd' ? 'f' : 'd']).toBe(0);
    expect(w.hero.mana).toBe(w.hero.maxMana);
  }
});

test('invalid, hidden, protected, returning, missing and out-of-range targets do not spend Smite', () => {
  for (const reason of [
    'champion',
    'ally',
    'structure',
    'dummy',
    'hidden',
    'protected',
    'returning',
    'far',
    'missing',
    'dead',
  ]) {
    const w = setup();
    let u: Unit = monster(w);
    if (reason === 'champion') u = w.spawn('champion', 'red', { x: 100, y: 0 });
    if (reason === 'ally') u = w.spawn('melee', 'blue', { x: 100, y: 0 });
    if (reason === 'structure') u = w.spawn('turret', 'red', { x: 100, y: 0 });
    if (reason === 'dummy') u = w.spawn('dummy', 'red', { x: 100, y: 0 });
    if (reason === 'hidden') w.battlefield.lineOfSight = () => false;
    if (reason === 'protected') {
      u.monster!.phase = 'spawning';
      u.monster!.spawn = { startTick: 0, readyTick: 52, clip: 'spawn' };
    }
    if (reason === 'returning') u.monster!.phase = 'returning';
    if (reason === 'far') u.x = 2000;
    if (reason === 'dead') {
      u.hp = 0;
      u.deadAt = 0;
    }
    cast(w, reason === 'missing' ? undefined : u);
    expect(w.player.smite!.charges, reason).toBe(1);
    expect(w.player.cooldowns.f, reason).toBe(0);
  }
});

test('targeted range uses both bounding radii and shared team sight without requiring a direct caster sight line', () => {
  const w = setup(),
    u = monster(w);
  u.x = S.range + w.hero.radius + u.radius;
  expect(smiteTarget(w, w.hero, u)).toBe(true);
  u.x += 0.001;
  expect(smiteTarget(w, w.hero, u)).toBe(false);
  u.x = 400;
  const ally = w.spawn('champion', 'blue', { x: 450, y: 0 });
  w.battlefield.lineOfSight = (a) => a.x === ally.x;
  expect(smiteTarget(w, w.hero, u)).toBe(true);
});

test('enemy lane minions grant normal last-hit rewards without healing or consuming Illumination', () => {
  const w = setup(),
    u = w.spawn('melee', 'red', { x: 150, y: 0 });
  u.ai = false;
  u.hp = 500;
  u.illumination = [{ sourceId: w.hero.id, endTick: 600 }];
  w.player.inventory = ['blade'];
  w.hero.hp = 100;
  const gold = w.player.gold;
  cast(w, u);
  expect(u.hp).toBe(0);
  expect(w.player.cs).toBe(1);
  expect(w.player.gold).toBeGreaterThan(gold);
  expect(w.events.some((e) => e.type === 'heal')).toBe(false);
  expect(w.events.filter((e) => e.type === 'damage').map((e) => e.value)).toContain(600);
});

test('Smite is allowed during root, stun, silence and recall without removing control or cancelling the channel', () => {
  const w = setup(),
    u = monster(w);
  w.hero.rootUntil = w.hero.stunUntil = w.hero.silenceUntil = 200;
  w.player.recallEnd = 480;
  cast(w, u);
  expect(w.player.smite!.charges).toBe(0);
  expect(w.player.recallEnd).toBe(480);
  expect(w.hero.stunUntil).toBe(200);
});

test('recharge is separate from cast lockout, sequential, saved, capped and continues through death', () => {
  const w = setup(),
    u = monster(w);
  const ready = w.player.smite!.rechargeTick!;
  cast(w, u);
  const hp = u.hp;
  cast(w, u);
  expect(u.hp).toBe(hp);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, copy]) {
    world.tick = ready - 1;
    world.enqueue({ type: 'cast', unit: world.hero.id, ability: 'f', point: u, targetId: u.id });
    world.step();
    expect(world.player.smite!.charges).toBe(0);
    expect(world.player.smite!.rechargeTick).toBe(ready + 5400);
  }
  expect(copy.snapshot()).toBe(w.snapshot());
  w.hero.hp = 0;
  w.hero.deadAt = w.tick;
  w.hero.respawnTick = w.tick + 12000;
  w.tick = ready + 5400 - 1;
  w.step();
  expect(w.player.smite!.charges).toBe(1);
  w.tick = ready + 10800 - 1;
  w.step();
  expect(w.player.smite!.charges).toBe(2);
  expect(w.player.smite!.rechargeTick).toBeNull();
});

test('queued Smite target IDs resume exactly and malformed loadouts/charge clocks are rejected', () => {
  const w = setup(),
    u = monster(w);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: u, targetId: u.id });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  copy.step();
  expect(copy.snapshot()).toBe(w.snapshot());
  for (const mutate of [
    (s: any) => (s.player.summoners.d = 'smite'),
    (s: any) => (s.player.smite = null),
    (s: any) => (s.player.smite.charges = 3),
    (s: any) => (s.player.smite.rechargeTick = null),
    (s: any) => (s.player.smite.rechargeTick = s.tick),
    (s: any) => (s.player.smite.rechargeTick = s.tick + 5401),
  ]) {
    const s = JSON.parse(w.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

test('swapped Flash and Heal retain their own legality, effects and cooldowns', () => {
  const w = setup();
  equipSummoners(w.player, { d: 'heal', f: 'flash' });
  w.hero.hp = 100;
  expect(instantSpell(w, 'd')).toBe(true);
  expect(instantSpell(w, 'f')).toBe(false);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: w.hero });
  w.step();
  expect(w.player.cooldowns.d).toBe(w.tick + 14400);
  const x = w.hero.x;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: { x: x + 300, y: 0 } });
  w.step();
  expect(w.hero.x).toBe(x + 300);
  expect(w.player.cooldowns.f).toBe(w.tick + 18000);
});

test('Smite and swapped Flash preserve Final Spark commitment and exact saved continuation', () => {
  for (const spell of ['flash', 'smite'] as const) {
    const w = setup(),
      u = monster(w);
    equipSummoners(w.player, { d: 'heal', f: spell });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: { x: 1000, y: 0 } });
    w.step();
    const deadline = w.player.pendingCast!.releaseTick;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'f',
      point: { x: 300, y: 0 },
      ...(spell === 'smite' ? { targetId: u.id } : {}),
    });
    w.step();
    expect(w.player.pendingCast!.releaseTick).toBe(deadline);
    expect(w.player.castAnimation?.ability).toBe('r');
    if (spell === 'smite') expect(w.player.smite!.charges).toBe(0);
    else expect(w.hero.x).toBe(300);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(90);
    copy.step(90);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
