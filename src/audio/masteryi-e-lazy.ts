import type { MasterYiWujuStyleAudio } from './masteryi-e';
import type { MasterYiEAudioRecord } from './masteryi-e-state';
/** Load source masters only for present Yi units; explicit retry keeps successes. */
export class LazyMasterYiWujuStyleAudio {
  private controller?: MasterYiWujuStyleAudio;
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
        const module = await import('./masteryi-e');
        this.controller = new module.MasterYiWujuStyleAudio();
        for (const r of this.fallback.values()) this.controller.suppressCast(r.id, r.startTick);
        this.fallback.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Wuju Style audio unavailable.', error);
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
    records: readonly MasterYiEAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ): void {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallback.keys()) if (!present.has(key)) this.fallback.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
