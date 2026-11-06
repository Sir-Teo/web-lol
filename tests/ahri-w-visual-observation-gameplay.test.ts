import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  finishAllWVisualHistory,
  type AhriWVisualHistory,
} from '../src/simulation/ahri-w-visual-history';
import { validateWVisualMotion } from '../src/simulation/ahri-w-visual-history-validation';
import reference from '../docs/reference/ahri/w-visual-gameplay-reference.json';
import { W_VISUAL_GAMEPLAY_CASES, wVisualGameplaySamples } from './helpers/ahri-w-visual-gameplay';

test('recording genuine W lifecycles preserves every independently archived old-state projection', () => {
  let samples = 0;
  class ObservedWorld extends World {
    ahriWVisuals: AhriWVisualHistory[] = [];
    override step() {
      super.step();
      if (this.winner) finishAllWVisualHistory(this);
      for (const r of this.ahriWVisuals) {
        validateWVisualMotion(r, this.tick);
        samples++;
      }
    }
  }
  for (const scenario of W_VISUAL_GAMEPLAY_CASES) {
    const actual = wVisualGameplaySamples(ObservedWorld, PRACTICE_FIXTURE, scenario).map(
      ({ tick, state }) => ({
        tick,
        sha256: createHash('sha256').update(state).digest('hex'),
      })
    );
    expect(actual, scenario).toEqual(reference.cases.find((c) => c.scenario === scenario)!.samples);
  }
  expect(samples).toBeGreaterThan(3000);
});
