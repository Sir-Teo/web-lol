import { expect, test } from 'vitest';
import {
  luxWaveClear,
  type WaveObservation,
  type WaveMinion,
} from '../src/simulation/lux-wave-clear';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { assignRole } from '../src/simulation/bot-jungle';
const minion = (id: number, x: number, y = 0): WaveMinion => ({
  id,
  x,
  y,
  radius: 35,
  hp: 1000,
  magicResist: 0,
  shield: 0,
  claimed: false,
  baseThreat: false,
  super: false,
});
const observe = (minions: WaveMinion[]): WaveObservation => ({
  actor: { x: 0, y: 0 },
  minions,
  damage: 300,
  mana: 500,
  manaCost: 70,
  reserve: 150,
  farmAllowed: true,
  lastHitReady: false,
  zone: null,
});
test('E finds a shared cast point for a spread wave and stays inside the normal cast radius', () => {
  const o = observe([minion(1, 700, -250), minion(2, 700, 250), minion(3, 1100, 0)]);
  const p = luxWaveClear(o)!;
  expect(p).not.toBeNull();
  expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1100.000001);
  for (const m of o.minions) expect(Math.hypot(p.x - m.x, p.y - m.y)).toBeLessThan(345);
  const copy = { ...p };
  o.minions[0].x = 9999;
  expect(p).toEqual(copy);
});
test('edge-of-range coverage does not require chasing the wave and out-of-reach or dispersed groups do not consume E', () => {
  const o = observe([minion(1, 1360, -80), minion(2, 1390, 0), minion(3, 1360, 80)]);
  expect(luxWaveClear(o)).not.toBeNull();
  expect(
    luxWaveClear(observe([minion(1, 1800, -80), minion(2, 1800, 0), minion(3, 1800, 80)]))
  ).toBeNull();
  expect(
    luxWaveClear(observe([minion(1, 400, -650), minion(2, 1000, 0), minion(3, 400, 650)]))
  ).toBeNull();
});
test('normal clears preserve mana and ready basic last hits, exclude claimed minions and reject wasteful damage into high resistance', () => {
  const o = observe([minion(1, 700), minion(2, 800), minion(3, 900)]);
  expect(luxWaveClear({ ...o, mana: 219 })).toBeNull();
  expect(luxWaveClear({ ...o, lastHitReady: true })).toBeNull();
  expect(
    luxWaveClear({ ...o, minions: o.minions.map((m, i) => ({ ...m, claimed: i === 0 })) })
  ).toBeNull();
  expect(
    luxWaveClear({ ...o, minions: o.minions.map((m) => ({ ...m, magicResist: 10000 })) })
  ).toBeNull();
  expect(luxWaveClear({ ...o, minions: o.minions.map((m) => ({ ...m, hp: 1 })) })).toBeNull();
});
test('nearby carry farm is left alone, but observed base pressure can justify the last affordable E', () => {
  const o = {
    ...observe([minion(1, 700), minion(2, 800), minion(3, 900)]),
    farmAllowed: false,
    mana: 70,
  };
  expect(luxWaveClear(o)).toBeNull();
  expect(
    luxWaveClear({ ...o, minions: o.minions.map((m) => ({ ...m, baseThreat: true })) })
  ).not.toBeNull();
  const single = [{ ...minion(1, 700), baseThreat: true, super: true }];
  expect(luxWaveClear({ ...o, minions: single })).not.toBeNull();
  expect(luxWaveClear({ ...o, minions: [{ ...single[0], super: false }] })).toBeNull();
  expect(luxWaveClear({ ...o, minions: single, mana: 69 })).toBeNull();
});
test('an armed wave zone recasts at zero mana using captured damage, while flight and an existing request wait', () => {
  const o = {
    ...observe([minion(1, 700), minion(2, 800), minion(3, 900)]),
    mana: 0,
    lastHitReady: true,
    zone: { x: 800, y: 0, arrived: true, requested: false },
  };
  expect(luxWaveClear(o)).toEqual({ x: 800, y: 0 });
  expect(luxWaveClear({ ...o, minions: [o.minions[1]] })).toEqual({ x: 800, y: 0 });
  expect(luxWaveClear({ ...o, zone: { ...o.zone, arrived: false } })).toBeNull();
  expect(luxWaveClear({ ...o, zone: { ...o.zone, requested: true } })).toBeNull();
  expect(luxWaveClear({ ...o, minions: [] })).toBeNull();
});
test('input enumeration does not change a deterministic area choice', () => {
  const o = observe([
    minion(1, 650, -120),
    minion(2, 780, 0),
    minion(3, 650, 120),
    minion(4, 900, 80),
  ]);
  expect(luxWaveClear({ ...o, minions: [...o.minions].reverse() })).toEqual(luxWaveClear(o));
});
function setup(team: 'blue' | 'red' = 'blue', visible = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => visible,
    inBrush: () => false,
  });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', team, { x: 0, y: 0 }, 'lux');
  lux.ai = true;
  lux.nextThink = 0;
  const state = w.championState(lux.id)!;
  state.trinket.charges = 0;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  const enemy = team === 'blue' ? 'red' : 'blue';
  const wave = [700, 800, 900].map((x) => {
    const m = w.spawn('caster', enemy, { x, y: 0 });
    m.hp = 40;
    return m;
  });
  const casts = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === lux.id && c.ability === 'e');
  return { w, lux, state, wave, casts };
}
for (const team of ['blue', 'red'] as const) {
  test(`${team} Lux clears a real wounded wave through paid E casts and free recast with exact saved continuation`, () => {
    const { w, lux, state, wave, casts } = setup(team);
    const mana = lux.mana;
    w.step();
    expect(casts()).toHaveLength(1);
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    let recast = false;
    for (let tick = 0; tick < 100; tick++) {
      w.step();
      saved.step();
      if (w.singularities.some((z) => z.arrivalTick !== null) && casts().length) recast = true;
    }
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(wave.every((m) => !w.alive(m))).toBe(true);
    expect(state.cs).toBe(3);
    expect(lux.mana).toBeLessThan(mana);
    expect(state.cooldowns.e).toBeGreaterThan(w.tick);
    expect(recast).toBe(true);
    expect(w.singularities.every((z) => z.detonatedTick !== null)).toBe(true);
  });
}
test('actual hidden waves cannot select a cast, and low mana or a committed windup keeps normal priorities', () => {
  const hidden = setup('blue', false);
  hidden.w.step();
  expect(hidden.casts()).toEqual([]);
  const poor = setup();
  poor.lux.mana = 100;
  poor.w.step();
  expect(poor.casts()).toEqual([]);
  const committed = setup();
  const target = committed.wave[0];
  target.x = 300;
  committed.w.setOrder(committed.lux, { type: 'attack', target: target.id });
  committed.lux.releaseTick = 20;
  committed.lux.attackTarget = target.id;
  committed.w.step();
  expect(committed.casts()).toEqual([]);
  expect(committed.lux.releaseTick).toBe(20);
});
test('support E preserves nearby carry farm unless a visible wave threatens the allied base', () => {
  for (const emergency of [false, true]) {
    const { w, state, wave, casts } = setup();
    w.hero.x = w.hero.y = 0;
    assignRole(w.player, 'carry');
    assignRole(state, 'support');
    if (emergency) {
      w.spawn('nexus', 'blue', { x: 1000, y: 0 });
      wave[0].hp = wave[0].maxHp;
    }
    w.step();
    expect(casts().length > 0).toBe(emergency);
  }
});

test('visible champion combat takes priority over an otherwise useful wave cast', () => {
  const { w, lux, casts } = setup();
  const enemy = w.spawn('champion', 'red', { x: 850, y: 200 });
  w.step();
  expect(casts()).toEqual([]);
  expect(w.commands).toContainEqual({
    type: 'cast',
    unit: lux.id,
    ability: 'q',
    point: { x: enemy.x, y: enemy.y },
  });
});
test('retreat and silence prevent a wave cast even when a useful visible cluster is present', () => {
  const retreat = setup();
  retreat.lux.hp = retreat.lux.maxHp * 0.1;
  retreat.w.step();
  expect(retreat.casts()).toEqual([]);
  expect(retreat.lux.aiRetreating).toBe(true);
  const silence = setup();
  silence.lux.silenceUntil = 100;
  silence.w.step();
  expect(silence.casts()).toEqual([]);
});
test('a queued wave aim does not track minions that move unseen before the command is accepted', () => {
  const { w, lux, casts } = setup();
  w.step();
  const aim = (casts()[0] as any).point;
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const [i, world] of [w, copy].entries()) {
    for (const m of world.units.filter((u) => u.kind === 'caster')) {
      m.x = 3000 + i * 1500;
      m.y = 0;
      world.setOrder(m, { type: 'idle' });
      expect(world.visible(m, 'blue')).toBe(false);
    }
    world.step(2);
    expect(world.championState(lux.id)!.pendingCast!.point).toEqual(aim);
  }
  expect(copy.championState(lux.id)!.pendingCast).toEqual(w.championState(lux.id)!.pendingCast);
});

test('wave casts can use allied turret cover, while uncovered danger or a planned champion splash keeps tower safety', () => {
  for (const mode of ['covered', 'uncovered', 'champion-splash'] as const) {
    const { w, lux, casts } = setup();
    w.spawn('turret', 'red', { x: 600, y: 0 });
    if (mode !== 'uncovered') w.spawn('melee', 'blue', { x: 500, y: 0 });
    if (mode === 'champion-splash') w.spawn('champion', 'red', { x: 800, y: 100 });
    w.step();
    expect(casts().length > 0).toBe(mode === 'covered');
    if (mode === 'uncovered') expect(lux.order.type).toBe('move');
  }
});
