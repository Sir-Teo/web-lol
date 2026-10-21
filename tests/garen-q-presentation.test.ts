import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../src/content/garen-q-audio-timing';

function setup(attack = false) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  w.learnSpell('q');
  const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
  if (attack) w.setOrder(w.hero, { type: 'attack', target: target.id });
  const cast = () => {
    w.player.cooldowns.q = 0;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
  };
  cast();
  return { w, target, cast };
}
test('Q history starts on acceptance, captures actual swing commitment and stops on consumption independently of speed', () => {
  const { w } = setup(true),
    release = w.hero.releaseTick!;
  expect(w.player.garenQVisuals).toMatchObject([
    {
      startTick: 1,
      rank: 1,
      stopTick: null,
      endReason: null,
      attacks: [{ startTick: 1, releaseTick: release }],
    },
  ]);
  w.step(release - w.tick);
  expect(w.player.garenQVisuals[0]).toMatchObject({ stopTick: release, endReason: 'consumed' });
  expect(w.player.garenQ?.consumed).toBe(true);
  expect(w.player.garenQ!.speedUntil).toBeGreaterThan(w.tick);
  expect(w.events.find((e) => e.type === 'attack')).toMatchObject({
    champion: 'garen',
    garenQStartTick: 1,
  });
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
test('Q natural expiry retains ending history and committed pre-expiry swing without changing its future release', () => {
  const { w, target } = setup();
  const stop = w.player.garenQ!.attackUntil;
  w.step(stop - 2 - w.tick);
  w.setOrder(w.hero, { type: 'attack', target: target.id });
  w.step();
  const release = w.hero.releaseTick!;
  expect(release).toBeGreaterThan(stop);
  w.step(stop - w.tick);
  const r = w.player.garenQVisuals.at(-1)!;
  expect(r.endReason).toBe('expired');
  expect(r.attacks).toMatchObject([{ startTick: stop - 1, releaseTick: release }]);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(release - w.tick);
  restored.step(release - restored.tick);
  expect(restored.snapshot()).toBe(w.snapshot());
  expect(r.endReason).toBe('expired');
});
test('target loss and caster death retain accepted swing clocks, never invent consumption and restore exactly', () => {
  const { w, target } = setup(true);
  w.damage(w.hero, target, 1e6, 'true');
  w.step(2);
  expect(w.hero.attackCycle).toBeNull();
  expect(w.player.garenQVisuals[0].attacks).toHaveLength(1);
  expect(w.player.garenQVisuals[0].stopTick).toBeNull();
  w.damage(w.hero, w.hero, 1e6, 'true');
  expect(w.player.garenQVisuals[0]).toMatchObject({ stopTick: w.tick, endReason: 'death' });
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const steps of [1, 14, 100, 100]) {
    w.step(steps);
    restored.step(steps);
    expect(restored.snapshot()).toBe(w.snapshot());
  }
  expect(w.player.garenQVisuals).toMatchObject([]);
});
test('practice recasts retain prior activation and swing history with independent stop clocks', () => {
  const { w, cast } = setup(true);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(20);
  const previous = structuredClone(w.player.garenQVisuals[0]);
  cast();
  previous.attacks[0].stopTick = w.tick;
  previous.attacks[0].endReason = 'recast';
  expect(w.player.garenQVisuals[0]).toEqual(previous);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(20);
  cast();
  expect(w.player.garenQVisuals[1].endReason).toBe('recast');
  expect(w.player.garenQVisuals[1].stopTick).toBe(w.player.garenQVisuals[2].startTick);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  for (let i = 0; i < 220; i++) cast();
  expect(w.player.garenQVisuals.length).toBeLessThanOrEqual(GAREN_Q_AUDIO_TAIL_TICKS + 1);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});
test('match-ending Q consumption stays consumed, while unrelated match end stops an armed interval once', () => {
  for (const consumes of [false, true]) {
    const { w } = setup();
    const nexus = w.spawn('nexus', 'red', { x: 100, y: 0 });
    if (consumes) {
      nexus.hp = 1;
      w.setOrder(w.hero, { type: 'attack', target: nexus.id });
      w.step(30);
    } else w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    expect(w.player.garenQVisuals[0].endReason).toBe(consumes ? 'consumed' : 'match-end');
    const saved = w.snapshot();
    w.step(100);
    expect(w.snapshot()).toBe(saved);
    expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
  }
});
test('Q presentation rejects missing, foreign, future, contradictory, expired and malformed swing histories', () => {
  const { w } = setup(true),
    base = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => delete s.player.garenQVisuals,
    (s: any) => (s.player.garenQVisuals = []),
    (s: any) => s.player.garenQVisuals.push(s.player.garenQVisuals[0]),
    (s: any) => s.player.garenQVisuals[0].startTick++,
    (s: any) => s.player.garenQVisuals[0].rank++,
    (s: any) => (s.player.garenQVisuals[0].endReason = 'expired'),
    (s: any) => (s.player.garenQVisuals[0].attacks = []),
    (s: any) => (s.player.garenQVisuals[0].attacks[0].releaseTick = 1),
    (s: any) => s.player.garenQVisuals[0].attacks.push(s.player.garenQVisuals[0].attacks[0]),
    (s: any) => (s.player.garenQVisuals[0].attacks[0].startTick = 2),
  ]) {
    const s = structuredClone(base);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(30);
  const consumed = JSON.parse(w.snapshot());
  consumed.player.garenQVisuals[0].stopTick++;
  expect(() => World.fromSnapshot(JSON.stringify(consumed), w.battlefield)).toThrow();
  w.step(GAREN_Q_AUDIO_TAIL_TICKS);
  const expired = JSON.parse(w.snapshot());
  expired.player.garenQVisuals = consumed.player.garenQVisuals;
  expect(() => World.fromSnapshot(JSON.stringify(expired), w.battlefield)).toThrow();
  const foreign = new World(false),
    s = JSON.parse(foreign.snapshot());
  s.player.garenQVisuals = base.player.garenQVisuals;
  expect(() => World.fromSnapshot(JSON.stringify(s), foreign.battlefield)).toThrow();
});

test('Q captures the resolved target point before lethal damage and retains it after order/death and reload', () => {
  const { w, target } = setup(true);
  const a = w.player.garenQVisuals[0].attacks[0];
  expect(a).toMatchObject({
    targetId: target.id,
    origin: { x: 0, y: 0 },
    impact: null,
    stopTick: null,
    endReason: null,
  });
  target.x = 110;
  target.y = 20;
  target.hp = 1;
  w.step(a.releaseTick - w.tick);
  expect(target.deadAt).toBe(w.tick);
  expect(a.impact).toEqual({ tick: w.tick, point: { x: 110, y: 20 }, facing: Math.atan2(110, 20) });
  w.setOrder(w.hero, { type: 'idle' });
  expect(a).toMatchObject({ stopTick: w.tick, endReason: 'order' });
  w.damage(w.hero, w.hero, 1e6, 'true');
  expect(a.endReason).toBe('order');
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
test('Q attack cancellation is separate from buff stops, never manufactures a hit, and resumes exactly', () => {
  for (const reason of ['target-lost', 'death', 'recast', 'match-end'] as const) {
    const { w, target, cast } = setup(true),
      a = w.player.garenQVisuals[0].attacks[0];
    if (reason === 'target-lost') {
      w.damage(w.hero, target, 1e6, 'true');
      w.step();
    } else if (reason === 'death') w.damage(target, w.hero, 1e6, 'true');
    else if (reason === 'recast') cast();
    else w.damage(w.hero, w.spawn('nexus', 'red', { x: 800, y: 0 }), 1e6, 'true');
    expect(a).toMatchObject({ impact: null, stopTick: w.tick, endReason: reason });
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const steps of [1, 20, 80]) {
      w.step(steps);
      restored.step(steps);
      expect(restored.snapshot()).toBe(w.snapshot());
    }
  }
});
test('a completed Q pose preserves contact and its captured period while a stun after contact stops the pose as an action', () => {
  for (const stun of [false, true]) {
    const { w } = setup(true),
      a = w.player.garenQVisuals[0].attacks[0];
    w.setOrder(w.hero, { type: 'idle' }); // Committed Q cannot be cancelled by this order.
    expect(a.stopTick).toBeNull();
    w.step(a.releaseTick - w.tick);
    if (stun) {
      w.hero.stunUntil = w.tick + 20;
      w.step();
    } else w.step(a.endTick - w.tick);
    expect(a.endReason).toBe(stun ? 'action' : 'complete');
    expect(a.stopTick).toBe(stun ? a.releaseTick + 1 : a.endTick);
    expect(a.impact?.tick).toBe(a.releaseTick);
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  }
});
test('Q checkpoints reject invented contact, mismatched target/period and contradictory pose stops', () => {
  const { w } = setup(true),
    base = JSON.parse(w.snapshot());
  for (const mutate of [
    (a: any) => delete a.impact,
    (a: any) => (a.targetId = w.hero.id),
    (a: any) => (a.targetId = 100000),
    (a: any) => a.endTick++,
    (a: any) => (a.impact = { tick: a.releaseTick, point: a.origin, facing: 0 }),
    (a: any) => {
      a.stopTick = w.tick;
      a.endReason = 'action';
    },
  ]) {
    const s = structuredClone(base);
    mutate(s.player.garenQVisuals[0].attacks[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(w.hero.releaseTick! - w.tick);
  const hit = JSON.parse(w.snapshot());
  for (const mutate of [
    (a: any) => (a.impact = null),
    (a: any) => a.impact.tick--,
    (a: any) => {
      a.stopTick = a.startTick;
      a.endReason = 'target-lost';
    },
  ]) {
    const s = structuredClone(hit);
    mutate(s.player.garenQVisuals[0].attacks[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

test('post-contact chasing hard-stops Q presentation while retaining its cadence cycle and confirmed impact', () => {
  const { w, target } = setup(true),
    a = w.player.garenQVisuals[0].attacks[0];
  w.step(a.releaseTick - w.tick);
  target.x = 400;
  const before = w.hero.x;
  w.step();
  expect(w.hero.x).toBeGreaterThan(before);
  expect(a).toMatchObject({ stopTick: w.tick, endReason: 'action' });
  expect(w.hero.attackCycle?.endTick).toBe(a.endTick);
  expect(w.hero.nextAttackTick).toBe(a.endTick);
  expect(a.impact?.point.x).toBe(100);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
