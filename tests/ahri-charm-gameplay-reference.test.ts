import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-charm-gameplay-reference.json';
import { CHARM_GAMEPLAY_CASES, charmGameplaySamples } from './helpers/ahri-charm-gameplay';

// Normalize only the new lifecycle presentation field on the current side.
// Frozen gameplay helper, producer and expected hashes remain unchanged.
class LifecyclePresentationProjection extends World {
  override snapshot(): string {
    const state = JSON.parse(super.snapshot());
    delete state.ahriLifecycleAudio;
    delete state.ahriRecallAudio;
    return JSON.stringify(state);
  }
}

test('Charm audio work preserves forty-eight complete archived gameplay projections', () => {
  expect(reference.cases.map((c) => c.scenario)).toEqual([...CHARM_GAMEPLAY_CASES]);
  for (const scenario of CHARM_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = charmGameplaySamples(
      LifecyclePresentationProjection,
      PRACTICE_FIXTURE,
      scenario
    ).map(({ tick, state }) => ({
      tick,
      sha256: createHash('sha256').update(state).digest('hex'),
    }));
    expect(actual, scenario).toEqual(expected.samples);
  }
});
