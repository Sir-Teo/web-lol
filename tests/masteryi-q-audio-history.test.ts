import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { alphaAudioExpiry } from '../src/simulation/masteryi-q-audio';
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
test('accepted cast captures only its two-layer root without extra RNG/IDs and rejects invalid casts without history', () => {
  const f = fixture(),
    rng = f.w.random.state,
    id = f.w.nextId;
  f.cast();
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id + 1);
  expect(f.owner.alphaAudio).toMatchObject([
    {
      startTick: 1,
      rank: 1,
      primaryTargetId: f.target.id,
      primaryTargetTeam: 'red',
      origin: { x: 0, y: 0 },
      castAudience: ['blue', 'red'],
      contacts: [],
    },
  ]);
  f.cast();
  expect(f.owner.alphaAudio).toHaveLength(1);
  f.resume(1);
});
test('pending marks create no hit cue; ordinary contacts retain their own accepted positions, audience and ordering', () => {
  const f = fixture();
  f.cast();
  f.w.step(14);
  expect(f.owner.alphaAudio[0].contacts).toEqual([]);
  f.w.step(14);
  expect(f.owner.alphaAudio[0].contacts).toMatchObject([
    {
      tick: 29,
      markTick: 29,
      markIndex: 1,
      repeatIndex: 1,
      targetId: f.target.id,
      point: { x: 300, y: 0 },
      audience: ['blue', 'red'],
    },
  ]);
  f.resume(28);
  expect(f.owner.alphaAudio[0].contacts.map((c) => [c.tick, c.markIndex])).toEqual([
    [29, 1],
    [43, 2],
    [57, 0],
    [57, 3],
  ]);
});
test('all ordinary unique contacts retain cues even when source voice admission will limit the audible subset', () => {
  const f = fixture();
  for (const x of [400, 500, 600]) {
    const u = f.w.spawn('dummy', 'red', { x, y: 0 });
    u.hp = u.maxHp = 1e6;
  }
  f.cast();
  f.w.step(55);
  expect(f.owner.alphaAudio[0].contacts).toEqual([]);
  f.w.step();
  expect(f.owner.alphaAudio[0].contacts.map((c) => [c.tick, c.markIndex, c.repeatIndex])).toEqual([
    [57, 0, 0],
    [57, 1, 0],
    [57, 2, 0],
    [57, 3, 0],
  ]);
  f.resume(1);
});
test('critical source omission yields cast cues and no hit cues, while all actual critical contacts retain visuals', () => {
  const f = fixture();
  f.owner.inventory = Array(6).fill('agility');
  f.cast();
  f.w.step(56);
  expect(f.owner.alphaStrike!.marks.every((m) => m.critical)).toBe(true);
  expect(f.owner.alphaAudio[0].contacts).toEqual([]);
  expect(f.owner.alphaContactVisuals).toHaveLength(3);
  f.resume(1);
});
test('audio survives visual and Q cleanup through its exact source retention boundary and reload', () => {
  const f = fixture();
  f.cast();
  f.resume(99);
  expect(f.owner.alphaStrike).toBeNull();
  expect(f.owner.alphaContactVisuals).toEqual([]);
  expect(f.owner.alphaAudio[0].contacts).toHaveLength(4);
  expect(alphaAudioExpiry(f.owner.alphaAudio[0])).toBe(145);
  f.resume(44);
  expect(f.owner.alphaAudio).toHaveLength(1);
  f.resume(1);
  expect(f.owner.alphaAudio).toEqual([]);
});
test('lost pending target adds no hit cue; an accepted lethal hit retains its pre-cleanup point', () => {
  const lost = fixture();
  lost.cast();
  lost.w.step(14);
  lost.w.damage(lost.yi, lost.target, 1e9, 'true');
  lost.w.step(14);
  expect(lost.owner.alphaAudio[0].contacts).toEqual([]);
  lost.resume(1);
  const f = fixture();
  f.cast();
  f.w.step(27);
  f.target.hp = 1;
  f.w.step();
  expect(f.target.hp).toBe(0);
  expect(f.owner.alphaAudio[0].contacts[0].point).toEqual({ x: 300, y: 0 });
  f.resume(1);
});
test.each(['death', 'victory'] as const)(
  '%s preserves finite cues after the Q controller clears',
  (kind) => {
    const f = fixture();
    f.cast();
    f.w.step(28);
    if (kind === 'death') f.w.damage(f.target, f.yi, 1e9, 'true');
    else {
      const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
      f.w.damage(f.yi, nexus, 1e9, 'true');
    }
    expect(f.owner.alphaStrike).toBeNull();
    expect(f.owner.alphaAudio).toHaveLength(1);
    f.resume(1);
  }
);
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'rank',
  'primary',
  'primary-team',
  'origin',
  'cast-audience',
  'missing-hit',
  'duplicate-hit',
  'mark-index',
  'mark-clock',
  'repeat',
  'contact-clock',
  'point',
  'hit-audience',
  'critical',
  'order',
  'unknown',
])('decoder rejects %s forged Q audio history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(42);
  const saved = JSON.parse(f.w.snapshot()),
    owner = saved.otherChampions.find((o: any) => o.id === f.yi.id),
    r = owner.alphaAudio[0],
    c = r.contacts[0];
  switch (kind) {
    case 'missing':
      owner.alphaAudio = [];
      break;
    case 'duplicate':
      owner.alphaAudio.push(structuredClone(r));
      break;
    case 'foreign':
      saved.player.alphaAudio = [r];
      break;
    case 'future':
      r.startTick = saved.tick + 1;
      break;
    case 'rank':
      r.rank = 5;
      break;
    case 'primary':
      r.primaryTargetId = saved.nextId;
      break;
    case 'primary-team':
      r.primaryTargetTeam = 'blue';
      break;
    case 'origin':
      r.origin.x++;
      break;
    case 'cast-audience':
      r.castAudience = ['red'];
      break;
    case 'missing-hit':
      r.contacts.shift();
      break;
    case 'duplicate-hit':
      r.contacts.push(structuredClone(c));
      break;
    case 'mark-index':
      c.markIndex = 0;
      break;
    case 'mark-clock':
      c.markTick++;
      break;
    case 'repeat':
      c.repeatIndex = 0;
      break;
    case 'contact-clock':
      c.tick++;
      break;
    case 'point':
      c.point.x++;
      break;
    case 'hit-audience':
      c.audience = ['red'];
      break;
    case 'critical':
      owner.alphaStrike.marks[1].critical = true;
      owner.alphaContactVisuals.find((v: any) => v.markIndex === 1).critical = true;
      break;
    case 'order':
      r.contacts.reverse();
      break;
    case 'unknown':
      r.nativeCallback = true;
      break;
  }
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
