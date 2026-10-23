import { GAREN_AA_AUDIO as P, GAREN_AA_ATTENUATION as A } from '../content/garen-aa-audio';
import {
  garenAAAudioStates,
  type GarenAAAudioRecord,
  type GarenAAAudioState,
} from './garen-aa-state';
import { wwise145Attenuation } from './wwise145-attenuation';
type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  containerId: number;
}
/** All material branches and critical layers retain separate source limits,
 * gains and pitch. Assets are cached by media identity across repeated branches. */
export class GarenBasicAttackAudio {
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
        const decoder = new OfflineAudioContext(1, 1, 44100),
          clips = new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const)));
        const results = await Promise.allSettled(
          [...clips.values()].map(async (clip) => {
            if (this.buffers.has(clip.id)) return;
            const response = await fetch(import.meta.env.BASE_URL + clip.url);
            if (!response.ok) throw Error(`Garen basic attack audio ${response.status}`);
            const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
            this.buffers.set(clip.id, buffer);
          })
        );
        const failure = results.find((r) => r.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Source Garen basic attack audio unavailable.', error);
      }
    })());
  }
  suppressSwing(id: number, startTick: number) {
    this.fallback.add(`${id}:${startTick}`);
  }
  private release(key: string, stop = true) {
    const v = this.voices.get(key);
    if (!v) return;
    v.source.onended = null;
    if (stop) v.source.stop();
    v.source.disconnect();
    v.gain.disconnect();
    this.voices.delete(key);
  }
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(state: GarenAAAudioState, listener: Point) {
    const p = P[state.profileIndex],
      clip = p.variants[state.variant];
    return (
      0.2 *
      10 ** ((p.gainDb + clip.gainDb) / 20) *
      wwise145Attenuation(A.points, Math.hypot(state.x - listener.x, state.y - listener.y))
        .amplitude
    );
  }
  private create(context: AudioContext, state: GarenAAAudioState, listener: Point, now: number) {
    const p = P[state.profileIndex];
    while (
      [...this.voices.values()].filter((v) => v.containerId === p.containerId).length >=
      p.policy.u16MaxNumInstance
    ) {
      const key = [...this.voices].find(([, v]) => v.containerId === p.containerId)![0];
      this.finished.add(key);
      this.release(key);
    }
    const v: Voice = {
      source: context.createBufferSource(),
      gain: context.createGain(),
      containerId: p.containerId,
    };
    v.source.buffer = this.buffers.get(p.variants[state.variant].id)!;
    v.source.loop = false;
    v.source.playbackRate.value = 2 ** (p.pitchCents / 1200);
    v.gain.gain.value = this.gain(state, listener);
    v.source.connect(v.gain).connect(context.destination);
    this.voices.set(state.key, v);
    v.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    v.source.start(now, state.offset);
    return v;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenAAAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = garenAAAudioStates(records, tick),
      active = new Set(states.map((s) => s.key)),
      roots = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const key of this.finished)
      if (!roots.has(key.slice(0, key.lastIndexOf(':')))) this.finished.delete(key);
    for (const key of this.fallback) if (!roots.has(key)) this.fallback.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    const now = context.currentTime;
    for (const state of states) {
      if (
        this.finished.has(state.key) ||
        this.fallback.has(state.key.slice(0, state.key.lastIndexOf(':')))
      )
        continue;
      const v = this.voices.get(state.key) ?? this.create(context, state, listener, now);
      v.gain.gain.setTargetAtTime(this.gain(state, listener), now, 0.02);
    }
  }
}
