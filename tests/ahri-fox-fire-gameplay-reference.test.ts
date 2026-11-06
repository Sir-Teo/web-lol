import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-fox-fire-gameplay-reference.json';
import { FOX_FIRE_GAMEPLAY_CASES, foxFireGameplaySamples } from './helpers/ahri-fox-fire-gameplay';

// Frozen reference and helper remain unchanged. Normalize only the newly added
// passive presentation field from the current World for this older baseline.
class PassivePresentationProjection extends World {
  override snapshot(): string {
    const state = JSON.parse(super.snapshot());
    delete state.ahriPassiveAudio;
    return JSON.stringify(state);
  }
}

test('Fox-Fire audio work preserves 132 complete archived gameplay projections', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tests/helpers/ahri-fox-fire-gameplay.ts'))
      .digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-fox-fire-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...FOX_FIRE_GAMEPLAY_CASES]);
  for (const scenario of FOX_FIRE_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = foxFireGameplaySamples(
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
