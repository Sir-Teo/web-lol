import type { AhriAttackAudio } from './ahri-attack';
import type { AhriAttackAudioRecord } from '../simulation/ahri-attack-audio';
import type { AttackAudioScene } from './ahri-attack-state';

/** Import and fetch only on an Ahri roster load. Failed resources
 * retry only when load is explicitly called again. */
export class LazyAhriAttackAudio {
  private controller?: AhriAttackAudio;
  private pending?: Promise<void>;
  private fallback = new Map<string, { id: number; startTick: number }>();
  private owner?: object;
  private lastTick = -Infinity;
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
        const { AhriAttackAudio } = await import('./ahri-attack');
        this.controller = new AhriAttackAudio();
        for (const r of this.fallback.values()) this.controller.suppressSwing(r.id, r.startTick);
        this.fallback.clear();
        await this.controller.load();
      } catch (error) {
        this.phase = 'failed';
        console.warn('Attack source audio unavailable.', error);
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
    records: readonly AhriAttackAudioRecord[],
    tick: number,
    listener: { x: number; y: number },
    owner: object,
    scene: AttackAudioScene
  ) {
    if (Number.isFinite(tick)) {
      if (this.owner !== undefined && (this.owner !== owner || tick < this.lastTick)) {
        this.fallback.clear();
        this.controller?.reset();
      }
      this.owner = owner;
      this.lastTick = tick;
      const present = new Set(records.map((r) => `${r.sourceId}:${r.startTick}`));
      for (const key of this.fallback.keys()) if (!present.has(key)) this.fallback.delete(key);
    }
    this.controller?.update(context, audible, records, tick, listener, owner, scene);
  }
}
