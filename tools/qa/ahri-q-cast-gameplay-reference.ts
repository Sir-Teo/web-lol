import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { World } from 'q-cast-reference-world';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { PRACTICE_FIXTURE } from 'q-cast-reference-field';
import {
  Q_CAST_GAMEPLAY_CASES,
  qCastGameplaySamples,
} from '../../tests/helpers/ahri-q-cast-gameplay';
const cases = Q_CAST_GAMEPLAY_CASES.map((scenario) => ({
  scenario,
  samples: qCastGameplaySamples(World, PRACTICE_FIXTURE, scenario).map(({ tick, state }) => ({
    tick,
    sha256: createHash('sha256').update(state).digest('hex'),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(cases, null, 2) + '\n', { flag: 'wx' });
