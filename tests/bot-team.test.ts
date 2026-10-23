import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  planTeam,
  type TeamActor,
  type TeamObservation,
  type SeenStructure,
} from '../src/simulation/bot-team';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { direction } from '../src/simulation/math';
const actor = (id = 1, role: TeamActor['role'] = 'jungle', x = 0): TeamActor => ({
  id,
  role,
  x,
  y: 0,
  hp: 100,
  maxHp: 100,
  damage: 60,
  attackPeriod: 90,
  controlled: true,
  available: true,
  clearing: false,
  companionComplete: false,
  level: 4,
});
const structure = (id = 20, x = 1800, kind: SeenStructure['kind'] = 'turret'): SeenStructure => ({
  id,
  x,
  y: 0,
  kind,
  hp: 1000,
  maxHp: 1000,
  range: 750,
  attackable: true,
});
const observed = (): TeamObservation => ({
  tick: 100,
  home: { x: -6000, y: 0 },
  actors: [actor()],
  minions: [],
  enemies: [],
  enemyMinions: [],
  ownStructures: [],
  enemyStructures: [],
  knownStructures: [],
  scuttlers: [],
  towers: [],
  gone: new Set(),
});
test('teams defend a threatened base with available controlled responders while the human and healing actors keep their control', () => {
  const o = observed();
  o.actors = [
    actor(),
    actor(2, 'mid', 300),
    { ...actor(3, 'carry', 400), controlled: false },
    { ...actor(4, 'support', 200), available: false },
  ];
  o.ownStructures = [{ ...structure(20, 1000, 'nexus'), hp: 200 }];
  o.enemies = [{ ...actor(9, 'mid', 1100) }];
  const goals = planTeam([], o);
  expect(goals.map((g) => g.unitId)).toEqual([1, 2]);
  expect(goals.every((g) => g.kind === 'defend' && g.targetId === 20)).toBe(true);
  expect(planTeam([], { ...o, enemies: [] })).toEqual([]);
});
test('a visible exposed structure with allied wave cover draws jungle help, while protection and an overwhelming visible defense cancel it', () => {
  const o = observed();
  o.enemyStructures = [structure(20, 1600)];
  o.minions = [{ x: 1300, y: 0, lane: 'mid' }];
  expect(planTeam([], o)).toMatchObject([{ kind: 'push', point: { x: 700, y: 0 }, targetId: 20 }]);
  expect(planTeam([], { ...o, minions: [] })).toEqual([]);
  expect(
    planTeam([], { ...o, enemyStructures: [{ ...o.enemyStructures[0], attackable: false }] })
  ).toEqual([]);
  expect(planTeam([], { ...o, enemies: [{ ...actor(9, 'top', 1700), damage: 600 }] })).toEqual([]);
});
test('ganks require nearby allied participation and avoid remembered tower ranges even when the tower is currently unseen', () => {
  const o = observed();
  o.actors = [...o.actors, { ...actor(2, 'mid', 2100), controlled: false }];
  o.enemies = [{ ...actor(9, 'top', 2500), hp: 35 }];
  expect(planTeam([], o)).toMatchObject([{ kind: 'gank', targetId: 9, point: { x: 2500, y: 0 } }]);
  expect(planTeam([], { ...o, actors: [actor()] })).toEqual([]);
  expect(planTeam([], { ...o, towers: [{ x: 2600, y: 0, range: 750 }] })).toEqual([]);
  expect(planTeam([], { ...o, actors: [{ ...actor(), clearing: true }, o.actors[1]] })).toEqual([]);
});
test('lost sight preserves only a copied three-second last-seen point and a seen death or newly unsafe target cancels the job', () => {
  const o = observed();
  o.actors = [...o.actors, { ...actor(2, 'mid', 2100), controlled: false }];
  o.enemies = [{ ...actor(9, 'top', 2500), hp: 35 }];
  const previous = planTeam([], o);
  o.enemies[0].x = 9999;
  const hidden = { ...o, tick: 160, enemies: [] };
  expect(planTeam(previous, hidden)).toMatchObject([
    { observedTick: 100, expiresTick: 280, point: { x: 2500, y: 0 } },
  ]);
  expect(planTeam(previous, { ...hidden, tick: 280 })).toEqual([]);
  expect(planTeam(previous, { ...hidden, gone: new Set([9]) })).toEqual([]);
  expect(
    planTeam(previous, {
      ...o,
      tick: 160,
      enemies: [{ ...actor(9, 'top', 2500), hp: 35 }],
      towers: [{ x: 2600, y: 0, range: 750 }],
    })
  ).toEqual([]);
});
test('visible Scuttlers are contested only with sufficient observed support and home-camp windups do not create offensive detours', () => {
  const o = observed();
  o.scuttlers = [{ id: 30, x: 1800, y: 0, hp: 1000, maxHp: 1000, attackable: true }];
  expect(planTeam([], o)).toMatchObject([{ kind: 'river', targetId: 30 }]);
  expect(planTeam([], { ...o, scuttlers: [] })).toEqual([]);
  const contested = { ...o, enemies: [{ ...actor(9, 'top', 2700) }] };
  expect(planTeam([], contested)).toEqual([]);
  expect(
    planTeam([], {
      ...contested,
      actors: [actor(), { ...actor(2, 'mid', 900), controlled: false }],
    })
  ).toMatchObject([{ kind: 'river' }]);
  expect(planTeam([], { ...o, actors: [{ ...actor(), clearing: true }] })).toEqual([]);
});
test('small score changes retain a gank commitment, but urgent defense preempts it', () => {
  const o = observed();
  o.actors = [...o.actors, { ...actor(2, 'mid', 2100), controlled: false }];
  o.enemies = [{ ...actor(9, 'top', 2500), hp: 40 }];
  const previous = planTeam([], o);
  const renewed = planTeam(previous, {
    ...o,
    tick: 160,
    enemies: [...o.enemies, { ...actor(10, 'top', 2600), hp: 30 }],
  });
  expect(renewed[0].targetId).toBe(9);
  const overwhelmed = planTeam(previous, {
    ...o,
    tick: 160,
    enemies: [...o.enemies, { ...actor(10, 'top', 2600), damage: 600 }],
  });
  expect(overwhelmed).toEqual([]);
  const later = planTeam(previous, {
    ...o,
    tick: 160,
    enemies: [{ ...actor(9, 'top', 2480), hp: 35 }],
  });
  expect(later[0]).toMatchObject({
    targetId: 9,
    issuedTick: 100,
    observedTick: 160,
    expiresTick: 340,
  });
  const defense = planTeam(previous, {
    ...o,
    tick: 160,
    ownStructures: [{ ...structure(20, 2100, 'nexus'), hp: 100 }],
  });
  expect(defense[0].kind).toBe('defend');
});
const raw = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function fixture() {
  const w = createLaneMatch(rift);
  w.nextWaveTick = 1e9;
  for (const u of w.units) if (u.kind === 'champion') u.ai = false;
  const jungle = w.units.find(
    (u) => u.kind === 'champion' && u.team === 'blue' && w.championState(u.id)!.role === 'jungle'
  )!;
  jungle.ai = true;
  w.gainExperience(700, jungle.id);
  return { w, jungle };
}
function move(w: World, u: any, p: { x: number; y: number }) {
  const point = rift.reachable(p, u.radius, u.team);
  Object.assign(u, point, { previous: { ...point } });
  w.setOrder(u, { type: 'idle' });
}
test('a real Rift jungler joins an allied wave and damages an exposed turret through normal attacks, with exact saved strategy continuation', () => {
  const { w, jungle } = fixture();
  const tower = w.units.find(
    (u) => u.team === 'red' && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
  )!;
  const away = direction(tower, rift.spawns.blue);
  move(w, jungle, { x: tower.x + away.x * 1600, y: tower.y + away.y * 1600 });
  tower.hp = 100;
  for (let i = 0; i < 3; i++) {
    const m = w.spawn(
      'melee',
      'blue',
      rift.reachable(
        { x: tower.x + away.x * (350 + i * 40), y: tower.y + away.y * (350 + i * 40) },
        35,
        'blue'
      )
    );
    m.damage = 0;
    m.hp = m.maxHp = 5000;
  }
  w.step(20);
  expect(w.teamPlans!.blue.assignments).toContainEqual(
    expect.objectContaining({ unitId: jungle.id, kind: 'push', targetId: tower.id })
  );
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, rift);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
  let attacking = false;
  for (let t = 0; t < 1800 && tower.hp > 0; t++) {
    w.step();
    if (jungle.attackTarget === tower.id) attacking = true;
  }
  expect(attacking).toBe(true);
  expect(tower.hp).toBeLessThan(100);
  expect(jungle.lane).toBeNull();
}, 30000);
test('a visible river target is selected, fought and secured by the actual jungle bot', () => {
  const { w, jungle } = fixture();
  w.tick = 10499;
  w.step();
  const crab = w.units.find(
    (u) => u.kind === 'monster' && u.monster.species === 'scuttler' && w.alive(u)
  )!;
  move(w, jungle, { x: crab.x + 350, y: crab.y });
  w.teamPlans!.blue.nextThinkTick = w.tick + 1;
  w.step(20);
  expect(w.teamPlans!.blue.assignments).toContainEqual(
    expect.objectContaining({ unitId: jungle.id, kind: 'river', targetId: crab.id })
  );
  for (let i = 0; i < 3600 && w.unit(crab.id)?.hp !== 0; i++) {
    w.step();
    if (!w.unit(crab.id)) break;
  }
  expect(!w.unit(crab.id) || !w.alive(w.unit(crab.id)!)).toBe(true);
  expect(w.scuttlers!.shrines.some((s) => s.team === 'blue')).toBe(true);
  expect(w.championState(jungle.id)!.smite!.charges).toBeLessThan(2);
  expect(jungle.lane).toBeNull();
  World.fromSnapshot(w.snapshot(), rift);
}, 30000);
test('saved team jobs reject foreign actors, wrong targets, missing plans, duplicate jobs and future or expired memory', () => {
  const { w, jungle } = fixture();
  w.step();
  const base = JSON.parse(w.snapshot());
  const target = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  const goal = {
    unitId: jungle.id,
    kind: 'gank',
    targetId: target.id,
    point: { x: target.x, y: target.y },
    score: 90,
    issuedTick: w.tick,
    observedTick: w.tick,
    expiresTick: w.tick + 180,
  };
  base.teamPlans.blue.assignments = [goal];
  expect(() => World.fromSnapshot(JSON.stringify(base), rift)).not.toThrow();
  for (const mutate of [
    (s: any) => (s.teamPlans = null),
    (s: any) => s.teamPlans.blue.assignments.push({ ...goal }),
    (s: any) => (s.teamPlans.blue.assignments[0].unitId = target.id),
    (s: any) => (s.teamPlans.blue.assignments[0].targetId = jungle.id),
    (s: any) => s.teamPlans.blue.assignments[0].observedTick++,
    (s: any) => s.teamPlans.blue.assignments[0].expiresTick--,
    (s: any) => (s.teamPlans.blue.nextThinkTick = s.tick + 61),
  ]) {
    const bad = structuredClone(base);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), rift)).toThrow();
  }
});

test('a retained gank follows its observed point through fog, independently of an unseen opponent moving or changing health', () => {
  const { w, jungle } = fixture();
  const ally = w.units.find(
    (u) => u.kind === 'champion' && u.team === 'blue' && w.championState(u.id)!.role === 'mid'
  )!;
  const enemy = w.units.find(
    (u) => u.kind === 'champion' && u.team === 'red' && w.championState(u.id)!.role === 'mid'
  )!;
  move(w, jungle, { x: -1200, y: 900 });
  move(w, ally, { x: 250, y: 0 });
  move(w, enemy, { x: 500, y: 0 });
  enemy.hp = 100;
  w.step();
  const goal = w.teamPlans!.blue.assignments.find((g) => g.unitId === jungle.id)!;
  expect(goal.kind).toBe('gank');
  const copy = World.fromSnapshot(w.snapshot(), rift);
  for (const [i, x] of [w, copy].entries()) {
    const e = x.unit(enemy.id)!;
    move(x, e, { x: rift.spawns.red.x - 1200 - i * 300, y: rift.spawns.red.y + 800 });
    e.hp = i ? 1 : 100;
    x.step(60);
    expect(x.visible(e, 'blue')).toBe(false);
    expect(x.teamPlans!.blue.assignments.find((g) => g.unitId === jungle.id)).toMatchObject({
      observedTick: goal.observedTick,
      point: goal.point,
    });
  }
  expect(copy.unit(jungle.id)!.order).toEqual(w.unit(jungle.id)!.order);
  expect({ x: copy.unit(jungle.id)!.x, y: copy.unit(jungle.id)!.y }).toEqual({
    x: jungle.x,
    y: jungle.y,
  });
});
test('remembered intact towers block a strategic crossing even if their unseen actual health changes', () => {
  const { w, jungle } = fixture();
  const tower = w.units.find(
    (u) => u.team === 'red' && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
  )!;
  const away = direction(tower, rift.spawns.blue),
    point = { x: tower.x - away.x * 1400, y: tower.y - away.y * 1400 };
  move(w, jungle, { x: tower.x + away.x * 2500, y: tower.y + away.y * 2500 });
  const enemy = w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  w.teamPlans!.blue.assignments = [
    {
      unitId: jungle.id,
      kind: 'gank',
      targetId: enemy.id,
      point,
      issuedTick: 0,
      observedTick: 0,
      expiresTick: 180,
      score: 90,
    },
  ];
  const copy = World.fromSnapshot(w.snapshot(), rift);
  copy.unit(tower.id)!.hp = 0;
  for (const x of [w, copy]) {
    x.step(20);
    expect(x.visible(x.unit(tower.id)!, 'blue')).toBe(false);
    expect(x.unit(jungle.id)!.lane).toBeNull();
  }
  expect(copy.unit(jungle.id)!.order).toEqual(jungle.order);
  expect(jungle.order).not.toEqual({
    type: 'move',
    point: rift.reachable(point, jungle.radius, 'blue'),
  });
});
