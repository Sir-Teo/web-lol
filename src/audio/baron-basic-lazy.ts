import type { BaronBasicAttackAudio } from './baron-basic';
import type { BaronBasicAudioRecord } from './baron-basic-state';

/** Import and fetch only on explicit private encounter load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyBaronBasicAttackAudio {
  private controller?: BaronBasicAttackAudio;
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
        const { BaronBasicAttackAudio } = await import('./baron-basic');
        this.controller = new BaronBasicAttackAudio();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Baron candidate audio unavailable.', error);
      }
    })());
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly BaronBasicAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object
  ) {
    this.controller?.update(context, audible, records, tick, listener, owner);
  }
}
