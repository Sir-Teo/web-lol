/** Bound presentation to 60 Hz while the simulation retains its own fixed clock. */
export class FramePacer {
  private next = -Infinity;
  reset(): void {
    this.next = -Infinity;
  }
  ready(timestamp: number): boolean {
    // RAF timestamps can straddle the target by a fraction of a millisecond.
    if (timestamp + 0.5 < this.next) return false;
    const interval = 1000 / 60;
    this.next = timestamp - this.next >= interval ? timestamp + interval : this.next + interval;
    return true;
  }
}
