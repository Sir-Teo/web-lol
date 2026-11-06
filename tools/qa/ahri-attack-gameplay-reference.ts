import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'attack-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'attack-reference-field';
import {
  ATTACK_GAMEPLAY_CASES,
  attackGameplaySamples,
} from '../../tests/helpers/ahri-attack-gameplay';
const cases = ATTACK_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: attackGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
