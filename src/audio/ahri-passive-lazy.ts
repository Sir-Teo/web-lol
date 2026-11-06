import type { AhriPassiveAudio } from './ahri-passive';
import type { AhriPassiveAudioRecord } from '../simulation/ahri-passive-audio';
import type { PassiveAudioScene } from './ahri-passive-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriPassiveAudio {
  private controller?: AhriPassiveAudio;
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
        const { AhriPassiveAudio } = await import('./ahri-passive');
        this.controller = new AhriPassiveAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Passive source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriPassiveAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: PassiveAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
