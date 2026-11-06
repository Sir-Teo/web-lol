import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'spirit-rush-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'spirit-rush-reference-field';
import {
  SPIRIT_RUSH_GAMEPLAY_CASES,
  spiritRushGameplaySamples,
} from '../../tests/helpers/ahri-spirit-rush-gameplay';
const cases = SPIRIT_RUSH_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: spiritRushGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
