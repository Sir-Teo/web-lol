import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_W_POLICY } from '../src/content/ahri-w-policy';
import { foxFireAudioExpiry } from '../src/simulation/ahri-fox-fire-audio';

function setup(target = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
  });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.learnSpell('w', ahri.id);
  const victim = target ? w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux') : null;
  if (victim) Object.assign(victim, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: 0, y: 0 } });
  w.step();
  return { w, ahri, victim };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}

test('every live, contact and finite-tail frame restores an exact next step', () => {
  for (const withTarget of [false, true]) {
    const { w } = setup(withTarget);
    for (let tick = 1; tick <= 300; tick++) {
      const copy = restore(w);
      w.step();
      copy.step();
      expect(copy.snapshot(), `target=${withTarget} tick=${tick}`).toBe(w.snapshot());
    }
    expect(w.ahriFoxFireAudio).toEqual([]);
    expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriFoxFireAudio');
  }
});
test('activation stop and source tails survive removal of the gameplay cast', () => {
  const { w } = setup(false);
  w.battlefield.lineOfSight = () => false;
  w.step(129);
  const victim = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  Object.assign(victim, { ai: false, hp: 10000, maxHp: 10000 });
  w.battlefield.lineOfSight = () => true;
  w.step(40);
  expect(w.ahriFoxFires).toEqual([]);
  const r = w.ahriFoxFireAudio[0];
  expect(r.fires.every((f) => f.end?.reason === 'hit')).toBe(true);
  expect(r.activationStop?.reason).toBe('released');
  const expiry = foxFireAudioExpiry(r),
    copy = restore(w);
  w.step(expiry - w.tick - 1);
  copy.step(expiry - copy.tick - 1);
  expect(w.ahriFoxFireAudio).toHaveLength(1);
  expect(copy.snapshot()).toBe(w.snapshot());
  w.step();
  copy.step();
  expect(w.ahriFoxFireAudio).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('windup death stops activation immediately while released missiles retain their futures', () => {
  for (const age of [5, 30]) {
    const { w, ahri, victim } = setup();
    w.step(age - 1);
    w.damage(victim!, ahri, 1e6, 'true');
    const r = w.ahriFoxFireAudio[0];
    expect(r.activationStop?.reason).toBe(age === 5 ? 'death' : 'released');
    if (age === 5) expect(r.fires.every((f) => !f.launch && f.end?.reason === 'death')).toBe(true);
    else expect(r.fires.some((f) => f.launch && !f.end)).toBe(true);
    const copy = restore(w);
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('terminal settlement closes orbit and flight at the winning frozen tick', () => {
  for (const age of [1, 16, 30, 80]) {
    const { w } = setup();
    w.step(age - 1);
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.ahriFoxFires).toEqual([]);
    expect(w.ahriFoxFireAudio[0].fires.every((f) => f.end)).toBe(true);
    const saved = w.snapshot(),
      copy = restore(w);
    w.step(300);
    copy.step(300);
    expect(w.snapshot()).toBe(saved);
    expect(copy.snapshot()).toBe(saved);
  }
});
test('birth audience cannot be rewritten by later visibility', () => {
  const { w } = setup(false);
  const birth = [...w.ahriFoxFireAudio[0].audience];
  expect(birth).toEqual(['blue']);
  const observer = w.spawn('champion', 'red', { x: 1000, y: 0 }, 'lux');
  observer.ai = false;
  w.battlefield.lineOfSight = () => true;
  w.step(10);
  expect(w.pointVisible(w.ahriFoxFireAudio[0].origin, 'red')).toBe(true);
  expect(w.ahriFoxFireAudio[0].audience).toEqual(birth);
  restore(w);
});
test('late flight keeps an earlier pruned target identity without inventing a contact', () => {
  const { w, ahri } = setup(false);
  const early = w.spawn('melee', 'red', { x: 650, y: 0 });
  Object.assign(early, { ai: false, hp: 10000, maxHp: 10000 });
  while (!w.ahriFoxFires[0].fires.some((f) => f.phase === 'flight') && w.tick < 60) w.step();
  expect(w.ahriFoxFires[0].fires.filter((f) => f.phase === 'flight')).toHaveLength(1);
  const deathTick = w.tick;
  w.damage(ahri, early, 1e6, 'true');
  w.step(130 - w.tick);
  const late = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  Object.assign(late, { ai: false, hp: 10000, maxHp: 10000 });
  w.step();
  while (w.tick < deathTick + 245) {
    late.x += 100;
    w.step();
  }
  expect(w.unit(early.id)).toBeUndefined();
  expect(w.ahriFoxFires[0].fires.filter((f) => f.phase === 'flight')).toHaveLength(2);
  const r = w.ahriFoxFireAudio[0],
    first = r.fires.find((f) => f.launch?.targetId === early.id)!;
  expect(first.end?.reason).toBe('lost-target');
  const copy = restore(w);
  const deadline =
    Math.max(...r.fires.map((f) => f.launch?.tick ?? 0)) + AHRI_W_POLICY.maximumFlightTicks;
  while (w.tick < deadline) {
    late.x += 100;
    copy.unit(late.id)!.x += 100;
    w.step();
    copy.step();
  }
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(r.fires.filter((f) => f.end?.reason === 'expired')).toHaveLength(2);
  expect(w.ahriFoxFireAudio).toEqual([]);
});
test('strict restoration rejects forged clocks, identities, phases, geometry and audiences', () => {
  const { w } = setup();
  w.step(29);
  const saved = w.snapshot();
  const reject = (change: (s: any, r: any) => void) => {
    const s = JSON.parse(saved);
    change(s, s.ahriFoxFireAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  };
  reject((s) => delete s.ahriFoxFireAudio);
  reject((s) => (s.ahriFoxFireAudio = []));
  reject((s, r) => s.ahriFoxFireAudio.push(structuredClone(r)));
  reject((s, r) => (r.id = s.nextId));
  reject((s, r) => (r.sourceId = s.player.id));
  reject((_s, r) => r.startTick++);
  reject((_s, r) => (r.fires[0].index = 1));
  reject((_s, r) => r.fires[0].launch.tick++);
  reject((_s, r) => (r.fires[0].launch.targetId = r.sourceId));
  reject((_s, r) => r.fires[0].launch.origin.x++);
  reject((_s, r) => r.fires[0].launch.currentPoint.x++);
  reject((_s, r) => (r.fires[0].launch.audience = ['red']));
  reject((_s, r) => (r.fires[0].launch.audience = ['blue', 'blue']));
  reject((_s, r) => (r.activationStop = null));
  reject((_s, r) => (r.activationStop.reason = 'expired'));
  reject((_s, r) => r.activationStop.point.x++);
});

test('completed orbit tails reject forged completion clocks and stop dispatch after gameplay pruning', () => {
  const { w } = setup(false);
  w.step(151);
  expect(w.ahriFoxFires).toEqual([]);
  const saved = w.snapshot();
  const reject = (change: (s: any, r: any) => void) => {
    const s = JSON.parse(saved);
    change(s, s.ahriFoxFireAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  };
  reject((_s, r) => r.fires[0].end.tick--);
  reject((_s, r) => (r.fires[0].end.reason = 'hit'));
  reject((_s, r) => (r.fires[0].end.reason = 'death'));
  reject((_s, r) => (r.fires[0].end.reason = 'match-end'));
  reject((_s, r) => r.activationStop.tick--);
  reject((_s, r) => (r.activationStop.reason = 'death'));
  reject((_s, r) => (r.activationStop.audience = ['red', 'blue']));
  reject((_s, r) => r.startTick++);
  reject((s, r) => s.ahriFoxFireAudio.push({ ...structuredClone(r), id: s.nextId++ }));
  restore(w);
});
