import { LEONA_W_AUDIO as P } from '../content/leona-w-audio';
import {
  leonaWAudioStates,
  LEONA_W_AUDIO_KINDS,
  type LeonaWAudioKind,
  type LeonaWAudioRecord,
  type LeonaWAudioState,
} from './leona-w-state';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: LeonaWAudioKind;
  stopAtTick: number | null;
}
/** Source finite Eclipse recordings. Local listener, master mix, equal-priority
 * kill-oldest caps and phase dispatch are not certified native behavior. */
export class LeonaEclipseAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<LeonaWAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallbackCasts = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    return (this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          LEONA_W_AUDIO_KINDS.map(async (kind) => {
            const buffers = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Eclipse audio ${response.status}`);
                return decoder.decodeAudioData(await response.arrayBuffer());
              })
            );
            return [kind, buffers] as const;
          })
        );
        this.buffers = Object.fromEntries(decoded);
        this.status = 'ready';
      } catch (error) {
        this.buffers = {};
        this.status = 'failed';
        console.warn('Source Eclipse audio unavailable.', error);
      }
    })());
  }
  suppressCast(id: number, start: number) {
    this.fallbackCasts.add(`${id}:${start}:cast`);
  }
  private release(key: string, stop = true) {
    const v = this.voices.get(key);
    if (!v) return;
    v.source.onended = null;
    if (stop) v.source.stop();
    v.source.disconnect();
    v.envelope.disconnect();
    v.spatial.disconnect();
    this.voices.delete(key);
  }
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(state: LeonaWAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.kind].gainDb / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private create(context: AudioContext, state: LeonaWAudioState, listener: Point) {
    while (
      [...this.voices.values()].filter((v) => v.kind === state.kind).length >=
      P[state.kind].policy.u16MaxNumInstance
    ) {
      const oldest = [...this.voices].find(([, v]) => v.kind === state.kind)![0];
      this.finished.add(oldest);
      this.release(oldest);
    }
    const v: Voice = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      kind: state.kind,
      stopAtTick: state.stopAtTick,
    };
    v.source.buffer = this.buffers[state.kind]![state.variant];
    v.source.loop = false;
    v.source.connect(v.envelope).connect(v.spatial).connect(context.destination);
    v.spatial.gain.value = this.gain(state, listener);
    const now = context.currentTime;
    v.envelope.gain.setValueAtTime(state.envelope, now);
    if (state.remainingIn) v.envelope.gain.linearRampToValueAtTime(1, now + state.remainingIn);
    this.voices.set(state.key, v);
    v.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    v.source.start(now, state.offset);
    v.source.stop(now + state.remaining);
    return v;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaWAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = leonaWAudioStates(records, tick),
      active = new Set(states.map((s) => s.key)),
      histories = new Set(
        records.flatMap((r) => LEONA_W_AUDIO_KINDS.map((kind) => `${r.id}:${r.startTick}:${kind}`))
      );
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.fallbackCasts) if (!histories.has(key)) this.fallbackCasts.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key) || !audible) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const s of states) {
      if (this.finished.has(s.key) || this.fallbackCasts.has(s.key)) continue;
      const v = this.voices.get(s.key) ?? this.create(context, s, listener);
      if (v.stopAtTick !== s.stopAtTick) {
        v.source.stop(context.currentTime + s.remaining);
        v.stopAtTick = s.stopAtTick;
      }
      v.spatial.gain.setTargetAtTime(this.gain(s, listener), context.currentTime, 0.02);
    }
  }
}
