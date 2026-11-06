import type { AhriCharmAudio } from './ahri-charm';
import type { AhriCharmAudioRecord } from '../simulation/ahri-charm-audio';
import type { CharmAudioState } from './ahri-charm-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriCharmAudio {
  private controller?: AhriCharmAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  get status() {
    return this.controller?.status ?? this.phase;
  }
  get activeVoices() {
    return this.controller?.activeVoices ?? 0;
  }
  load(): Promise<void> {
    if (this.controller) return this.controller.load();
    if (this.pending && this.phase !== 'failed') return this.pending;
    this.phase = 'loading';
    return (this.pending = (async () => {
      try {
        const { AhriCharmAudio } = await import('./ahri-charm');
        this.controller = new AhriCharmAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Charm source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriCharmAudioRecord[],
    states: readonly CharmAudioState[],
    tick: number,
    listener: { x: number; y: number },
    owner: object
  ) {
    this.controller?.update(context, audible, records, states, tick, listener, owner);
  }
}
