import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri/e-visual-gameplay-reference.json';
import { E_VISUAL_GAMEPLAY_CASES, eVisualGameplaySamples } from './helpers/ahri-e-visual-gameplay';
const hash = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
test('E gameplay baseline keeps its frozen helper and producer identities', () => {
  expect(hash(readFileSync('tests/helpers/ahri-e-visual-gameplay.ts'))).toBe(
    reference.scenarioHelperSha256
  );
  expect(hash(readFileSync('tools/qa/build-ahri-e-visual-gameplay-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(reference.cases.map((c) => c.scenario)).toEqual([...E_VISUAL_GAMEPLAY_CASES]);
});
for (const scenario of E_VISUAL_GAMEPLAY_CASES)
  test('E observer preserves complete archived state and exact restore: ' + scenario, () => {
    const samples = eVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario);
    expect(samples.map(({ tick, state }) => ({ tick, sha256: hash(state) }))).toEqual(
      reference.cases.find((c) => c.scenario === scenario)!.samples
    );
    const field = (tick: number) => ({
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      lineOfSight: () => scenario !== 'hidden-reveal' || tick >= 25,
      inBrush: () => false,
      lineWalkable: () => true,
      reachable: (p: { x: number; y: number }) => ({ ...p }),
      findPath: (_a: unknown, b: { x: number; y: number }) => [{ ...b }],
    });
    for (const sample of samples)
      expect(World.fromSnapshot(sample.snapshot, field(sample.tick)).snapshot()).toBe(
        sample.snapshot
      );
    const pairs = [
      [120, 180],
      [180, 300],
      [300, 420],
      [420, 480],
    ];
    if (
      ['hit', 'miss', 'lethal-hit', 'moving-target', 'overlap', 'replacement', 'tenacity'].includes(
        scenario
      )
    )
      pairs.push([1, 15], [16, 17], [20, 30], [35, 40], [40, 45], [45, 60], [60, 90]);
    const expected = reference.cases.find((c) => c.scenario === scenario)!.samples;
    for (const [start, end] of pairs) {
      const sample = samples.find((s) => s.tick === start);
      if (!sample) continue;
      const copy = World.fromSnapshot(sample.snapshot, field(start));
      copy.step(end - start);
      const state = JSON.parse(copy.snapshot());
      delete state.version;
      delete state.ruleset;
      delete state.ahriEVisuals;
      expect(hash(JSON.stringify(state)), `${scenario} future ${start} → ${end}`).toBe(
        expected.find((s) => s.tick === end)!.sha256
      );
    }
  });
