import { MASTER_YI_Q_AUDIO as P, MASTER_YI_Q_ATTENUATION as A } from '../content/masteryi-q-audio';
import { masterYiQStates, type MasterYiQRecord, type MasterYiQState } from './masteryi-q-state';
import { floatSourceBuffer, verifySourceWave } from './float-source-wav';
import { wwise145Attenuation } from './wwise145-attenuation';
type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  containerId: number;
}

/** Declared finite Q cues. Queue-time admission, fixed captured spatial points
 * and master/bus mixing are explicit local policies. */
export class MasterYiAlphaAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private pending?: Promise<void>;
  private buffers = new Map<number, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallback = new Set<string>();
  load(): Promise<void> {
    if (this.pending && this.status !== 'failed') return this.pending;
    this.status = 'loading';
    return (this.pending = (async () => {
      try {
        const clips = new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const)));
        const outcomes = await Promise.allSettled(
          [...clips.values()].map(async (clip) => {
            if (this.buffers.has(clip.id)) return;
            const response = await fetch(import.meta.env.BASE_URL + clip.url);
            if (!response.ok) throw Error(`Alpha Strike audio ${response.status}`);
            const raw = await response.arrayBuffer();
            await verifySourceWave(raw, clip.sha256);
            this.buffers.set(clip.id, floatSourceBuffer(raw, clip));
          })
        );
        const failed = outcomes.find((r) => r.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Source Alpha Strike audio unavailable.', error);
      }
    })());
  }
  suppressCast(id: number, startTick: number): void {
    this.fallback.add(`${id}:${startTick}`);
  }
  private release(key: string, stop = true): void {
    const voice = this.voices.get(key);
    if (!voice) return;
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
    this.voices.delete(key);
  }
  stop(): void {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(state: MasterYiQState, listener: Point): number {
    const p = P[state.profileIndex],
      v = p.variants[state.variant];
    return (
      0.2 *
      10 ** ((p.gainDb + v.gainDb) / 20) *
      wwise145Attenuation(A.points, Math.hypot(state.x - listener.x, state.y - listener.y))
        .amplitude
    );
  }
  private create(
    context: AudioContext,
    state: MasterYiQState,
    listener: Point,
    now: number
  ): Voice | undefined {
    const p = P[state.profileIndex],
      same = [...this.voices].filter(([, v]) => v.containerId === p.containerId),
      cap = p.policy.u16MaxNumInstance;
    if (cap > 0 && same.length >= cap) {
      if (p.policy.bKillNewest) {
        this.finished.add(state.key);
        return;
      }
      for (const [key] of same.slice(0, same.length - cap + 1)) {
        this.finished.add(key);
        this.release(key);
      }
    }
    const voice = {
      source: context.createBufferSource(),
      gain: context.createGain(),
      containerId: p.containerId,
    };
    voice.source.buffer = this.buffers.get(p.variants[state.variant].id)!;
    voice.source.loop = false;
    voice.source.playbackRate.value = state.playbackRate;
    voice.gain.gain.value = this.gain(state, listener);
    voice.source.connect(voice.gain).connect(context.destination);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    voice.source.start(now, state.offset);
    return voice;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly MasterYiQRecord[],
    tick: number,
    listener: Point
  ): void {
    const states = masterYiQStates(records, tick),
      active = new Set(states.map((s) => s.key));
    const roots = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.finished)
      if (!roots.has(key.split(':').slice(0, 2).join(':'))) this.finished.delete(key);
    for (const key of this.fallback) if (!roots.has(key)) this.fallback.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') {
      this.stop();
      return;
    }
    const now = context.currentTime;
    for (const state of states) {
      if (
        this.finished.has(state.key) ||
        (P[state.profileIndex].kind === 'cast' && this.fallback.has(state.root))
      )
        continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener, now);
      voice?.gain.gain.setTargetAtTime(this.gain(state, listener), now, 0.02);
    }
  }
}
