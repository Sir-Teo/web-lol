import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'passive-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'passive-reference-field';
import {
  PASSIVE_GAMEPLAY_CASES,
  passiveGameplaySamples,
} from '../../tests/helpers/ahri-passive-gameplay';
const cases = PASSIVE_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: passiveGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
