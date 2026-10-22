import { expect, test } from 'vitest';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { grantCompanion } from '../src/simulation/owned-companions';
import { equipSummoners } from '../src/simulation/smite';
import { World } from '../src/simulation/world';
import {
  COMPANION_PASSIVES as S,
  mosstomperShield,
  type CompanionKind,
} from '../src/content/companion-policy';
import type { Unit } from '../src/simulation/types';

test('final passive scalars retain the frozen shield, decay and burn baselines', () => {
  expect(S.gustwalker).toEqual({ brushBonus: 0.3, killBonus: 0.45, decayTicks: 90 });
  expect(S.scorchclaw).toEqual({
    maxStacks: 100,
    stacksPerInterval: 3,
    radius: 250,
    healthFraction: 0.05,
    burnTicks: 240,
    slowFraction: 0.3,
    slowTicks: 180,
  });
  expect(S.mosstomper.rechargeTicks).toBe(600);
});

function kill(w: World, owner = w.hero) {
  const u = w.spawnMonster({ x: 2500, y: 2500 });
  w.damage(owner, u, 999999, 'true');
}
function setup(kind: CompanionKind, feeds = 35) {
  const w = createGrompEncounter(
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      reachable: (p) => ({ ...p }),
      findPath: (_a, b) => [{ ...b }],
      lineWalkable: () => true,
      lineOfSight: () => true,
      inBrush: (p) => p.x >= 100 && p.x <= 200,
    },
    'lux'
  );
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  const p = grantCompanion(w, kind);
  for (const u of w.units) u.stunUntil = 100000;
  for (let i = 0; i < feeds; i++) kill(w);
  w.step(240);
  return { w, p };
}
function enemy(w: World, point = { x: 250, y: 0 }) {
  const u = w.spawn('champion', 'red', point, 'lux');
  u.ai = false;
  u.stunUntil = 100000;
  u.hp = u.maxHp = 2000;
  return u;
}
function roundTrip(w: World, ticks = 60) {
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
  return copy;
}

test('all final effects require earned full growth and initialize on the completing kill', () => {
  for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const) {
    const { w, p } = setup(kind, 34);
    expect(p.passive).toBeNull();
    expect(w.shieldAmount(w.hero)).toBe(0);
    expect(w.movementSpeed(w.hero)).toBe(w.hero.speed);
    kill(w);
    expect(p.fed).toBe(35);
    expect(p.passive?.kind).toBe(kind);
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  }
});
test('Mosstomper follows the retained level-11 breakpoint without obsolete tenacity', () => {
  expect([1, 10, 11, 18].map(mosstomperShield)).toEqual([200, 200, 220, 360]);
  const { w } = setup('mosstomper'),
    e = enemy(w);
  expect(w.shieldAmount(w.hero)).toBe(mosstomperShield(w.player.level));
  w.applySlow(e, w.hero, 'lucent', 180, 0.7);
  expect(w.hero.slows[0].endTick - w.hero.slows[0].startTick).toBe(180);
});
test('Mosstomper absorbs through normal shield ordering and refreshes partial stock after exactly ten seconds', () => {
  const { w, p } = setup('mosstomper'),
    e = enemy(w);
  w.hero.armor = 0;
  w.applyShield(w.hero, w.hero, 50, 1200);
  const health = w.hero.hp,
    cap = w.shieldAmount(w.hero) - 50;
  w.damage(e, w.hero, 100, 'physical');
  expect(w.hero.hp).toBe(health);
  expect(w.shieldAmount(w.hero)).toBe(cap - 50);
  expect(p.passive).toEqual({ kind: 'mosstomper', rechargeTick: w.tick + 600 });
  roundTrip(w, 599);
  expect(w.shieldAmount(w.hero)).toBe(cap - 50);
  w.step();
  expect(w.shieldAmount(w.hero)).toBe(cap);
  expect(w.hero.shields.filter((s) => s.companionGrantTick !== undefined)).toHaveLength(1);
  expect((p.passive as any).rechargeTick).toBeNull();
});
test('positive outgoing and fully absorbed incoming damage postpone Moss recovery; zero damage does not', () => {
  const { w, p } = setup('mosstomper'),
    e = enemy(w);
  w.damage(e, w.hero, 10, 'true');
  w.step(599);
  w.damage(w.hero, e, 1, 'magic');
  expect((p.passive as any).rechargeTick).toBe(w.tick + 600);
  const deadline = (p.passive as any).rechargeTick;
  w.damage(e, w.hero, 0, 'true');
  expect((p.passive as any).rechargeTick).toBe(deadline);
  roundTrip(w, 600);
  expect(w.shieldAmount(w.hero)).toBe(mosstomperShield(w.player.level));
});
test('large kills refresh Moss immediately without stacking it or disturbing independent shields', () => {
  const { w } = setup('mosstomper'),
    e = enemy(w);
  w.damage(e, w.hero, 100, 'true');
  w.applyShield(w.hero, w.hero, 25, 1000);
  kill(w);
  kill(w);
  expect(w.shieldAmount(w.hero)).toBe(mosstomperShield(w.player.level) + 25);
  expect(w.hero.shields).toHaveLength(2);
  roundTrip(w);
});
test('an unfinished companion follow-up strike postpones Moss recovery after the owner stops attacking', () => {
  const { w, p } = setup('mosstomper'),
    u = w.units.find((u) => u.kind === 'monster')!;
  w.damage(w.hero, u, 1, 'magic');
  const first = (p.passive as any).rechargeTick;
  w.setOrder(w.hero, { type: 'idle' });
  w.step(29);
  expect((p.passive as any).rechargeTick).toBe(w.tick + 600);
  expect((p.passive as any).rechargeTick).toBeGreaterThan(first);
  roundTrip(w);
});
test('Moss death removes the shield and its saved recovery clock resumes through respawn', () => {
  const { w, p } = setup('mosstomper'),
    e = enemy(w);
  w.damage(e, w.hero, 999999, 'true');
  expect(w.hero.shields).toEqual([]);
  expect((p.passive as any).rechargeTick).toBe(w.tick + 600);
  const copy = roundTrip(w, 120);
  const until = Math.max(w.hero.respawnTick! - w.tick, 600);
  w.step(until);
  copy.step(until);
  expect(w.shieldAmount(w.hero)).toBe(mosstomperShield(w.player.level));
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('posthumous completion does not put a Moss shield on a dead champion', () => {
  const { w, p } = setup('mosstomper', 34),
    e = enemy(w);
  w.damage(e, w.hero, 999999, 'true');
  kill(w);
  expect(p.fed).toBe(35);
  expect(w.hero.hp).toBe(0);
  expect(w.hero.shields).toEqual([]);
  roundTrip(w);
});
test('Gustwalker uses actual brush membership with a linear 1.5-second exit decay', () => {
  const { w, p } = setup('gustwalker');
  w.hero.x = 150;
  w.hero.previous.x = 150;
  w.step();
  expect(w.movementSpeed(w.hero)).toBeCloseTo(w.hero.speed * 1.3);
  const inside = (p.passive as any).lastBrushTick;
  w.hero.x = 0;
  w.hero.previous.x = 0;
  roundTrip(w, 45);
  expect(w.movementSpeed(w.hero)).toBeCloseTo(w.hero.speed * 1.15);
  expect(w.tick - inside).toBe(45);
  w.step(45);
  expect(w.movementSpeed(w.hero)).toBe(w.hero.speed);
  expect((p.passive as any).lastBrushTick).toBeNull();
});
test('Gustwalker kill burst uses 45%, takes the strongest overlap and adds to existing haste', () => {
  const { w } = setup('gustwalker');
  w.hero.x = 150;
  w.hero.previous.x = 150;
  kill(w);
  w.step();
  w.hero.summonerHealSpeedUntil = w.tick + 120;
  expect(w.movementSpeed(w.hero)).toBeCloseTo(w.hero.speed * (1.3 + (0.45 * 89) / 90));
  w.step(89);
  expect(w.movementSpeed(w.hero)).toBeCloseTo(w.hero.speed * 1.6);
});
test('Gustwalker does not grant vision and death cancels both movement bursts', () => {
  const { w, p } = setup('gustwalker'),
    e = enemy(w);
  const sources = w.visionSources('blue').length;
  w.hero.x = 150;
  w.hero.previous.x = 150;
  kill(w);
  w.step();
  expect(w.visionSources('blue')).toHaveLength(sources);
  w.damage(e, w.hero, 999999, 'true');
  w.step();
  expect(p.passive).toEqual({ kind: 'gustwalker', lastBrushTick: null, killTick: null });
  roundTrip(w);
});
test('Scorchclaw accumulates three Ember per half second on a saved capped phase', () => {
  const { w, p } = setup('scorchclaw'),
    e = enemy(w);
  w.damage(w.hero, e, 100, 'magic');
  expect((p.passive as any).stacks).toBe(0);
  roundTrip(w, 29);
  expect((p.passive as any).stacks).toBe(0);
  w.step();
  expect((p.passive as any).stacks).toBe(3);
  w.step(30 * 40);
  expect((p.passive as any).stacks).toBe(100);
});
test('Smite, nonchampion hits and proc/companion categories cannot consume Scorchclaw', () => {
  const { w, p } = setup('scorchclaw'),
    e = enemy(w);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: e, targetId: e.id });
  w.step();
  expect((p.passive as any).stacks).toBe(100);
  expect(e.scorchclawBurns).toEqual([]);
  for (const category of ['proc', 'companion', 'companion-passive', 'summoner'] as const)
    w.damage(w.hero, e, 5, 'true', category);
  const u = w.spawn('dummy', 'red', { x: 100, y: 0 });
  w.damage(w.hero, u, 5, 'magic');
  expect((p.passive as any).stacks).toBe(100);
  expect(e.scorchclawBurns).toEqual([]);
});
test('a spell proc burns four captured max-health pulses and applies a separate decaying slow', () => {
  const { w, p } = setup('scorchclaw'),
    e = enemy(w);
  w.damage(w.hero, e, 100, 'magic', 'area');
  expect((p.passive as any).stacks).toBe(0);
  expect(e.scorchclawBurns[0].damagePerTick).toBe(25);
  expect(e.slows.find((s) => s.kind === 'scorchclaw')).toMatchObject({
    startMultiplier: 0.7,
    endMultiplier: 1,
    endTick: w.tick + 180,
  });
  for (let i = 0; i < 4; i++) {
    const health = e.hp;
    roundTrip(w, 60);
    expect(health - e.hp).toBeCloseTo(25 - 1.1);
  }
  expect(e.scorchclawBurns).toEqual([]);
  expect(e.slows.some((s) => s.kind === 'scorchclaw')).toBe(false);
});
test('Scorchclaw area policy hits nearby enemies without touching allies, structures or a distant victim', () => {
  const { w } = setup('scorchclaw'),
    e = enemy(w);
  const near = w.spawn('melee', 'red', { x: e.x + 200, y: e.y }),
    far = enemy(w, { x: e.x + 251, y: e.y }),
    ally = w.spawn('champion', 'blue', { x: e.x, y: e.y }),
    structure = w.spawn('turret', 'red', { x: e.x, y: e.y });
  near.stunUntil = ally.stunUntil = structure.stunUntil = 100000;
  w.damage(w.hero, e, 1, 'magic');
  expect(near.scorchclawBurns).toHaveLength(1);
  for (const u of [far, ally, structure]) expect(u.scorchclawBurns).toEqual([]);
  expect(near.slows.some((s) => s.kind === 'scorchclaw')).toBe(true);
  roundTrip(w);
});
test('Scorchclaw burn survives its owner death but resets or clears with a monster or victim', () => {
  const { w } = setup('scorchclaw'),
    e = enemy(w);
  const m = w.units.find((u) => u.kind === 'monster')!;
  Object.assign(m, { x: 300, y: 0, previous: { x: 300, y: 0 } });
  w.damage(w.hero, e, 1, 'magic');
  expect(m.scorchclawBurns).toHaveLength(1);
  w.damage(e, w.hero, 999999, 'true');
  const health = e.hp;
  roundTrip(w, 60);
  expect(health - e.hp).toBeGreaterThan(0);
  expect(
    w.events.some((event) => event.type === 'damage' && event.unit === e.id && event.value === 25)
  ).toBe(true);
  if (m.kind !== 'monster') throw new Error('Missing monster');
  m.monster.phase = 'returning';
  w.step();
  expect(m.scorchclawBurns).toEqual([]);
  w.damage(m, e, 999999, 'true');
  expect(e.scorchclawBurns).toEqual([]);
  roundTrip(w);
});
test('large kills ready Scorchclaw immediately; reapplication refreshes a single owner burn', () => {
  const { w, p } = setup('scorchclaw'),
    e = enemy(w);
  w.damage(w.hero, e, 1, 'magic');
  w.step(20);
  kill(w);
  expect((p.passive as any).stacks).toBe(100);
  w.damage(w.hero, e, 1, 'physical');
  expect(e.scorchclawBurns).toHaveLength(1);
  expect(e.scorchclawBurns[0].startTick).toBe(w.tick);
  roundTrip(w);
});
test('two Scorchclaw owners retain independent burns and slow sources through a death checkpoint', () => {
  const { w } = setup('scorchclaw');
  const ally = w.spawn('champion', 'blue', { x: 0, y: -200 }, 'lux');
  ally.ai = false;
  ally.stunUntil = 100000;
  equipSummoners(w.championState(ally.id)!, { d: 'flash', f: 'smite' }, w.tick);
  grantCompanion(w, 'scorchclaw', ally.id);
  for (let i = 0; i < 35; i++) kill(w, ally);
  const e = enemy(w);
  w.damage(w.hero, e, 100, 'magic');
  w.damage(ally, e, 100, 'magic');
  expect(e.scorchclawBurns.map((b) => b.sourceId)).toEqual([w.hero.id, ally.id]);
  expect(e.slows.filter((s) => s.kind === 'scorchclaw')).toHaveLength(2);
  w.damage(e, w.hero, 999999, 'true');
  roundTrip(w, 60);
  expect(e.scorchclawBurns).toHaveLength(2);
  expect(
    w.events.filter((event) => event.type === 'damage' && event.unit === e.id && event.value === 25)
  ).toHaveLength(2);
});
test('companion monster amplification leaves all true damage unchanged', () => {
  const { w } = setup('scorchclaw'),
    u = w.units.find((u) => u.kind === 'monster')!;
  const hp = u.hp;
  w.damage(w.hero, u, 100, 'true');
  expect(hp - u.hp).toBe(100);
});
test('saved final effects reject invented states, duplicate shields and forged burn ownership/clocks', () => {
  for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const) {
    const { w } = setup(kind),
      e = enemy(w);
    if (kind === 'scorchclaw') w.damage(w.hero, e, 1, 'magic');
    const original = JSON.parse(w.snapshot());
    const changes: ((s: any) => void)[] = [
      (s) => (s.companions[0].passive = null),
      (s) => (s.companions[0].passive.kind = 'invalid'),
    ];
    if (kind === 'gustwalker') changes.push((s) => (s.companions[0].passive.killTick = s.tick + 1));
    if (kind === 'mosstomper')
      changes.push(
        (s) =>
          s.units
            .find((u: Unit) => u.id === s.player.id)
            .shields.push({ ...s.units[0].shields[0] }),
        (s) => (s.units.find((u: Unit) => u.id === s.player.id).shields[0].amount = 9999)
      );
    if (kind === 'scorchclaw')
      changes.push(
        (s) => (s.companions[0].passive.stacks = 101),
        (s) => s.companions[0].passive.nextStackTick++,
        (s) => s.units.find((u: Unit) => u.id === e.id).scorchclawBurns[0].nextTick++,
        (s) => s.units.find((u: Unit) => u.id === e.id).scorchclawBurns[0].damagePerTick++,
        (s) => (s.units.find((u: Unit) => u.id === e.id).scorchclawBurns[0].sourceId = e.id)
      );
    for (const mutate of changes) {
      const saved = structuredClone(original);
      mutate(saved);
      expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
    }
  }
});
