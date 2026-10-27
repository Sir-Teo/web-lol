import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { distance } from '../src/simulation/math';
import { selectableChampion } from '../src/content/champion-profiles';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { activeSpiritDash, spiritRushDestination } from '../src/simulation/ahri-spirit-rush';

const bytes = readFileSync('public/assets/maps/rift-nav.bin'),
  grid = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  rift = createRift(grid, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
  trial = { ...rift, developmentAhriRift: true as const };
const fresh = () => createLaneMatch(trial, 'ahri');
let midSnapshot: string;
function inMid() {
  if (!midSnapshot) {
    const w = fresh(),
      lane = rift.lanes.find((l) => l.name === 'mid')!;
    expect(w.learnSpell('q')).toBeNull();
    w.setOrder(w.hero, { type: 'move', point: lane.points[Math.floor(lane.points.length / 2)] });
    const target = w.units.find(
      (u) => u.kind === 'champion' && u.team === 'red' && w.championState(u.id)?.role === 'mid'
    )!;
    for (
      let i = 0;
      i < 6000 && !(w.visible(target, 'blue') && distance(w.hero, target) <= 650);
      i++
    )
      w.step();
    expect(w.alive(w.hero)).toBe(true);
    expect(w.alive(target)).toBe(true);
    expect(w.visible(target, 'blue')).toBe(true);
    expect(distance(w.hero, target)).toBeLessThanOrEqual(650);
    w.setOrder(w.hero, { type: 'idle' });
    midSnapshot = w.snapshot();
  }
  const w = World.fromSnapshot(midSnapshot, trial),
    target = w.units.find(
      (u) => u.kind === 'champion' && u.team === 'red' && w.championState(u.id)?.role === 'mid'
    )!;
  return { w, target };
}

test('human Ahri takes mid with her own stats and leaves nine bots and all ten roles intact', () => {
  const w = fresh(),
    champions = w.units.filter((u) => u.kind === 'champion');
  expect(w.hero).toMatchObject({
    champion: 'ahri',
    ai: false,
    lane: null,
    maxMana: 418,
    range: 550,
  });
  expect(w.player.role).toBe('mid');
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(champions).toHaveLength(10);
  expect(champions.filter((u) => u.ai)).toHaveLength(9);
  expect(champions.filter((u) => u.champion === 'ahri')).toHaveLength(1);
  expect(champions.filter((u) => u.champion === 'ashe')).toHaveLength(6);
  expect(champions.filter((u) => u.champion === 'lux')).toHaveLength(3);
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
  expect(rift.developmentAhriRift).toBeUndefined();
});

test('practice admission, unrelated trials and forged save permissions cannot authorize Ahri Rift states', () => {
  for (const context of [
    rift,
    { ...rift, developmentAhri: true as const },
    { ...rift, developmentMasterYiRift: true as const },
  ]) {
    expect(() => createLaneMatch(context, 'ahri')).toThrow(/development/);
    expect(() => World.fromSnapshot(fresh().snapshot(), context)).toThrow(/Ahri/);
  }
  expect(() => selectableChampion('ahri')).toThrow(/development/);
  const raw = JSON.parse(fresh().snapshot());
  raw.developmentAhriRift = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), rift)).toThrow();
  delete raw.developmentAhriRift;
  raw.matchMode = 'practice';
  expect(() => World.fromSnapshot(JSON.stringify(raw), trial)).toThrow(/Ahri/);
  expect(
    () => new World(false, { ...PRACTICE_FIXTURE, developmentAhriRift: true }, 'ahri')
  ).toThrow(/development/);
});

test('the human stays idle while nine bots advance and then follows real mid-lane navigation', () => {
  const w = fresh(),
    starts = new Map(
      w.units.filter((u) => u.kind === 'champion').map((u) => [u.id, { x: u.x, y: u.y }])
    );
  w.step(300);
  expect(distance(w.hero, starts.get(w.hero.id)!)).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  for (const u of w.units.filter((u) => u.kind === 'champion' && u.ai))
    expect(distance(u, starts.get(u.id)!)).toBeGreaterThan(300);
  const lane = rift.lanes.find((l) => l.name === 'mid')!;
  w.setOrder(w.hero, { type: 'move', point: lane.points[Math.floor(lane.points.length / 2)] });
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

test('Q reaches the normal opposing mid laner and preserves outward and returning checkpoints exactly', () => {
  const { w, target } = inMid(),
    outward = new Set<number>(),
    returning = new Set<number>();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: { x: target.x, y: target.y } });
  w.step();
  expect(w.player.pendingCast?.ability).toBe('q');
  const copy = World.fromSnapshot(w.snapshot(), trial);
  for (let i = 0; i < 180; i++) {
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
    for (const orb of w.ahriOrbs) {
      orb.outwardHits.forEach((id) => outward.add(id));
      orb.returnHits.forEach((id) => returning.add(id));
      if ([20, 50, 80].includes(i))
        expect(World.fromSnapshot(w.snapshot(), trial).snapshot()).toBe(w.snapshot());
    }
  }
  expect(outward.has(target.id)).toBe(true);
  expect(returning.has(target.id)).toBe(true);
  expect(w.ahriOrbs).toHaveLength(0);
}, 30000);

test('Charm interacts with normal mid-lane opponents and restores controlled movement without replacing map queries', () => {
  const { w, target } = inMid();
  w.gainExperience(700);
  expect(w.learnSpell('e')).toBeNull();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: target.x, y: target.y } });
  w.step();
  expect(w.player.pendingCast?.ability).toBe('e');
  let controlled = false;
  for (let i = 0; i < 100; i++) {
    w.step();
    if (target.charm?.sourceId === w.hero.id) {
      controlled = true;
      expect(target.order.type).toBe('idle');
      const impactCopy = World.fromSnapshot(w.snapshot(), trial);
      w.step();
      impactCopy.step();
      expect(impactCopy.snapshot()).toBe(w.snapshot());
      expect(target.order.type).toBe('move');
      const copy = World.fromSnapshot(w.snapshot(), trial);
      w.step(180);
      copy.step(180);
      expect(copy.snapshot()).toBe(w.snapshot());
      break;
    }
  }
  expect(controlled).toBe(true);
}, 30000);

test('Spirit Rush corrects a source-wall landing and restores the actual dash and free recast exactly', () => {
  const w = fresh();
  w.gainExperience(1e6);
  expect(w.learnSpell('r')).toBeNull();
  let probe:
    | {
        start: { x: number; y: number };
        point: { x: number; y: number };
        end: { x: number; y: number };
      }
    | undefined;
  for (let x = -2500; x <= 2500 && !probe; x += 100)
    for (let y = -2500; y <= 2500 && !probe; y += 100) {
      const start = { x, y };
      if (!grid.walkable(start, w.hero.radius, 'blue')) continue;
      for (const d of [
        { x: 500, y: 0 },
        { x: 0, y: 500 },
        { x: -500, y: 0 },
        { x: 0, y: -500 },
      ]) {
        const point = { x: x + d.x, y: y + d.y };
        if (grid.walkable(point, w.hero.radius, 'blue')) continue;
        Object.assign(w.hero, start, { previous: { ...start } });
        const end = spiritRushDestination(w, w.hero, point);
        if (end && distance(start, end) > 100) {
          probe = { start, point, end };
          break;
        }
      }
    }
  expect(probe).toBeDefined();
  Object.assign(w.hero, probe!.start, { previous: { ...probe!.start } });
  const before = w.hero.mana;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: probe!.point });
  w.step();
  expect(activeSpiritDash(w, w.hero.id)).toBeDefined();
  expect(w.hero.mana).toBeLessThan(before - 99);
  const copy = World.fromSnapshot(w.snapshot(), trial);
  w.step(60);
  copy.step(60);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(distance(w.hero, probe!.end)).toBeLessThan(1e-6);
  expect(grid.walkable(w.hero, w.hero.radius, 'blue')).toBe(true);
  const cooldown = w.player.cooldowns.r,
    remaining = w.ahriRushes[0].remainingCasts,
    mana = w.hero.mana;
  const next = rift.reachable({ x: w.hero.x + 200, y: w.hero.y }, w.hero.radius, 'blue');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: next });
  w.step();
  expect(w.ahriRushes[0].remainingCasts).toBe(remaining - 1);
  expect(w.player.cooldowns.r).toBe(cooldown);
  expect(w.hero.mana).toBeGreaterThanOrEqual(mana);
});

test('ordinary lane roles and the original trusted Ahri practice host still round-trip', () => {
  const practice = new World(false, { ...PRACTICE_FIXTURE, developmentAhri: true }, 'ahri');
  expect(World.fromSnapshot(practice.snapshot(), practice.battlefield).snapshot()).toBe(
    practice.snapshot()
  );
  expect(() => World.fromSnapshot(practice.snapshot(), PRACTICE_FIXTURE)).toThrow(/Ahri/);
  for (const [champion, role] of [
    ['ashe', 'carry'],
    ['lux', 'mid'],
  ] as const) {
    const w = createLaneMatch(rift, champion);
    expect(w.player.role).toBe(role);
    expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  }
});
