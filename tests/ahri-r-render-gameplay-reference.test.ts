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
/** Compare the unchanged archived twelve-second source-pose window. Only the
 * newly retained older source poses are omitted; every other saved field and
 * every pose inside the old window remains in the frozen hash comparison. */
function archivedSourceWindow(state: string) {
  const parsed = JSON.parse(state);
  for (const record of parsed.ahriRVisuals ?? []) {
    const last = record.sourceFrames.at(-1)?.tick;
    if (last !== undefined)
      record.sourceFrames = record.sourceFrames.filter(
        (pose: { tick: number }) => pose.tick >= last - 720
      );
  }
  return JSON.stringify(parsed);
}
test('the compatibility projection removes only added older source poses and retains all other observations', () => {
  const state = {
    ahriRVisuals: [
      {
        sourceFrames: [
          { tick: 1, point: 'older' },
          { tick: 80, point: 'boundary' },
          { tick: 800, point: 'latest' },
        ],
        targetFrames: [{ tick: 1, point: 'target' }],
        arbitraryRField: 7,
      },
    ],
    arbitraryGameplayField: { tick: 1 },
  };
  expect(JSON.parse(archivedSourceWindow(JSON.stringify(state)))).toEqual({
    ...state,
    ahriRVisuals: [
      { ...state.ahriRVisuals[0], sourceFrames: state.ahriRVisuals[0].sourceFrames.slice(1) },
    ],
  });
});
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
  test(
    'R renderer preserves archived state with its original source-pose window: ' + scenario,
    () => {
      const samples = rRenderGameplaySamples(World, PRACTICE_FIXTURE, scenario);
      const expected = reference.cases.find((row) => row.scenario === scenario)!.samples;
      expect(
        samples.map(({ tick, state }) => ({ tick, sha256: sha(archivedSourceWindow(state)) }))
      ).toEqual(expected);
    }
  );
