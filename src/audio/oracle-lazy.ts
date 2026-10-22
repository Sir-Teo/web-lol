import type { OracleAudio } from './oracle';
import type { OracleAudioRecord } from './oracle-state';
/** Keep the profile, controller and recordings out of ordinary startup loading. */
export class LazyOracleAudio {
  private controller?: OracleAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.pending) return this.pending;
    this.phase = 'loading';
    this.pending = (async () => {
      try {
        const module = await import('./oracle');
        this.controller = new module.OracleAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Oracle audio unavailable.', error);
      }
    })();
    return this.pending;
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly OracleAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    this.controller?.update(context, audible, records, tick, listener);
  }
}
