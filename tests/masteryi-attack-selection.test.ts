import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  masterYiAttackKind,
  masterYiAttackClip,
  type MasterYiAttackKind,
} from '../src/simulation/masteryi-attack-kind';
import { PRIMARY_TRAIL_MARKERS } from '../src/content/masteryi-primary-trail-timing';
import { primaryTrailMarkerTick } from '../src/simulation/masteryi-primary-trails';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { mobilePose } from '../src/render/mobile-pose';
import { masterYiAAStates } from '../src/audio/masteryi-aa-state';
import { MASTER_YI_AA_AUDIO } from '../src/content/masteryi-aa-audio';
function fixture(kind: MasterYiAttackKind) {
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
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi'),
    target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  yi.ai = target.ai = false;
  target.hp = target.maxHp = 1e6;
  while (kind !== 'crit' && masterYiAttackKind(yi.id, w.tick + 1) !== kind) w.step();
  const random = w.random.state,
    id = w.nextId,
    spy = kind === 'crit' ? vi.spyOn(w, 'criticalChance').mockReturnValue(1) : undefined;
  w.setOrder(yi, { type: 'attack', target: target.id });
  w.step();
  spy?.mockRestore();
  const owner = w.championState(yi.id)!,
    record = owner.masterYiAAAudio.at(-1)!;
  expect(record.kind).toBe(kind);
  if (kind !== 'crit') {
    expect(w.random.state).toBe(random);
    expect(w.nextId).toBe(id);
  }
  return { w, yi, target, owner, record };
}
test('both declared weights feed a stable independent ordinary choice', () => {
  const random = vi.spyOn(Math, 'random');
  try {
    const counts = { attack1: 0, attack2: 0 };
    for (let tick = 0; tick < 4096; tick++) {
      const kind = masterYiAttackKind(7, tick, false);
      expect(kind).toBe(masterYiAttackKind(7, tick, false));
      if (kind === 'crit') throw Error('Ordinary choice became critical');
      counts[kind]++;
      expect(masterYiAttackKind(7, tick, true)).toBe('crit');
    }
    expect(counts.attack1).toBeGreaterThan(1843);
    expect(counts.attack1).toBeLessThan(2253);
    expect(counts.attack2).toBeGreaterThan(1843);
    expect(counts.attack2).toBeLessThan(2253);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});
test.each(['attack1', 'attack2', 'crit'] as const)(
  '%s actual admission selects its native clip, marker and source cue and saves exactly',
  (kind) => {
    const { w, yi, owner, record } = fixture(kind),
      expected = { attack1: 'entry_d5c55cfd', attack2: 'entry_0d6139b0', crit: 'entry_e1798980' };
    const pose = mobilePose(yi, owner, w.tick, 1, MOBILE_CLIP_DURATIONS['masteryi-base']);
    expect(pose.clip).toBe(expected[kind]);
    expect(masterYiAttackClip(kind)).toBe(expected[kind]);
    const cue = masterYiAAStates(
      [{ ...record, id: yi.id, x: yi.x, y: yi.y, castVisible: true, hitVisible: true }],
      w.tick
    );
    expect(cue).toHaveLength(1);
    expect(MASTER_YI_AA_AUDIO[cue[0].profileIndex].kind).toBe(kind);
    expect(cue[0].leadSeconds).toBe({ attack1: 0.05, attack2: 0.055, crit: 0.2 }[kind]);
    const tick = primaryTrailMarkerTick(record),
      marker = PRIMARY_TRAIL_MARKERS[kind],
      rate = marker.renderedDuration / ((record.endTick - record.startTick) / 60);
    expect(((tick - record.startTick) / 60) * rate).toBeGreaterThanOrEqual(marker.renderedSeconds);
    expect(((tick - record.startTick - 1) / 60) * rate).toBeLessThan(marker.renderedSeconds);
    w.step(tick + 2 - w.tick);
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(130);
    copy.step(130);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
);
test.each(['attack1', 'attack2'] as const)(
  'saved %s cannot be replaced by the other ordinary pose',
  (kind) => {
    const { w, yi } = fixture(kind),
      saved = JSON.parse(w.snapshot()),
      owner = saved.otherChampions.find((s: any) => s.id === yi.id);
    owner.masterYiAAAudio[0].kind = kind === 'attack1' ? 'attack2' : 'attack1';
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow(
      'Master Yi attack audio'
    );
  }
);
test.each([0, -1, NaN, Infinity])('invalid actor identity %s rejects', (id) =>
  expect(() => masterYiAttackKind(id, 1)).toThrow()
);
test.each([-1, NaN, Infinity])('invalid attack clock %s rejects', (tick) =>
  expect(() => masterYiAttackKind(1, tick)).toThrow()
);
