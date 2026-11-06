import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.learnSpell('q', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  return { w, ahri };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('every saved fixed step restores the actual projectile and its finite independent tail', () => {
  const { w } = setup();
  let ended = 0;
  for (let tick = 1; tick <= 500; tick++) {
    w.step();
    const copy = restore(w);
    if (w.ahriQProjectileVisuals[0]?.end) ended ||= w.tick;
    if (tick % 17 === 0) {
      copy.step();
      const future = restore(w);
      future.step();
      expect(copy.snapshot()).toBe(future.snapshot());
    }
  }
  expect(ended).toBeGreaterThan(62);
  expect(w.ahriQProjectileVisuals).toEqual([]);
});
test('a return-target teleport and caster death retain replayable motion', () => {
  const { w, ahri } = setup();
  w.step(90);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: -300, y: 0 } });
  w.step();
  expect(ahri.x).toBe(-300);
  restore(w);
  const enemy = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  enemy.ai = false;
  w.damage(enemy, ahri, 1e6, 'true');
  for (let i = 0; i < 80; i++) {
    w.step();
    restore(w);
  }
  expect(w.ahriQProjectileVisuals[0].end?.reason).toBe('caught');
});
test('terminal capture restores without advancing the frozen World', () => {
  for (const tick of [16, 62, 90]) {
    const { w } = setup();
    w.step(tick);
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.ahriQProjectileVisuals[0].end?.reason).toBe('match-end');
    restore(w);
    const saved = w.snapshot();
    w.step(1000);
    expect(w.snapshot()).toBe(saved);
  }
});
test('restore rejects missing, forged, reordered or inconsistent projectile history', () => {
  const { w } = setup();
  w.step(90);
  const changes: ((s: any) => void)[] = [
    (s) => delete s.ahriQProjectileVisuals,
    (s) => s.ahriQProjectileVisuals.push(s.ahriQProjectileVisuals[0]),
    (s) => s.ahriQProjectileVisuals[0].frames.splice(20, 1),
    (s) => s.ahriQProjectileVisuals[0].frames.reverse(),
    (s) => s.ahriQProjectileVisuals[0].frames[20].x++,
    (s) => s.ahriQProjectileVisuals[0].frames.at(-1).facing++,
    (s) => (s.ahriQProjectileVisuals[0].frames[0].sourcePoint.x = Infinity),
    (s) => (s.ahriQProjectileVisuals[0].frames[0].audience = ['red']),
    (s) => (s.ahriQProjectileVisuals[0].birthAudience = ['blue', 'blue']),
    (s) => s.ahriQProjectileVisuals[0].turn.tick++,
    (s) => s.ahriQProjectileVisuals[0].turn.point.x++,
    (s) => s.ahriQProjectileVisuals[0].direction.x++,
    (s) => (s.ahriQProjectileVisuals[0].sourceId = w.hero.id),
    (s) =>
      (s.ahriQProjectileVisuals[0].end = { tick: 90, point: { x: 0, y: 0 }, reason: 'caught' }),
  ];
  for (const mutate of changes) {
    const state = JSON.parse(w.snapshot());
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
  }
});
test('a stopped history cannot be omitted while its independent audio dispatch still proves it exists', () => {
  const { w } = setup();
  w.step(140);
  expect(w.ahriQProjectileVisuals[0].end?.reason).toBe('caught');
  expect(w.ahriOrbAudio.some((a) => a.launch)).toBe(true);
  const state = JSON.parse(w.snapshot());
  delete state.ahriQProjectileVisuals;
  expect(() => World.fromSnapshot(JSON.stringify(state), w.battlefield)).toThrow();
});
test('negative and vertical flight directions retain canonical facing through JSON round trips', () => {
  for (const aim of [
    { x: -900, y: 0 },
    { x: 0, y: -900 },
    { x: 0, y: 900 },
  ]) {
    const { w, ahri } = setup();
    w.commands.length = 0;
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: aim });
    for (let i = 0; i < 150; i++) {
      w.step();
      if (i % 11 === 0) restore(w);
    }
    expect(w.ahriQProjectileVisuals[0].end?.reason).toBe('caught');
  }
});
