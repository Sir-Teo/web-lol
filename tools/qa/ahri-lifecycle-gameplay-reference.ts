import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'lifecycle-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'lifecycle-reference-field';
import {
  LIFECYCLE_GAMEPLAY_CASES,
  lifecycleGameplaySamples,
} from '../../tests/helpers/ahri-lifecycle-gameplay';
const cases = LIFECYCLE_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: lifecycleGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
