import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-lifecycle-gameplay-reference.json';
import {
  LIFECYCLE_GAMEPLAY_CASES,
  lifecycleGameplaySamples,
} from './helpers/ahri-lifecycle-gameplay';

// Remove only newly added Recall presentation from this older frozen baseline.
class RecallPresentationProjection extends World {
  override snapshot(): string {
    const state = JSON.parse(super.snapshot());
    delete state.ahriRecallAudio;
    delete state.ahriQCastVisuals;
    delete state.ahriQProjectileVisuals;
    delete state.ahriWVisuals;
    return JSON.stringify(state);
  }
}

test('Lifecycle audio work preserves 228 complete archived gameplay projections', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tests/helpers/ahri-lifecycle-gameplay.ts'))
      .digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-lifecycle-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...LIFECYCLE_GAMEPLAY_CASES]);
  for (const scenario of LIFECYCLE_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = lifecycleGameplaySamples(
      RecallPresentationProjection,
      PRACTICE_FIXTURE,
      scenario
    ).map(({ tick, state }) => ({
      tick,
      sha256: createHash('sha256').update(state).digest('hex'),
    }));
    expect(actual, scenario).toEqual(expected.samples);
  }
});
