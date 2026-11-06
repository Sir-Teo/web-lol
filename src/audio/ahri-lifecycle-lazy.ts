import type { AhriLifecycleAudio } from './ahri-lifecycle';
import type { AhriLifecycleAudioRecord } from '../simulation/ahri-lifecycle-audio';
import type { LifecycleAudioScene } from './ahri-lifecycle-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriLifecycleAudio {
  private controller?: AhriLifecycleAudio;
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
        const { AhriLifecycleAudio } = await import('./ahri-lifecycle');
        this.controller = new AhriLifecycleAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Lifecycle source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriLifecycleAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: LifecycleAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
