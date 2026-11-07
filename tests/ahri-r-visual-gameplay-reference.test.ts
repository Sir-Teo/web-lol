import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri/r-visual-gameplay-reference.json';
import { R_VISUAL_GAMEPLAY_CASES, rVisualGameplaySamples } from './helpers/ahri-r-visual-gameplay';
const hash = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('R visual baseline keeps its frozen helper and archive-only producer identities', () => {
  expect(hash(readFileSync('tests/helpers/ahri-r-visual-gameplay.ts'))).toBe(
    reference.scenarioHelperSha256
  );
  expect(hash(readFileSync('tools/qa/build-ahri-r-visual-gameplay-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(reference.cases.map((c) => c.scenario)).toEqual([...R_VISUAL_GAMEPLAY_CASES]);
});
for (const scenario of R_VISUAL_GAMEPLAY_CASES)
  test('R observer preserves complete archived state and exact restore: ' + scenario, () => {
    const samples = rVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario);
    const expected = reference.cases.find((c) => c.scenario === scenario)!.samples;
    expect(samples.map(({ tick, state }) => ({ tick, sha256: hash(state) }))).toEqual(expected);
    const field = (tick: number) => ({
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => scenario !== 'hidden-recast' || tick >= 40,
      inBrush: () => false,
      lineWalkable: () => true,
      reachable: (p: { x: number; y: number }) => ({ ...p }),
      findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
    });
    for (const sample of samples) {
      const copy = World.fromSnapshot(sample.snapshot, field(sample.tick));
      expect(copy.snapshot()).toBe(sample.snapshot);
      if (copy.winner) {
        copy.step(120);
        expect(copy.snapshot()).toBe(sample.snapshot);
      }
    }
    const constantInputs = [
      'hit',
      'miss',
      'many-targets',
      'lethal-hit',
      'overlap',
      'rejected-zero-aim',
      'rejected-rooted',
    ];
    const pairs = constantInputs.includes(scenario)
      ? [
          [0, 1],
          [1, 2],
          [2, 5],
          [5, 6],
          [6, 15],
          [15, 25],
          [25, 60],
          [60, 61],
          [61, 121],
          [121, 300],
          [300, 800],
          [800, 801],
          [801, 850],
          [850, 851],
          [851, 900],
          [900, 901],
          [901, 1401],
          [1401, 1500],
        ]
      : [
          [901, 1401],
          [1401, 1500],
        ];
    for (const [start, end] of pairs) {
      const sample = samples.find((s) => s.tick === start);
      if (!sample) continue;
      const copy = World.fromSnapshot(sample.snapshot, field(start));
      copy.step(end - start);
      const state = JSON.parse(copy.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriRVisuals;
      expect(hash(JSON.stringify(state)), `${scenario} future ${start} → ${end}`).toBe(
        expected.find((s) => s.tick === end)!.sha256
      );
    }
  });
