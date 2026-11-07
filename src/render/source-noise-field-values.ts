import { SourceValue, type SourceValueDefinition } from './source-value';
import {
  sourceNoiseClock,
  sourceNoiseImpulses,
  type SourceNoiseClock,
  type SourceNoiseImpulse,
} from './source-noise-field';

function record(value: unknown, type: string, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw RangeError('Invalid source noise definition');
  const object = value as Record<string, unknown>;
  if (object.__type !== type || Object.keys(object).some((key) => !keys.includes(key)))
    throw RangeError('Unsupported source noise definition');
  return object;
}
function scalar(raw: unknown, nonnegative: boolean) {
  const value = record(raw, 'ValueFloat', ['__type', 'constantValue', 'dynamics']);
  const constant = value.constantValue;
  if (
    typeof constant !== 'number' ||
    !Number.isFinite(constant) ||
    !Number.isFinite(Math.fround(constant)) ||
    (nonnegative && constant < 0)
  )
    throw RangeError('Source noise scalar requires an authored finite constant');
  let times = [0],
    values = [[constant]],
    authoredKeyCount = 0;
  if (value.dynamics !== undefined) {
    const dynamics = record(value.dynamics, 'VfxAnimatedFloatVariableData', [
      '__type',
      'times',
      'values',
    ]);
    if (
      !Array.isArray(dynamics.times) ||
      !Array.isArray(dynamics.values) ||
      !dynamics.times.length ||
      dynamics.values.some(
        (v) =>
          typeof v !== 'number' ||
          !Number.isFinite(v) ||
          !Number.isFinite(Math.fround(v)) ||
          (nonnegative && v < 0)
      )
    )
      throw RangeError('Invalid source noise scalar curve');
    times = dynamics.times as number[];
    values = dynamics.values.map((v) => [v as number]);
    authoredKeyCount = times.length;
  }
  const definition: SourceValueDefinition = {
    constant: [constant],
    times,
    values,
    authoredKeyCount,
    probabilities: [],
  };
  return new SourceValue(definition);
}
/** Closed adapter for authored noise collections with an omitted Position. Zero
 * centre is the explicit external-reader default; other field kinds and native
 * defaults are not silently inferred. Owns all prepared values and axis arrays. */
export class SourceNoiseFieldValues {
  private readonly fields: {
    radius: SourceValue;
    frequency: SourceValue;
    delta: SourceValue;
    axes: number[];
  }[];
  constructor(raw: unknown) {
    const collection = record(raw, 'VfxFieldCollectionDefinitionData', [
      '__type',
      'fieldNoiseDefinitions',
    ]);
    if (!Array.isArray(collection.fieldNoiseDefinitions))
      throw RangeError('Invalid source noise field list');
    this.fields = collection.fieldNoiseDefinitions.map((rawField) => {
      const field = record(rawField, 'VfxFieldNoiseDefinitionData', [
        '__type',
        'radius',
        'frequency',
        'velocityDelta',
        'axisFraction',
      ]);
      if (
        !Array.isArray(field.axisFraction) ||
        field.axisFraction.length !== 3 ||
        !field.axisFraction.every(
          (v) => typeof v === 'number' && Number.isFinite(v) && Number.isFinite(Math.fround(v))
        )
      )
        throw RangeError('Source noise field requires authored axis fractions');
      return {
        radius: scalar(field.radius, true),
        frequency: scalar(field.frequency, true),
        delta: scalar(field.velocityDelta, false),
        axes: [...field.axisFraction],
      };
    });
  }
  sample(phase: number, now: number, clocks: SourceNoiseClock[]): SourceNoiseImpulse[] {
    if (!Number.isFinite(phase) || phase < 0 || phase > 1 || !Number.isFinite(now) || now < 0)
      throw RangeError('Invalid source noise field sample');
    const next: SourceNoiseClock[] = [];
    const sampled = this.fields.map((field, slot) => {
      const clock = { ...(clocks[slot] ?? sourceNoiseClock()) },
        first = clock.fired;
      const kicks = sourceNoiseImpulses(clock, field.frequency.sample(phase)[0], now);
      next.push(clock);
      return {
        centre: [0, 0, 0],
        radius: field.radius.sample(phase)[0],
        delta: field.delta.sample(phase)[0],
        axes: [...field.axes],
        kicks,
        first,
        slot,
      };
    });
    for (let slot = 0; slot < next.length; slot++) {
      if (clocks[slot]) Object.assign(clocks[slot], next[slot]);
      else clocks[slot] = next[slot];
    }
    return sampled;
  }
}
