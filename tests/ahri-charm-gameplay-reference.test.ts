import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-charm-gameplay-reference.json';
import { CHARM_GAMEPLAY_CASES, charmGameplaySamples } from './helpers/ahri-charm-gameplay';

test('Charm audio work preserves forty-eight complete archived gameplay projections', () => {
  expect(reference.cases.map((c) => c.scenario)).toEqual([...CHARM_GAMEPLAY_CASES]);
  for (const scenario of CHARM_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = charmGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({ tick, sha256: createHash('sha256').update(state).digest('hex') })
    );
    expect(actual, scenario).toEqual(expected.samples);
  }
});
