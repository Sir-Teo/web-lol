import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { spiritRushAudioExpiry } from '../src/simulation/ahri-spirit-rush-audio';

function setup(target = true, minion = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = 1e9;
  Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, ai: false });
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  w.gainExperience(1e6, ahri.id);
  w.learnSpell('r', ahri.id);
  const victim = target ? w.spawn(minion ? 'melee' : 'dummy', 'red', { x: 400, y: 0 }) : null;
  if (victim)
    Object.assign(victim, {
      ai: false,
      hp: minion ? 1 : 10000,
      maxHp: minion ? 1 : 10000,
      magicResist: 0,
    });
  const cast = (point = { x: 900, y: 0 }) => {
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point });
    w.step();
  };
  cast();
  return { w, ahri, victim, cast };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}

test('every dash, bolt, active-window and post-window audio frame retains an exact next step', () => {
  for (const target of [false, true]) {
    const { w } = setup(target);
    for (let tick = 1; tick <= 1000; tick++) {
      const copy = restore(w);
      w.step();
      copy.step();
      expect(copy.snapshot(), `target=${target} tick=${tick}`).toBe(w.snapshot());
    }
    expect(w.ahriSpiritRushAudio).toEqual([]);
    expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriSpiritRushAudio');
  }
}, 60000); // 2,000 complete restores now include the bounded owned visual poses.
test('all three casts can be spent while activation remains alive until the original window closes', () => {
  const { w, cast } = setup();
  w.step(59);
  cast({ x: 500, y: 900 });
  w.step(59);
  cast({ x: -100, y: 500 });
  expect(w.ahriRushes[0].remainingCasts).toBe(0);
  expect(w.ahriSpiritRushAudio[0].bursts).toHaveLength(3);
  w.step(900 - w.tick);
  expect(w.ahriSpiritRushAudio[0].end).toBeNull();
  restore(w);
  w.step();
  expect(w.ahriRushes).toEqual([]);
  const r = w.ahriSpiritRushAudio[0];
  expect(r.end).toMatchObject({ tick: 901, reason: 'expired' });
  const expiry = spiritRushAudioExpiry(r),
    copy = restore(w);
  w.step(expiry - w.tick - 1);
  copy.step(expiry - copy.tick - 1);
  expect(w.ahriSpiritRushAudio).toHaveLength(1);
  expect(copy.snapshot()).toBe(w.snapshot());
  w.step();
  copy.step();
  expect(w.ahriSpiritRushAudio).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('a last accepted dash remains linked when it outlives the expired window', () => {
  const { w, cast } = setup(false);
  w.step(898);
  cast({ x: 500, y: 900 });
  expect(w.tick).toBe(900);
  w.step();
  const r = w.ahriSpiritRushAudio[0];
  expect(r.end?.tick).toBe(901);
  expect(r.bursts[1].dashEndTick).toBeNull();
  expect(spiritRushAudioExpiry(r)).toBe(Infinity);
  while (w.ahriRushes.length) {
    const copy = restore(w);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
  expect(r.bursts[1].dashEndTick).toBe(924);
  expect(Number.isFinite(spiritRushAudioExpiry(r))).toBe(true);
  restore(w);
});
test('consumed Essence extends the original audio window without restarting activation', () => {
  const { w, ahri } = setup(false);
  w.step(799);
  const victim = w.spawn('champion', 'red', { x: ahri.x, y: ahri.y }, 'lux');
  victim.ai = false;
  w.damage(ahri, victim, 1e6, 'true');
  w.step();
  const r = w.ahriSpiritRushAudio[0];
  expect(r.startTick).toBe(1);
  expect(r.windowEndTick).toBe(1401);
  expect(r.end).toBeNull();
  const copy = restore(w);
  w.step(600);
  copy.step(600);
  expect(r.end).toMatchObject({ tick: 1401, reason: 'expired' });
  expect(copy.snapshot()).toBe(w.snapshot());
});
test('death closes window/dash while captured bolts retain their full futures; control and Flash only close the dash', () => {
  for (const mode of ['death', 'root', 'flash'] as const) {
    const { w, ahri, victim } = setup();
    w.step(4);
    if (mode === 'death') w.damage(victim!, ahri, 1e6, 'true');
    if (mode === 'root') w.applyRoot(ahri, 60);
    if (mode === 'flash') {
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -100, y: 0 },
      });
      w.step();
      expect(ahri.x).toBe(-100);
    }
    const r = w.ahriSpiritRushAudio[0];
    expect(r.bursts[0].dashEndTick).toBe(w.tick);
    if (mode === 'death') expect(r.end?.reason).toBe('death');
    else expect(r.end).toBeNull();
    expect(r.bursts[0].bolts[0].end).toBeNull();
    const copy = restore(w);
    w.step(40);
    copy.step(40);
    expect(r.bursts[0].bolts[0].end?.reason).toBe('hit');
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('a visible recast gets a fresh audience without rewriting activation birth', () => {
  const { w, cast } = setup(false);
  expect(w.ahriSpiritRushAudio[0].audience).toEqual(['blue']);
  const observer = w.spawn('champion', 'red', { x: 1000, y: 0 }, 'lux');
  observer.ai = false;
  w.step(59);
  cast({ x: 500, y: 900 });
  const r = w.ahriSpiritRushAudio[0];
  expect(w.pointVisible(r.origin, 'red')).toBe(true);
  expect(r.audience).toEqual(['blue']);
  expect(r.bursts[0].audience).toEqual(['blue']);
  expect(r.bursts[1].audience).toEqual(['blue', 'red']);
  restore(w);
});
test('active window retains an old contact target after its minion corpse is pruned', () => {
  const { w, victim } = setup(true, true);
  w.step(300);
  expect(w.unit(victim!.id)).toBeUndefined();
  const r = w.ahriSpiritRushAudio[0];
  expect(r.bursts[0].bolts[0].targetId).toBe(victim!.id);
  expect(r.bursts[0].bolts[0].end?.reason).toBe('hit');
  const copy = restore(w);
  w.step(700);
  copy.step(700);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.ahriSpiritRushAudio).toEqual([]);
});
test('terminal settlement closes every active window, dash and bolt without changing a frozen victory', () => {
  for (const age of [1, 5, 30, 900, 901, 920]) {
    const { w } = setup();
    w.step(age - 1);
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.ahriRushes).toEqual([]);
    const r = w.ahriSpiritRushAudio[0];
    expect(r.end).not.toBeNull();
    expect(r.bursts.every((b) => b.dashEndTick !== null && b.bolts.every((p) => p.end))).toBe(true);
    const saved = w.snapshot(),
      copy = restore(w);
    w.step(300);
    copy.step(300);
    expect(w.snapshot()).toBe(saved);
    expect(copy.snapshot()).toBe(saved);
  }
});
test('strict active restoration rejects missing history, forged identities, windows, casts and projectile facts', () => {
  const { w } = setup();
  w.step(4);
  const saved = w.snapshot();
  const reject = (change: (s: any, r: any) => void) => {
    const s = JSON.parse(saved);
    change(s, s.ahriSpiritRushAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  };
  reject((s) => delete s.ahriSpiritRushAudio);
  reject((s) => (s.ahriSpiritRushAudio = []));
  reject((s, r) => s.ahriSpiritRushAudio.push(structuredClone(r)));
  reject((s, r) => (r.id = s.nextId));
  reject((s, r) => (r.sourceId = s.player.id));
  reject((_s, r) => r.startTick++);
  reject((_s, r) => r.windowEndTick++);
  reject((_s, r) => (r.audience = ['red']));
  reject((_s, r) => (r.bursts[0].index = 1));
  reject((_s, r) => r.bursts[0].tick++);
  reject((_s, r) => r.bursts[0].origin.x++);
  reject((_s, r) => (r.bursts[0].dashEndTick = 1));
  reject((_s, r) => (r.bursts[0].bolts[0].index = 1));
  reject((_s, r) => (r.bursts[0].bolts[0].targetId = r.sourceId));
  reject((_s, r) => r.bursts[0].bolts[0].currentPoint.x++);
  reject((_s, r) => (r.end = { tick: 5, point: r.origin, reason: 'expired', audience: ['blue'] }));
});
test('completed tails reject forged expiry, death, dash and contact clocks after gameplay pruning', () => {
  const { w } = setup();
  w.step(900);
  expect(w.ahriRushes).toEqual([]);
  const saved = w.snapshot();
  const reject = (change: (s: any, r: any) => void) => {
    const s = JSON.parse(saved);
    change(s, s.ahriSpiritRushAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  };
  reject((_s, r) => r.end.tick--);
  reject((_s, r) => (r.end.reason = 'death'));
  reject((_s, r) => (r.end.reason = 'match-end'));
  reject((_s, r) => r.windowEndTick++);
  reject((_s, r) => (r.bursts[0].dashEndTick = 40));
  reject((_s, r) => (r.bursts[0].bolts[0].end.reason = 'expired'));
  reject((_s, r) => r.bursts[0].bolts[0].currentPoint.x++);
  reject((_s, r) => {
    r.bursts[0].bolts[0].currentPoint.x += 10000;
    r.bursts[0].bolts[0].end.point.x += 10000;
  });
  reject((_s, r) => (r.bursts[0].bolts[0].end.audience = ['red', 'blue']));
  reject((s, r) => s.ahriSpiritRushAudio.push({ ...structuredClone(r), id: s.nextId++ }));
  restore(w);
});
