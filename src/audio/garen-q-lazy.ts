import type { GarenDecisiveStrikeAudio } from './garen-q';
import type { GarenQAudioRecord } from './garen-q-state';

/** Keep Q profiles and controller code out of ordinary Ashe/Lux entry loading. */
export class LazyGarenDecisiveStrikeAudio {
  private controller?: GarenDecisiveStrikeAudio;
  private pending?: Promise<void>;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  private fallbackCasts = new Map<string, { id: number; startTick: number }>();
  private fallbackAttacks = new Map<string, { id: number; startTick: number }>();
  get status() {
    return this.controller?.status ?? this.phase;
  }
  load(): Promise<void> {
    if (this.pending) return this.pending;
    this.phase = 'loading';
    this.pending = (async () => {
      try {
        const module = await import('./garen-q');
        this.controller = new module.GarenDecisiveStrikeAudio();
        for (const r of this.fallbackCasts.values())
          this.controller.suppressCast(r.id, r.startTick);
        this.fallbackCasts.clear();
        for (const r of this.fallbackAttacks.values())
          this.controller.suppressAttack(r.id, r.startTick);
        this.fallbackAttacks.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Source Decisive Strike audio unavailable.', error);
      }
    })();
    return this.pending;
  }
  suppressCast(id: number, startTick: number) {
    if (this.controller) this.controller.suppressCast(id, startTick);
    else this.fallbackCasts.set(`${id}:${startTick}`, { id, startTick });
  }
  suppressAttack(id: number, startTick: number) {
    if (this.controller) this.controller.suppressAttack(id, startTick);
    else this.fallbackAttacks.set(`${id}:${startTick}`, { id, startTick });
  }
  stop() {
    this.controller?.stop();
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenQAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.fallbackCasts.keys())
      if (!present.has(key)) this.fallbackCasts.delete(key);
    const attacks = new Set(records.flatMap((r) => r.attacks.map((a) => `${r.id}:${a.startTick}`)));
    for (const key of this.fallbackAttacks.keys())
      if (!attacks.has(key)) this.fallbackAttacks.delete(key);
    this.controller?.update(context, audible, records, tick, listener);
  }
}
