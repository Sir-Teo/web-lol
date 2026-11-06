import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'w-visual-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'w-visual-reference-field';
import {
  W_VISUAL_GAMEPLAY_CASES,
  wVisualGameplaySamples,
} from '../../tests/helpers/ahri-w-visual-gameplay';
const cases = W_VISUAL_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: wVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
