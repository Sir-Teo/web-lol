import type { MasterYiAlphaAudio } from './masteryi-q';
import type { MasterYiQRecord } from './masteryi-q-state';
export class LazyMasterYiAlphaAudio {
  private controller?: MasterYiAlphaAudio;
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
        const module = await import('./masteryi-q');
        this.controller = new module.MasterYiAlphaAudio();
        for (const r of this.fallback.values()) this.controller.suppressCast(r.id, r.startTick);
        this.fallback.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Alpha Strike audio unavailable.', error);
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
    records: readonly MasterYiQRecord[],
    tick: number,
    listener: { x: number; y: number }
  ): void {
    const roots = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallback.keys()) if (!roots.has(key)) this.fallback.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
