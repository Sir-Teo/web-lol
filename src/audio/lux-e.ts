import { LUX_E_AUDIO as P } from '../content/lux-e-audio';
import { LUX_E_AUDIO_KINDS, type LuxEAudioKind, type LuxEAudioState } from './lux-e-state';
import type { LuxEAudioRecord } from '../simulation/lux-e-audio';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: LuxEAudioKind;
  variant: number;
  startTime: number;
  offset: number;
  stopTick: number | null | undefined;
}
/** Source mono finite cast/flight/zone/hit playback with independent distance gain and stop
 * envelope. Native script dispatch, shuffle, bus mix and listener are unverified. */
export class LuxSingularityAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<LuxEAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallbackCasts = new Set<string>();
  load(): Promise<void> {
    if (this.status === 'ready') return Promise.resolve();
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          LUX_E_AUDIO_KINDS.map(async (kind) => {
            const buffers = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Lucent Singularity audio ${response.status}`);
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
        console.warn('Source Lucent Singularity audio unavailable.', error);
      }
    })();
    const loading = this.loading;
    void loading.finally(() => {
      if (this.loading === loading) this.loading = undefined;
    });
    return loading;
  }
  suppressCast(id: number, startTick: number) {
    this.fallbackCasts.add(`${id}:${startTick}:cast`);
  }
  private release(key: string, stop = true) {
    const voice = this.voices.get(key);
    if (!voice) return;
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.envelope.disconnect();
    voice.spatial.disconnect();
    this.voices.delete(key);
  }
  reset() {
    this.stop();
    this.finished.clear();
    this.fallbackCasts.clear();
  }
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(state: LuxEAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.kind].gainDb / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private envelope(voice: Voice, state: LuxEAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(state.fade, now);
    if (state.remainingFade !== null) {
      voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingFade);
      voice.source.stop(now + state.remainingFade);
    }
    voice.stopTick = state.stopTick;
  }
  private create(context: AudioContext, state: LuxEAudioState, listener: Point) {
    while (
      [...this.voices.values()].filter((v) => v.kind === state.kind).length >=
      P[state.kind].policy.u16MaxNumInstance
    ) {
      const oldest = [...this.voices].find(([, v]) => v.kind === state.kind)![0];
      this.finished.add(oldest);
      this.release(oldest);
    }
    const voice: Voice = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      kind: state.kind,
      variant: state.variant,
      startTime: context.currentTime,
      offset: state.offset,
      stopTick: undefined,
    };
    voice.source.buffer = this.buffers[state.kind]![state.variant];
    voice.source.loop = false;
    voice.source.connect(voice.envelope).connect(voice.spatial).connect(context.destination);
    voice.spatial.gain.value = this.gain(state, listener);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    voice.source.start(context.currentTime, state.offset);
    this.envelope(voice, state, context.currentTime);
    return voice;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly LuxEAudioRecord[],
    states: readonly LuxEAudioState[],
    listener: Point
  ) {
    const active = new Set(states.map((s) => s.key));
    const present = new Set(records.map((r) => `${r.sourceId}:${r.startTick}:cast`));
    const histories = new Set(
      records.flatMap((r) =>
        LUX_E_AUDIO_KINDS.map((kind) => `${r.sourceId}:${r.startTick}:${kind}`)
      )
    );
    for (const key of this.fallbackCasts) if (!present.has(key)) this.fallbackCasts.delete(key);
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.key) || this.fallbackCasts.has(state.key)) continue;
      const prior = this.voices.get(state.key);
      // Reconstruct after an explicit seek/catch-up, rather than continuing a
      // voice from an unrelated logical offset. Ordinary frames need no restart.
      if (
        prior &&
        Math.abs(prior.offset + context.currentTime - prior.startTime - state.offset) > 0.1
      )
        this.release(state.key);
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener);
      this.envelope(voice, state, context.currentTime);
      voice.spatial.gain.setTargetAtTime(this.gain(state, listener), context.currentTime, 0.02);
    }
  }
}
