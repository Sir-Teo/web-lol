import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { R_VISUAL_GAMEPLAY_CASES } from './helpers/ahri-r-visual-gameplay';
import {
  rRenderGameplaySamples,
  rRenderGameplayProjection,
} from './helpers/ahri-r-render-gameplay';
import reference from '../docs/reference/ahri/r-render-gameplay-reference.json';
const sha = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('R renderer baseline pins its archive-only producer, entry and helpers', () => {
  for (const [filename, expected] of [
    ['tools/qa/build-ahri-r-render-gameplay-reference.mjs', reference.producerSha256],
    ['tools/qa/ahri-r-render-gameplay-reference.ts', reference.entrySha256],
    ['tests/helpers/ahri-r-visual-gameplay.ts', reference.scenarioHelperSha256],
    ['tests/helpers/ahri-r-render-gameplay.ts', reference.projectionHelperSha256],
  ])
    expect(sha(readFileSync(filename))).toBe(expected);
  expect(reference.sourceRevision).toBe('eac4f9fa375789091a8425e869d9da02f5f779e4');
  expect(reference.sourceFiles).toBe(680);
  expect(reference.excludedFields).toEqual(['version', 'ruleset']);
  expect(reference.cases.map((row) => row.scenario)).toEqual([...R_VISUAL_GAMEPLAY_CASES]);
});
test('R renderer projection retains R, earlier observations and arbitrary gameplay keys', () => {
  const state = {
    version: 181,
    ruleset: 'source-id',
    tick: 7,
    ahriRVisuals: [{ id: 3 }],
    ahriEVisuals: [{ castTick: 2 }],
    ahriWVisuals: [{ id: 1 }],
    ahriSpiritRushAudio: [{ id: 4 }],
    units: [{ id: 9, hp: 1 }],
  };
  expect(JSON.parse(rRenderGameplayProjection(JSON.stringify(state)))).toEqual({
    tick: 7,
    ahriRVisuals: [{ id: 3 }],
    ahriEVisuals: [{ castTick: 2 }],
    ahriWVisuals: [{ id: 1 }],
    ahriSpiritRushAudio: [{ id: 4 }],
    units: [{ id: 9, hp: 1 }],
  });
});
for (const scenario of R_VISUAL_GAMEPLAY_CASES)
  test('R renderer preserves complete archived observation state: ' + scenario, () => {
    const samples = rRenderGameplaySamples(World, PRACTICE_FIXTURE, scenario);
    const expected = reference.cases.find((row) => row.scenario === scenario)!.samples;
    expect(samples.map(({ tick, state }) => ({ tick, sha256: sha(state) }))).toEqual(expected);
  });
