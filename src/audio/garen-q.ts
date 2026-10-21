import { GAREN_Q_AUDIO as P } from '../content/garen-q-audio';
import {
  garenQAudioStates,
  garenQAudioKeys,
  GAREN_Q_AUDIO_KINDS,
  type GarenQAudioKind,
  type GarenQAudioRecord,
  type GarenQAudioState,
} from './garen-q-state';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: GarenQAudioKind;
  variant: number;
  stopTick: number | null | undefined;
}
/** Source mono cast/active/end and dual attack playback with independent distance gain and stop
 * envelope. Native script dispatch, shuffle, bus mix and listener are unverified. */
export class GarenDecisiveStrikeAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<GarenQAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallbackCues = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          GAREN_Q_AUDIO_KINDS.map(async (kind) => {
            const buffers = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Decisive Strike audio ${response.status}`);
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
        console.warn('Source Decisive Strike audio unavailable.', error);
      }
    })();
    return this.loading;
  }
  suppressCast(id: number, startTick: number) {
    this.fallbackCues.add(`${id}:${startTick}:cast`);
  }
  suppressAttack(id: number, startTick: number) {
    for (const kind of ['attack', 'attackDelayed'])
      this.fallbackCues.add(`${id}:${startTick}:${kind}`);
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
  private gain(state: GarenQAudioState, listener: Point) {
    return (
      0.2 *
      10 ** ((P[state.kind].gainDb + P[state.kind].variants[state.variant].gainDb) / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private envelope(voice: Voice, state: GarenQAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(state.fade, now);
    if (state.remainingFade !== null) {
      voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingFade);
      voice.source.stop(now + state.remainingFade);
    }
    voice.stopTick = state.stopTick;
  }
  private create(context: AudioContext, state: GarenQAudioState, listener: Point, now: number) {
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
    voice.source.buffer = this.buffers[state.kind]![state.variant];
    voice.source.loop = false;
    voice.source.connect(voice.envelope).connect(voice.spatial).connect(context.destination);
    voice.spatial.gain.value = this.gain(state, listener);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    voice.source.start(now + state.delay, state.offset);
    this.envelope(voice, state, now);
    return voice;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenQAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = garenQAudioStates(records, tick),
      active = new Set(states.map((s) => s.key));
    const histories = new Set(garenQAudioKeys(records));
    for (const key of this.fallbackCues) if (!histories.has(key)) this.fallbackCues.delete(key);
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    const now = context.currentTime;
    for (const state of states) {
      if (this.finished.has(state.key) || this.fallbackCues.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener, now);
      this.envelope(voice, state, now);
      voice.spatial.gain.setTargetAtTime(this.gain(state, listener), now, 0.02);
    }
  }
}
