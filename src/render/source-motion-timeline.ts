import { sourceSteppedMotion } from './source-stepped-motion';

/** A bounded 60 Hz source-motion track. Rows retain exact float32 step outputs;
 * arbitrary seeks interpolate adjacent rows and never expose stored buffers. */
export class SourceMotionTimeline {
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly drag: Float32Array;
  private readonly rows: Float32Array | null;
  private completed = 0;
  constructor(
    position: ArrayLike<number>,
    velocity: ArrayLike<number>,
    drag: ArrayLike<number>,
    private maximumSteps: number
  ) {
    for (const vector of [position, velocity, drag])
      if (
        vector.length !== 3 ||
        !Array.from(vector).every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v)))
      )
        throw RangeError('Invalid source motion track vector');
    if (!Number.isSafeInteger(maximumSteps) || maximumSteps < 1)
      throw RangeError('Invalid source motion track extent');
    this.position = Float32Array.from(position);
    this.velocity = Float32Array.from(velocity);
    this.drag = Float32Array.from(drag);
    this.rows = this.velocity.every((v) => v === 0)
      ? null
      : new Float32Array((maximumSteps + 1) * 9);
    if (this.rows) {
      this.rows.set(this.position, 0);
      this.rows.set(this.velocity, 3);
      this.rows.set(this.velocity, 6);
    }
  }
  get computedSteps() {
    return this.completed;
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
      throw RangeError('Invalid source motion track seek');
    const rows = this.rows;
    if (!rows)
      return {
        position: new Float32Array(this.position),
        velocity: new Float32Array(this.velocity),
        moving: new Float32Array(this.velocity),
      };
    while (this.completed < until) {
      const offset = this.completed * 9;
      const state = sourceSteppedMotion({
        position: rows.subarray(offset, offset + 3),
        velocity: rows.subarray(offset + 3, offset + 6),
        birthAcceleration: [0, 0, 0],
        acceleration: [0, 0, 0],
        carriedVelocity: [0, 0, 0],
        birthDrag: this.drag,
        drag: [0, 0, 0],
        dt: 1 / 60,
        fresh: false,
      });
      this.completed++;
      rows.set(state.position, this.completed * 9);
      rows.set(state.velocity, this.completed * 9 + 3);
      rows.set(state.moving, this.completed * 9 + 6);
    }
    const vector = (channel: number) =>
      Float32Array.from({ length: 3 }, (_, axis) => {
        const from = rows[steps * 9 + channel + axis];
        return fraction ? from + (rows[(steps + 1) * 9 + channel + axis] - from) * fraction : from;
      });
    return { position: vector(0), velocity: vector(3), moving: vector(6) };
  }
}
