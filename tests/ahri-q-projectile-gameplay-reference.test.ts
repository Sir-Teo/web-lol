import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import reference from '../docs/reference/ahri/q-projectile-gameplay-reference.json';
import {
  Q_PROJECTILE_GAMEPLAY_CASES,
  qProjectileGameplaySamples,
} from './helpers/ahri-q-projectile-gameplay';
test('Q projectile visual preparation preserves complete independently archived gameplay projections', () => {
  const hash = (raw: string | Buffer) => createHash('sha256').update(raw).digest('hex');
  expect(hash(readFileSync('tests/helpers/ahri-q-projectile-gameplay.ts'))).toBe(
    reference.scenarioHelperSha256
  );
  expect(hash(readFileSync('tools/qa/build-ahri-q-projectile-gameplay-reference.mjs'))).toBe(
    reference.producerSha256
  );
  expect(reference.cases.map((c) => c.scenario)).toEqual([...Q_PROJECTILE_GAMEPLAY_CASES]);
  for (const scenario of Q_PROJECTILE_GAMEPLAY_CASES) {
    const actual = qProjectileGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({ tick, sha256: hash(state) })
    );
    expect(actual, scenario).toEqual(reference.cases.find((c) => c.scenario === scenario)!.samples);
  }
});
