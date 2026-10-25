import { wwise145Attenuation } from './wwise145-attenuation';
import type { Team } from '../simulation/types';
export interface SourceAudioState<K extends string> {
  key: string;
  kind: K;
  variant: number;
  startTick: number;
  age: number;
  offset: number;
  playbackRate: number;
  remaining: number;
  envelope: number;
  remainingIn: number;
  /** Optional end level when a stop interrupts the initial fade-in. */
  fadeInTarget?: number;
  fadeStartTick: number | null;
  stopAtTick: number | null;
  fadeIn: number;
  fadeOutSeconds: number;
  fadeOutAt: number;
  fadeOutRemaining: number;
  x: number;
  y: number;
}
export interface SourceAudioRole {
  loop?: boolean;
  gainDb: number;
  policy: { u16MaxNumInstance: number; bKillNewest: number };
  variants: readonly { url: string }[];
}
export type SourceAudioProfile<K extends string> = Record<K, SourceAudioRole> & {
  attenuation: {
    points: readonly { distance: number; storedValue: number; interpolation: number }[];
  };
};
type Point = { x: number; y: number };
interface Voice<K extends string> {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: K;
  stopAtTick: number | null;
  fadeStartTick: number | null;
}
/** Source SFX with optional whole-buffer looping. Local phase/listener/master mix, cap-zero handling and
 * equal-priority admission order do not certify native dispatch or bus behavior. */
export class FiniteSourceAudio<K extends string, R extends { id: number; startTick: number }> {
  constructor(
    private readonly profile: SourceAudioProfile<K>,
    private readonly kinds: readonly K[],
    private readonly states: (
      records: readonly R[],
      tick: number,
      team: Team
    ) => SourceAudioState<K>[],
    private readonly label: string
  ) {}
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<K, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice<K>>();
  private finished = new Set<string>();
  private fallbackCasts = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    return (this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          this.kinds.map(
            async (kind) =>
              [
                kind,
                await Promise.all(
                  this.profile[kind].variants.map(async ({ url }) => {
                    const response = await fetch(import.meta.env.BASE_URL + url);
                    if (!response.ok) throw Error(`${this.label} audio ${response.status}`);
                    return decoder.decodeAudioData(await response.arrayBuffer());
                  })
                ),
              ] as const
          )
        );
        this.buffers = Object.fromEntries(decoded) as Partial<Record<K, AudioBuffer[]>>;
        this.status = 'ready';
      } catch (error) {
        this.buffers = {};
        this.status = 'failed';
        console.warn(`Source ${this.label} audio unavailable.`, error);
      }
    })());
  }
  suppressCast(id: number, start: number) {
    this.suppress(`${id}:${start}:cast`);
  }
  suppress(key: string) {
    this.fallbackCasts.add(key);
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
  private gain(s: SourceAudioState<K>, listener: Point) {
    return (
      0.2 *
      10 ** (this.profile[s.kind].gainDb / 20) *
      wwise145Attenuation(
        this.profile.attenuation.points,
        Math.hypot(s.x - listener.x, s.y - listener.y)
      ).amplitude
    );
  }
  private schedule(v: Voice<K>, s: SourceAudioState<K>, now: number) {
    const gain = v.envelope.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(s.envelope, now);
    if (s.remainingIn) gain.linearRampToValueAtTime(s.fadeInTarget ?? 1, now + s.remainingIn);
    if (s.fadeStartTick !== null && s.fadeOutSeconds > 0) {
      if (s.fadeOutAt > 0) gain.setValueAtTime(s.fadeInTarget ?? 1, now + s.fadeOutAt);
      gain.linearRampToValueAtTime(0, now + s.fadeOutRemaining);
    }
    if (Number.isFinite(s.remaining)) v.source.stop(now + s.remaining);
    v.stopAtTick = s.stopAtTick;
    v.fadeStartTick = s.fadeStartTick;
  }
  private create(context: AudioContext, s: SourceAudioState<K>, listener: Point) {
    const policy = this.profile[s.kind].policy,
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
    const v: Voice<K> = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      kind: s.kind,
      stopAtTick: s.stopAtTick,
      fadeStartTick: s.fadeStartTick,
    };
    v.source.buffer = this.buffers[s.kind]![s.variant];
    v.source.loop = this.profile[s.kind].loop ?? false;
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
    records: readonly R[],
    tick: number,
    listener: Point,
    visible: (point: Point) => boolean = () => true,
    team: Team = 'blue'
  ) {
    const states = this.states(records, tick, team).filter(visible),
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
