import type { AhriSpiritRushAudio } from './ahri-spirit-rush';
import type { AhriSpiritRushAudioRecord } from '../simulation/ahri-spirit-rush-audio';
import type { SpiritRushAudioScene } from './ahri-spirit-rush-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriSpiritRushAudio {
  private controller?: AhriSpiritRushAudio;
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
        const { AhriSpiritRushAudio } = await import('./ahri-spirit-rush');
        this.controller = new AhriSpiritRushAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Spirit Rush source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriSpiritRushAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: SpiritRushAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
