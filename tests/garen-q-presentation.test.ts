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
  expect(w.player.garenQVisuals).toEqual([
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
  expect(r.attacks).toEqual([{ startTick: stop - 1, releaseTick: release }]);
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
  expect(w.player.garenQVisuals).toEqual([]);
});
test('practice recasts retain prior activation and swing history with independent stop clocks', () => {
  const { w, cast } = setup(true);
  w.setOrder(w.hero, { type: 'idle' });
  w.step(20);
  const previous = structuredClone(w.player.garenQVisuals[0]);
  cast();
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
