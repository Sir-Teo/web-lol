import type { LeonaSunlightAudio } from './leona-sunlight';
import type { SunlightVisual } from '../simulation/sunlight-visuals';
import type { Team } from '../simulation/types';

/** Load the source profile/controller/masters only when Leona is present. */
export class LazyLeonaSunlightAudio {
  private controller?: LeonaSunlightAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    return (this.pending ??= (async () => {
      this.phase = 'loading';
      try {
        const m = await import('./leona-sunlight');
        this.controller = new m.LeonaSunlightAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Sunlight audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly SunlightVisual[],
    tick: number,
    listener: { x: number; y: number },
    visible: (point: { x: number; y: number }) => boolean,
    team: Team
  ) {
    this.controller?.update(context, audible, records, tick, listener, visible, team);
  }
}
