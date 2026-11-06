import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-passive-gameplay-reference.json';
import { PASSIVE_GAMEPLAY_CASES, passiveGameplaySamples } from './helpers/ahri-passive-gameplay';

test('Passive audio work preserves 120 complete archived gameplay projections', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tests/helpers/ahri-passive-gameplay.ts'))
      .digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-passive-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...PASSIVE_GAMEPLAY_CASES]);
  for (const scenario of PASSIVE_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = passiveGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({
        tick,
        sha256: createHash('sha256').update(state).digest('hex'),
      })
    );
    expect(actual, scenario).toEqual(expected.samples);
  }
});
