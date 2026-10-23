import type { GarenPerseveranceAudio } from './garen-p';
import type { GarenPAudioRecord } from './garen-p-state';
/** No passive source/profile imports or recording requests until Garen presence. */
export class LazyGarenPerseveranceAudio {
  private controller?: GarenPerseveranceAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.controller) return this.controller.load();
    if (this.pending && this.phase !== 'failed') return this.pending;
    this.phase = 'loading';
    return (this.pending = (async () => {
      try {
        const module = await import('./garen-p');
        this.controller = new module.GarenPerseveranceAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Perseverance audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenPAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    this.controller?.update(context, audible, records, tick, listener);
  }
}
