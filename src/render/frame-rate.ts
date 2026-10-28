/** Count presented frames against wall time, independently of simulation catch-up limits. */
export class FrameRate {
  value: number | null = null;
  private started: number | undefined;
  private frames = 0;

  reset(): void {
    this.started = undefined;
    this.frames = 0;
  }

  record(now: number): void {
    if (this.started === undefined) {
      this.started = now;
      return;
    }
    this.frames++;
    const elapsed = now - this.started;
    if (elapsed < 500) return;
    this.value = (this.frames * 1000) / elapsed;
    this.started = now;
    this.frames = 0;
  }
}
