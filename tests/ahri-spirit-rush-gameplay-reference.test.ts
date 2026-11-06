import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-spirit-rush-gameplay-reference.json';
import {
  SPIRIT_RUSH_GAMEPLAY_CASES,
  spiritRushGameplaySamples,
} from './helpers/ahri-spirit-rush-gameplay';

// Keep the frozen producer/helper and expected hashes unchanged. Only the new
// passive and lifecycle presentation fields are removed from current snapshots; all gameplay
// and the already-existing Q/W/E histories remain covered by this R baseline.
class PassivePresentationProjection extends World {
  override snapshot(): string {
    const state = JSON.parse(super.snapshot());
    delete state.ahriPassiveAudio;
    delete state.ahriLifecycleAudio;
    delete state.ahriRecallAudio;
    delete state.ahriQCastVisuals;
    delete state.ahriQProjectileVisuals;
    return JSON.stringify(state);
  }
}

test('Spirit Rush audio work preserves 210 complete archived gameplay projections', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tests/helpers/ahri-spirit-rush-gameplay.ts'))
      .digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-spirit-rush-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...SPIRIT_RUSH_GAMEPLAY_CASES]);
  for (const scenario of SPIRIT_RUSH_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = spiritRushGameplaySamples(
      PassivePresentationProjection,
      PRACTICE_FIXTURE,
      scenario
    ).map(({ tick, state }) => ({
      tick,
      sha256: createHash('sha256').update(state).digest('hex'),
    }));
    expect(actual, scenario).toEqual(expected.samples);
  }
});
