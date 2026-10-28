import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import type { ChampionIdentity } from '../src/simulation/types';

const battlefield = {
  ...PRACTICE_FIXTURE,
  developmentBaron: true as const,
  developmentAhri: true as const,
  initialUnits: [],
  lineOfSight: () => true,
  lineWalkable: () => true,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
};
function setup(champion: ChampionIdentity = 'ashe') {
  const w = createBaronEncounter(battlefield, champion),
    b = w.units.find((u) => u.kind === 'monster' && u.monster.species === 'baron')!;
  return { w, b };
}

test('the local immunity subset stays tied to its explicit secondary rule reading', () => {
  const raw = readFileSync('docs/reference/baron-control-source.json'),
    source = JSON.parse(raw.toString());
  expect(BARON.controlSourceSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(BARON.policy.immuneControls).toEqual(['root', 'stun', 'silence', 'charm']);
  expect(source.implementedControls).toEqual(BARON.policy.immuneControls);
  expect(source.scope).toContain('Pages postdate the frozen target');
  expect(source.sources[0].quote).toContain('except stasis');
});

for (const [method, field] of [
  ['applyRoot', 'rootUntil'],
  ['applyStun', 'stunUntil'],
  ['applySilence', 'silenceUntil'],
] as const) {
  test(`Baron rejects ${method} without changing the world`, () => {
    const { w, b } = setup(),
      before = w.snapshot();
    expect(w[method](b, 120)).toBe(false);
    expect(b[field]).toBe(0);
    expect(w.snapshot()).toBe(before);
  });
  test(`ordinary monsters remain eligible for ${method}`, () => {
    const { w } = setup(),
      ordinary = w.spawnMonster({ x: -500, y: 0 }, null, 'gromp');
    expect(w[method](ordinary, 120)).toBe(true);
    expect(ordinary[field]).toBeGreaterThan(w.tick);
  });
}

test('Charm cannot replace a Baron attack or interrupt its pending release', () => {
  const { w, b } = setup('ahri');
  expect(w.learnSpell('e')).toBeNull();
  w.damage(w.hero, b, 1, 'true');
  w.step(8);
  expect(b.releaseTick).toBeGreaterThan(w.tick);
  const before = w.snapshot();
  expect(w.applyCharm(w.hero, b, 1)).toBe(false);
  expect(b.charm).toBeNull();
  expect(w.snapshot()).toBe(before);
});

test('ordinary monsters retain Charm and its forced-walk state', () => {
  const { w } = setup('ahri'),
    ordinary = w.spawnMonster({ x: -500, y: 0 }, null, 'gromp');
  expect(w.learnSpell('e')).toBeNull();
  expect(w.applyCharm(w.hero, ordinary, 1)).toBe(true);
  expect(ordinary.charm?.sourceId).toBe(w.hero.id);
});

test('a real Light Binding missile damages Baron while its root is resisted', () => {
  const { w, b } = setup('lux'),
    hp = b.hp,
    second = w.spawnMonster({ x: 800, y: 0 }, null, 'gromp');
  expect(w.player.spellRanks.q).toBe(1);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: b });
  // Observe the impact before the distant ordinary camp can reset on its next tick.
  for (let ticks = 0; ticks < 60 && second.rootUntil <= w.tick; ticks++) w.step();
  expect(b.hp).toBeLessThan(hp);
  expect(b.rootUntil).toBe(0);

  expect(second.rootUntil).toBeGreaterThan(w.tick);
  expect(w.projectiles.filter((p) => p.type === 'binding')).toEqual([]);
});

test('a real Charm missile still damages Baron without attaching forced movement', () => {
  const { w, b } = setup('ahri'),
    hp = b.hp;
  expect(w.learnSpell('e')).toBeNull();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: b });
  w.step(60);
  expect(b.hp).toBeLessThan(hp);
  expect(b.charm).toBeNull();
  expect(b.monster?.targetId).toBe(w.hero.id);
  expect(w.projectiles.filter((p) => p.type === 'charm')).toEqual([]);
});

test('Shield of Daybreak is consumed and damages Baron without stunning it', () => {
  const { w, b } = setup('leona'),
    hp = b.hp;
  Object.assign(w.hero, { x: 300, y: 0, previous: { x: 300, y: 0 } });
  expect(w.learnSpell('q')).toBeNull();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: b });
  w.step();
  expect(w.player.leonaQ?.rank).toBe(1);
  w.setOrder(w.hero, { type: 'attack', target: b.id });
  w.step(35);
  expect(b.hp).toBeLessThan(hp);
  expect(w.player.leonaQ).toBeNull();
  expect(w.player.cooldowns.q).toBeGreaterThan(w.tick);
  expect(b.stunUntil).toBe(0);
});

test('resisted controls preserve a mid-windup save and its uninterrupted future', () => {
  const { w, b } = setup('ahri');
  expect(w.learnSpell('e')).toBeNull();
  w.damage(w.hero, b, 1, 'true');
  w.step(8);
  const before = w.snapshot();
  expect(w.applyRoot(b, 120)).toBe(false);
  expect(w.applyStun(b, 120)).toBe(false);
  expect(w.applySilence(b, 120)).toBe(false);
  expect(w.applyCharm(w.hero, b, 1)).toBe(false);
  expect(w.snapshot()).toBe(before);
  const copy = World.fromSnapshot(before, battlefield);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Decisive Strike is consumed and damages Baron without applying silence', () => {
  const { w, b } = setup('garen'),
    hp = b.hp;
  Object.assign(w.hero, { x: 300, y: 0, previous: { x: 300, y: 0 } });
  expect(w.learnSpell('q')).toBeNull();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: b });
  w.step();
  expect(w.player.garenQ?.consumed).toBe(false);
  w.setOrder(w.hero, { type: 'attack', target: b.id });
  w.step(35);
  expect(b.hp).toBeLessThan(hp);
  expect(w.player.garenQ?.consumed).toBe(true);
  expect(b.silenceUntil).toBe(0);
});

for (const field of ['rootUntil', 'stunUntil', 'silenceUntil', 'charm'] as const)
  test(`an edited Baron ${field} cannot enter through a save`, () => {
    const { w, b } = setup('ahri');
    expect(w.learnSpell('e')).toBeNull();
    const ordinary = w.spawnMonster({ x: -500, y: 0 }, null, 'gromp');
    expect(w.applyCharm(w.hero, ordinary, 1)).toBe(true);
    const raw = JSON.parse(w.snapshot()),
      row = raw.units.find((u: any) => u.id === b.id);
    row[field] = field === 'charm' ? { ...ordinary.charm } : 120;
    expect(() => World.fromSnapshot(JSON.stringify(raw), battlefield)).toThrow(
      'Baron cannot carry'
    );
  });
