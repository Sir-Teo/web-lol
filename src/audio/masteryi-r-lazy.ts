import type { MasterYiHighlanderAudio } from './masteryi-r';
import type { MasterYiRAudioRecord } from './masteryi-r-state';
/** Load source masters only for present Yi units; explicit retry keeps successes. */
export class LazyMasterYiHighlanderAudio {
  private controller?: MasterYiHighlanderAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallback = new Map<string, { id: number; startTick: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.controller) return this.controller.load();
    if (this.pending && this.phase !== 'failed') return this.pending;
    this.phase = 'loading';
    return (this.pending = (async () => {
      try {
        const module = await import('./masteryi-r');
        this.controller = new module.MasterYiHighlanderAudio();
        for (const r of this.fallback.values()) this.controller.suppressCast(r.id, r.startTick);
        this.fallback.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Highlander audio unavailable.', error);
      }
    })());
  }
  suppressCast(id: number, startTick: number): void {
    if (this.controller) this.controller.suppressCast(id, startTick);
    else this.fallback.set(`${id}:${startTick}`, { id, startTick });
  }
  stop(): void {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly MasterYiRAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ): void {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallback.keys()) if (!present.has(key)) this.fallback.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
