import type { LeonaEclipseAudio } from './leona-w';
import type { LeonaWAudioRecord } from './leona-w-state';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaEclipseAudio {
  private controller?: LeonaEclipseAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallbackCasts = new Map<string, { id: number; start: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      this.phase = 'loading';
      try {
        const m = await import('./leona-w');
        this.controller = new m.LeonaEclipseAudio();
        for (const r of this.fallbackCasts.values()) this.controller.suppressCast(r.id, r.start);
        this.fallbackCasts.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Eclipse audio unavailable.', error);
      }
    })());
  }
  suppressCast(id: number, start: number) {
    if (this.controller) this.controller.suppressCast(id, start);
    else this.fallbackCasts.set(`${id}:${start}`, { id, start });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaWAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key)) this.fallbackCasts.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
