import { SourceValue, type SourceValueDefinition } from './source-value';
import { SourceIntegratedValue } from './source-integrated-value';
export interface SourceUvLayerDefinition {
  scale: SourceValueDefinition;
  rotation: SourceValueDefinition;
  birthOffset: SourceValueDefinition;
  birthScrollRate: SourceValueDefinition;
  birthRotateRate: SourceValueDefinition;
  birthFrameRate: SourceValueDefinition;
  scrollRate: SourceValueDefinition;
  rotateRate: SourceValueDefinition;
  book: {
    divisions: readonly number[];
    frames: number;
    start: number;
    rate: number;
    randomStart: boolean;
  };
  center: readonly number[];
  emitterScrollRate: readonly number[];
  flipU: boolean;
  flipV: boolean;
  scrollClamp: boolean;
  addressMode: 0 | 1 | 2 | 3;
}
export interface SourceUvBirth {
  offset: Float32Array;
  scroll: Float32Array;
  rotation: number;
  phase: number;
  rate: number;
}
export interface SourceUvDraw {
  turn: number;
  scaleU: number;
  scaleV: number;
  offsetU: number;
  offsetV: number;
  cellU: number;
  cellV: number;
}
/** Prepared external UV policy for complex emitters without UV flex channels.
 * The caller supplies the shared particle chance/roll; no RNG is consumed here. */
export class SourceUvLayer {
  private readonly d: SourceUvLayerDefinition;
  private readonly values: Record<
    'scale' | 'rotation' | 'birthOffset' | 'birthScrollRate' | 'birthRotateRate' | 'birthFrameRate',
    SourceValue
  >;
  private readonly scroll: SourceIntegratedValue;
  private readonly rotate: SourceIntegratedValue;
  constructor(definition: SourceUvLayerDefinition) {
    const pairs = [definition.book.divisions, definition.center, definition.emitterScrollRate];
    if (
      pairs.some((v) => v.length !== 2 || !v.every(Number.isFinite)) ||
      ![definition.book.frames, definition.book.start, definition.book.rate].every(
        Number.isFinite
      ) ||
      ![
        definition.book.randomStart,
        definition.flipU,
        definition.flipV,
        definition.scrollClamp,
      ].every((v) => typeof v === 'boolean') ||
      ![0, 1, 2, 3].includes(definition.addressMode)
    )
      throw RangeError('Invalid source UV layer policy');
    this.d = {
      ...definition,
      book: { ...definition.book, divisions: [...definition.book.divisions] },
      center: [...definition.center],
      emitterScrollRate: [...definition.emitterScrollRate],
    };
    const widths = {
      scale: 2,
      rotation: 1,
      birthOffset: 2,
      birthScrollRate: 2,
      birthRotateRate: 1,
      birthFrameRate: 1,
    };
    this.values = {} as typeof this.values;
    for (const key of Object.keys(widths) as (keyof typeof widths)[]) {
      if (definition[key].constant.length !== widths[key])
        throw RangeError('Invalid source UV value width');
      this.values[key] = new SourceValue(definition[key]);
    }
    if (definition.scrollRate.constant.length !== 2 || definition.rotateRate.constant.length !== 1)
      throw RangeError('Invalid integrated source UV width');
    this.scroll = new SourceIntegratedValue(definition.scrollRate);
    this.rotate = new SourceIntegratedValue(definition.rotateRate);
  }
  birth(phase: number, chance: number, roll = chance): SourceUvBirth {
    if (!Number.isFinite(roll) || roll < 0 || roll > 1) throw RangeError('Invalid source UV roll');
    const held = this.values;
    return {
      offset: new Float32Array(held.birthOffset.drawShared(phase, chance)),
      scroll: new Float32Array(held.birthScrollRate.drawShared(phase, chance)),
      rotation: Math.fround(held.birthRotateRate.drawShared(phase, chance)[0]),
      phase: Math.fround(this.d.book.randomStart ? roll * Math.max(this.d.book.frames, 0) : 0),
      rate: Math.fround(this.d.book.rate * held.birthFrameRate.drawShared(phase, chance)[0]),
    };
  }
  sample(
    birth: SourceUvBirth,
    age: number,
    life: number,
    now: number,
    emitterScroll = true
  ): SourceUvDraw {
    if (
      !Number.isFinite(age) ||
      age < 0 ||
      !(Number.isFinite(life) || life === Infinity) ||
      life < 0 ||
      !Number.isFinite(now) ||
      now < 0 ||
      typeof emitterScroll !== 'boolean' ||
      birth.offset.length !== 2 ||
      birth.scroll.length !== 2 ||
      ![...birth.offset, ...birth.scroll, birth.rotation, birth.phase, birth.rate].every(
        Number.isFinite
      )
    )
      throw RangeError('Invalid source UV particle clock/state');
    const phase = life > 0 ? Math.min(Math.max(age / life, 0), 1) : 1,
      lived = Number.isFinite(life) ? life : 0;
    const scale = new Float32Array(this.values.scale.sample(phase)),
      rotation = Math.fround(this.values.rotation.sample(phase)[0]);
    const turn =
      (rotation + age * birth.rotation + this.rotate.sample(phase, 1)[0] * lived) * (Math.PI / 180);
    const scroll = this.scroll.sample(phase, 1),
      offset = [];
    const wrap = (v: number, span: number) => ((v % span) + span) % span;
    for (let axis = 0; axis < 2; axis++) {
      const ramp = birth.offset[axis] + age * birth.scroll[axis] + 0;
      const bounded = this.d.scrollClamp ? Math.min(Math.max(ramp, -1), 1) : ramp % 1;
      const flip = axis === 0 ? this.d.flipU : this.d.flipV;
      const pan = emitterScroll ? this.d.emitterScrollRate[axis] * now * (flip ? -1 : 1) : 0;
      const value = bounded + scroll[axis] * lived + pan;
      offset.push(
        this.d.addressMode === 0
          ? wrap(value, 1)
          : this.d.addressMode === 1
            ? wrap(value, 2)
            : value
      );
    }
    const [columns, rows] = this.d.book.divisions.map((v) => Math.max(Math.round(v), 1));
    const frames = Math.max(Math.round(this.d.book.frames), 1);
    const played = wrap(birth.phase + (birth.rate > 0 ? age * birth.rate : 0), frames);
    const cell = wrap(Math.trunc(this.d.book.start + played), columns * rows);
    return {
      turn,
      scaleU: scale[0],
      scaleV: scale[1],
      offsetU: offset[0],
      offsetV: offset[1],
      cellU: (cell % columns) / columns,
      cellV: Math.floor(cell / columns) / rows,
    };
  }
  rows(draw: SourceUvDraw): Float32Array {
    if (!Object.values(draw).every(Number.isFinite)) throw RangeError('Invalid source UV draw');
    const [width, height] = this.d.book.divisions.map((v) => 1 / Math.max(Math.round(v), 1));
    const [centerU, centerV] = this.d.center,
      c = Math.cos(draw.turn),
      s = Math.sin(draw.turn);
    const uu = draw.scaleU * c,
      uv = -draw.scaleV * s,
      vu = draw.scaleU * s,
      vv = draw.scaleV * c;
    const bu = centerU + draw.offsetU - uu * centerU - uv * centerV,
      bv = centerV + draw.offsetV - vu * centerU - vv * centerV;
    const u = this.d.flipU ? -1 : 1,
      v = this.d.flipV ? -1 : 1;
    return new Float32Array([
      uu * u * width,
      uv * u * width,
      draw.cellU + (this.d.flipU ? 1 - bu : bu) * width,
      0,
      vu * v * height,
      vv * v * height,
      draw.cellV + (this.d.flipV ? 1 - bv : bv) * height,
      0,
    ]);
  }
}
