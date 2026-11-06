import { SourceValue, type SourceValueDefinition } from './source-value';

export interface SourceBirthValueDefinition {
  lifetime: SourceValueDefinition;
  velocity: SourceValueDefinition;
  rotation: SourceValueDefinition;
  angularVelocity: SourceValueDefinition;
  scale: SourceValueDefinition;
  drag: SourceValueDefinition;
  color: SourceValueDefinition;
}
/** Untransformed complex birth values for the current Baron field closure.
 * The caller draws/owns the particle's shared chance separately. Shape/surface
 * placement, flex, UV state and live integrated motion are separate stages.
 * Absent acceleration/orbital fields consume no draws in this closure. */
export class SourceBirthValues {
  private readonly values: Record<keyof SourceBirthValueDefinition, SourceValue>;
  private readonly lifetimeDrawn: boolean;
  constructor(definition: SourceBirthValueDefinition) {
    const widths = {
      lifetime: 1,
      velocity: 3,
      rotation: 3,
      angularVelocity: 3,
      scale: 3,
      drag: 3,
      color: 4,
    };
    this.values = {} as typeof this.values;
    for (const key of Object.keys(widths) as (keyof SourceBirthValueDefinition)[]) {
      if (definition[key].constant.length !== widths[key])
        throw RangeError('Invalid source birth width');
      this.values[key] = new SourceValue(definition[key]);
    }
    this.lifetimeDrawn = definition.lifetime.probabilities.length > 0;
  }
  sample(phase: number, draw: () => number, pinned: number | null = null) {
    if (
      !Number.isFinite(phase) ||
      (pinned !== null && (!Number.isFinite(pinned) || pinned < 0 || pinned > 1))
    )
      throw RangeError('Invalid source birth phase/pin');
    const next = () => {
      const value = draw();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw RangeError('Invalid source birth draw');
      return value;
    };
    const chance = this.lifetimeDrawn ? next() : 0;
    const life = this.values.lifetime.drawShared(phase, pinned ?? chance)[0];
    const channels = (key: keyof SourceBirthValueDefinition) =>
      this.values[key].drawChannels(phase, next, pinned);
    // Preserve the emitter's birth-vector order, including zero-draw fields.
    return {
      lifetime: Math.fround(life < 0 ? Infinity : life),
      velocity: channels('velocity'),
      rotation: channels('rotation'),
      angularVelocity: channels('angularVelocity'),
      scale: channels('scale'),
      drag: channels('drag'),
      color: channels('color'),
    };
  }
}
