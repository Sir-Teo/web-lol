import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'fox-fire-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'fox-fire-reference-field';
import {
  FOX_FIRE_GAMEPLAY_CASES,
  foxFireGameplaySamples,
} from '../../tests/helpers/ahri-fox-fire-gameplay';
const cases = FOX_FIRE_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: foxFireGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
