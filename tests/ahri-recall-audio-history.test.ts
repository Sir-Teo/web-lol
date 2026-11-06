import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
function setup(hidden = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => !hidden,
    inBrush: () => false,
  });
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  enemy.ai = false;
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  return { w, ahri, enemy };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('every frame retains accepted channel, exact actual return and finite tail through restore', () => {
  const { w, ahri } = setup();
  const r = w.ahriRecallAudio[0];
  expect(r.id).toBe(w.events.find((e) => e.text === 'Recalling…')!.id);
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.completeTick).toBe(481);
  for (let i = 1; i <= 581; i++) {
    const copy = restore(w);
    if (w.tick === 481) {
      expect(r.end?.reason).toBe('complete');
      expect(ahri.x).toBe(w.battlefield.spawns.blue.x);
    }
    if (w.tick === 580) expect(w.ahriRecallAudio).toHaveLength(1);
    if (w.tick === 581) expect(w.ahriRecallAudio).toHaveLength(0);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('orders, damage, silence and stun close history immediately without delayed observation', () => {
  for (const kind of ['move', 'damage', 'silence', 'stun'] as const) {
    const { w, ahri, enemy } = setup();
    w.step(19);
    if (kind === 'move') w.setOrder(ahri, { type: 'move', point: { x: 100, y: 0 } });
    if (kind === 'damage') w.damage(enemy, ahri, 1, 'true');
    if (kind === 'silence') w.applySilence(ahri, 60);
    if (kind === 'stun') w.applyStun(ahri, 60);
    expect(w.ahriRecallAudio[0].end).toEqual({
      tick: 20,
      point: { x: 0, y: 0 },
      reason: 'cancelled',
    });
    restore(w);
    w.step(2);
    expect(w.ahriRecallAudio).toHaveLength(0);
  }
});
test('hidden birth stays private and zero health loss preserves the channel', () => {
  const { w, ahri, enemy } = setup(true);
  expect(w.ahriRecallAudio[0].audience).toEqual(['blue']);
  w.damage(enemy, ahri, 0, 'true');
  expect(w.ahriRecallAudio[0].end).toBeNull();
  restore(w);
});
test('same-tick restart reuses distinct existing message identities without merging channels', () => {
  const { w, ahri } = setup();
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(3);
  expect(w.ahriRecallAudio.map((r) => r.end?.reason ?? 'active')).toEqual([
    'cancelled',
    'cancelled',
    'active',
  ]);
  restore(w);
});
test('strict restore rejects forged ownership, clocks, audiences and completion position', () => {
  const { w } = setup();
  const mutations = [
    (r: any) => (r.id = 1),
    (r: any) => r.completeTick++,
    (r: any) => (r.audience = ['red']),
    (r: any) => r.origin.x++,
    (r: any) => (r.end = { tick: 1, point: { x: 0, y: 0 }, reason: 'complete' }),
  ];
  for (const mutate of mutations) {
    const saved = JSON.parse(w.snapshot());
    mutate(saved.ahriRecallAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  w.step(480);
  const saved = JSON.parse(w.snapshot());
  saved.ahriRecallAudio[0].end.point.x++;
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
test('victory closes active channels and preserves completed tails without advancing the World', () => {
  for (const completed of [false, true]) {
    const { w } = setup();
    if (completed) w.step(480);
    const r = w.ahriRecallAudio[0];
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    expect(r.end?.reason).toBe(completed ? 'complete' : 'match-end');
    restore(w);
    const saved = w.snapshot();
    w.step(1000);
    expect(w.snapshot()).toBe(saved);
  }
});
test('lethal damage closes the channel alongside real lifecycle death and dead commands add no audio', () => {
  const { w, ahri, enemy } = setup();
  w.damage(enemy, ahri, 1e6, 'true');
  expect(w.ahriRecallAudio[0].end?.reason).toBe('cancelled');
  expect(w.ahriLifecycleAudio).toHaveLength(1);
  restore(w);
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(1);
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(0);
  restore(w);
});
