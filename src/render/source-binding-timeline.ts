import { SourceValue, type SourceValueDefinition } from './source-value';

/** Accumulated root binding on the chosen 60 Hz grid. A changing bind weight
 * scales each step's movement, rather than the total displacement since birth.
 * Caller supplies immutable saved root positions in a consistent world frame. */
export class SourceBindingTimeline {
  private readonly binding: SourceValue;
  private readonly life: number;
  private readonly rows: Float32Array | null;
  private completed = 0;
  private stop = Infinity;
  private linger = 0;
  constructor(
    definition: SourceValueDefinition,
    naturalLife: number,
    private birthTime: number,
    private updateTime: number,
    private root: (time: number) => ArrayLike<number>,
    private maximumSteps: number
  ) {
    if (
      definition.constant.length !== 1 ||
      !Number.isFinite(naturalLife) ||
      naturalLife <= 0 ||
      !Number.isFinite(Math.fround(naturalLife)) ||
      Math.fround(naturalLife) <= 0 ||
      typeof root !== 'function' ||
      !Number.isFinite(birthTime) ||
      birthTime < 0 ||
      !Number.isFinite(updateTime) ||
      updateTime < birthTime - 1e-6 ||
      !Number.isSafeInteger(maximumSteps) ||
      maximumSteps < 1
    )
      throw new RangeError('Invalid source binding timeline');
    this.life = Math.fround(naturalLife);
    this.binding = new SourceValue(definition);
    this.rows = (
      definition.authoredKeyCount === 0
        ? definition.constant[0] === 0
        : definition.values.every((v) => v[0] === 0)
    )
      ? null
      : new Float32Array((maximumSteps + 1) * 6);
  }
  get computedSteps() {
    return this.completed;
  }
  sample(steps: number, fraction: number, stopSeconds = Infinity, particleLinger = 0) {
    const until = steps + (fraction > 0 ? 1 : 0);
    if (
      !Number.isSafeInteger(steps) ||
      steps < 0 ||
      !Number.isFinite(fraction) ||
      fraction < 0 ||
      fraction > 1 ||
      until > this.maximumSteps ||
      !(Number.isFinite(stopSeconds) || stopSeconds === Infinity) ||
      stopSeconds < 0 ||
      !Number.isFinite(particleLinger)
    )
      throw new RangeError('Invalid source binding seek');
    const rows = this.rows;
    if (!rows) return { bound: new Float32Array(3), velocity: new Float32Array(3) };
    if (this.stop !== stopSeconds || this.linger !== particleLinger) {
      this.completed = 0;
      rows.fill(0);
      this.stop = stopSeconds;
      this.linger = particleLinger;
    }
    const point = (time: number) => {
      const p = this.root(time);
      if (p.length !== 3 || !Array.from(p).every(Number.isFinite))
        throw new RangeError('Invalid saved binding root');
      return Array.from(p);
    };
    while (this.completed < until) {
      const step = this.completed + 1,
        now = this.updateTime + step / 60;
      const current = point(now),
        previous = point(this.updateTime + this.completed / 60);
      const life = Math.fround(
        now >= stopSeconds ? Math.min(this.life, Math.max(particleLinger, 0)) : this.life
      );
      const phase = life > 0 ? Math.min(1, Math.max(0, (now - this.birthTime) / life)) : 1;
      const weight = Math.fround(this.binding.sample(phase)[0]);
      for (let axis = 0; axis < 3; axis++) {
        const movement = weight > 0 ? weight * (current[axis] - previous[axis]) : 0;
        rows[step * 6 + axis] = rows[this.completed * 6 + axis] + movement;
        rows[step * 6 + 3 + axis] = movement / (1 / 60);
      }
      this.completed = step;
    }
    const vector = (channel: number) =>
      Float32Array.from({ length: 3 }, (_, axis) => {
        const from = rows[steps * 6 + channel + axis];
        return fraction ? from + (rows[(steps + 1) * 6 + channel + axis] - from) * fraction : from;
      });
    return { bound: vector(0), velocity: vector(3) };
  }
}
