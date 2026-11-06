import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri/w-visual-gameplay-reference.json';
import {
  W_VISUAL_GAMEPLAY_CASES,
  wVisualGameplaySamples,
} from './helpers/ahri-w-visual-gameplay';
test('W visual preparation preserves complete independently archived gameplay projections', () => {
  const hash = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
  expect(hash(readFileSync('tests/helpers/ahri-w-visual-gameplay.ts'))).toBe(
    reference.scenarioHelperSha256
  );
  expect(hash(readFileSync('tools/qa/build-ahri-w-visual-gameplay-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(reference.cases.map((c) => c.scenario)).toEqual([...W_VISUAL_GAMEPLAY_CASES]);
  for (const scenario of W_VISUAL_GAMEPLAY_CASES) {
    const actual = wVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({ tick, sha256: hash(state) })
    );
    expect(actual, scenario).toEqual(reference.cases.find((c) => c.scenario === scenario)!.samples);
  }
});
