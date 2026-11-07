/** Scoped external-preview noise policy. Its hash, threshold and impulse cap are
 * explicit stand-ins; native random-stream/default correspondence is unresolved. */
export const SOURCE_NOISE_FIELD_POLICY = {
  maximumImpulsesPerUpdate: 256,
  minimumSquaredNormalization: 1e-12,
  clock: 'one first-update impulse, then whole absolute-frequency crossings',
  direction: 'float32 normalized cube hash by cosmetic particle, field and impulse',
  nativeRandomStreamCertified: false,
} as const;
export interface SourceNoiseClock {
  last: number | null;
  fired: number;
}
export interface SourceNoiseImpulse {
  centre: ArrayLike<number>;
  radius: number;
  delta: number;
  axes: ArrayLike<number>;
  kicks: number;
  first: number;
  slot: number;
}
export const sourceNoiseClock = (): SourceNoiseClock => ({ last: null, fired: 0 });
export function sourceNoiseImpulses(clock: SourceNoiseClock, rate: number, now: number) {
  const period = Math.trunc(rate * now);
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    !Number.isFinite(now) ||
    now < 0 ||
    !Number.isSafeInteger(period) ||
    !Number.isSafeInteger(clock.fired) ||
    clock.fired < 0 ||
    (clock.last === null
      ? clock.fired !== 0
      : !Number.isFinite(clock.last) || clock.last < 0 || clock.last > now)
  )
    throw RangeError('Invalid source noise clock update');
  const owed = clock.last === null ? 1 : Math.max(period - Math.trunc(rate * clock.last), 0);
  const kicks = Math.min(owed, SOURCE_NOISE_FIELD_POLICY.maximumImpulsesPerUpdate);
  if (!Number.isSafeInteger(clock.fired + kicks)) throw RangeError('Source noise clock overflow');
  if (owed > 0) clock.last = now;
  clock.fired += kicks;
  return kicks;
}
function vector(value: ArrayLike<number>) {
  if (
    value.length !== 3 ||
    !Array.from(value).every((n) => Number.isFinite(n) && Number.isFinite(Math.fround(n)))
  )
    throw RangeError('Invalid source noise vector');
}
function mixed(value: number) {
  let held = value | 0;
  held = Math.imul(held ^ (held >>> 16), 0x7feb352d);
  held = Math.imul(held ^ (held >>> 15), 0x846ca68b);
  return (held ^ (held >>> 16)) >>> 0;
}
const direction = new Float32Array(3);
/** Acts after particle drag, before movement; no step multiplier. The owner
 * retains this velocity change, including an impulse on a zero-delta birth. */
export function sourceNoiseInto(
  velocity: Float32Array,
  at: ArrayLike<number>,
  noise: SourceNoiseImpulse,
  serial: number
) {
  for (const value of [velocity, at, noise.centre, noise.axes]) vector(value);
  if (
    !Number.isFinite(noise.radius) ||
    noise.radius < 0 ||
    !Number.isFinite(noise.delta) ||
    !Number.isSafeInteger(noise.kicks) ||
    noise.kicks < 0 ||
    noise.kicks > SOURCE_NOISE_FIELD_POLICY.maximumImpulsesPerUpdate ||
    !Number.isSafeInteger(noise.first) ||
    noise.first < 0 ||
    !Number.isSafeInteger(noise.first + noise.kicks) ||
    !Number.isSafeInteger(noise.slot) ||
    noise.slot < 0 ||
    noise.slot > 0xffffffff ||
    !Number.isSafeInteger(serial) ||
    serial < 0 ||
    serial > 0xffffffff
  )
    throw RangeError('Invalid source noise impulse');
  const dx = noise.centre[0] - at[0],
    dy = noise.centre[1] - at[1],
    dz = noise.centre[2] - at[2];
  if (noise.kicks === 0 || dx * dx + dy * dy + dz * dz > noise.radius * noise.radius) return;
  for (let kick = 0; kick < noise.kicks; kick++) {
    const first = mixed(
      mixed(serial + 1) ^ mixed((Math.imul(noise.slot + 1, 0x9e3779b1) + (noise.first + kick)) | 0)
    );
    const second = mixed(first ^ 0x68e31da4),
      third = mixed(second ^ 0x1b56c4e9);
    direction[0] = (first / 2 ** 32) * 2 - 1;
    direction[1] = (second / 2 ** 32) * 2 - 1;
    direction[2] = (third / 2 ** 32) * 2 - 1;
    const squared =
      direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
    if (squared >= SOURCE_NOISE_FIELD_POLICY.minimumSquaredNormalization) {
      const length = Math.sqrt(squared);
      for (let axis = 0; axis < 3; axis++) direction[axis] /= length;
    }
    for (let axis = 0; axis < 3; axis++)
      velocity[axis] += direction[axis] * noise.delta * noise.axes[axis];
  }
}
