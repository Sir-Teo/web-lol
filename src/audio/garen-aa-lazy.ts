import type { GarenBasicAttackAudio } from './garen-aa';
import type { GarenAAAudioRecord } from './garen-aa-state';
/** Basic attack masters/profiles load only with Garen presence. Explicit retry
 * reuses successful buffers; frame updates do not retry failed resources. */
export class LazyGarenBasicAttackAudio {
  private controller?: GarenBasicAttackAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallback = new Map<string, { id: number; startTick: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.controller) return this.controller.load();
    if (this.pending && this.phase !== 'failed') return this.pending;
    this.phase = 'loading';
    return (this.pending = (async () => {
      try {
        const m = await import('./garen-aa');
        this.controller = new m.GarenBasicAttackAudio();
        for (const r of this.fallback.values()) this.controller.suppressSwing(r.id, r.startTick);
        this.fallback.clear();
        await this.controller.load();
      } catch (e) {
        this.phase = 'failed';
        console.warn('Source Garen basic attack audio unavailable.', e);
      }
    })());
  }
  suppressSwing(id: number, startTick: number) {
    if (this.controller) this.controller.suppressSwing(id, startTick);
    else this.fallback.set(`${id}:${startTick}`, { id, startTick });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenAAAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallback.keys()) if (!present.has(key)) this.fallback.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
