import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  const state = w.championState(garen.id)!;
  expect(w.learnSpell('q', garen.id)).toBeNull();
  const cast = () => {
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: { x: 0, y: 0 } });
    w.step();
  };
  return { w, garen, target, state, cast };
}

test('Q cleanses existing slows, keeps roots, costs no mana, and expires speed independently of its attack window', () => {
  const { w, garen, state, cast } = setup();
  garen.slowUntil = 100;
  garen.slowMultiplier = 0.5;
  garen.rootUntil = 20;
  cast();
  expect(garen.slowUntil).toBe(0);
  expect(garen.slows).toEqual([]);
  expect(garen.rootUntil).toBe(20);
  expect(garen.mana).toBe(0);
  expect(w.movementSpeed(garen)).toBeCloseTo(459);
  expect(state.garenQ).toEqual({
    startTick: 1,
    rank: 1,
    attackUntil: 271,
    speedUntil: 85,
    consumed: false,
  });
  expect(state.cooldowns.q).toBe(481);
  const q = structuredClone(state.garenQ);
  cast();
  expect(state.garenQ).toEqual(q);
  garen.slowUntil = 60;
  garen.slowMultiplier = 0.5;
  expect(w.movementSpeed(garen)).toBeCloseTo(229.5);
  w.step(85 - w.tick);
  expect(w.movementSpeed(garen)).toBe(340);
  expect(state.garenQ?.consumed).toBe(false);
  w.step(271 - w.tick);
  expect(state.garenQ).toBeNull();
});

test('Q resets the attack timer, consumes one melee hit, and silences at damage release', () => {
  const { w, garen, target, state, cast } = setup();
  garen.nextAttackTick = 200;
  w.setOrder(garen, { type: 'attack', target: target.id });
  cast();
  expect(garen.attackCycle?.garenQRank).toBe(1);
  expect(garen.nextAttackTick).toBe(96);
  expect(garen.releaseTick).toBe(20);
  w.step(garen.releaseTick! - w.tick - 1);
  expect(target.hp).toBe(1500);
  expect(target.silenceUntil).toBe(0);
  w.step();
  expect(target.hp).toBe(1366.5);
  expect(target.silenceUntil).toBe(w.tick + 90);
  expect(state.garenQ?.consumed).toBe(true);
  expect(w.movementSpeed(garen)).toBeCloseTo(459);
  expect(garen.animationTimeline?.primary.clip).toBe('spell1');
  expect(w.projectiles).toHaveLength(0);
  w.step(113 - w.tick);
  expect(target.hp).toBe(1297.5);
  expect(target.silenceUntil).toBe(110);
});

test('a committed Q survives movement orders, stun, and buff expiry without moving while disabled', () => {
  const { w, garen, target, state, cast } = setup();
  cast();
  w.step(265 - w.tick);
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  const release = garen.releaseTick!;
  w.setOrder(garen, { type: 'move', point: { x: 500, y: 0 } });
  garen.stunUntil = 400;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(release - w.tick);
  restored.step(release - restored.tick);
  expect(w.snapshot()).toBe(restored.snapshot());
  expect(state.garenQ).toBeNull();
  expect(target.hp).toBe(1366.5);
  expect(garen.x).toBe(0);
  w.step(30);
  expect(garen.x).toBe(0);
});

test('silence blocks activation and an invalidated target does not consume the armed hit', () => {
  const { w, garen, target, state, cast } = setup();
  w.applySilence(garen, 20);
  cast();
  expect(state.garenQ).toBeNull();
  expect(state.cooldowns.q).toBe(0);
  w.step(20 - w.tick);
  w.setOrder(garen, { type: 'attack', target: target.id });
  cast();
  target.deadAt = w.tick;
  target.hp = 0;
  garen.stunUntil = 100;
  w.step();
  expect(garen.releaseTick).toBeNull();
  expect(state.garenQ?.consumed).toBe(false);
  expect(garen.x).toBe(0);
});

test('save decoding rejects foreign ownership, changed deadlines, and unlearned empowered attacks', () => {
  const { w, garen, target, cast } = setup();
  w.setOrder(garen, { type: 'attack', target: target.id });
  cast();
  for (const mutate of [
    (s: any) => {
      s.player.garenQ = s.otherChampions[0].garenQ;
    },
    (s: any) => {
      s.otherChampions[0].garenQ.speedUntil++;
    },
    (s: any) => {
      s.otherChampions[0].spellRanks.q = 0;
    },
    (s: any) => {
      s.units.find((u: any) => u.id === garen.id).attackCycle.garenQRank = 5;
    },
  ]) {
    const s = JSON.parse(w.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

test('Garen AI activates Q against a visible nearby champion and does not backstep like a ranged attacker', () => {
  const { w, garen, target, state } = setup();
  w.units = w.units.filter((u) => u !== target);
  const foe = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  garen.ai = true;
  w.step(45);
  expect(state.cooldowns.q).toBeGreaterThan(w.tick);
  expect(foe.silenceUntil).toBeGreaterThan(w.tick);
  expect(garen.order.type).toBe('attack');
  expect(garen.x).toBe(0);
});

test('rank five captures its own damage and speed duration, and death clears the buff', () => {
  const { w, garen, target, state, cast } = setup();
  w.gainExperience(1e6, garen.id);
  for (let i = 1; i < 5; i++) expect(w.learnSpell('q', garen.id)).toBeNull();
  w.setOrder(garen, { type: 'attack', target: target.id });
  cast();
  expect(state.garenQ?.speedUntil).toBe(217);
  w.step(garen.releaseTick! - w.tick);
  expect(target.hp).toBe(1131.75);
  const killer = w.spawn('champion', 'red', { x: 100, y: 0 }, 'lux');
  killer.damage = 10000;
  w.setOrder(killer, { type: 'attack', target: garen.id });
  w.step(40);
  expect(garen.deadAt).not.toBeNull();
  expect(state.garenQ).toBeNull();
  expect(garen.attackCycle).toBeNull();
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});

test('Q clears independent Frost and critical slow contributions without immunity to subsequent slows', () => {
  const { w, garen, cast } = setup();
  const source = w.spawn('champion', 'red', { x: 500, y: 0 }, 'ashe');
  w.applySlow(source, garen, 'frost', 120, 0.7);
  garen.criticalSlow = { startTick: 0, endTick: 120, startMultiplier: 0.4, endMultiplier: 0.7 };
  cast();
  expect(garen.slows).toEqual([]);
  expect(garen.criticalSlow).toBeNull();
  w.applySlow(source, garen, 'frost', 120, 0.7);
  expect(w.movementSpeed(garen)).toBeCloseTo(321.3);
});

test('retreating Garen moves while activating Q and does not react to hidden champions', () => {
  const { w, garen, target, state } = setup();
  w.units = w.units.filter((u) => u !== target);
  w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  garen.ai = true;
  garen.hp = 100;
  state.cooldowns.d = state.cooldowns.f = 10000;
  w.step(2);
  expect(state.garenQ).not.toBeNull();
  expect(Math.hypot(garen.x, garen.y)).toBeGreaterThan(10);
  const hidden = setup();
  hidden.w.units = hidden.w.units.filter((u) => u !== hidden.target);
  hidden.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  hidden.w.battlefield.lineOfSight = () => false;
  hidden.garen.ai = true;
  hidden.w.step(40);
  expect(hidden.state.garenQ).toBeNull();
  expect(hidden.state.cooldowns.q).toBe(0);
});

test('a stunned Q that destroys the Nexus stops later units and produces a valid terminal checkpoint', () => {
  const { w, garen, cast, state } = setup();
  const nexus = w.spawn('nexus', 'red', { x: 150, y: 0 });
  nexus.structure = undefined;
  nexus.hp = 100;
  cast();
  w.step(100 - w.tick);
  w.setOrder(garen, { type: 'attack', target: nexus.id });
  w.step();
  const release = garen.releaseTick!;
  const later = w.spawn('turret', 'red', { x: 250, y: 0 });
  later.nextAttackTick = release;
  garen.stunUntil = release + 100;
  w.step(release - w.tick);
  expect(w.winner).toBe('blue');
  expect(state.garenQ).toBeNull();
  expect(garen.attackCycle).toBeNull();
  expect(later.attackCycle).toBeNull();
  const saved = w.snapshot();
  const restored = World.fromSnapshot(saved, w.battlefield);
  restored.step(100);
  expect(restored.snapshot()).toBe(saved);
});

test('Q keeps its captured cadence and source contact frame when levelling during the swing', () => {
  const { w, garen, target, cast } = setup();
  w.setOrder(garen, { type: 'attack', target: target.id });
  cast();
  const release = garen.releaseTick!;
  const end = garen.nextAttackTick;
  w.gainExperience(1e6, garen.id);
  expect(garen.releaseTick).toBe(release);
  expect(garen.attackCycle?.garenQReleaseTick).toBe(release);
  expect(garen.nextAttackTick).toBe(end);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(release - w.tick);
  restored.step(release - restored.tick);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(garen.animationTimeline?.primary.clip).toBe('spell1');
  expect(garen.animationTimeline?.primary.time).toBeCloseTo(1 / 3);
  const fresh = setup();
  fresh.w.gainExperience(1e6, fresh.garen.id);
  fresh.w.setOrder(fresh.garen, { type: 'attack', target: fresh.target.id });
  fresh.cast();
  expect(fresh.garen.releaseTick).toBe(19);
  expect(fresh.garen.nextAttackTick).toBe(91);
  for (const mutate of [
    (cycle: any) => {
      delete cycle.garenQReleaseTick;
    },
    (cycle: any) => {
      cycle.garenQReleaseTick++;
    },
    (cycle: any) => {
      cycle.endTick++;
    },
  ]) {
    const invalid = JSON.parse(fresh.w.snapshot());
    mutate(invalid.units.find((u: any) => u.id === fresh.garen.id).attackCycle);
    expect(() => World.fromSnapshot(JSON.stringify(invalid), fresh.w.battlefield)).toThrow();
  }
});
