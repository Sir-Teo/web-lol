import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri-attack-gameplay-reference.json';
import { ATTACK_GAMEPLAY_CASES, attackGameplaySamples } from './helpers/ahri-attack-gameplay';

test('Attack audio work preserves 120 complete archived gameplay projections', () => {
  expect(
    createHash('sha256').update(readFileSync('tests/helpers/ahri-attack-gameplay.ts')).digest('hex')
  ).toBe(reference.scenarioHelperSha256);
  expect(
    createHash('sha256')
      .update(readFileSync('tools/qa/build-ahri-attack-gameplay-reference.mjs'))
      .digest('hex')
  ).toBe(reference.producerSha256);
  expect(reference.cases.map((c) => c.scenario)).toEqual([...ATTACK_GAMEPLAY_CASES]);
  for (const scenario of ATTACK_GAMEPLAY_CASES) {
    const expected = reference.cases.find((c) => c.scenario === scenario)!;
    const actual = attackGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({
        tick,
        sha256: createHash('sha256').update(state).digest('hex'),
      })
    );
    expect(actual, scenario).toEqual(expected.samples);
  }
});
