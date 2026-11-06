import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri/q-cast-gameplay-reference.json';
import { Q_CAST_GAMEPLAY_CASES, qCastGameplaySamples } from './helpers/ahri-q-cast-gameplay';
test('Q cast visual preparation preserves complete independently archived gameplay projections', () => {
  const hash = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
  expect(hash(readFileSync('tests/helpers/ahri-q-cast-gameplay.ts'))).toBe(
    reference.scenarioHelperSha256
  );
  expect(hash(readFileSync('tools/qa/build-ahri-q-cast-gameplay-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(reference.cases.map((c) => c.scenario)).toEqual([...Q_CAST_GAMEPLAY_CASES]);
  for (const scenario of Q_CAST_GAMEPLAY_CASES) {
    const actual = qCastGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => {
        const previous = JSON.parse(state);
        delete previous.ahriQProjectileVisuals;
        return { tick, sha256: hash(JSON.stringify(previous)) };
      }
    );
    expect(actual, scenario).toEqual(reference.cases.find((c) => c.scenario === scenario)!.samples);
  }
});
