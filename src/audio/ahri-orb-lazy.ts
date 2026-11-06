import type { AhriOrbAudio } from './ahri-orb';
import type { AhriOrbAudioRecord } from '../simulation/ahri-orb-audio';
import type { OrbAudioScene } from './ahri-orb-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriOrbAudio {
  private controller?: AhriOrbAudio;
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
        const { AhriOrbAudio } = await import('./ahri-orb');
        this.controller = new AhriOrbAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Orb source audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriOrbAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: OrbAudioScene
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
