import { expect, test } from 'vitest';
import {
  ahriWaveClear,
  type AhriWaveMinion,
  type AhriWaveObservation,
} from '../src/simulation/ahri-wave-clear';
import { AHRI_Q_POLICY } from '../src/content/ahri-q-policy';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { assignRole } from '../src/simulation/bot-jungle';
import { sweepCircle } from '../src/simulation/math';
import { World } from '../src/simulation/world';

const minion = (id: number, x: number, y = 0): AhriWaveMinion => ({
  id,
  x,
  y,
  radius: 35,
  hp: 200,
  magicResist: 0,
  shield: 0,
  claimed: false,
});
const observe = (minions: AhriWaveMinion[]): AhriWaveObservation => ({
  actor: { x: 0, y: 0 },
  minions,
  damage: 100,
  mana: 500,
  manaCost: 55,
  reserve: 150,
  farmAllowed: true,
  lastHitReady: false,
});
const polar = (id: number, angle: number, d = 700) =>
  minion(id, Math.cos(angle) * d, Math.sin(angle) * d);
const hit = (o: AhriWaveObservation, point: { x: number; y: number }, m: AhriWaveMinion) =>
  sweepCircle(o.actor, point, m, AHRI_Q_POLICY.collisionRadius + m.radius) !== null;

test('Q aims through a shared narrow corridor that misses one target at each minion center', () => {
  const center = 1.13;
  const o = observe([polar(1, center - 0.17), polar(2, center + 0.04), polar(3, center + 0.17)]);
  for (const m of o.minions) {
    const d = Math.hypot(m.x, m.y);
    expect(
      o.minions.filter((n) => hit(o, { x: (m.x * 1000) / d, y: (m.y * 1000) / d }, n)).length
    ).toBeLessThan(3);
  }
  const point = ahriWaveClear(o)!;
  expect(point).not.toBeNull();
  expect(Math.hypot(point.x, point.y)).toBeCloseTo(1000, 8);
  expect(o.minions.every((m) => hit(o, point, m))).toBe(true);
});

test('angular wraparound and translated opposing-side observations retain valid copied aims', () => {
  for (const center of [-0.02, Math.PI + 0.3]) {
    const o = observe([polar(1, center - 0.16), polar(2, center + 0.03), polar(3, center + 0.16)]);
    o.actor = { x: 900, y: -700 };
    o.minions = o.minions.map((m) => ({ ...m, x: m.x + 900, y: m.y - 700 }));
    const point = ahriWaveClear(o)!;
    expect(point).not.toBeNull();
    expect(o.minions.every((m) => hit(o, point, m))).toBe(true);
    const before = { ...point };
    o.minions[0].x = 99999;
    expect(point).toEqual(before);
  }
});

test('finite endpoint coverage includes reachable edge circles without aiming past range', () => {
  const o = observe([polar(1, -0.01, 1120), polar(2, 0, 1120), polar(3, 0.01, 1120)]);
  const point = ahriWaveClear(o)!;
  expect(point).not.toBeNull();
  expect(Math.hypot(point.x, point.y)).toBeCloseTo(1000, 8);
  expect(o.minions.every((m) => hit(o, point, m))).toBe(true);
  expect(
    ahriWaveClear(observe([polar(1, 0, 1140), polar(2, 0.01, 1140), polar(3, -0.01, 1140)]))
  ).toBeNull();
});

test('circles covering the caster are handled without a zero-length aim', () => {
  const o = observe([minion(1, 0), minion(2, 10, 20), minion(3, -50)]);
  const point = ahriWaveClear(o)!;
  expect(point).not.toEqual(o.actor);
  expect(o.minions.every((m) => hit(o, point, m))).toBe(true);
});

test('analytic aim value meets independent dense segment-distance searches across rotated waves', () => {
  for (let rotation = 0; rotation < 24; rotation++) {
    const center = (rotation * Math.PI) / 12 + 0.037;
    const o = observe(
      [
        polar(1, center - 0.17),
        polar(2, center + 0.04),
        polar(3, center + 0.17),
        polar(4, center + 0.8, 900),
        polar(5, center + 1.1, 600),
        polar(6, center + 2, 1120),
        polar(7, center + 2.02, 1120),
        polar(8, center + 2.04, 1120),
      ].map((m) => ({ ...m, hp: 100 + m.id * 12, magicResist: m.id * 7 }))
    );
    // Independently project each center onto a finite segment, without using
    // the planner's tangent intervals or the simulation collision quadratic.
    const value = (point: { x: number; y: number }) => {
      const hits = o.minions.filter((m) => {
        const t = Math.max(0, Math.min(1, (m.x * point.x + m.y * point.y) / 1e6));
        return Math.hypot(m.x - point.x * t, m.y - point.y * t) <= 127 + 1e-7;
      });
      if (hits.length < 3) return 0;
      return hits.reduce((sum, m) => sum + Math.min(m.hp, (100 * 100) / (100 + m.magicResist)), 0);
    };
    let sampled = 0;
    for (let i = 0; i < 1440; i++) {
      const angle = (i * Math.PI) / 720;
      sampled = Math.max(sampled, value({ x: Math.cos(angle) * 1000, y: Math.sin(angle) * 1000 }));
    }
    const point = ahriWaveClear(o);
    expect(point).not.toBeNull();
    expect(value(point!) + 1e-7).toBeGreaterThanOrEqual(sampled);
  }
});

test('dispersed or small waves, low useful damage and claimed bodies do not justify a Q', () => {
  expect(ahriWaveClear(observe([polar(1, 0), polar(2, 2), polar(3, 4)]))).toBeNull();
  const o = observe([minion(1, 700), minion(2, 800), minion(3, 900)]);
  for (const change of [
    o.minions.slice(1),
    o.minions.map((m) => ({ ...m, hp: 1 })),
    o.minions.map((m) => ({ ...m, magicResist: 10000 })),
    o.minions.map((m, i) => ({ ...m, claimed: i === 0 })),
  ])
    expect(ahriWaveClear({ ...o, minions: change })).toBeNull();
});

test('ordinary wave casts keep the exact mana reserve, farm boundary and ready basic last hit', () => {
  const o = observe([minion(1, 700), minion(2, 800), minion(3, 900)]);
  expect(ahriWaveClear({ ...o, mana: 205 })).not.toBeNull();
  expect(ahriWaveClear({ ...o, mana: 204.99 })).toBeNull();
  expect(ahriWaveClear({ ...o, farmAllowed: false })).toBeNull();
  expect(ahriWaveClear({ ...o, lastHitReady: true })).toBeNull();
});

test('enumeration, excess candidates, resistance, health and shields produce a deterministic useful corridor', () => {
  const wave = Array.from({ length: 40 }, (_, i) => ({
    ...polar(i + 1, ((i % 8) * Math.PI) / 4, 300 + Math.floor(i / 8) * 100),
    hp: 30 + i * 3,
    shield: (i % 3) * 10,
    magicResist: (i % 4) * 10,
  }));
  const o = observe(wave);
  const point = ahriWaveClear(o);
  expect(point).not.toBeNull();
  expect(ahriWaveClear({ ...o, minions: [...wave].reverse() })).toEqual(point);
});

function setup(team: 'blue' | 'red' = 'blue') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    inBrush: () => false,
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 }, 'ahri');
  bot.ai = true;
  bot.nextThink = 0;
  const state = w.championState(bot.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  const wave = [700, 800, 900].map((x) => {
    const m = w.spawn('caster', team === 'blue' ? 'red' : 'blue', { x, y: 0 });
    m.ai = false;
    m.hp = 50;
    m.magicResist = 0;
    return m;
  });
  const casts = () => w.commands.filter((c) => c.type === 'cast' && c.unit === bot.id);
  return { w, bot, state, wave, casts };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} learned Q farms a real wave with own damage, resources and exact saved futures`, () => {
    const { w, bot, state, wave, casts } = setup(team);
    const mana = bot.mana;
    w.step();
    expect(state.spellRanks.q).toBe(1);
    expect(casts()).toMatchObject([{ ability: 'q' }]);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(180);
    copy.step(180);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(wave.every((m) => !w.alive(m))).toBe(true);
    expect(state.cs).toBe(3);
    expect(bot.mana).toBeLessThan(mana);
    expect(state.cooldowns.q).toBeGreaterThan(w.tick);
    expect(w.ahriOrbs.length).toBe(0);
  });

test('hidden minion positions and health cannot add a useful wave or alter its aim', () => {
  const aims: unknown[] = [];
  for (const x of [100, 800, 3000]) {
    const { w, casts } = setup();
    const hidden = w.spawn('caster', 'red', { x, y: 100 });
    hidden.ai = false;
    hidden.hp = x;
    w.battlefield.lineOfSight = (_a, b) => b.y !== 100;
    w.step();
    aims.push(casts());
  }
  expect(aims[1]).toEqual(aims[0]);
  expect(aims[2]).toEqual(aims[0]);
  const { w, casts } = setup();
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(casts()).toEqual([]);
});

test('nearby carry farm, jungle assignment, low mana, retreat and silence preserve ordinary priorities', () => {
  for (const condition of ['carry', 'jungle', 'mana', 'retreat', 'silence'] as const) {
    const { w, bot, state, casts } = setup();
    if (condition === 'carry') {
      w.hero.x = w.hero.y = 0;
      assignRole(w.player, 'carry');
      assignRole(state, 'support');
    }
    if (condition === 'jungle') assignRole(state, 'jungle');
    if (condition === 'mana') bot.mana = 100;
    if (condition === 'retreat') bot.hp = bot.maxHp * 0.1;
    if (condition === 'silence') bot.silenceUntil = 100;
    w.step();
    expect(casts(), condition).toEqual([]);
  }
});

test('ready basic last hits and committed attacks do not get replaced by wave Q', () => {
  for (const committed of [false, true]) {
    const { w, bot, wave, casts } = setup();
    wave[0].x = 300;
    wave[0].hp = 1;
    if (committed) {
      bot.ai = false;
      w.setOrder(bot, { type: 'attack', target: wave[0].id });
      w.step();
      expect(bot.releaseTick).not.toBeNull();
      bot.ai = true;
      bot.nextThink = 0;
    }
    w.step();
    expect(casts()).toEqual([]);
    expect(bot.attackTarget).toBe(wave[0].id);
  }
});

test('visible champion combat precedes farming and observed turret danger prevents wave Q', () => {
  const combat = setup();
  const enemy = combat.w.spawn('champion', 'red', { x: 800, y: 200 });
  enemy.ai = false;
  combat.w.step();
  expect(combat.casts()).toContainEqual({
    type: 'cast',
    unit: combat.bot.id,
    ability: 'q',
    point: { x: enemy.x, y: enemy.y },
  });
  const danger = setup();
  danger.w.spawn('turret', 'red', { x: 500, y: 0 }).ai = false;
  danger.w.spawn('melee', 'blue', { x: 400, y: 0 }).ai = false;
  danger.w.step();
  expect(danger.casts()).toEqual([]);
});

test('queued Q aim stays copied through fog and new silence rejects its ordinary dispatch', () => {
  const { w, bot, state, wave, casts } = setup();
  w.step();
  const aim = structuredClone(casts()[0]);
  for (const m of wave) {
    m.x = 3000;
    m.y = 1000;
  }
  w.battlefield.lineOfSight = () => false;
  w.step();
  expect(state.pendingCast?.point).toEqual(aim.type === 'cast' ? aim.point : null);
  const rejected = setup();
  rejected.w.step();
  rejected.bot.silenceUntil = 100;
  const mana = rejected.bot.mana;
  rejected.w.step();
  expect(rejected.state.pendingCast).toBeNull();
  expect(rejected.bot.mana).toBeGreaterThanOrEqual(mana);
  expect(bot.champion).toBe('ahri');
});
