import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-recall-gameplay-reference.json';
import {
  RECALL_GAMEPLAY_CASES,
  recallGameplaySamples,
} from './helpers/ahri-recall-gameplay';

test('Recall audio work preserves 104 complete archived gameplay projections', () => {
  expect(
    createHash('sha256')
      .update(readFileSync('tests/helpers/ahri-recall-gameplay.ts'))
      .digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-recall-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...RECALL_GAMEPLAY_CASES]);
  for (const scenario of RECALL_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = recallGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({
        tick,
        sha256: createHash('sha256').update(state).digest('hex'),
      })
    );
    expect(actual, scenario).toEqual(expected.samples);
  }
});
