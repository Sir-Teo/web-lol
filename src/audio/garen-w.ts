import { GAREN_W_AUDIO as P } from '../content/garen-w-audio';
import {
  garenWAudioStates,
  type GarenWAudioKind,
  type GarenWAudioRecord,
  type GarenWAudioState,
} from './garen-w-state';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: GarenWAudioKind;
  variant: number;
  stopTick: number | null | undefined;
}
/** Source mono cast/loop/end playback with independent distance gain and stop
 * envelope. Native script dispatch, shuffle, bus mix and listener are unverified. */
export class GarenCourageAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<GarenWAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallbackCasts = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          (['cast', 'active', 'end'] as const).map(async (kind) => {
            const buffers = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Courage audio ${response.status}`);
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
        console.warn('Source Courage audio unavailable.', error);
      }
    })();
    return this.loading;
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
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(state: GarenWAudioState, listener: Point) {
    return (
      0.2 *
      10 ** ((P[state.kind].gainDb + P[state.kind].variants[state.variant].gainDb) / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private envelope(voice: Voice, state: GarenWAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(state.fade, now);
    if (state.remainingFade !== null) {
      voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingFade);
      voice.source.stop(now + state.remainingFade);
    }
    voice.stopTick = state.stopTick;
  }
  private create(context: AudioContext, state: GarenWAudioState, listener: Point) {
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
      stopTick: undefined,
    };
    const clip = P[state.kind].variants[state.variant];
    voice.source.buffer = this.buffers[state.kind]![state.variant];
    voice.source.loop = clip.loop !== null;
    if (clip.loop) {
      voice.source.loopStart = clip.loop.start / clip.sampleRate;
      voice.source.loopEnd = clip.loop.end / clip.sampleRate;
    }
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
    records: readonly GarenWAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = garenWAudioStates(records, tick),
      active = new Set(states.map((s) => s.key));
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}:cast`));
    const histories = new Set(
      records.flatMap((r) =>
        ['cast', 'active', 'end'].map((kind) => `${r.id}:${r.startTick}:${kind}`)
      )
    );
    for (const key of this.fallbackCasts) if (!present.has(key)) this.fallbackCasts.delete(key);
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.key) || this.fallbackCasts.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener);
      this.envelope(voice, state, context.currentTime);
      voice.spatial.gain.setTargetAtTime(this.gain(state, listener), context.currentTime, 0.02);
    }
  }
}
