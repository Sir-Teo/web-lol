import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'r-render-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'r-render-reference-field';
import { R_VISUAL_GAMEPLAY_CASES } from '../../tests/helpers/ahri-r-visual-gameplay';
import { rRenderGameplaySamples } from '../../tests/helpers/ahri-r-render-gameplay';
const cases = R_VISUAL_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: rRenderGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
