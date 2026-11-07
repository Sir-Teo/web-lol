import { expect, test } from 'vitest';
import type { Projectile, Unit } from '../src/simulation/types';
import {
  advanceEVisualHistory,
  attachEVisualBuff,
  beginEVisualHistory,
  cancelEVisualCast,
  endEVisualBuffForTarget,
  endEVisualFlight,
  eVisualEndTick,
  finishAllEVisualHistory,
  launchEVisualHistory,
  pruneEVisualHistory,
  refreshEVisualAudience,
  sampleEVisualFlight,
  type EVisualObserverWorld,
} from '../src/simulation/ahri-e-visual-history';

function fixture(two = false) {
  const source = {
    id: 1,
    champion: 'ahri',
    team: 'blue',
    x: 0,
    y: 0,
    facing: 0,
    radius: 35,
    hp: 100,
    charm: null,
  } as Unit;
  const target = {
    id: 2,
    champion: 'lux',
    team: 'red',
    x: 50,
    y: 0,
    facing: 1,
    radius: 35,
    hp: 100,
    charm: null,
  } as Unit;
  const other = { ...source, id: 4, x: -20 } as Unit;
  const units = [source, target, ...(two ? [other] : [])];
  let known = false;
  const pending = new Map([
    [source.id, { ability: 'e', startTick: 1 }],
    ...(two ? ([[other.id, { ability: 'e', startTick: 1 }]] as const) : []),
  ]);
  const world: EVisualObserverWorld & { nextId: number; random: { state: number } } = {
    tick: 1,
    winner: null,
    ahriEVisuals: [],
    projectiles: [],
    nextId: 9,
    random: { state: 173 },
    unit: (id) => units.find((u) => u.id === id),
    alive: (u) => u.hp > 0,
    visible: (u, team) => u.team === team || known,
    pointVisible: () => known,
    championState: (id) => ({ pendingCast: pending.get(id) ?? null }),
  };
  const core = () =>
    JSON.stringify({
      units,
      projectiles: world.projectiles,
      pending: [...pending],
      nextId: world.nextId,
      random: world.random,
    });
  const pure = (fn: () => void) => {
    const saved = core();
    fn();
    expect(core()).toBe(saved);
  };
  pure(() => beginEVisualHistory(world, source, { x: 900, y: 0 }, 1, 16));
  if (two) pure(() => beginEVisualHistory(world, other, { x: 900, y: 0 }, 1, 16));
  const advance = (until: number) => {
    while (world.tick < until) {
      world.tick++;
      pure(() => advanceEVisualHistory(world));
    }
  };
  const launch = (unit = source, id = 3) => {
    advance(15);
    world.tick = 16;
    pending.delete(unit.id);
    const p: Projectile = {
      id,
      source: unit.id,
      team: 'blue',
      type: 'charm',
      charmRank: 1,
      x: unit.x,
      y: unit.y,
      origin: { x: unit.x, y: unit.y },
      previous: { x: unit.x, y: unit.y },
      direction: { x: 1, y: 0 },
      launchTick: 16,
      speed: 1550,
      radius: 60,
      remaining: 1000,
      target: null,
      volleyId: null,
      damage: 80,
    };
    world.projectiles.push(p);
    pure(() => launchEVisualHistory(world, 1, p));
    return p;
  };
  const record = () => world.ahriEVisuals![0];
  return {
    world,
    source,
    target,
    other,
    units,
    pending,
    pure,
    advance,
    launch,
    record,
    reveal: () => {
      known = true;
    },
  };
}

test('launch anchor and same-tick movement remain separate immutable observations without gameplay writes', () => {
  const f = fixture(),
    p = f.launch();
  const birth = f.record().sourceFrames[0];
  p.x = 1550 / 60;
  f.pure(() => {
    sampleEVisualFlight(f.world, p);
    advanceEVisualHistory(f.world);
  });
  const first = f.record().flightFrames[0];
  expect(first.tick).toBe(16);
  expect(first.previous).toEqual({ x: 0, y: 0 });
  expect(first.point.x).toBe(1550 / 60);
  expect(f.record().launch!.point).toEqual({ x: 0, y: 0 });
  expect(f.record().flightFrames).toHaveLength(1);
  f.source.x = -100;
  p.previous = { x: p.x, y: p.y };
  p.x += 1550 / 60;
  f.advance(17);
  expect(first.point.x).toBe(1550 / 60);
  expect(birth.point.x).toBe(0);
  expect(f.record().sourceFrames.at(-1)!.point.x).toBe(-100);
  expect(f.world.nextId).toBe(9);
  expect(f.world.random.state).toBe(173);
});

test('contact, target center and target-owned buff visibility remain distinct and refresh only current frames', () => {
  const f = fixture(),
    p = f.launch();
  f.pure(() => endEVisualFlight(f.world, p, { x: 0, y: 0 }, 'hit', f.target));
  f.target.charm = { sourceId: 1, rank: 1, startTick: 16, endTick: 88, tenacityApplied: false };
  f.pure(() => attachEVisualBuff(f.world, p, f.target));
  expect(f.record().hit!.point.x).toBe(0);
  expect(f.record().hit!.targetPoint.x).toBe(50);
  expect(f.record().hit!.audience).toEqual(['blue']);
  expect(f.record().hit!.targetAudience).toEqual(['red']);
  expect(f.record().buff!.audience).toEqual(['red']);
  const old = f.record().targetFrames[0];
  f.reveal();
  f.pure(() => refreshEVisualAudience(f.world));
  expect(f.record().buff!.audience).toEqual(['blue', 'red']);
  expect(f.record().targetFrames[0].audience).toEqual(['blue', 'red']);
  expect(old.audience).toEqual(['red']);
  f.target.x = 70;
  expect(f.record().hit!.targetPoint.x).toBe(50);
  expect(f.record().buff!.control).not.toBe(f.target.charm);
});

test('a same-tick replacement closes older control without changing sampled ownership or target state', () => {
  const f = fixture(true),
    first = f.launch(),
    second = f.launch(f.other, 5);
  f.pure(() => endEVisualFlight(f.world, first, first, 'hit', f.target));
  f.target.charm = { sourceId: 1, rank: 1, startTick: 16, endTick: 88, tenacityApplied: false };
  f.pure(() => attachEVisualBuff(f.world, first, f.target));
  f.pure(() => endEVisualBuffForTarget(f.world, f.target, 'replaced'));
  f.target.charm = { sourceId: 4, rank: 1, startTick: 16, endTick: 45, tenacityApplied: true };
  f.pure(() => {
    endEVisualFlight(f.world, second, second, 'hit', f.target);
    attachEVisualBuff(f.world, second, f.target);
  });
  const [a, b] = f.world.ahriEVisuals!;
  expect(a.buff!.stop).toEqual({ tick: 16, reason: 'replaced' });
  expect(a.buff!.control.sourceId).toBe(1);
  expect(b.buff!.control.sourceId).toBe(4);
  expect(b.buff!.control.tenacityApplied).toBe(true);
  expect(b.buff!.stop).toBeNull();
  expect(eVisualEndTick(a)).toBe(16);
  expect(eVisualEndTick(b)).toBe(Infinity);
  f.world.tick = 316;
  f.pure(() => pruneEVisualHistory(f.world, 300));
  expect(f.world.ahriEVisuals).toEqual([b]);
});

test('lethal or immune contact does not invent control, and terminal removal does not invent movement', () => {
  const f = fixture(),
    p = f.launch();
  f.pure(() => endEVisualFlight(f.world, p, p, 'hit', f.target));
  f.target.hp = 0;
  f.pure(() => attachEVisualBuff(f.world, p, f.target));
  expect(f.record().buff).toBeNull();
  const saved = JSON.stringify(f.record().stop);
  f.pure(() => endEVisualFlight(f.world, p, { x: 900, y: 0 }, 'range'));
  expect(JSON.stringify(f.record().stop)).toBe(saved);
  const terminal = fixture(),
    shot = terminal.launch();
  expect(terminal.record().flightFrames).toEqual([]);
  terminal.world.winner = 'blue';
  terminal.pure(() => finishAllEVisualHistory(terminal.world));
  expect(terminal.record().stop).toMatchObject({
    tick: 16,
    reason: 'match-end',
    point: shot.origin,
  });
  expect(terminal.record().flightFrames).toEqual([]);
});

test('natural expiry, direct death and canceled windup end only their own presentation ownership', () => {
  const f = fixture(),
    p = f.launch();
  f.pure(() => endEVisualFlight(f.world, p, p, 'hit', f.target));
  f.target.charm = { sourceId: 1, rank: 1, startTick: 16, endTick: 18, tenacityApplied: true };
  f.pure(() => attachEVisualBuff(f.world, p, f.target));
  f.world.projectiles = [];
  // Complete the launch/contact tick before the next fixed-step observation.
  f.pure(() => advanceEVisualHistory(f.world));
  f.advance(17);
  f.target.charm = null;
  f.advance(18);
  expect(f.record().buff!.stop).toEqual({ tick: 18, reason: 'expired' });
  const death = fixture(),
    shot = death.launch();
  death.pure(() => endEVisualFlight(death.world, shot, shot, 'hit', death.target));
  death.target.charm = { sourceId: 1, rank: 1, startTick: 16, endTick: 88, tenacityApplied: false };
  death.pure(() => attachEVisualBuff(death.world, shot, death.target));
  death.pure(() => endEVisualBuffForTarget(death.world, death.target, 'death'));
  expect(death.record().buff!.stop).toEqual({ tick: 16, reason: 'death' });
  const canceled = fixture();
  canceled.advance(5);
  canceled.pure(() => cancelEVisualCast(canceled.world, 1, 'death'));
  expect(canceled.record().cancel).toEqual({ tick: 5, reason: 'death' });
  expect(canceled.record().launch).toBeNull();
});

test('optional observers stay inert and duplicate/gapped identities fail before partial observations', () => {
  const f = fixture();
  expect(() => beginEVisualHistory(f.world, f.source, f.source, 1, 16)).toThrow('duplicate');
  f.world.tick = 3;
  expect(() => advanceEVisualHistory(f.world)).toThrow('Nonconsecutive');
  const inactive = { ...f.world, ahriEVisuals: undefined };
  expect(() => {
    beginEVisualHistory(inactive, f.source, f.source, 1, 18);
    advanceEVisualHistory(inactive);
    refreshEVisualAudience(inactive);
    finishAllEVisualHistory(inactive);
  }).not.toThrow();
  expect(inactive.ahriEVisuals).toBeUndefined();
  const g = fixture(),
    p = g.launch();
  const before = JSON.stringify(g.record());
  expect(() => launchEVisualHistory(g.world, 1, { ...p, id: 99 })).toThrow('Invalid');
  expect(() => endEVisualFlight(g.world, p, p, 'hit')).toThrow('mismatch');
  expect(JSON.stringify(g.record())).toBe(before);
  expect(() => pruneEVisualHistory(g.world, 0)).toThrow('retention');
});

test('later sight does not rewrite hidden birth audiences and caster death does not end target-owned control', () => {
  const f = fixture(),
    p = f.launch();
  f.pure(() => endEVisualFlight(f.world, p, p, 'hit', f.target));
  f.target.charm = { sourceId: 1, rank: 1, startTick: 16, endTick: 88, tenacityApplied: false };
  f.pure(() => attachEVisualBuff(f.world, p, f.target));
  f.world.projectiles = [];
  f.pure(() => advanceEVisualHistory(f.world));
  const hidden = f.record().targetFrames[0];
  f.source.hp = 0;
  f.reveal();
  f.advance(17);
  f.pure(() => refreshEVisualAudience(f.world));
  expect(f.record().buff!.stop).toBeNull();
  expect(f.record().buff!.audience).toEqual(['red']);
  expect(f.record().hit!.targetAudience).toEqual(['red']);
  expect(f.record().launch!.audience).toEqual(['blue']);
  expect(hidden.audience).toEqual(['red']);
  expect(f.record().targetFrames.at(-1)!.audience).toEqual(['blue', 'red']);
  expect(f.target.charm).not.toBeNull();
});
