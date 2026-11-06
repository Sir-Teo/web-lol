export interface SourceValueDefinition {
  sourceType?: string | null;
  constant: readonly number[];
  times: readonly number[];
  values: readonly (readonly number[])[];
  authoredKeyCount: number;
  probabilities: readonly {
    times: readonly number[];
    values: readonly number[];
    single: number;
  }[];
}
/** Prepared format-2 value. Owns its input so later source edits cannot change a
 * historical replay. Ordinary samples stay double; per-channel birth writes
 * round once before and once after probability multiplication, like the reader. */
export class SourceValue {
  private readonly definition: SourceValueDefinition;
  constructor(definition: SourceValueDefinition) {
    if (definition.sourceType?.startsWith('Integrated'))
      throw RangeError('Integrated source values require their integral adapter');
    const { constant, times, values, authoredKeyCount, probabilities } = definition;
    const finite = (v: number) => Number.isFinite(v);
    const ordered = (v: readonly number[]) => v.every((x, i) => finite(x) && (!i || x >= v[i - 1]));
    if (
      !constant.length ||
      !constant.every(finite) ||
      !ordered(times) ||
      times.length !== values.length ||
      !times.length ||
      ![0, times.length].includes(authoredKeyCount) ||
      !values.every((v) => v.length === constant.length && v.every(finite)) ||
      probabilities.length > constant.length ||
      !probabilities.every(
        (p) =>
          p.times.length === p.values.length &&
          ordered(p.times) &&
          p.values.every(finite) &&
          finite(p.single)
      )
    )
      throw RangeError('Invalid source value definition');
    this.definition = {
      constant: [...constant],
      times: [...times],
      values: values.map((v) => [...v]),
      authoredKeyCount,
      probabilities: probabilities.map((p) => ({
        times: [...p.times],
        values: [...p.values],
        single: p.single,
      })),
    };
  }
  private lower(times: readonly number[], at: number) {
    let index = -1;
    for (let i = 0; i < times.length && times[i] <= at; i++) index = i;
    return index;
  }
  sample(phase: number): number[] {
    if (!Number.isFinite(phase)) throw RangeError('Invalid source value phase');
    const d = this.definition;
    if (!d.authoredKeyCount) return [...d.constant];
    const under = this.lower(d.times, phase),
      lo = Math.max(under, 0),
      hi = under + 1;
    const span = hi < d.times.length ? d.times[hi] - d.times[lo] : 0;
    return d.values[lo].map((from, axis) =>
      span <= 0 ? from : from + (d.values[hi][axis] - from) * ((phase - d.times[lo]) / span)
    );
  }
  private probability(axis: number, chance: number) {
    const p = this.definition.probabilities[axis];
    if (!p.times.length) return p.single;
    const under = this.lower(p.times, chance),
      lo = Math.max(under, 0),
      hi = under + 1;
    const from = p.values[lo];
    if (under < 0 || hi >= p.times.length) return from;
    const span = p.times[hi] - p.times[lo];
    return span > 0 ? from + (p.values[hi] - from) * ((chance - p.times[lo]) / span) : from;
  }
  drawShared(phase: number, chance: number): number[] {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1)
      throw RangeError('Invalid shared source chance');
    const result = this.sample(phase);
    for (let axis = 0; axis < this.definition.probabilities.length; axis++)
      result[axis] *= this.probability(axis, chance);
    return result;
  }
  drawChannels(phase: number, draw: () => number, pinned: number | null = null): Float32Array {
    if (pinned !== null && (!Number.isFinite(pinned) || pinned < 0 || pinned > 1))
      throw RangeError('Invalid pinned source chance');
    const result = new Float32Array(this.sample(phase));
    for (let axis = 0; axis < this.definition.probabilities.length; axis++) {
      const chance = draw();
      if (!Number.isFinite(chance) || chance < 0 || chance >= 1)
        throw RangeError('Invalid source draw');
      result[axis] *= this.probability(axis, pinned ?? chance);
    }
    return result;
  }
}
