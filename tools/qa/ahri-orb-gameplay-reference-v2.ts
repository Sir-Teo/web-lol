import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'orb-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'orb-reference-field';
import { ORB_GAMEPLAY_CASES, orbGameplaySamples } from '../../tests/helpers/ahri-orb-gameplay-v2';
const cases = ORB_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: orbGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
