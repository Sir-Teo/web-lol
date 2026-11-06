import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ahriAttackAudioExpiry } from '../src/simulation/ahri-attack-audio';
function setup(critical = false, level18 = false) {
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
  if (level18) w.gainExperience(1e6, ahri.id);
  if (critical) w.championState(ahri.id)!.inventory = Array(6).fill('agility');
  const target = w.spawn('dummy', 'red', { x: 450, y: 0 });
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, armor: 0 });
  w.random.state = 1;
  w.setOrder(ahri, { type: 'attack', target: target.id });
  w.step();
  return { w, ahri, target };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('ordinary and critical windup, swept flight/contact and finite tails restore every frame', () => {
  for (const critical of [false, true]) {
    const { w, ahri, target } = setup(critical);
    expect(w.ahriAttackAudio[0].critical).toBe(critical);
    for (let t = 1; t < 180; t++) {
      if (t === 20) w.setOrder(ahri, { type: 'idle' });
      const copy = restore(w);
      w.step();
      copy.step();
      expect(copy.snapshot()).toBe(w.snapshot());
    }
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(w.ahriAttackAudio).toEqual([]);
    expect(JSON.parse(w.snapshot())).not.toHaveProperty('ahriAttackAudio');
  }
});
test('consecutive faster attacks retain independent existing windup and projectile identities', () => {
  const { w } = setup(false, true);
  const keys = new Set<string>(),
    projectiles = new Set<number>();
  for (let t = 0; t < 300; t++) {
    for (const r of w.ahriAttackAudio) {
      keys.add(`${r.sourceId}:${r.startTick}`);
      if (r.launch) projectiles.add(r.launch.id);
    }
    const copy = restore(w);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
  expect(keys.size).toBeGreaterThan(4);
  expect(projectiles.size).toBeGreaterThan(4);
});
test('immediate windup cancellation and owner death saves retain finite cast tails without a missile', () => {
  for (const death of [false, true]) {
    const { w, ahri } = setup();
    w.step(4);
    if (death) w.damage(w.hero, ahri, 1e6, 'true');
    else w.setOrder(ahri, { type: 'move', point: { x: -300, y: 0 } });
    expect(w.ahriAttackAudio[0]).toMatchObject({
      cancel: { tick: 5, reason: death ? 'death' : 'cancelled' },
      launch: null,
    });
    restore(w);
    w.step(90);
    expect(w.ahriAttackAudio).toEqual([]);
    expect(w.projectiles).toEqual([]);
  }
});
test('owner death and real Flash after release preserve the original projectile and swept contact point', () => {
  for (const death of [false, true]) {
    const { w, ahri } = setup();
    w.step(24);
    w.setOrder(ahri, { type: 'idle' });
    const r = w.ahriAttackAudio[0],
      origin = { ...r.launch!.origin },
      id = r.launch!.id;
    if (death) w.damage(w.hero, ahri, 1e6, 'true');
    else
      w.enqueue({
        type: 'cast',
        unit: ahri.id,
        ability: w.summonerSlot('flash', ahri.id)!,
        point: { x: -300, y: 0 },
      });
    restore(w);
    w.step(25);
    expect(r.launch!.origin).toEqual(origin);
    expect(r.launch!.id).toBe(id);
    expect(r.launch!.end?.reason).toBe('hit');
    expect(r.launch!.end!.point.x).toBeGreaterThan(400);
    expect(r.launch!.end!.point.x).toBeLessThan(450);
    expect(r.cancel).toBeNull();
    if (!death) expect(ahri.x).toBeLessThan(-200);
    restore(w);
  }
});
test('launch and contact audiences stay independent and contacts survive projectile pruning', () => {
  const { w, ahri } = setup();
  const observer = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
  observer.ai = false;
  // The initial cast predates this visibility change; launch is hidden, contact visible.
  w.pointVisible = (_p, team) => team !== 'red';
  w.step(24);
  w.setOrder(ahri, { type: 'idle' });
  const r = w.ahriAttackAudio[0];
  expect(r.launch!.audience).toEqual(['blue']);
  w.pointVisible = () => true;
  w.step(35);
  expect(r.launch!.end).toMatchObject({ reason: 'hit', audience: ['blue', 'red'] });
  expect(w.projectiles).toEqual([]);
  expect(ahriAttackAudioExpiry(r)).toBeGreaterThan(w.tick);
  restore(w);
});
test('target loss and the actual range deadline close missiles without inventing hits', () => {
  for (const range of [false, true]) {
    const { w, ahri, target } = setup();
    w.step(19);
    w.setOrder(ahri, { type: 'idle' });
    const r = w.ahriAttackAudio[0];
    if (!range) w.damage(w.hero, target, 1e6, 'true');
    for (let t = 0; t < 150; t++) {
      if (range) target.x += 100;
      w.step();
      if (t % 10 === 0) restore(w);
    }
    expect(r.launch!.end?.reason).toBe(range ? 'range' : 'lost-target');
    expect(w.ahriAttackAudio).toEqual([]);
  }
});
test('victory closes pending and released attacks while preserving earlier contacts and frozen saves', () => {
  for (const age of [1, 10, 25, 35, 60]) {
    const { w, ahri } = setup();
    w.step(age - 1);
    if (age >= 20) w.setOrder(ahri, { type: 'idle' });
    const r = w.ahriAttackAudio[0],
      before = r.launch?.end?.reason;
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    if (r.launch) expect(r.launch.end?.reason).toBe(before ?? 'match-end');
    else expect(r.cancel?.reason).toBe('match-end');
    restore(w);
    const saved = w.snapshot();
    w.step(300);
    expect(w.snapshot()).toBe(saved);
  }
});
test('malformed windups, linked projectiles and pruned contact histories are rejected', () => {
  for (const age of [1, 25, 60]) {
    const { w, ahri } = setup();
    w.step(age - 1);
    if (age >= 20) w.setOrder(ahri, { type: 'idle' });
    const changes = [
      (s: any) => {
        s.ahriAttackAudio[0].sourceId = w.hero.id;
      },
      (s: any) => {
        s.ahriAttackAudio[0].releaseTick = s.ahriAttackAudio[0].startTick;
      },
      (s: any) => {
        s.ahriAttackAudio[0].audience = ['red', 'blue'];
      },
      (s: any) => {
        s.ahriAttackAudio.push(s.ahriAttackAudio[0]);
      },
      (s: any) => {
        const r = s.ahriAttackAudio[0];
        if (r.launch) r.launch.currentPoint.x = 1e6;
        else r.critical = !r.critical;
      },
    ];
    for (const change of changes) {
      const raw = JSON.parse(w.snapshot());
      change(raw);
      expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
    }
    if (age < 60) {
      const raw = JSON.parse(w.snapshot());
      delete raw.ahriAttackAudio;
      expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow(/attack audio/);
    }
  }
});

test('release feedback carries the existing windup identity for source/fallback ownership', () => {
  const { w, ahri } = setup();
  const startTick = w.ahriAttackAudio[0].startTick;
  w.step(19);
  w.setOrder(ahri, { type: 'idle' });
  expect(w.events.find((e) => e.type === 'attack' && e.unit === ahri.id)).toMatchObject({
    champion: 'ahri',
    ahriAAStartTick: startTick,
  });
});
