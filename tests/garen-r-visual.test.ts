import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { GAREN_R_PRESENTATION_TAIL_TICKS } from '../src/simulation/garen-r';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'garen');
  w.nextWaveTick = Infinity;
  w.pendingSpawns = [];
  w.hero.x = w.hero.y = 0;
  w.hero.previous = { x: 0, y: 0 };
  w.gainExperience(1e6);
  w.learnSpell('r');
  const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
  target.hp = target.maxHp = 2000;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
  w.step();
  return { w, target };
}
test('R presentation captures acceptance and freezes the actual release point independently of orders', () => {
  const { w, target } = setup();
  expect(w.player.garenRVisual).toEqual({
    startTick: 1,
    targetId: target.id,
    facing: Math.PI / 2,
    point: { x: 250, y: 0 },
    releaseTick: null,
    stopTick: null,
    killed: false,
  });
  target.x = 700;
  w.step(27);
  expect(w.player.garenRVisual).toMatchObject({
    releaseTick: 28,
    stopTick: null,
    point: { x: 700, y: 0 },
  });
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'move', point: { x: 0, y: 500 } } });
  w.step();
  target.x = 900;
  expect(w.player.castAnimation).toBeNull();
  expect(w.player.garenRVisual?.point).toEqual({ x: 700, y: 0 });
});
for (const phase of ['windup', 'released', 'cancelled'] as const)
  test(`R ${phase} presentation continues identically after restore`, () => {
    const { w, target } = setup();
    if (phase === 'released') w.step(27);
    if (phase === 'cancelled') w.damage(target, w.hero, 1e6, 'true');
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(GAREN_R_PRESENTATION_TAIL_TICKS + 30);
    restored.step(GAREN_R_PRESENTATION_TAIL_TICKS + 30);
    expect(restored.snapshot()).toBe(w.snapshot());
    expect(w.player.garenRVisual).toBeNull();
  });
test('a killing R and later caster death retain released history through reveal expiry and target disappearance', () => {
  const { w, target } = setup();
  target.hp = 1;
  w.step(27);
  expect(target.deadAt).toBe(28);
  const killer = w.spawn('champion', 'red', { x: 2000, y: 0 }, 'ashe');
  w.damage(killer, w.hero, 1e6, 'true');
  w.units = w.units.filter((u) => u.id !== target.id);
  w.step();
  expect(w.player.garenRReveal).toBeNull();
  expect(w.player.garenRVisual?.releaseTick).toBe(28);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  w.step(GAREN_R_PRESENTATION_TAIL_TICKS - 1);
  expect(w.player.garenRVisual).toBeNull();
});
for (const failure of ['caster-death', 'target-death', 'target-removal'] as const)
  test(`R ${failure} never manufactures an impact release`, () => {
    const { w, target } = setup();
    if (failure === 'caster-death') w.damage(target, w.hero, 1e6, 'true');
    if (failure === 'target-death') w.damage(w.hero, target, 1e6, 'true');
    if (failure === 'target-removal') {
      w.units = w.units.filter((u) => u.id !== target.id);
    }
    w.step(27);
    expect(w.player.garenRVisual?.releaseTick).toBeNull();
    expect(w.player.garenRVisual?.stopTick).not.toBeNull();
    expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  });
test('R presentation decoder rejects missing, foreign, inconsistent and expired histories', () => {
  const { w } = setup();
  const mutations = [
    (s: any) => delete s.player.garenRVisual,
    (s: any) => (s.player.garenRVisual = null),
    (s: any) => s.player.garenRVisual.startTick++,
    (s: any) => (s.player.garenRVisual.targetId = s.player.id),
    (s: any) => s.player.garenRVisual.point.x++,
    (s: any) => s.player.garenRVisual.facing++,
    (s: any) => (s.player.garenRVisual.releaseTick = s.tick),
    (s: any) => (s.player.garenRVisual.stopTick = s.tick),
  ];
  for (const mutate of mutations) {
    const s = JSON.parse(w.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(27);
  const released = JSON.parse(w.snapshot());
  released.player.garenRVisual.stopTick = released.tick;
  expect(() => World.fromSnapshot(JSON.stringify(released), w.battlefield)).toThrow();
  const expired = JSON.parse(w.snapshot());
  expired.tick = 28 + GAREN_R_PRESENTATION_TAIL_TICKS;
  expect(() => World.fromSnapshot(JSON.stringify(expired), w.battlefield)).toThrow();
  const foreign = new World(false, PRACTICE_FIXTURE);
  const s = JSON.parse(foreign.snapshot());
  s.player.garenRVisual = JSON.parse(w.snapshot()).player.garenRVisual;
  expect(() => World.fromSnapshot(JSON.stringify(s), foreign.battlefield)).toThrow();
});

test('match end cancels an unreleased R without fabricating damage or an impact history', () => {
  const { w, target } = setup();
  const nexus = w.spawn('nexus', 'red', { x: 150, y: 0 });
  nexus.structure = undefined;
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(w.player.pendingCast).toBeNull();
  expect(w.player.garenRVisual).toMatchObject({ releaseTick: null, stopTick: 1 });
  expect(target.hp).toBe(2000);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});
