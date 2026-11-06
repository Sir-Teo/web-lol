import { describe, expect, it } from 'vitest';
import { baronBasicAudioStates, type BaronBasicAudioRecord } from '../src/audio/baron-basic-state';
import { BARON_BASIC_AUDIO as P } from '../src/content/baron-basic-audio';

const record = (id = 1): BaronBasicAudioRecord => ({
  id,
  launchTick: 100,
  origin: { x: 1000, y: 2000 },
  castVisible: true,
  impact: { startTick: 130, point: { x: 1200, y: 2100 }, visible: true },
});

describe('local Baron candidate audio state', () => {
  it('applies the authored cast delay relative to the explicit release policy', () => {
    expect(baronBasicAudioStates([record()], 111.99).some((s) => s.profileIndex === 0)).toBe(false);
    const state = baronBasicAudioStates([record()], 112).find((s) => s.profileIndex === 0)!;
    expect(state.age).toBe(0);
    expect(state.offset).toBe(0);
    expect([state.x, state.y]).toEqual([1000, 2000]);
  });
  it('dispatches hit at contact and keeps its randomized authored pitch range', () => {
    expect(baronBasicAudioStates([record()], 129.99).some((s) => s.profileIndex === 2)).toBe(false);
    const states = Array.from({ length: 100 }, (_, i) =>
      baronBasicAudioStates([record(i + 1)], 145).find((s) => s.profileIndex === 2)!
    );
    expect(new Set(states.map((s) => s.pitchCents)).size).toBe(100);
    for (const s of states) {
      expect(s.pitchCents).toBeGreaterThanOrEqual(-500);
      expect(s.pitchCents).toBeLessThan(500);
      expect(s.offset).toBeCloseTo(0.25 * s.rate, 14);
      expect([s.x, s.y]).toEqual([1200, 2100]);
    }
  });
  it('gates each cue by its saved audience independently', () => {
    const r = record();
    r.castVisible = false;
    expect(baronBasicAudioStates([r], 145).every((s) => s.profileIndex === 2)).toBe(true);
    r.impact!.visible = false;
    expect(baronBasicAudioStates([r], 145)).toEqual([]);
    r.castVisible = true;
    expect(baronBasicAudioStates([r], 145).some((s) => s.profileIndex === 0)).toBe(true);
  });
  it('uses the authored 35 percent action probability rather than always layering', () => {
    let selected = 0;
    const variants = new Set<number>();
    for (let id = 1; id <= 1000; id++) {
      const state = baronBasicAudioStates([record(id)], 100).find((s) => s.profileIndex === 1);
      if (state) {
        selected++;
        variants.add(state.variant);
      }
    }
    expect(selected).toBeGreaterThan(280);
    expect(selected).toBeLessThan(420);
    expect(variants.size).toBe(4);
  });
  it('reconstructs identical choices/offsets after JSON restore and record reordering', () => {
    const records = [record(1), record(2), record(3)];
    const before = structuredClone(records);
    const state = baronBasicAudioStates(records, 145.25);
    expect(baronBasicAudioStates(JSON.parse(JSON.stringify(records)), 145.25)).toEqual(state);
    expect(
      baronBasicAudioStates([...records].reverse(), 145.25).sort((a, b) =>
        a.key.localeCompare(b.key)
      )
    ).toEqual([...state].sort((a, b) => a.key.localeCompare(b.key)));
    expect(records).toEqual(before);
  });
  it('expires by pitched sample duration and rejects future/nonfinite time', () => {
    expect(baronBasicAudioStates([record()], 99)).toEqual([]);
    for (const tick of [NaN, Infinity, -Infinity, 1000])
      expect(baronBasicAudioStates([record()], tick)).toEqual([]);
    const s = baronBasicAudioStates([record()], 145).find((s) => s.profileIndex === 2)!;
    const end = 130 + (P[2].variants[s.variant].durationSeconds / s.rate) * 60;
    expect(baronBasicAudioStates([record()], end - 0.001).some((s) => s.profileIndex === 2)).toBe(
      true
    );
    expect(baronBasicAudioStates([record()], end + 0.001).some((s) => s.profileIndex === 2)).toBe(
      false
    );
  });
});
