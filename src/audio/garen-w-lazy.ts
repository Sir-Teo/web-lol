import type { GarenCourageAudio } from './garen-w';
import type { GarenWAudioRecord } from './garen-w-state';

/** Keep W profiles and controller code out of ordinary Ashe/Lux entry loading. */
export class LazyGarenCourageAudio {
  private controller?: GarenCourageAudio;
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
        const module = await import('./garen-w');
        this.controller = new module.GarenCourageAudio();
        for (const r of this.fallbackCasts.values())
          this.controller.suppressCast(r.id, r.startTick);
        this.fallbackCasts.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Courage audio unavailable.', error);
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
    records: readonly GarenWAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key)) this.fallbackCasts.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
