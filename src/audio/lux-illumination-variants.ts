import { LUX_ILLUMINATION_AUDIO } from '../content/lux-illumination-audio';

/** Local reconstruction of the source's global equal-weight selection with two
 * recent variants excluded. Event hashing is cosmetic and never consumes sim RNG.
 * Native shuffle/reset/random-stream parity remains unverified. */
export class LuxIlluminationVariants {
  private recent: number[] = [];
  next(eventId: number): number {
    const candidates = LUX_ILLUMINATION_AUDIO.variants
      .map((_, i) => i)
      .filter((i) => !this.recent.includes(i));
    const seed = (Math.imul(eventId, 1664525) + 1013904223) >>> 0;
    const selected = candidates[seed % candidates.length];
    this.recent.push(selected);
    this.recent = this.recent.slice(-LUX_ILLUMINATION_AUDIO.policy.wAvoidRepeatCount);
    return selected;
  }
}
