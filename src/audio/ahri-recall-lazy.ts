import type { AhriRecallAudio } from './ahri-recall';
import type { AhriRecallAudioRecord } from '../simulation/ahri-recall-audio';
import type { RecallAudioScene } from './ahri-recall-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriRecallAudio {
  private controller?: AhriRecallAudio;
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
        const { AhriRecallAudio } = await import('./ahri-recall');
        this.controller = new AhriRecallAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Recall source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriRecallAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: RecallAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
