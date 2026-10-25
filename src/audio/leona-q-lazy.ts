import type { LeonaDaybreakAudio } from './leona-q';
import type { LeonaQAudioRecord } from './leona-q-state';
import type { Team } from '../simulation/types';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaDaybreakAudio {
  private controller?: LeonaDaybreakAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallbackCasts = new Map<string, { id: number; start: number; attempt?: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      this.phase = 'loading';
      try {
        const m = await import('./leona-q');
        this.controller = new m.LeonaDaybreakAudio();
        for (const r of this.fallbackCasts.values()) {
          if (r.attempt === undefined) this.controller.suppressCast(r.id, r.start);
          else this.controller.suppressAttack(r.id, r.start, r.attempt);
        }
        this.fallbackCasts.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Daybreak audio unavailable.', error);
      }
    })());
  }
  suppressCast(id: number, start: number) {
    if (this.controller) this.controller.suppressCast(id, start);
    else this.fallbackCasts.set(`${id}:${start}:cast`, { id, start });
  }
  suppressAttack(id: number, start: number, attempt: number) {
    if (this.controller) this.controller.suppressAttack(id, start, attempt);
    else this.fallbackCasts.set(`${id}:${start}:attack:${attempt}`, { id, start, attempt });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaQAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    visible: (point: { x: number; y: number }) => boolean,
    team: Team
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key.split(':').slice(0, 2).join(':'))) this.fallbackCasts.delete(key);
    this.controller?.update(context, audible, records, tick, listener, visible, team);
  }
}
