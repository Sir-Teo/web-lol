import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { masterYiAttackExpiry } from '../src/simulation/masteryi-aa-presentation';
function fixture(champion?: 'ahri' | 'leona' | 'masteryi') {
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
  const target = champion
    ? w.spawn('champion', 'red', { x: 150, y: 0 }, champion)
    : w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.ai = false;
  target.hp = target.maxHp = 100000;
  const state = w.championState(yi.id)!;
  w.setOrder(yi, { type: 'attack', target: target.id });
  w.step();
  const record = state.masterYiAAAudio[0];
  return { w, yi, target, state, record };
}
test.each([undefined, 'ahri', 'leona', 'masteryi'] as const)(
  'accepted windup and contact against %s survive exact save futures',
  (champion) => {
    const f = fixture(champion),
      saved = f.w.snapshot(),
      copy = World.fromSnapshot(saved, f.w.battlefield);
    expect(f.record.impact).toBeNull();
    expect(copy.snapshot()).toBe(saved);
    const ticks = f.yi.releaseTick! - f.w.tick;
    copy.step(ticks);
    f.w.step(ticks);
    expect(copy.snapshot()).toBe(f.w.snapshot());
    expect(f.record.impact).toMatchObject({
      tick: f.record.releaseTick,
      point: { x: 150, y: 0 },
      material: champion === 'leona' ? 'Metal' : 'Flesh',
    });
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
    f.w.setOrder(f.yi, { type: 'idle' });
    f.w.step(masterYiAttackExpiry(f.record) - f.w.tick);
    expect(f.state.masterYiAAAudio).toEqual([]);
  }
);
test('ordinary cancellation keeps the cast tail and never manufactures an impact', () => {
  const f = fixture();
  f.w.setOrder(f.yi, { type: 'idle' });
  expect(f.record.cancelTick).toBe(f.w.tick);
  f.w.step(30);
  expect(f.record.impact).toBeNull();
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});
test('Double Strike secondary contact does not create an extra ordinary attack cue', () => {
  const f = fixture();
  f.state.doubleStrike!.stacks = 3;
  f.state.doubleStrike!.expiresTick = f.w.tick + 240;
  f.w.step(f.yi.releaseTick! - f.w.tick);
  const strike = f.state.doubleStrike!.strike!;
  f.w.setOrder(f.yi, { type: 'idle' });
  f.w.step(strike.releaseTick - f.w.tick);
  expect(strike.result).toBe('hit');
  expect(f.state.masterYiAAAudio).toHaveLength(1);
});
test.each([
  'missing',
  'duplicate',
  'future',
  'release',
  'end',
  'target',
  'rig',
  'audience',
  'kind',
  'cancel',
  'impact',
])('decoder rejects %s forged attack history', (kind) => {
  const f = fixture(),
    saved = JSON.parse(f.w.snapshot());
  const owner = saved.otherChampions.find((s: any) => s.id === f.yi.id),
    r = owner.masterYiAAAudio[0];
  if (kind === 'missing') owner.masterYiAAAudio = [];
  if (kind === 'duplicate') owner.masterYiAAAudio.push({ ...r });
  if (kind === 'future') r.startTick = saved.tick + 1;
  if (kind === 'release') r.releaseTick++;
  if (kind === 'end') r.endTick++;
  if (kind === 'target') r.targetId = saved.nextId;
  if (kind === 'rig') r.targetRig = 'masteryi-base';
  if (kind === 'audience') r.castAudience = ['red'];
  if (kind === 'kind') r.kind = 'crit';
  if (kind === 'cancel') r.cancelTick = saved.tick;
  if (kind === 'impact')
    r.impact = {
      tick: r.releaseTick,
      point: { x: 150, y: 0 },
      material: 'Flesh',
      audience: ['blue', 'red'],
    };
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
