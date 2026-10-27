import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ALPHA_CONTACT_HISTORY_TICKS } from '../src/content/masteryi-q-contact-timing';
import { Random } from '../src/simulation/math';
import { advanceAlphaContacts } from '../src/simulation/masteryi-q-contact-visuals';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const owner = w.championState(yi.id)!;
  w.learnSpell('q', yi.id);
  const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'q', point: target, targetId: target.id });
    w.step();
  };
  const resume = (ticks: number) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, owner, target, cast, resume };
}

test('ordinary units do not trigger Yi contact-history state lookups', () => {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] });
  for (let i = 0; i < 100; i++) w.spawn('dummy', 'red', { x: 300 + i, y: 0 });
  const lookup = vi.spyOn(w, 'championState');
  advanceAlphaContacts(w);
  expect(lookup).not.toHaveBeenCalled();
  lookup.mockRestore();
});

test('queued explicit Yi Q saves before admission and restores its exact next-step result', () => {
  const f = fixture();
  f.w.enqueue({
    type: 'cast',
    unit: f.yi.id,
    ability: 'q',
    point: f.target,
    targetId: f.target.id,
  });
  f.resume(1);
  expect(f.owner.alphaStrike).not.toBeNull();
  expect(f.owner.alphaContactVisuals).toEqual([]);
});

test.each(['w', 'e', 'r'] as const)(
  'decoder still rejects explicit target IDs on Yi %s commands',
  (ability) => {
    const f = fixture();
    f.w.enqueue({ type: 'cast', unit: f.yi.id, ability, point: f.target, targetId: f.target.id });
    expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).toThrow(
      'incompatible targeted cast'
    );
  }
);

test('history retention derives from every selected native target emitter and the existing first-update grid', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/q-particles.json', 'utf8'));
  const emitters = ['MasterYi_Q_Tar', 'MasterYi_Q_Crit_tar'].flatMap(
    (key) => source.resources[key].definition.complexEmitterDefinitionData
  );
  const endpoints = emitters.map((p: any) => {
    const count = p.isSingleParticle
      ? 1
      : Math.max(1, Math.floor((Math.floor(p.lifetime * 60) * p.rate.constantValue) / 60));
    const born = count === 1 ? 1 : Math.ceil((count * 60) / p.rate.constantValue);
    return born + Math.ceil(p.particleLifetime.constantValue * 60) + 1;
  });
  expect(emitters).toHaveLength(7);
  expect(ALPHA_CONTACT_HISTORY_TICKS).toBe(Math.max(...endpoints));
  expect(ALPHA_CONTACT_HISTORY_TICKS).toBe(22);
});

test('pending first mark creates no contact; repeats capture only their accepted ticks without RNG or IDs', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  expect(f.owner.alphaStrike!.marks[0].result).toBe('pending');
  expect(f.owner.alphaContactVisuals).toEqual([]);
  f.w.step(13);
  const rng = f.w.random.state,
    nextId = f.w.nextId;
  f.w.step();
  expect(f.w.random.state).toBe(rng);
  // The pre-existing damage event owns one ID; contact presentation owns none.
  expect(f.w.nextId).toBe(nextId + 1);
  expect(f.w.events.filter((event) => event.id >= nextId)).toHaveLength(1);
  expect(f.owner.alphaContactVisuals).toMatchObject([
    {
      castTick: 1,
      rank: 1,
      markIndex: 1,
      markTick: 29,
      repeatIndex: 1,
      tick: 29,
      targetId: f.target.id,
      targetTeam: 'red',
      targetKind: 'dummy',
      point: { x: 300, y: 0 },
      audience: ['blue', 'red'],
      detachedTick: null,
      frames: [{ tick: 29, point: { x: 300, y: 0 }, audience: ['blue', 'red'] }],
    },
  ]);
  f.resume(1);
});

test('four unique contacts wait for reappearance and capture actual contact roots, not mark positions', () => {
  const f = fixture();
  for (const x of [400, 500, 600]) {
    const u = f.w.spawn('dummy', 'red', { x, y: 0 });
    u.hp = u.maxHp = 1e6;
  }
  f.cast();
  f.w.step(55);
  expect(f.owner.alphaContactVisuals).toEqual([]);
  const markPoint = { ...f.owner.alphaStrike!.marks[0].point };
  f.target.y = f.target.previous.y = 100;
  f.w.step();
  expect(f.owner.alphaContactVisuals.map((r) => [r.tick, r.markIndex, r.repeatIndex])).toEqual([
    [57, 0, 0],
    [57, 1, 0],
    [57, 2, 0],
    [57, 3, 0],
  ]);
  expect(f.owner.alphaContactVisuals[0].point).toEqual({ x: 300, y: 100 });
  expect(f.owner.alphaContactVisuals[0].point).not.toEqual(markPoint);
  f.resume(21);
  expect(f.owner.alphaStrike).toBeNull();
  expect(f.owner.alphaContactVisuals).toHaveLength(4);
  f.resume(1);
  expect(f.owner.alphaContactVisuals).toEqual([]);
});

test('repeat-before-pending resolution is stored in canonical contact/index order and survives Q cleanup', () => {
  const f = fixture();
  f.cast();
  f.w.step(56);
  expect(f.owner.alphaContactVisuals.map((r) => [r.tick, r.markIndex])).toEqual([
    [43, 2],
    [57, 0],
    [57, 3],
  ]);
  f.resume(10);
  expect(f.owner.alphaStrike).toBeNull();
  expect(f.owner.alphaContactVisuals.map((r) => r.markIndex)).toEqual([0, 3]);
  f.resume(12);
  expect(f.owner.alphaContactVisuals).toEqual([]);
});

test('lost pending target records no contact flash or invented empty Q_Hit emitter', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  f.target.hp = 0;
  f.target.deadAt = f.w.tick;
  f.w.step(14);
  expect(f.owner.alphaStrike!.marks[0].result).toBe('lost');
  expect(f.owner.alphaContactVisuals).toEqual([]);
  f.resume(1);
});

test('lethal accepted contact retains its known endpoint and freezes after target cleanup', () => {
  const f = fixture();
  f.cast();
  f.w.step(27);
  f.target.hp = 1;
  f.w.step();
  const r = f.owner.alphaContactVisuals[0];
  expect(f.target.hp).toBe(0);
  expect(r.detachedTick).toBe(29);
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.frames[0].audience).toEqual(r.audience);
  f.target.x = 900;
  f.target.y = 900;
  f.resume(3);
  expect(r.frames.every((frame) => frame.point.x === 300 && frame.point.y === 0)).toBe(true);
});

test('confirmed contact tails survive caster death and do not require a future Q phase', () => {
  const f = fixture();
  f.cast();
  f.w.step(28);
  f.w.damage(f.target, f.yi, 1e6, 'true');
  expect(f.owner.alphaStrike).toBeNull();
  expect(f.owner.alphaContactVisuals).toHaveLength(1);
  f.resume(21);
  expect(f.owner.alphaContactVisuals).toHaveLength(1);
  f.resume(1);
  expect(f.owner.alphaContactVisuals).toEqual([]);
});

test('target movement and visibility are captured per tick without modifying known birth points', () => {
  const f = fixture();
  f.cast();
  f.w.step(28);
  const r = f.owner.alphaContactVisuals[0];
  f.target.x = f.target.previous.x = 320;
  f.target.y = f.target.previous.y = 50;
  f.w.step();
  f.resume(1);
  expect(r.point).toEqual({ x: 300, y: 0 });
  expect(r.frames.at(-1)!.point).toEqual({ x: 320, y: 50 });
  expect(r.frames.map((frame) => frame.tick)).toEqual([29, 30, 31]);
});

test('critical contacts use the saved mark critical payload without another random roll', () => {
  const f = fixture();
  f.owner.inventory = Array(6).fill('agility');
  f.cast();
  f.w.step(27);
  const expectedRandom = new Random(f.w.random.state);
  expectedRandom.next(); // The pre-existing critical roll for this mark.
  f.w.step();
  expect(f.w.random.state).toBe(expectedRandom.state);
  expect(f.owner.alphaContactVisuals[0].critical).toBe(true);
  expect(f.owner.alphaContactVisuals[0].critical).toBe(f.owner.alphaStrike!.marks[1].critical);
  f.resume(1);
});

test('later hidden movement does not change the accepted contact audience or point', () => {
  const f = fixture();
  f.cast();
  f.w.step(28);
  const r = f.owner.alphaContactVisuals[0];
  f.target.x = f.target.previous.x = 6000;
  f.w.step();
  f.resume(1);
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.point).toEqual({ x: 300, y: 0 });
  expect(r.frames.at(-1)!.audience).toEqual(['red']);
  expect(r.frames.at(-1)!.point.x).toBe(6000);
});

test('another Yi becoming vanished removes both frame audiences while leaving known contact data intact', () => {
  const f = fixture();
  f.target.hp = 0;
  f.target.deadAt = 0;
  f.target.x = 5000;
  const enemy = f.w.spawn('champion', 'red', { x: 300, y: 0 }, 'masteryi');
  enemy.ai = false;
  f.w.learnSpell('q', enemy.id);
  const ally = f.w.spawn('dummy', 'blue', { x: 400, y: 0 });
  ally.hp = ally.maxHp = 1e6;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: enemy, targetId: enemy.id });
  f.w.step(29);
  const r = f.owner.alphaContactVisuals[0];
  f.w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: ally, targetId: ally.id });
  f.resume(1);
  expect(f.w.championState(enemy.id)!.alphaStrike!.reappearTick).toBeNull();
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.frames.at(-1)!.audience).toEqual([]);
});

test('victory retains a valid frozen contact tail without advancing the simulation clock', () => {
  const f = fixture();
  f.cast();
  f.w.step(28);
  const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
  f.w.damage(f.yi, nexus, 1e6, 'true');
  expect(f.w.winner).toBe('blue');
  expect(f.owner.alphaStrike).toBeNull();
  const before = f.w.tick;
  f.resume(10);
  expect(f.w.tick).toBe(before);
  expect(f.owner.alphaContactVisuals).toHaveLength(1);
});

test.each([
  'missing',
  'duplicate',
  'foreign-owner',
  'future',
  'expired',
  'rank',
  'mark-index',
  'repeat',
  'target-team',
  'target-id',
  'structure',
  'audience',
  'duplicate-audience',
  'frame-gap',
  'missing-frame',
  'frame-future',
  'frame-endpoint',
  'critical',
  'detached',
  'unknown-field',
])('decoder rejects %s contact history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(29);
  const data = JSON.parse(f.w.snapshot()),
    owner = data.otherChampions.find((o: any) => o.id === f.yi.id);
  const r = owner.alphaContactVisuals[0];
  switch (kind) {
    case 'missing':
      owner.alphaContactVisuals = [];
      break;
    case 'duplicate':
      owner.alphaContactVisuals.push(structuredClone(r));
      break;
    case 'foreign-owner':
      data.player.alphaContactVisuals = [r];
      break;
    case 'future':
      r.tick = data.tick + 1;
      break;
    case 'expired':
      r.tick = data.tick - ALPHA_CONTACT_HISTORY_TICKS;
      break;
    case 'rank':
      r.rank = 5;
      break;
    case 'mark-index':
      r.markIndex = 0;
      break;
    case 'repeat':
      r.repeatIndex = 0;
      break;
    case 'target-team':
      r.targetTeam = 'blue';
      break;
    case 'target-id':
      r.targetId = data.nextId;
      break;
    case 'structure':
      r.targetKind = 'turret';
      break;
    case 'audience':
      r.audience = ['red'];
      break;
    case 'duplicate-audience':
      r.frames[0].audience = ['blue', 'blue'];
      break;
    case 'frame-gap':
      r.frames[0].tick++;
      break;
    case 'missing-frame':
      r.frames.pop();
      break;
    case 'frame-future':
      r.frames.at(-1).tick = data.tick + 1;
      break;
    case 'frame-endpoint':
      r.frames.at(-1).point.x++;
      break;
    case 'critical':
      r.critical = !r.critical;
      break;
    case 'detached':
      r.detachedTick = r.tick;
      break;
    case 'unknown-field':
      r.nativeDispatch = true;
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(data), f.w.battlefield)).toThrow();
});
