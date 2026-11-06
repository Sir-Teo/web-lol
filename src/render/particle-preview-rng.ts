/** Deterministic viewer stream: Murmur finalizer + xorshift32, 24-bit unit
 * draws. This matches the pinned external preview, not native xorshift64.
 * Never borrow the gameplay RNG for presentation replay. */
export class ParticlePreviewRng {
  private state: number;
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed < -0x80000000 || seed > 0xffffffff)
      throw RangeError('Invalid particle preview seed');
    let mixed = seed | 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x85ebca6b);
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 0xc2b2ae35);
    mixed ^= mixed >>> 16;
    this.state = mixed === 0 ? 0x9e3779b9 : mixed | 0;
  }
  unitFloat(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value | 0;
    return (value >>> 8) / 0x1000000;
  }
  range(low: number, high: number): number {
    if (!Number.isFinite(low) || !Number.isFinite(high))
      throw RangeError('Invalid particle preview range');
    return low + (high - low) * this.unitFloat();
  }
  snapshot(): number {
    return this.state | 0;
  }
  static fromState(state: number): ParticlePreviewRng {
    if (!Number.isInteger(state) || state < -0x80000000 || state > 0x7fffffff || state === 0)
      throw RangeError('Invalid particle preview RNG state');
    const rng = new ParticlePreviewRng(0);
    rng.state = state;
    return rng;
  }
  clone(): ParticlePreviewRng {
    return ParticlePreviewRng.fromState(this.snapshot());
  }
}
