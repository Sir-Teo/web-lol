import { expect, test } from 'vitest';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { equipSummoners, smiteTarget } from '../src/simulation/smite';
import { grantCompanion, companionDps, companionHps } from '../src/simulation/owned-companions';
import {
  COMPANION_POLICY as P,
  companionSmiteDamage,
  type CompanionKind,
} from '../src/content/companion-policy';
import { growthAtLevel } from '../src/simulation/progression';
import type { Unit } from '../src/simulation/types';
function setup(kind: CompanionKind = 'gustwalker') {
  const w = createGrompEncounter(
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      reachable: (p) => ({ ...p }),
      findPath: (_a, b) => [{ ...b }],
      lineWalkable: () => true,
      lineOfSight: () => true,
    },
    'lux'
  );
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  const p = grantCompanion(w, kind),
    u = w.units.find((u) => u.kind === 'monster')!;
  u.stunUntil = 1_000_000;
  return { w, p, u };
}
function kill(w: World, species: 'gromp' | 'wolf-mini' | 'krug-medium' = 'gromp') {
  const u = w.spawnMonster({ x: 300, y: 0 }, undefined, species);
  w.damage(w.hero, u, 999999, 'true');
  return u;
}
function smite(w: World, u: Unit) {
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: u, targetId: u.id });
  w.step();
}

test('owned companions are restricted to Smite-equipped controlled encounters and never become neutral units', () => {
  const { w, p } = setup();
  expect(() => grantCompanion(w, 'scorchclaw')).toThrow();
  expect(w.units.some((u) => u.id === p.ownerId && u.kind === 'monster')).toBe(false);
  expect(w.companions).toHaveLength(1);
  expect(w.companions[0].fed).toBe(0);
  const other = new World(false);
  expect(() => grantCompanion(other, 'gustwalker')).toThrow();
  const g = createGrompEncounter(PRACTICE_FIXTURE);
  expect(() => grantCompanion(g, 'gustwalker')).toThrow();
});
test('all three variants follow movement and restore exact position, pose and path clocks', () => {
  for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const) {
    const { w, p } = setup(kind);
    w.step(240);
    w.enqueue({
      type: 'order',
      unit: w.hero.id,
      order: { type: 'move', point: { x: 1200, y: 300 } },
    });
    w.step(120);
    expect(Math.hypot(p.x - w.hero.x, p.y - w.hero.y)).toBeLessThan(200);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(240);
    copy.step(240);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('pet DPS incorporates bonus AD/AP/HP/armor/MR while HPS keeps the source breakpoint', () => {
  const { w } = setup(),
    u = w.hero;
  expect(companionDps(w, u)).toBe(20);
  expect(companionHps(1)).toBe(6);
  expect(companionHps(3)).toBe(6);
  expect(companionHps(4)).toBe(8);
  expect(companionHps(18)).toBe(36);
  u.damage += 10;
  u.maxHp += 100;
  u.armor += 20;
  u.magicResist += 10;
  w.player.inventory = ['wand'];
  expect(companionDps(w, u)).toBeCloseTo(20 + 1 + 4 + 7.5 + 45 * 0.16);
  w.player.level = 18;
  const b = companionDps(w, u);
  expect(b).toBeGreaterThanOrEqual(150);
  expect(growthAtLevel(18)).toBeGreaterThan(0);
});
test('owned monster modifiers leave Smite and companion damage unamplified', () => {
  const { w, u } = setup();
  u.armor = u.magicResist = 0;
  w.hero.armor = 0;
  let hp = u.hp;
  w.damage(w.hero, u, 100, 'physical');
  expect(hp - u.hp).toBeCloseTo(110);
  hp = u.hp;
  w.damage(w.hero, u, 100, 'true', 'summoner');
  expect(hp - u.hp).toBe(100);
  hp = u.hp;
  w.damage(w.hero, u, 100, 'true', 'companion');
  expect(hp - u.hp).toBe(100);
  hp = w.hero.hp;
  w.damage(u, w.hero, 100, 'physical');
  expect(hp - w.hero.hp).toBe(50);
});
test('attack release is delayed, cleaves small monsters once, heals once and resumes exactly mid-windup', () => {
  const { w, p, u } = setup();
  w.step(240);
  const small = w.spawnMonster({ x: u.x + 100, y: u.y }, undefined, 'wolf-mini');
  small.stunUntil = 1_000_000;
  w.hero.hp = 100;
  w.damage(w.hero, u, 1, 'true');
  w.step();
  expect(p.releaseTick).toBe(w.tick + P.windupTicks);
  const hp = u.hp,
    other = small.hp,
    copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(P.windupTicks - 1);
  copy.step(P.windupTicks - 1);
  expect(u.hp).toBe(hp);
  w.step();
  copy.step();
  expect(hp - u.hp).toBeCloseTo(40);
  expect(other - small.hp).toBeCloseTo(40);
  expect(w.events.filter((e) => e.type === 'heal' && e.value === 12)).toHaveLength(1);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(u.illumination).toEqual([]);
});
test('target loss before pet release cancels damage and clears the saved commitment', () => {
  const { w, p, u } = setup();
  w.step(240);
  w.damage(w.hero, u, 1, 'true');
  w.step();
  w.battlefield.lineOfSight = () => false;
  w.step(P.windupTicks + 1);
  expect(p.targetId).toBeNull();
  expect(p.releaseTick).toBeNull();
  expect(w.events.filter((e) => e.type === 'damage' && e.value === 40)).toHaveLength(0);
});
test('large kills feed once, bonus treats feed twice and first-monster XP is not repeated', () => {
  const { w, p } = setup();
  const before = w.player.gold;
  p.bonusTreats = 1;
  kill(w);
  expect(p.fed).toBe(2);
  expect(p.bonusTreats).toBe(0);
  expect(p.firstMonsterDone).toBe(true);
  expect(w.player.gold - before).toBe(100);
  expect(w.player.level).toBe(2);
  const dead = kill(w);
  expect(p.fed).toBe(3);
  const count = p.fed;
  w.damage(w.hero, dead, 99999, 'true');
  expect(p.fed).toBe(count);
  kill(w, 'wolf-mini');
  kill(w, 'krug-medium');
  expect(p.fed).toBe(count);
});
test('bonus treat deadlines are sequential, capped and change on earned first evolution', () => {
  const { w, p } = setup();
  w.tick = p.nextTreatTick! - 1;
  w.step();
  expect(p.bonusTreats).toBe(1);
  expect(p.nextTreatTick).toBe(w.tick + 3600);
  w.tick = p.nextTreatTick! + 3600 * 8;
  w.step();
  expect(p.bonusTreats).toBe(5);
  p.bonusTreats = 0;
  for (let i = 0; i < 15; i++) kill(w);
  expect(p.fed).toBe(15);
  expect(p.nextTreatTick).toBe(w.tick + 5400);
  expect(companionSmiteDamage(p.fed)).toBe(1000);
  expect(w.abilitySpec('f').icon).toBe('S5_SummonerSmitePlayerGanker');
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(20);
  copy.step(20);
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('earned first evolution permits 40-damage champion Smite and its independent saved slow', () => {
  const { w, p } = setup();
  for (let i = 0; i < 15; i++) kill(w);
  const enemy = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  enemy.ai = false;
  const hp = enemy.hp;
  expect(smiteTarget(w, w.hero, enemy)).toBe(true);
  smite(w, enemy);
  expect(hp - enemy.hp).toBeCloseTo(40 - 1.1 / 60);
  expect(w.events.some((e) => e.type === 'damage' && e.unit === enemy.id && e.value === 40)).toBe(
    true
  );
  expect(enemy.slows.find((s) => s.kind === 'smite')?.startMultiplier).toBe(0.8);
  expect(p.fed).toBe(15);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
test('full growth derives the adult form/variant icon and 1400 monster-area Smite without another charge', () => {
  for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const) {
    const { w, p } = setup(kind);
    for (let i = 0; i < 35; i++) kill(w);
    expect(p.fed).toBe(35);
    expect(p.nextTreatTick).toBeNull();
    expect(p.pose.action).toBe('transform');
    expect(w.abilitySpec('f').name).toBe('Primal Smite');
    expect(companionSmiteDamage(p.fed)).toBe(1400);
    const a = w.spawnMonster({ x: 200, y: 0 }),
      b = w.spawnMonster({ x: 300, y: 0 }, undefined, 'wolf-mini'),
      outside = w.spawnMonster({ x: 700, y: 0 });
    for (const u of [a, b, outside]) {
      u.hp = u.maxHp = 2000;
      u.stunUntil = 1_000_000;
    }
    smite(w, a);
    expect(a.hp).toBe(600);
    expect(b.hp).toBe(600);
    expect(outside.hp).toBe(2000);
    expect(w.player.smite!.charges).toBe(0);
  }
});
test('owner death cancels pet combat while preserving earned feeds and bonus clocks', () => {
  const { w, p, u } = setup();
  kill(w);
  w.step(240);
  w.damage(w.hero, u, 1, 'true');
  w.step();
  w.damage(u, w.hero, 999999, 'true');
  w.step();
  expect(p.targetId).toBeNull();
  expect(p.releaseTick).toBeNull();
  expect(p.fed).toBe(1);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(120);
  copy.step(120);
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('snapshots reject duplicate owners, missing Smite, impossible feed state and invented future releases', () => {
  const { w } = setup();
  w.step();
  const original = JSON.parse(w.snapshot());
  for (const change of [
    (s: any) => s.companions.push({ ...s.companions[0] }),
    (s: any) => (s.player.summoners.f = 'heal'),
    (s: any) => (s.companions[0].fed = 36),
    (s: any) => (s.companions[0].fed = 1),
    (s: any) => (s.companions[0].bonusTreats = 6),
    (s: any) => (s.companions[0].releaseTick = s.tick + 29),
    (s: any) => s.companions[0].nextTreatTick++,
    (s: any) => (s.companions[0].firstEvolvedTick = s.tick),
    (s: any) => (s.companions[0].firstMonsterDone = true),
    (s: any) => (s.companions[0].pose = { action: 'transform', startTick: s.tick }),
  ]) {
    const s = structuredClone(original);
    change(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});
