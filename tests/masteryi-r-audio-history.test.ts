import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { experienceToNextLevel } from '../src/simulation/progression';
import { highlanderAudioExpiry } from '../src/simulation/masteryi-highlander-audio';
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
  const state = w.championState(yi.id)!;
  while (state.level < 6) w.gainExperience(experienceToNextLevel(state.level), yi.id);
  w.learnSpell('r', yi.id);
  const cast = (ability: 'r' | 'w' | 'q' = 'r', target?: number) => {
    w.enqueue({
      type: 'cast',
      unit: yi.id,
      ability,
      point: target ? w.unit(target)! : yi,
      ...(target ? { targetId: target } : {}),
    });
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
  return { w, yi, state, cast, resume };
}
test('accepted R captures its own history without extra RNG/IDs, then saves exact natural expiry and ending tail', () => {
  const f = fixture(),
    rng = f.w.random.state,
    id = f.w.nextId;
  f.cast();
  const r = f.state.highlanderAudio[0];
  expect(f.w.random.state).toBe(rng);
  expect(f.w.nextId).toBe(id + 1);
  expect(r).toMatchObject({ startTick: 1, rank: 1, takedownsAtCast: 0, stop: null });
  f.resume(419);
  expect(r.stop).toBeNull();
  f.resume(1);
  expect(r.stop).toMatchObject({
    tick: 421,
    reason: 'expired',
    endTick: 421,
    pausedTicks: 0,
    extensionCount: 0,
  });
  expect(highlanderAudioExpiry(r)).toBe(531);
  f.resume(109);
  expect(f.state.highlanderAudio).toHaveLength(1);
  f.w.step();
  expect(f.state.highlanderAudio).toEqual([]);
});
test('awarded takedown extends the same history without a new onset and records its later natural ending', () => {
  const f = fixture();
  f.cast();
  const r = f.state.highlanderAudio[0],
    victim = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  victim.ai = false;
  f.w.damage(f.yi, victim, 1e6, 'true');
  f.resume(420);
  expect(r.stop).toBeNull();
  expect(f.state.highlanderAudio).toHaveLength(1);
  f.resume(420);
  expect(r.stop).toMatchObject({ reason: 'expired', tick: 841, endTick: 841, extensionCount: 1 });
});
test('Meditate pauses the real buff while the saved onset keeps its original source clock', () => {
  const f = fixture();
  f.w.learnSpell('w', f.yi.id);
  f.cast();
  const r = f.state.highlanderAudio[0];
  f.cast('w');
  f.resume(240);
  expect(r.stop).toBeNull();
  expect(f.state.highlander!.pausedTicks).toBe(240);
  expect(r.startTick).toBe(1);
  f.resume(f.state.highlander!.endTick - f.w.tick);
  expect(r.stop).toMatchObject({ reason: 'expired', pausedTicks: 240, tick: 661 });
});
test('Q pause accounting survives save/reload through later R expiry', () => {
  const f = fixture();
  f.w.learnSpell('q', f.yi.id);
  f.cast();
  const r = f.state.highlanderAudio[0],
    target = f.w.spawn('dummy', 'red', { x: 400, y: 0 });
  target.hp = target.maxHp = 100000;
  f.cast('q', target.id);
  expect(f.state.alphaStrike).not.toBeNull();
  f.resume(70);
  const paused = f.state.highlander!.pausedTicks;
  expect(paused).toBeGreaterThan(0);
  f.resume(f.state.highlander!.endTick - f.w.tick);
  expect(r.stop).toMatchObject({ reason: 'expired', pausedTicks: paused, tick: 421 + paused });
});
test.each(['death', 'match-end', 'recast'] as const)(
  '%s closes the active history without forging natural expiry',
  (reason) => {
    const f = fixture();
    f.cast();
    const r = f.state.highlanderAudio[0];
    f.w.step(5);
    if (reason === 'death') {
      const enemy = f.w.spawn('champion', 'red', { x: 100, y: 0 }, 'lux');
      enemy.ai = false;
      f.w.damage(enemy, f.yi, 1e6, 'true');
    } else if (reason === 'match-end') {
      const nexus = f.w.spawn('nexus', 'red', { x: 1000, y: 1000 });
      f.w.damage(f.yi, nexus, 1e6, 'true');
    } else {
      f.state.cooldowns.r = 0;
      f.yi.mana = f.yi.maxMana;
      f.cast();
      expect(f.state.highlanderAudio).toHaveLength(2);
      expect(f.state.highlanderAudio[1].startTick).toBe(r.stop!.tick);
    }
    expect(r.stop!.reason).toBe(reason);
    expect(r.stop!.tick).toBeLessThan(r.stop!.endTick);
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  }
);
test.each([
  'missing',
  'duplicate',
  'foreign',
  'future',
  'rank',
  'audience',
  'takedowns',
  'unowned',
  'future-stop',
  'early-expiry',
  'unearned-extension',
  'overpaid-pause',
  'death',
  'match-end',
  'recast',
])('decoder rejects %s forged Highlander history', (kind) => {
  const f = fixture();
  f.cast();
  f.w.step(5);
  const saved = JSON.parse(f.w.snapshot()),
    owner = saved.otherChampions.find((s: any) => s.id === f.yi.id),
    r = owner.highlanderAudio[0];
  if (kind === 'missing') owner.highlanderAudio = [];
  if (kind === 'duplicate') owner.highlanderAudio.push({ ...r });
  if (kind === 'foreign') {
    saved.player.highlanderAudio = [r];
    owner.highlanderAudio = [];
  }
  if (kind === 'future') r.startTick = saved.tick + 1;
  if (kind === 'rank') r.rank = 2;
  if (kind === 'audience') r.castAudience = ['red'];
  if (kind === 'takedowns') r.takedownsAtCast = 1;
  if (kind === 'unowned') owner.highlander = null;
  if (
    [
      'future-stop',
      'early-expiry',
      'unearned-extension',
      'overpaid-pause',
      'death',
      'match-end',
      'recast',
    ].includes(kind)
  ) {
    owner.highlander = null;
    r.stop = {
      tick: saved.tick,
      reason: 'expired',
      endTick: 421,
      extensionCount: 0,
      pausedTicks: 0,
      point: { x: 0, y: 0 },
      audience: ['blue', 'red'],
    };
    if (kind === 'future-stop') r.stop.tick = saved.tick + 1;
    if (kind === 'unearned-extension') {
      r.stop.extensionCount = 1;
      r.stop.endTick += 420;
    }
    if (kind === 'overpaid-pause') {
      r.stop.pausedTicks = 10;
      r.stop.endTick += 10;
    }
    if (['death', 'match-end', 'recast'].includes(kind)) r.stop.reason = kind;
  }
  expect(() => World.fromSnapshot(JSON.stringify(saved), f.w.battlefield)).toThrow();
});
