import { LEONA_E_AUDIO as P } from '../content/leona-e-audio';
import {
  leonaEAudioStates,
  LEONA_E_AUDIO_KINDS,
  type LeonaEAudioKind,
  type LeonaEAudioRecord,
  type LeonaEAudioState,
} from './leona-e-state';
import { wwise145Attenuation } from './wwise145-attenuation';
import type { Team } from '../simulation/types';
type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: LeonaEAudioKind;
  stopAtTick: number | null;
  fadeStartTick: number | null;
}
/** Finite source SFX only. Local phase/listener/master mix, cap-zero handling and
 * equal-priority admission order do not certify native dispatch or bus behavior. */
export class LeonaZenithAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<LeonaEAudioKind, AudioBuffer[]>> = {};
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
          LEONA_E_AUDIO_KINDS.map(
            async (kind) =>
              [
                kind,
                await Promise.all(
                  P[kind].variants.map(async ({ url }) => {
                    const response = await fetch(import.meta.env.BASE_URL + url);
                    if (!response.ok) throw Error(`Zenith audio ${response.status}`);
                    return decoder.decodeAudioData(await response.arrayBuffer());
                  })
                ),
              ] as const
          )
        );
        this.buffers = Object.fromEntries(decoded);
        this.status = 'ready';
      } catch (error) {
        this.buffers = {};
        this.status = 'failed';
        console.warn('Source Zenith audio unavailable.', error);
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
  private gain(s: LeonaEAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[s.kind].gainDb / 20) *
      wwise145Attenuation(P.attenuation.points, Math.hypot(s.x - listener.x, s.y - listener.y))
        .amplitude
    );
  }
  private schedule(v: Voice, s: LeonaEAudioState, now: number) {
    const gain = v.envelope.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(s.envelope, now);
    if (s.remainingIn) gain.linearRampToValueAtTime(1, now + s.remainingIn);
    if (s.fadeStartTick !== null && s.fadeOutSeconds > 0) {
      if (s.fadeOutAt > 0) gain.setValueAtTime(1, now + s.fadeOutAt);
      gain.linearRampToValueAtTime(0, now + s.fadeOutRemaining);
    }
    v.source.stop(now + s.remaining);
    v.stopAtTick = s.stopAtTick;
    v.fadeStartTick = s.fadeStartTick;
  }
  private create(context: AudioContext, s: LeonaEAudioState, listener: Point) {
    const policy = P[s.kind].policy,
      same = [...this.voices].filter(([, v]) => v.kind === s.kind),
      cap = policy.u16MaxNumInstance;
    // Authored zero is bound locally to unlimited; it must never enter a cap loop.
    if (cap > 0 && same.length >= cap) {
      if (policy.bKillNewest) {
        this.finished.add(s.key);
        return;
      }
      for (const [key] of same.slice(0, same.length - cap + 1)) {
        this.finished.add(key);
        this.release(key);
      }
    }
    const v: Voice = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      kind: s.kind,
      stopAtTick: s.stopAtTick,
      fadeStartTick: s.fadeStartTick,
    };
    v.source.buffer = this.buffers[s.kind]![s.variant];
    v.source.loop = false;
    v.source.playbackRate.value = s.playbackRate;
    v.source.connect(v.envelope).connect(v.spatial).connect(context.destination);
    v.spatial.gain.value = this.gain(s, listener);
    this.voices.set(s.key, v);
    v.source.onended = () => {
      this.finished.add(s.key);
      this.release(s.key, false);
    };
    v.source.start(context.currentTime, s.offset);
    this.schedule(v, s, context.currentTime);
    return v;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LeonaEAudioRecord[],
    tick: number,
    listener: Point,
    visible: (point: Point) => boolean = () => true,
    team: Team = 'blue'
  ) {
    const states = leonaEAudioStates(records, tick, team).filter(visible),
      active = new Set(states.map((s) => s.key)),
      histories = new Set(records.map((r) => `${r.id}:${r.startTick}`));
    for (const set of [this.finished, this.fallbackCasts])
      for (const key of set)
        if (!histories.has(key.split(':').slice(0, 2).join(':'))) set.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key) || !audible) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const s of states) {
      if (this.finished.has(s.key) || this.fallbackCasts.has(s.key)) continue;
      const v = this.voices.get(s.key) ?? this.create(context, s, listener);
      if (!v) continue;
      if (v.stopAtTick !== s.stopAtTick || v.fadeStartTick !== s.fadeStartTick)
        this.schedule(v, s, context.currentTime);
      v.spatial.gain.setTargetAtTime(this.gain(s, listener), context.currentTime, 0.02);
    }
  }
}
