import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';
import { selectableChampion } from '../src/content/champion-profiles';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { RIFT_CAMPS } from '../src/content/rift-camps';
import { alphaTarget } from '../src/simulation/masteryi-alpha-strike';
import { smiteTarget } from '../src/simulation/smite';

const bytes = readFileSync('public/assets/maps/rift-nav.bin'),
  grid = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  rift = createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
  trial = { ...rift, developmentMasterYiRift: true as const },
  loadout = { d: 'smite', f: 'flash' } as const;
const fresh = () => createLaneMatch(trial, 'masteryi', loadout);
let campSnapshot: string;
function atGromp() {
  if (!campSnapshot) {
    const w = fresh(),
      camp = RIFT_CAMPS.find((c) => c.id === 'order-gromp')!;
    expect(w.buy('mosstomper')).toBeNull();
    expect(w.learnSpell('q')).toBeNull();
    w.step(camp.firstReadyTick + 1);
    w.setOrder(w.hero, {
      type: 'move',
      point: rift.reachable({ x: camp.point.x + 200, y: camp.point.y }, w.hero.radius, 'blue'),
    });
    for (let i = 0; i < 1800 && w.hero.order.type !== 'idle'; i++) w.step();
    campSnapshot = w.snapshot();
  }
  const w = World.fromSnapshot(campSnapshot, trial),
    target = w.unit(w.jungleCamps.find((c) => c.id === 'order-gromp')!.unitIds[0]!)!;
  if (target.kind !== 'monster') throw new Error('The source Gromp camp must be active.');
  expect(w.alive(w.hero)).toBe(true);
  expect(alphaTarget(w, w.hero, target)).toBe(true);
  expect(distance(w.hero, target)).toBeLessThan(600);
  return { w, target };
}

test('trusted human Yi owns jungle with Smite, own stats, nine bots and all ten role assignments', () => {
  const w = fresh(),
    champions = w.units.filter((u) => u.kind === 'champion');
  expect(w.hero).toMatchObject({
    champion: 'masteryi',
    ai: false,
    lane: null,
    maxMana: 251,
    range: 175,
  });
  expect(w.player.role).toBe('jungle');
  expect(w.player.summoners).toEqual(loadout);
  expect(w.player.smite).toMatchObject({ charges: 1 });
  expect(w.player.inventory).toEqual([]);
  expect(w.companions.some((c) => c.ownerId === w.hero.id)).toBe(false);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.champion === 'masteryi')).toHaveLength(1);
  expect(champions.filter((u) => u.champion === 'ashe')).toHaveLength(5);
  expect(champions.filter((u) => u.champion === 'lux')).toHaveLength(4);
  for (const team of ['blue', 'red'] as const)
    expect(
      champions
        .filter((u) => u.team === team)
        .map((u) => w.championState(u.id)!.role)
        .sort()
    ).toEqual(['carry', 'jungle', 'mid', 'support', 'top']);
  expect(w.units.filter((u) => u.kind === 'turret')).toHaveLength(22);
  expect(w.battlefield.findPath).toBe(rift.findPath);
  expect(w.battlefield.lineOfSight).toBe(rift.lineOfSight);
  expect(rift.developmentMasterYiRift).toBeUndefined();
});

test('practice admission, other trials, serialized permission and ordinary Rift cannot authorize Yi Rift saves', () => {
  for (const context of [
    rift,
    { ...rift, developmentMasterYi: true as const },
    { ...rift, developmentGaren: true as const },
  ]) {
    expect(() => createLaneMatch(context, 'masteryi', loadout)).toThrow(/development/);
    expect(() => World.fromSnapshot(fresh().snapshot(), context)).toThrow(/Master Yi/);
  }
  expect(() => selectableChampion('masteryi')).toThrow(/development/);
  const raw = JSON.parse(fresh().snapshot());
  raw.developmentMasterYiRift = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  delete raw.developmentMasterYiRift;
  raw.matchMode = 'practice';
  expect(() => World.fromSnapshot(JSON.stringify(raw), trial)).toThrow(/Master Yi/);
  expect(
    () => new World(false, { ...PRACTICE_FIXTURE, developmentMasterYiRift: true }, 'masteryi')
  ).toThrow(/development/);
});

test('the human stays idle and unlearned while every bot advances, then uses source jungle navigation', () => {
  const w = fresh(),
    starts = new Map(
      w.units.filter((u) => u.kind === 'champion').map((u) => [u.id, { x: u.x, y: u.y }])
    );
  w.step(300);
  expect(distance(w.hero, starts.get(w.hero.id)!)).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  for (const u of w.units.filter((u) => u.kind === 'champion' && u.ai))
    expect(distance(u, starts.get(u.id)!)).toBeGreaterThan(300);
  const camp = RIFT_CAMPS.find((c) => c.id === 'order-gromp')!;
  w.setOrder(w.hero, { type: 'move', point: camp.point });
  for (let i = 0; i < 360; i++) {
    w.step();
    for (const u of w.units.filter((u) => u.kind === 'champion'))
      expect(grid.lineWalkable(u.previous, u, u.radius, u.team as 'blue' | 'red')).toBe(true);
  }
  expect(distance(w.hero, starts.get(w.hero.id)!)).toBeGreaterThan(1000);
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Alpha Strike reaches the scheduled source Gromp and restores every vanished-state future exactly', () => {
  const { w, target } = atGromp(),
    hp = target.hp;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', targetId: target.id, point: target });
  w.step();
  expect(w.player.alphaStrike).not.toBeNull();
  expect(w.targetable(w.hero)).toBe(false);
  expect(w.player.alphaStrike!.primaryTargetId).toBe(target.id);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, trial);
  expect(saved).not.toContain('developmentMasterYiRift');
  expect(copy.snapshot()).toBe(saved);
  for (let i = 0; i < 80; i++) {
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
  expect(target.hp).toBeLessThan(hp);
  expect(w.player.alphaStrike).toBeNull();
  expect(w.targetable(w.hero)).toBe(true);
  expect(grid.walkable(w.hero, w.hero.radius, 'blue')).toBe(true);
  expect(distance(w.hero, target)).toBeLessThan(300);
}, 30000);

test('the human purchases a normal jungle companion and spends Smite against the real camp with exact restore', () => {
  const { w, target } = atGromp(),
    hp = target.hp,
    charges = w.player.smite!.charges;
  expect(w.player.inventory).toContain('mosstomper');
  expect(w.companions.some((c) => c.ownerId === w.hero.id && c.kind === 'mosstomper')).toBe(true);
  expect(smiteTarget(w, w.hero, target)).toBe(true);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', targetId: target.id, point: target });
  w.step();
  expect(w.player.smite!.charges).toBe(charges - 1);
  expect(target.hp).toBeLessThanOrEqual(hp - 600);
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
}, 30000);

test('the existing practice host and ordinary Ashe/Lux lane roles still round-trip independently', () => {
  const practice = new World(false, { ...PRACTICE_FIXTURE, developmentMasterYi: true }, 'masteryi');
  expect(World.fromSnapshot(practice.snapshot(), practice.battlefield).snapshot()).toBe(
    practice.snapshot()
  );
  expect(() => World.fromSnapshot(practice.snapshot(), PRACTICE_FIXTURE)).toThrow(/Master Yi/);
  for (const [champion, role] of [
    ['ashe', 'carry'],
    ['lux', 'mid'],
  ] as const) {
    const w = createLaneMatch(rift, champion);
    expect(w.player.role).toBe(role);
    expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  }
});
