import type { GarenJusticeAudio } from './garen-r';
import type { GarenRAudioRecord } from './garen-r-state';

/** Keep R profiles and controller code out of ordinary Ashe/Lux entry loading. */
export class LazyGarenJusticeAudio {
  private controller?: GarenJusticeAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallbackCasts = new Map<string, { id: number; startTick: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.pending) return this.pending;
    this.phase = 'loading';
    this.pending = (async () => {
      try {
        const module = await import('./garen-r');
        this.controller = new module.GarenJusticeAudio();
        for (const r of this.fallbackCasts.values())
          this.controller.suppressCast(r.id, r.startTick);
        this.fallbackCasts.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Demacian Justice audio unavailable.', error);
      }
    })();
    return this.pending;
  }
  suppressCast(id: number, startTick: number) {
    if (this.controller) this.controller.suppressCast(id, startTick);
    else this.fallbackCasts.set(`${id}:${startTick}`, { id, startTick });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenRAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key)) this.fallbackCasts.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
