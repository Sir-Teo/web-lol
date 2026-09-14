/** Local reconstruction of the source's global equal-weight selection with recent
 * variants excluded. Event hashing is cosmetic and never consumes sim RNG.
 * Native shuffle/reset/random-stream parity remains unverified. */
export class SourceAudioVariants {
  private recent: number[] = [];
  constructor(
    private count: number,
    private avoid: number
  ) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      !Number.isInteger(avoid) ||
      avoid < 0 ||
      avoid >= count
    )
      throw new Error('Invalid source variant exclusion policy');
  }
  next(eventId: number): number {
    const candidates = Array.from({ length: this.count }, (_, i) => i).filter(
      (i) => !this.recent.includes(i)
    );
    const seed = (Math.imul(eventId, 1664525) + 1013904223) >>> 0;
    const selected = candidates[seed % candidates.length];
    this.recent.push(selected);
    this.recent = this.avoid ? this.recent.slice(-this.avoid) : [];
    return selected;
  }
}
