import { ORACLE_AUDIO as P } from '../content/oracle-audio';
import {
  oracleAudioStates,
  oracleStopFade,
  type OracleAudioRecord,
  type OracleAudioState,
  type OracleAudioKind,
} from './oracle-state';
import { wwise145Attenuation } from './wwise145-attenuation';
type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  stopTick: number | null | undefined;
}
/** The two activation actions are concurrent layers, not a random playlist. */
export class OracleAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<OracleAudioKind, AudioBuffer>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const decoded = await Promise.all(
          (['intro', 'loop', 'end'] as const).map(async (kind) => {
            const response = await fetch(import.meta.env.BASE_URL + P[kind].url);
            if (!response.ok) throw new Error(`Oracle audio ${response.status}`);
            return [kind, await decoder.decodeAudioData(await response.arrayBuffer())] as const;
          })
        );
        this.buffers = Object.fromEntries(decoded);
        this.status = 'ready';
      } catch (error) {
        this.buffers = {};
        this.status = 'failed';
        console.warn('Source Oracle audio unavailable.', error);
      }
    })();
    return this.loading;
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
  private envelope(voice: Voice, state: OracleAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(oracleStopFade(state.fadeProgress), now);
    if (state.remainingFade !== null) {
      const curve = new Float32Array(257);
      for (let i = 0; i < curve.length; i++)
        curve[i] = oracleStopFade(
          state.fadeProgress + ((1 - state.fadeProgress) * i) / (curve.length - 1)
        );
      voice.envelope.gain.setValueCurveAtTime(curve, now, state.remainingFade);
      voice.source.stop(now + state.remainingFade);
    }
    voice.stopTick = state.stopTick;
  }
  private gain(state: OracleAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.kind].gainDb / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private create(context: AudioContext, state: OracleAudioState, listener: Point) {
    const voice: Voice = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      stopTick: undefined,
    };
    const clip = P[state.kind];
    voice.source.buffer = this.buffers[state.kind]!;
    voice.source.playbackRate.value = state.rate;
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
    records: readonly OracleAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = oracleAudioStates(records, tick),
      active = new Set(states.map((s) => s.key));
    const histories = new Set(
      records.flatMap((r) => ['intro', 'loop', 'end'].map((k) => `${r.id}:${r.startTick}:${k}`))
    );
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener);
      this.envelope(voice, state, context.currentTime);
      voice.spatial.gain.setTargetAtTime(this.gain(state, listener), context.currentTime, 0.02);
    }
  }
}
