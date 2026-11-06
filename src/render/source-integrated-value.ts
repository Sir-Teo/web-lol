import { SourceValue, type SourceValueDefinition } from './source-value';

/** Unit-interval running integrals. Caller supplies lifetime/lifetime-squared
 * scaling separately. Unkeyed constants remain fixed amounts, not rates. */
export class SourceIntegratedValue {
  private readonly definition: SourceValueDefinition;
  private readonly tables = new Map<1 | 2, Float32Array>();
  constructor(definition: SourceValueDefinition) {
    // Apply the ordinary structural guards without treating this as an ordinary
    // runtime sample. This adapter explicitly owns the integration decision.
    new SourceValue({ ...definition, sourceType: undefined });
    this.definition = {
      ...definition,
      constant: [...definition.constant],
      times: [...definition.times],
      values: definition.values.map((v) => [...v]),
      probabilities: definition.probabilities.map((p) => ({
        ...p,
        times: [...p.times],
        values: [...p.values],
      })),
    };
  }
  private integral(axis: number, until: number): number {
    const d = this.definition,
      last = d.times.length - 1;
    let result = d.values[0][axis] * Math.min(until, Math.max(d.times[0], 0));
    for (let i = 0; i < last; i++) {
      const from = Math.max(d.times[i], 0),
        to = Math.min(d.times[i + 1], until);
      if (to <= from || d.times[i + 1] <= d.times[i]) continue;
      const width = d.times[i + 1] - d.times[i];
      const start =
        d.values[i][axis] +
        (d.values[i + 1][axis] - d.values[i][axis]) * ((from - d.times[i]) / width);
      const end =
        d.values[i][axis] +
        (d.values[i + 1][axis] - d.values[i][axis]) * ((to - d.times[i]) / width);
      result += ((start + end) / 2) * (to - from);
    }
    if (until > d.times[last])
      result += d.values[last][axis] * (until - Math.max(d.times[last], 0));
    return result;
  }
  private table(order: 1 | 2): Float32Array {
    const held = this.tables.get(order);
    if (held) return held;
    const width = this.definition.constant.length,
      result = new Float32Array(64 * width);
    for (let axis = 0; axis < width; axis++) {
      let sum = 0;
      for (let entry = order === 1 ? 0 : 1; entry < 64; entry++) {
        if (order === 1) result[entry * width + axis] = this.integral(axis, entry / 63);
        else {
          const cut = 1 / (63 * 8),
            from = (entry - 1) / 63;
          for (let piece = 0; piece < 8; piece++) {
            const at = from + piece * cut;
            sum +=
              (cut / 6) *
              (this.integral(axis, at) +
                4 * this.integral(axis, at + cut / 2) +
                this.integral(axis, at + cut));
          }
          result[entry * width + axis] = sum;
        }
      }
    }
    this.tables.set(order, result);
    return result;
  }
  sample(age01: number, order: 1 | 2): Float32Array {
    if (!Number.isFinite(age01) || (order !== 1 && order !== 2))
      throw RangeError('Invalid source integral phase/order');
    const d = this.definition;
    if (!d.authoredKeyCount) return new Float32Array(d.constant);
    const width = d.constant.length,
      table = this.table(order);
    const placed = Math.min(Math.max(age01, 0), 1) * 63;
    const under = Math.min(Math.floor(placed), 62),
      share = placed - under;
    return Float32Array.from({ length: width }, (_, axis) => {
      const from = table[under * width + axis],
        to = table[(under + 1) * width + axis];
      return from + (to - from) * share;
    });
  }
}
