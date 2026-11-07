import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'r-visual-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'r-visual-reference-field';
import {
  R_VISUAL_GAMEPLAY_CASES,
  rVisualGameplaySamples,
} from '../../tests/helpers/ahri-r-visual-gameplay';
const cases = R_VISUAL_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: rVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
