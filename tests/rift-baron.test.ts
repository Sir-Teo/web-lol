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

test('a manual player can decline, join, and leave an attempt without bots overriding their order', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  const [baron] = barons(w);
  const allies = w.units.filter(
    (u) => u.team === 'blue' && ['jungle', 'mid'].includes(w.championState(u.id)?.role ?? '')
  );
  const approach = w.battlefield.reachable({ x: baron.x + 450, y: baron.y }, w.hero.radius);
  for (const actor of [w.hero, ...allies]) {
    Object.assign(actor, approach, { previous: { ...approach } });
    w.gainExperience(10_000, actor.id);
  }
  for (const ally of allies) ally.ai = true;
  const plan = w.teamPlans!.blue;
  const refresh = () => {
    plan.nextThinkTick = w.tick + 1;
    for (const ally of allies) ally.nextThink = w.tick + 1;
    w.step();
    return plan.assignments.filter((goal) => goal.kind === 'baron');
  };
  expect(refresh()).toEqual([]);
  expect(w.hero.order.type).toBe('idle');
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: baron.id } });
  expect(
    refresh()
      .map((goal) => goal.unitId)
      .sort()
  ).toEqual(allies.map((ally) => ally.id).sort());
  expect(w.hero.order).toEqual({ type: 'attack', target: baron.id });
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'idle' } });
  expect(refresh()).toEqual([]);
  expect(w.hero.order.type).toBe('idle');
  expect(
    allies.some((ally) => ally.order.type === 'attack' && ally.order.target === baron.id)
  ).toBe(false);
});

test('a staged Baron clear carries through to a normal minion attack after restore', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  const [baron] = barons(w);
  const approach = w.battlefield.reachable({ x: baron.x + 450, y: baron.y }, w.hero.radius);
  Object.assign(w.hero, approach, { previous: { ...approach } });
  w.damage(w.hero, baron, baron.maxHp - 100, 'true');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: baron, targetId: baron.id });
  w.step();
  expect(w.riftBaron?.lastClear).toEqual({ tick: w.tick, team: 'blue' });

  const restored = World.fromSnapshot(w.snapshot(), playtest);
  const attackTower = (world: World, empowered: boolean) => {
    const tower = world.units.find(
      (unit) => unit.team === 'red' && unit.structure?.role === 'outer-turret'
    )!;
    const point = world.battlefield.reachable({ x: tower.x + 115, y: tower.y }, 30, 'blue');
    const minion = world.spawn('melee', 'blue', point);
    if (empowered) Object.assign(world.hero, point, { previous: { ...point } });
    expect(world.baronEmpoweredMinion(minion)).toBe(empowered);
    world.enqueue({ type: 'order', unit: minion.id, order: { type: 'attack', target: tower.id } });
    const hp = tower.hp;
    for (let i = 0; i < 180 && tower.hp === hp; i++) world.step();
    expect(tower.hp).toBeLessThan(hp);
    return hp - tower.hp;
  };
  const baseDamage = attackTower(w, false);
  expect(attackTower(restored, true)).toBeCloseTo(baseDamage * 1.5);
});

test('scouting wards the pit after 20:00 without leaking hidden enemy clears, and fallback preserves jungle role', () => {
  const live = match();
  live.tick = RIFT_BARON.firstReadyTick - 1;
  live.step();
  const [baron] = barons(live);
  const jungler = live.units.find(
    (u) => u.team === 'blue' && live.championState(u.id)?.role === 'jungle'
  )!;
  const start = live.battlefield.reachable({ x: -2900, y: -1200 }, jungler.radius, 'blue');
  Object.assign(jungler, start, { previous: { ...start }, ai: true, nextThink: live.tick + 1 });
  live.gainExperience(10_000, jungler.id);

  const clearedInFog = World.fromSnapshot(live.snapshot(), playtest);
  const redJungler = clearedInFog.units.find(
    (u) => u.team === 'red' && clearedInFog.championState(u.id)?.role === 'jungle'
  )!;
  clearedInFog.damage(redJungler, barons(clearedInFog)[0], 100_000, 'true');
  expect(clearedInFog.riftBaron?.lastClear?.team).toBe('red');
  expect(live.pointVisible(RIFT_BARON.point, 'blue')).toBe(false);
  expect(clearedInFog.pointVisible(RIFT_BARON.point, 'blue')).toBe(false);

  live.step(5);
  clearedInFog.step(5);
  const movedLive = live.unit(jungler.id)!;
  const movedCleared = clearedInFog.unit(jungler.id)!;
  expect(movedLive.order).toEqual(movedCleared.order);
  expect(movedLive.order.type).toBe('move');

  const pitMouth = clearedInFog.battlefield.reachable(
    { x: RIFT_BARON.point.x + 350, y: RIFT_BARON.point.y },
    movedCleared.radius,
    'blue'
  );
  Object.assign(movedCleared, pitMouth, {
    previous: { ...pitMouth },
    nextThink: clearedInFog.tick + 1,
  });
  clearedInFog.step(30);
  expect(
    clearedInFog.units.some((u) => u.kind === 'ward' && u.team === 'blue' && clearedInFog.alive(u))
  ).toBe(true);
  expect(clearedInFog.pointVisible(RIFT_BARON.point, 'blue')).toBe(true);

  // If Baron goal falls back while hidden, the jungler keeps lane === null and valid snapshot state.
  live.teamPlans!.blue.assignments = [
    {
      unitId: movedLive.id,
      kind: 'baron-rally',
      targetId: baron.id,
      point: { ...RIFT_BARON.point },
      issuedTick: live.tick,
      observedTick: live.tick,
      expiresTick: live.tick + 180,
      score: 185,
    },
  ];
  movedLive.nextThink = live.tick + 1;
  live.step(2);
  expect(movedLive.lane).toBeNull();
  expect(() => World.fromSnapshot(live.snapshot(), playtest)).not.toThrow();
});

test('Baron switches aggro to another pit attacker when its target leaves leash, and resets only when empty', () => {
  const w = match();
  w.tick = RIFT_BARON.firstReadyTick - 1;
  w.step();
  const [baron] = barons(w);
  const [first, second] = w.units.filter((u) => u.team === 'blue' && u.kind === 'champion');
  const inside = w.battlefield.reachable({ x: baron.x + 400, y: baron.y }, first.radius, 'blue');
  for (const ally of [first, second]) {
    ally.hp = ally.maxHp = 10_000;
    Object.assign(ally, inside, { previous: { ...inside } });
  }
  w.damage(second, baron, 500, 'true');
  w.damage(first, baron, 500, 'true');
  expect(baron.monster?.targetId).toBe(first.id);
  const outside = w.battlefield.reachable({ x: baron.x - 1600, y: baron.y }, first.radius, 'blue');
  Object.assign(first, outside, { previous: { ...outside } });
  w.step();
  expect(baron.monster?.phase).toBe('engaged');
  expect(baron.monster?.targetId).toBe(second.id);
  Object.assign(second, outside, { previous: { ...outside } });
  w.step();
  expect(baron.monster?.phase).toBe('returning');
});
