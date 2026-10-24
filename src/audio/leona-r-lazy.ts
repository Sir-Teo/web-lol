import type { LeonaSolarAudio } from './leona-r';
import type { LeonaRAudioRecord } from './leona-r-state';
import type { Team } from '../simulation/types';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaSolarAudio {
  private controller?: LeonaSolarAudio;
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
        const m = await import('./leona-r');
        this.controller = new m.LeonaSolarAudio();
        for (const r of this.fallbackCasts.values()) this.controller.suppressCast(r.id, r.start);
        this.fallbackCasts.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Solar audio unavailable.', error);
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
    records: readonly LeonaRAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    visible: (point: { x: number; y: number }) => boolean,
    team: Team
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key)) this.fallbackCasts.delete(key);
    this.controller?.update(context, audible, records, tick, listener, visible, team);
  }
}
