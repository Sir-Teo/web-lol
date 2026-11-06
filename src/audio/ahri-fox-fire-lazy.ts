import type { AhriFoxFireAudio } from './ahri-fox-fire';
import type { AhriFoxFireAudioRecord } from '../simulation/ahri-fox-fire-audio';
import type { FoxFireAudioScene } from './ahri-fox-fire-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriFoxFireAudio {
  private controller?: AhriFoxFireAudio;
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
        const { AhriFoxFireAudio } = await import('./ahri-fox-fire');
        this.controller = new AhriFoxFireAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Fox-Fire source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriFoxFireAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: FoxFireAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
