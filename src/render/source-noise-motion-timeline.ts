import { SourceNoiseFieldValues } from './source-noise-field-values';
import {
  sourceNoiseInto,
  type SourceNoiseClock,
  type SourceNoiseImpulse,
} from './source-noise-field';
import { sourceSteppedMotion } from './source-stepped-motion';

/** One bounded emitter-wide field schedule. The fixed system clock and accumulated
 * emitter age are the explicit reference protocol, not native clock certification. */
export class SourceNoiseSchedule {
  private readonly rows: readonly (readonly SourceNoiseImpulse[])[];
  constructor(
    values: SourceNoiseFieldValues,
    emitterLife: number,
    readonly maximumUpdateTick: number
  ) {
    if (
      !Number.isFinite(emitterLife) ||
      emitterLife <= 0 ||
      !Number.isSafeInteger(maximumUpdateTick) ||
      maximumUpdateTick < 1
    )
      throw RangeError('Invalid source noise schedule extent');
    const rows: (readonly SourceNoiseImpulse[])[] = [[]],
      clocks: SourceNoiseClock[] = [];
    let age = 0;
    for (let tick = 1; tick <= maximumUpdateTick; tick++) {
      age += 1 / 60;
      const sampled = values.sample(Math.min(age / emitterLife, 1), tick / 60, clocks);
      rows.push(
        Object.freeze(
          sampled.map((field) =>
            Object.freeze({
              ...field,
              centre: Object.freeze(Array.from(field.centre)),
              axes: Object.freeze(Array.from(field.axes)),
            })
          )
        )
      );
    }
    this.rows = rows;
  }
  at(tick: number): readonly SourceNoiseImpulse[] {
    if (!Number.isSafeInteger(tick) || tick < 1 || tick > this.maximumUpdateTick)
      throw RangeError('Invalid source noise schedule seek');
    return this.rows[tick];
  }
}

/** A finite particle's stepped drag and field motion. Fresh births receive their
 * shared field's impulses without moving; later updates retain the field change
 * in velocity before moving. Stores exact float32 rows and owns all inputs. */
export class SourceNoiseMotionTimeline {
  private readonly rows: Float32Array;
  private readonly drag: Float32Array;
  private completed = 0;
  constructor(
    position: ArrayLike<number>,
    velocity: ArrayLike<number>,
    drag: ArrayLike<number>,
    private maximumSteps: number,
    private birthTick: number,
    private serial: number,
    private schedule: SourceNoiseSchedule
  ) {
    if (
      !Number.isSafeInteger(maximumSteps) ||
      maximumSteps < 1 ||
      !Number.isSafeInteger(birthTick) ||
      birthTick < 1 ||
      birthTick + maximumSteps > schedule.maximumUpdateTick
    )
      throw RangeError('Invalid source noise motion extent');
    this.drag = Float32Array.from(drag);
    const first = this.step(position, velocity, birthTick, true);
    this.rows = new Float32Array((maximumSteps + 1) * 9);
    this.rows.set(first.position, 0);
    this.rows.set(first.velocity, 3);
    this.rows.set(first.moving, 6);
  }
  get computedSteps() {
    return this.completed;
  }
  private step(
    position: ArrayLike<number>,
    velocity: ArrayLike<number>,
    tick: number,
    fresh: boolean
  ) {
    const state = sourceSteppedMotion({
      position,
      velocity,
      birthAcceleration: [0, 0, 0],
      acceleration: [0, 0, 0],
      carriedVelocity: [0, 0, 0],
      birthDrag: this.drag,
      drag: [0, 0, 0],
      dt: 1 / 60,
      fresh,
    });
    const pushed = state.moving.slice();
    for (const field of this.schedule.at(tick))
      sourceNoiseInto(state.moving, position, field, this.serial);
    for (let axis = 0; axis < 3; axis++) {
      state.velocity[axis] += state.moving[axis] - pushed[axis];
      state.position[axis] = position[axis] + state.moving[axis] * (fresh ? 0 : 1 / 60);
    }
    return state;
  }
  sample(steps: number, fraction: number) {
    const until = steps + (fraction > 0 ? 1 : 0);
    if (
      !Number.isSafeInteger(steps) ||
      steps < 0 ||
      !Number.isFinite(fraction) ||
      fraction < 0 ||
      fraction > 1 ||
      until > this.maximumSteps
    )
      throw RangeError('Invalid source noise motion seek');
    while (this.completed < until) {
      const offset = this.completed * 9;
      const state = this.step(
        this.rows.subarray(offset, offset + 3),
        this.rows.subarray(offset + 3, offset + 6),
        this.birthTick + this.completed + 1,
        false
      );
      this.completed++;
      this.rows.set(state.position, this.completed * 9);
      this.rows.set(state.velocity, this.completed * 9 + 3);
      this.rows.set(state.moving, this.completed * 9 + 6);
    }
    const vector = (channel: number) =>
      Float32Array.from({ length: 3 }, (_, axis) => {
        const from = this.rows[steps * 9 + channel + axis];
        return fraction
          ? from + (this.rows[(steps + 1) * 9 + channel + axis] - from) * fraction
          : from;
      });
    return { position: vector(0), velocity: vector(3), moving: vector(6) };
  }
}
