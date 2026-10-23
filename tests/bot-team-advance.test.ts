import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  planTeam,
  type KnownStructure,
  type TeamActor,
  type TeamObservation,
} from '../src/simulation/bot-team';
import { STRUCTURE_RESPAWN_TICKS } from '../src/content/rules';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { direction } from '../src/simulation/math';

const actor = (overrides: Partial<TeamActor> = {}): TeamActor => ({
  id: 1,
  role: 'jungle',
  x: 0,
  y: 0,
  hp: 100,
  maxHp: 100,
  damage: 60,
  attackPeriod: 90,
  controlled: true,
  available: true,
  clearing: false,
  companionComplete: true,
  level: 8,
  ...overrides,
});
const objective = (overrides: Partial<KnownStructure> = {}): KnownStructure => ({
  id: 20,
  kind: 'turret',
  role: 'outer-turret',
  lane: 'mid',
  x: 6000,
  y: 0,
  knownDestroyed: false,
  ...overrides,
});
const observation = (): TeamObservation => ({
  tick: 1000,
  home: { x: -6000, y: 0 },
  actors: [actor()],
  minions: [4200, 4160, 4120].map((x) => ({ x, y: 0, lane: 'mid' })),
  enemies: [],
  enemyMinions: [],
  ownStructures: [],
  enemyStructures: [],
  knownStructures: [objective()],
  scuttlers: [],
  towers: [],
  gone: new Set(),
});

test('a friendly wave draws a healthy bot toward an unseen map objective without supplying hidden structure health', () => {
  const o = observation();
  const goals = planTeam([], o);
  expect(goals).toMatchObject([
    {
      unitId: 1,
      kind: 'advance',
      targetId: 20,
      point: { x: 3850, y: 0 },
      issuedTick: 1000,
      observedTick: 1000,
      expiresTick: 1180,
    },
  ]);
  o.minions[0].x = 7000;
  expect(goals[0].point).toEqual({ x: 3850, y: 0 });
});

test('advancement follows remembered frontier order and reaches a base only after earlier lane structures are known destroyed', () => {
  const o = observation();
  o.knownStructures = [
    objective({ id: 25, kind: 'nexus', role: 'nexus', lane: null, x: 7200 }),
    objective({ id: 21, role: 'inner-turret', x: 6500 }),
    objective({ id: 22, role: 'inhibitor-turret', x: 6700 }),
    objective({ id: 23, kind: 'inhibitor', role: 'inhibitor', x: 6900 }),
    objective(),
  ];
  expect(planTeam([], o)[0].targetId).toBe(20);
  o.knownStructures = o.knownStructures.map((s) =>
    s.id === 20 ? { ...s, knownDestroyed: true } : s
  );
  expect(planTeam([], o)[0].targetId).toBe(21);
  o.minions = [6200, 6160, 6120].map((x) => ({ x, y: 0, lane: 'mid' }));
  o.actors = [actor({ x: -3000 })];
  o.knownStructures = [
    ...o.knownStructures.map((s) => (s.lane !== null ? { ...s, knownDestroyed: true } : s)),
    objective({ id: 24, role: 'nexus-turret', lane: null, x: 7000 }),
  ];
  expect(planTeam([], o)[0]).toMatchObject({ kind: 'advance', targetId: 24 });
});

test('absent, isolated and unrelated waves do not create or retain an advance job', () => {
  const o = observation(),
    previous = planTeam([], o);
  for (const minions of [
    [],
    o.minions.slice(0, 1),
    o.minions.map((m) => ({ ...m, lane: 'bot' as const })),
    o.minions.map((m) => ({ ...m, lane: null })),
  ]) {
    expect(planTeam(previous, { ...o, tick: 1060, minions })).toEqual([]);
  }
});

test('fresh wave positions renew only the captured staging point and preserve the original commitment tick', () => {
  const o = observation(),
    previous = planTeam([], o);
  const renewed = planTeam(previous, {
    ...o,
    tick: 1060,
    minions: [4500, 4460, 4420].map((x) => ({ x, y: 0, lane: 'mid' })),
  });
  expect(renewed[0]).toMatchObject({
    kind: 'advance',
    issuedTick: 1000,
    observedTick: 1060,
    expiresTick: 1240,
    point: { x: 4150, y: 0 },
  });
});

test('human control, healing, recall, camp clearing and early development retain their own actions', () => {
  for (const overrides of [
    { controlled: false },
    { available: false },
    { clearing: true },
    { hp: 25 },
    { level: 2 },
    { role: null },
    { x: -5000 },
  ]) {
    const o = observation();
    o.actors = [actor(overrides)];
    expect(planTeam([], o)).toEqual([]);
  }
});

test('ordinary unseen towers preserve unfinished jungle progression; mature junglers and lane rotations can join', () => {
  const o = observation();
  o.actors = [actor({ companionComplete: false })];
  expect(planTeam([], o)).toEqual([]);
  o.actors = [actor({ companionComplete: true })];
  expect(planTeam([], o)[0]).toMatchObject({ kind: 'advance', targetId: 20 });
  o.actors = [actor({ role: 'top', companionComplete: false })];
  expect(planTeam([], o)[0]).toMatchObject({ kind: 'advance', targetId: 20 });
});

test('unfinished junglers can answer a public base-ending wave but still respect camp clearing and visible pushes', () => {
  const o = observation();
  o.actors = [actor({ companionComplete: false })];
  for (const target of [
    objective({ kind: 'inhibitor', role: 'inhibitor' }),
    objective({ role: 'nexus-turret', lane: null }),
    objective({ kind: 'nexus', role: 'nexus', lane: null }),
  ]) {
    o.knownStructures = [target];
    expect(planTeam([], o)[0]).toMatchObject({ kind: 'advance', targetId: target.id });
    expect(
      planTeam([], { ...o, actors: [actor({ companionComplete: false, clearing: true })] })
    ).toEqual([]);
  }
  o.knownStructures = [objective()];
  o.actors = [actor({ x: 4600, companionComplete: false })];
  o.minions = [5400, 5360, 5320].map((x) => ({ x, y: 0, lane: 'mid' }));
  o.enemyStructures = [
    { id: 20, kind: 'turret', x: 6000, y: 0, hp: 1000, maxHp: 1000, range: 750, attackable: true },
  ];
  expect(planTeam([], o)[0]).toMatchObject({ kind: 'push', targetId: 20 });
});

test('overwhelming observed defenders and uncovered staging hazards cancel advancement; urgent home defense preempts it', () => {
  const o = observation(),
    previous = planTeam([], o);
  expect(
    planTeam(previous, { ...o, tick: 1060, enemies: [actor({ id: 90, x: 4300, damage: 600 })] })
  ).toEqual([]);
  expect(planTeam(previous, { ...o, tick: 1060, towers: [{ x: 3000, y: 0, range: 750 }] })).toEqual(
    []
  );
  const defended = planTeam(previous, {
    ...o,
    tick: 1060,
    ownStructures: [
      { id: 30, kind: 'nexus', x: -1000, y: 0, hp: 200, maxHp: 1000, range: 0, attackable: true },
    ],
    enemies: [actor({ id: 90, x: -900 })],
  });
  expect(defended[0]).toMatchObject({ kind: 'defend', targetId: 30 });
});

test('arrival at a visible covered structure converts the advance job into the existing push and attack policy', () => {
  const o = observation(),
    previous = planTeam([], o);
  o.tick = 1060;
  o.actors = [actor({ x: 4600 })];
  o.minions = [5400, 5360, 5320].map((x) => ({ x, y: 0, lane: 'mid' }));
  o.enemyStructures = [
    { id: 20, kind: 'turret', x: 6000, y: 0, hp: 1000, maxHp: 1000, range: 750, attackable: true },
  ];
  expect(planTeam(previous, o)[0]).toMatchObject({ kind: 'push', targetId: 20 });
});

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
function battlefield() {
  return createRift(
    new NavGrid(
      JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    ),
    JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
  );
}
function fixture() {
  const rift = battlefield(),
    w = createLaneMatch(rift);
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) if (u.kind === 'champion') u.ai = false;
  const bot = w.units.find(
    (u) => u.kind === 'champion' && u.team === 'blue' && w.championState(u.id)!.role === 'top'
  )!;
  bot.ai = true;
  w.gainExperience(5000, bot.id);
  const tower = w.units.find(
    (u) => u.team === 'red' && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
  )!;
  const away = direction(tower, rift.spawns.blue);
  const position = rift.reachable(
    { x: tower.x + away.x * 4500, y: tower.y + away.y * 4500 },
    bot.radius,
    'blue'
  );
  Object.assign(bot, position, { previous: { ...position }, nextThink: w.tick });
  w.setOrder(bot, { type: 'idle' });
  const wave = Array.from({ length: 6 }, (_, i) => {
    const p = rift.reachable(
      { x: tower.x + away.x * (1800 + i * 40), y: tower.y + away.y * (1800 + i * 40) },
      35,
      'blue'
    );
    const m = w.spawn(i < 3 ? 'melee' : 'caster', 'blue', p);
    m.lane = rift.lanes.findIndex((l) => l.name === 'mid');
    m.ai = false;
    m.damage = 0;
    w.setOrder(m, { type: 'move', point: { x: tower.x, y: tower.y } });
    return m;
  });
  return { w, bot, tower, wave };
}

test('an autonomous Rift top laner advances with a real friendly wave before seeing the target, restores the job and attacks after arrival', () => {
  const { w, bot, tower } = fixture();
  expect(w.visible(tower, 'blue')).toBe(false);
  w.step(20);
  expect(w.visible(tower, 'blue')).toBe(false);
  expect(w.teamPlans!.blue.assignments).toContainEqual(
    expect.objectContaining({ unitId: bot.id, kind: 'advance', targetId: tower.id })
  );
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, battlefield());
  let attacked = false;
  const hp = tower.hp;
  for (let i = 0; i < 1800; i++) {
    w.step();
    copy.step();
    if (bot.attackTarget === tower.id) attacked = true;
    if (i % 60 === 0) expect(copy.snapshot()).toBe(w.snapshot());
    if (tower.hp < hp) break;
  }
  expect(attacked).toBe(true);
  expect(tower.hp).toBeLessThan(hp);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.battlefield.lanes[bot.lane!].name).toBe('top');
  expect(w.championState(bot.id)!.role).toBe('top');
}, 30000);

test('advance saves reject human actors, friendly or non-structure anchors, forged clocks and out-of-map points', () => {
  const { w, bot, tower, wave } = fixture();
  w.step(20);
  const base = JSON.parse(w.snapshot()),
    goal = base.teamPlans.blue.assignments.find((g: any) => g.unitId === bot.id);
  expect(goal.kind).toBe('advance');
  const enemy = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  const own = w.units.find((u) => u.team === 'blue' && !!u.structure)!;
  for (const mutate of [
    (s: any) => (s.units.find((u: any) => u.id === bot.id).ai = false),
    (s: any) => (s.teamPlans.blue.assignments[0].targetId = own.id),
    (s: any) => (s.teamPlans.blue.assignments[0].targetId = enemy.id),
    (s: any) => (s.teamPlans.blue.assignments[0].targetId = wave[0].id),
    (s: any) => s.teamPlans.blue.assignments[0].observedTick++,
    (s: any) => (s.teamPlans.blue.assignments[0].point.x = 100000),
  ]) {
    const bad = structuredClone(base);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), battlefield())).toThrow();
  }
  expect(goal.targetId).toBe(tower.id);
});

test('hidden opponent health and position cannot redirect an advance job or its staging movement', () => {
  const { w, bot, tower } = fixture();
  w.step(20);
  const copy = World.fromSnapshot(w.snapshot(), battlefield());
  copy.unit(tower.id)!.hp = 1;
  const enemy = copy.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  const away = direction(tower, copy.battlefield.spawns.red);
  const point = copy.battlefield.reachable(
    { x: tower.x + away.x * 2500, y: tower.y + away.y * 2500 },
    enemy.radius,
    'red'
  );
  Object.assign(enemy, point, { previous: { ...point } });
  expect(copy.visible(enemy, 'blue')).toBe(false);
  expect(World.fromSnapshot(copy.snapshot(), battlefield()).snapshot()).toBe(copy.snapshot());
  w.step(60);
  copy.step(60);
  expect(w.visible(tower, 'blue')).toBe(false);
  expect(copy.visible(copy.unit(tower.id)!, 'blue')).toBe(false);
  expect(copy.teamPlans!.blue).toEqual(w.teamPlans!.blue);
  const other = copy.unit(bot.id)!;
  expect({ x: other.x, y: other.y, order: other.order }).toEqual({
    x: bot.x,
    y: bot.y,
    order: bot.order,
  });
});

test('a vanished friendly wave leaves a restorable captured point and cancels advancement on the next team decision', () => {
  const { w, bot, wave } = fixture();
  w.step(20);
  const enemy = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  for (const m of wave) w.damage(enemy, m, 99999, 'true');
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, battlefield());
  expect(copy.snapshot()).toBe(saved);
  w.step(60);
  copy.step(60);
  expect(
    w.teamPlans!.blue.assignments.some((g) => g.unitId === bot.id && g.kind === 'advance')
  ).toBe(false);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('a remembered Nexus turret becomes a hazard again on its public calendar without consulting hidden health or respawn state', () => {
  const w = createLaneMatch(battlefield());
  const tower = w.units.find((u) => u.team === 'red' && u.structure?.role === 'nexus-turret')!;
  tower.structureKnowledge!.blue = 10;
  w.tick = 10 + STRUCTURE_RESPAWN_TICKS['nexus-turret'] - 1;
  expect((w as any).knownTeamTowers('blue')).not.toContain(tower);
  w.tick++;
  expect(w.visible(tower, 'blue')).toBe(false);
  expect((w as any).knownTeamTowers('blue')).toContain(tower);
  tower.hp = 1;
  tower.respawnTick = w.tick + 100000;
  expect((w as any).knownTeamTowers('blue')).toContain(tower);
});
