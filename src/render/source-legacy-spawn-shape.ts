import { SourceValue, type SourceValueDefinition } from './source-value';
export interface SourceLegacyShapeDefinition {
  offset: SourceValueDefinition;
  angles: readonly SourceValueDefinition[];
  axes: readonly (readonly number[])[];
}
/** Current strict Baron's legacy shape has no authored birthTranslation.
 * Its zero translation write is retained, as are empty probability-table draws. */
export class SourceLegacySpawnShape {
  private readonly offset: SourceValue;
  private readonly angles: SourceValue[];
  private readonly axes: number[][];
  constructor(definition: SourceLegacyShapeDefinition) {
    if (
      definition.offset.constant.length !== 3 ||
      definition.angles.length !== definition.axes.length ||
      definition.angles.some((v) => v.constant.length !== 1) ||
      definition.axes.some((axis) => axis.length !== 3 || !axis.every(Number.isFinite))
    )
      throw RangeError('Invalid source legacy shape definition');
    this.offset = new SourceValue(definition.offset);
    this.angles = definition.angles.map((v) => new SourceValue(v));
    this.axes = definition.axes.map((axis) => [...axis]);
  }
  sample(phase: number, draw: () => number, pinned: number | null = null) {
    const offset = this.offset.drawChannels(phase, draw, pinned);
    for (let axis = 0; axis < 3; axis++) offset[axis] += 0;
    let turn = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      turned = false;
    for (let index = 0; index < this.angles.length; index++) {
      const radians = this.angles[index].drawChannels(phase, draw, pinned)[0] * (Math.PI / 180);
      if (radians === 0) continue;
      const axis = this.axes[index],
        length = Math.hypot(...axis);
      let spun = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      if (length !== 0) {
        const [x, y, z] = axis.map((v) => v / length),
          c = Math.cos(radians),
          s = Math.sin(radians),
          t = 1 - c;
        spun = new Float32Array([
          t * x * x + c,
          t * x * y - s * z,
          t * x * z + s * y,
          t * x * y + s * z,
          t * y * y + c,
          t * y * z - s * x,
          t * x * z - s * y,
          t * y * z + s * x,
          t * z * z + c,
        ]);
      }
      const product = new Float32Array(9);
      for (let row = 0; row < 3; row++)
        for (let column = 0; column < 3; column++)
          product[row * 3 + column] =
            spun[row * 3] * turn[column] +
            spun[row * 3 + 1] * turn[3 + column] +
            spun[row * 3 + 2] * turn[6 + column];
      turn = product;
      turned = true;
    }
    const raw = new Float32Array(offset);
    if (turned)
      for (let axis = 0; axis < 3; axis++)
        offset[axis] =
          turn[axis * 3] * raw[0] + turn[axis * 3 + 1] * raw[1] + turn[axis * 3 + 2] * raw[2];
    return { raw, offset, turn, turned };
  }
}
