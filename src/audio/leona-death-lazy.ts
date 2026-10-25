import type { LeonaDeathAudio } from './leona-death';
import type { LeonaDeathAudioRecord } from './leona-death-state';
import type { Team } from '../simulation/types';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaDeathAudio {
  private controller?: LeonaDeathAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      this.phase = 'loading';
      try {
        const m = await import('./leona-death');
        this.controller = new m.LeonaDeathAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Leona death audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaDeathAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    team: Team
  ) {
    // A death has a fixed known point. Losing live sight must not erase an
    // accepted birth, especially when the player was the only vision source.
    this.controller?.update(context, audible, records, tick, listener, () => true, team);
  }
}
