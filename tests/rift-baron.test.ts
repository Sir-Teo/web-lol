import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BARON, RIFT_BARON } from '../src/content/baron';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const playtest = { ...rift, rosterPlaytestBaron: true as const };
const firstSpawnTick = RIFT_BARON.firstReadyTick - BARON.spawnClipTicks;
const barons = (w: World) =>
  w.units.filter((u) => u.kind === 'monster' && u.monster.species === 'baron');
function match(battlefield = playtest) {
  const w = createLaneMatch(battlefield, 'ashe', { d: 'flash', f: 'smite' });
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  return w;
}

test('only admitted lanes run the calendar, with a protected first spawn at the Rift locator', () => {
  for (const w of [createLaneMatch(rift), new World(true, playtest)]) {
    w.tick = RIFT_BARON.firstReadyTick - 1;
    w.step();
    expect(w.riftBaron).toBeNull();
    expect(barons(w)).toEqual([]);
    expect(() => w.spawnMonster(RIFT_BARON.point, null, 'baron')).toThrow('trusted');
  }
  const w = match();
  expect(w.battlefield.reachable(RIFT_BARON.point, 0)).toEqual(RIFT_BARON.point);
  expect(() => w.spawnMonster(RIFT_BARON.point, null, 'baron')).toThrow('scheduled');
  w.tick = firstSpawnTick - 2;
  w.step();
  expect(barons(w)).toEqual([]);
  const pending = w.snapshot();
  expect(() => World.fromSnapshot(pending, rift)).toThrow('trusted roster playtest');
  expect(World.fromSnapshot(pending, playtest).snapshot()).toBe(pending);
  w.step();
  const [baron] = barons(w);
  expect(baron).toMatchObject({
    ...RIFT_BARON.point,
    monster: {
      home: RIFT_BARON.point,
      phase: 'spawning',
      spawn: { startTick: firstSpawnTick, readyTick: RIFT_BARON.firstReadyTick },
    },
  });
  expect(w.vulnerable(baron)).toBe(false);
  w.damage(w.hero, baron, 100_000, 'true');
  expect(baron.hp).toBe(baron.maxHp);
  const spawning = w.snapshot();
  const copy = World.fromSnapshot(spawning, playtest);
  expect(copy.snapshot()).toBe(spawning);
  for (const branch of [w, copy]) branch.step(BARON.spawnClipTicks);
  expect(w.vulnerable(baron)).toBe(true);
  expect(baron.monster?.spawn).toBeNull();
  expect(copy.snapshot()).toBe(w.snapshot());
});

test.each(['blue', 'red'] as const)(
  '%s takes Baron with Smite, pays only that team once, and restores the respawn',
  (team) => {
    const w = match();
    w.tick = RIFT_BARON.firstReadyTick - 1;
    w.step();
    const [baron] = barons(w);
    const champions = w.units.filter((u) => u.kind === 'champion');
    const killer =
      team === 'blue'
        ? w.hero
        : champions.find((u) => u.team === team && w.championState(u.id)!.role === 'jungle')!;
    const ability = team === 'blue' ? 'f' : 'd';
    const approach = w.battlefield.reachable({ x: baron.x + 450, y: baron.y }, killer.radius, team);
    Object.assign(killer, approach, { previous: { ...approach } });
    expect(w.visible(baron, team)).toBe(true);
    // Diagnostic damage puts the live boss in range of an ordinary Smite command.
    w.damage(killer, baron, baron.maxHp - 100, 'true');
    const before = champions.map((u) => ({ ...w.championState(u.id)! }));
    w.enqueue({
      type: 'cast',
      unit: killer.id,
      ability,
      point: { x: baron.x, y: baron.y },
      targetId: baron.id,
    });
    w.step();
    expect(baron.hp).toBe(0);
    expect(w.riftBaron).toEqual({
      unitId: null,
      lastClear: { tick: w.tick, team },
      holders: champions
        .filter((champion) => champion.team === team)
        .map((champion) => champion.id),
    });
    w.damage(killer, baron, 100, 'true');
    for (const [i, champion] of champions.entries()) {
      const state = w.championState(champion.id)!;
      expect(state.gold - before[i].gold).toBeCloseTo(champion.team === team ? 150 : 0, 0);
      expect(state).toMatchObject({ cs: before[i].cs, kills: before[i].kills });
    }
    const notice = w.events.find((event) => event.text?.startsWith('Your team slew Baron Nashor'));
    expect(notice?.audience).toEqual(team === 'blue' ? ['blue'] : undefined);
    const saved = w.snapshot();
    const copy = World.fromSnapshot(saved, playtest);
    expect(copy.snapshot()).toBe(saved);
    const ready = w.tick + RIFT_BARON.respawnTicks;
    for (const branch of [w, copy]) {
      branch.step(BARON.policy.corpseLifetimeTicks + 1);
      expect(barons(branch)).toEqual([]);
      branch.tick = ready - BARON.spawnClipTicks - 1;
      branch.step(BARON.spawnClipTicks + 1);
      const [next] = barons(branch);
      expect(next.id).not.toBe(baron.id);
      expect(next.hp).toBe(next.maxHp);
      expect(branch.vulnerable(next)).toBe(true);
    }
    expect(copy.snapshot()).toBe(w.snapshot());
  }
);

test('restore rejects a missing controller, forged ownership, and an impossible calendar', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  const state = JSON.parse(w.snapshot());
  const read = (riftBaron: unknown) =>
    World.fromSnapshot(JSON.stringify({ ...state, riftBaron }), playtest);
  expect(() => read(null)).toThrow('trusted roster playtest');
  expect(() => read({ ...state.riftBaron, unitId: w.hero.id })).toThrow('invalid spawn');
  expect(() => read({ ...state.riftBaron, unitId: null })).toThrow('invalid spawn');
  expect(() =>
    read({ ...state.riftBaron, lastClear: { tick: state.tick + 1, team: 'red' } })
  ).toThrow('invalid spawn');
});

test('a real bot jungler saves Smite until lethal, then secures a visible Baron', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  const [baron] = barons(w);
  const jungler = w.units.find(
    (u) => u.team === 'blue' && w.championState(u.id)?.role === 'jungle'
  )!;
  const approach = w.battlefield.reachable({ x: baron.x + 450, y: baron.y }, jungler.radius);
  Object.assign(jungler, approach, { previous: { ...approach }, ai: true, nextThink: w.tick + 1 });
  w.damage(jungler, baron, baron.maxHp - 1000, 'true');
  w.step();
  expect(
    w.commands.some((command) => command.type === 'cast' && command.targetId === baron.id)
  ).toBe(false);
  w.damage(jungler, baron, 500, 'true');
  jungler.nextThink = w.tick + 1;
  w.step(2);
  expect(w.alive(baron)).toBe(false);
  expect(w.riftBaron?.lastClear?.team).toBe('blue');
});

test('Hand of Baron amplifies real minion hits without stacking and expires on death or time', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  w.damage(w.hero, barons(w)[0], 100_000, 'true');
  const tower = w.units.find((u) => u.team === 'red' && u.structure?.role === 'outer-turret')!;
  const minion = w.spawn('melee', 'blue', { x: tower.x + 150, y: tower.y });
  const allied = w.units.find(
    (u) => u.team === 'blue' && u.kind === 'champion' && u.id !== w.hero.id
  )!;
  const initialHp = tower.hp;
  w['hitBasicAttack'](minion, tower, minion.damage);
  const normalDamage = initialHp - tower.hp;
  Object.assign(w.hero, { x: tower.x + 200, y: tower.y });
  Object.assign(allied, { x: tower.x + 300, y: tower.y });
  expect(w.baronEmpoweredMinion(minion)).toBe(true);
  const empoweredHp = tower.hp;
  w['hitBasicAttack'](minion, tower, minion.damage);
  expect(empoweredHp - tower.hp).toBeCloseTo(normalDamage * 1.5);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, playtest).snapshot()).toBe(saved);
  const invalid = JSON.parse(saved);
  invalid.riftBaron.holders[0] = minion.id;
  expect(() => World.fromSnapshot(JSON.stringify(invalid), playtest)).toThrow('invalid spawn');
  w.damage(tower, w.hero, 100_000, 'true');
  expect(w.handOfBaronEndTick(w.hero)).toBeNull();
  expect(w.baronEmpoweredMinion(minion)).toBe(true);
  w.tick = w.handOfBaronEndTick(allied)! - 1;
  w.step();
  expect(w.handOfBaronEndTick(allied)).toBeNull();
  expect(w.baronEmpoweredMinion(minion)).toBe(false);
  expect(w.riftBaron?.holders).toEqual([]);
});
