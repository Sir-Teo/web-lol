import { BARON_BASIC_CAST_TICKS } from '../src/content/baron-basic-audio-timing';
import { expect, test } from 'vitest';
import type { Unit } from '../src/simulation/types';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import { baronBasicAudioStates } from '../src/audio/baron-basic-state';
import type { BaronAttackVisual } from '../src/simulation/baron-attack-visuals';

const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
const record = (r: BaronAttackVisual) => ({
  id: r.id,
  launchTick: r.launchTick,
  origin: r.origin,
  castVisible: r.frames[0].audience.includes('blue'),
  impact: null,
});

test('a missed long cast remains saved after particle expiry and restores its remaining sample offset', () => {
  let selected: { w: World; boss: Unit; visual: BaronAttackVisual } | undefined;
  for (let offset = 0; offset < 32 && !selected; offset++) {
    const w = createBaronEncounter(field),
      boss = w.units.find((u) => u.monster?.species === 'baron')!;
    w.nextId += offset;
    w.damage(w.hero, boss, 1, 'true');
    w.step();
    w.step(boss.releaseTick! - w.tick);
    const visual = w.baronAttackVisuals[0];
    if (baronBasicAudioStates([record(visual)], w.tick).some((s) => s.profileIndex === 1))
      selected = { w, boss, visual };
  }
  expect(selected).toBeDefined();
  const { w, boss, visual } = selected!;
  w.damage(boss, w.hero, 1e6, 'true');
  w.step(110);
  expect(visual.stopReason).toBe('target-lost');
  const retained = w.baronAttackVisuals.find((r) => r.id === visual.id);
  expect(retained, 'saved history must outlive the shorter particle tail').toBeDefined();
  const states = baronBasicAudioStates([record(retained!)], w.tick);
  expect(states.some((s) => s.profileIndex === 1 && s.offset > 1.8)).toBe(true);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  const restored = copy.baronAttackVisuals.find((r) => r.id === visual.id)!;
  expect(baronBasicAudioStates([record(restored)], copy.tick)).toEqual(states);
  const untilLast = visual.launchTick + BARON_BASIC_CAST_TICKS - w.tick - 1;
  w.step(untilLast);
  copy.step(untilLast);
  expect(w.baronAttackVisuals.some((r) => r.id === visual.id)).toBe(true);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.step();
  copy.step();
  expect(w.baronAttackVisuals.some((r) => r.id === visual.id)).toBe(false);
  expect(copy.snapshot()).toBe(w.snapshot());
});
