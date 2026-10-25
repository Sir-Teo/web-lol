import type { LeonaBasicAttackAudio } from './leona-aa';
import type { LeonaAAAudioRecord } from './leona-aa-state';
import type { Team } from '../simulation/types';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaBasicAttackAudio {
  private controller?: LeonaBasicAttackAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallbackSwings = new Map<string, { id: number; start: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      this.phase = 'loading';
      try {
        const m = await import('./leona-aa');
        this.controller = new m.LeonaBasicAttackAudio();
        for (const r of this.fallbackSwings.values()) this.controller.suppressSwing(r.id, r.start);
        this.fallbackSwings.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Leona basic attack audio unavailable.', error);
      }
    })());
  }
  suppressSwing(id: number, start: number) {
    if (this.controller) this.controller.suppressSwing(id, start);
    else this.fallbackSwings.set(`${id}:${start}`, { id, start });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaAAAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    visible: (point: { x: number; y: number }) => boolean,
    team: Team
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackSwings.keys())
      if (!present.has(key)) this.fallbackSwings.delete(key);
    this.controller?.update(context, audible, records, tick, listener, visible, team);
  }
}
