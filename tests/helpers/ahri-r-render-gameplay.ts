import type { World } from '../../src/simulation/world';
import type { Battlefield } from '../../src/simulation/battlefield';
import { rVisualGameplaySamples, type RVisualGameplayCase } from './ahri-r-visual-gameplay';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  return value;
}
/** Renderer comparisons retain every saved observation, including R history. */
export function rRenderGameplayProjection(snapshot: string): string {
  const state = JSON.parse(snapshot);
  delete state.version;
  delete state.ruleset;
  return JSON.stringify(canonical(state));
}
export function rRenderGameplaySamples(
  WorldType: typeof World,
  field: Battlefield,
  scenario: RVisualGameplayCase
) {
  return rVisualGameplaySamples(WorldType, field, scenario).map((sample) => ({
    ...sample,
    state: rRenderGameplayProjection(sample.snapshot),
  }));
}
