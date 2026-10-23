import { GAREN_P_AUDIO as P } from '../content/garen-p-audio';
import {
  garenPAudioStates,
  type GarenPAudioKind,
  type GarenPAudioRecord,
  type GarenPAudioState,
} from './garen-p-state';
import { wwise145Attenuation } from './wwise145-attenuation';
type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: GarenPAudioKind;
  stopTick: number | null | undefined;
}
/** Two unchanged mono masters; authored per-role distance and independent
 * fade/spatial nodes. Native bus/listener/mix/dispatch remain unverified. */
export class GarenPerseveranceAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private pending?: Promise<void>;
  private buffers: Partial<Record<GarenPAudioKind, AudioBuffer>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  load(): Promise<void> {
    if (this.pending && this.status !== 'failed') return this.pending;
    this.status = 'loading';
    return (this.pending = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const loaded = await Promise.allSettled(
          (['onset', 'active'] as const).map(async (kind) => {
            const cached = this.buffers[kind];
            if (cached) return [kind, cached] as const;
            const response = await fetch(import.meta.env.BASE_URL + P[kind].clip.url);
            if (!response.ok) throw Error(`Perseverance audio ${response.status}`);
            return [kind, await decoder.decodeAudioData(await response.arrayBuffer())] as const;
          })
        );
        for (const r of loaded) if (r.status === 'fulfilled') this.buffers[r.value[0]] = r.value[1];
        const failure = loaded.find((r) => r.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Source Perseverance audio unavailable.', error);
      }
    })());
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
  private gain(state: GarenPAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.kind].gainDb / 20) *
      wwise145Attenuation(
        P[state.kind].attenuation.points,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private envelope(voice: Voice, state: GarenPAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(state.envelope, now);
    if (state.remainingOut !== null) {
      voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingOut);
      voice.source.stop(now + state.remainingOut);
    } else if (state.remainingIn > 0)
      voice.envelope.gain.linearRampToValueAtTime(1, now + state.remainingIn);
    voice.stopTick = state.stopTick;
  }
  private create(context: AudioContext, state: GarenPAudioState, listener: Point, now: number) {
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
      stopTick: undefined,
    };
    voice.source.buffer = this.buffers[state.kind]!;
    const loop = P[state.kind].clip.loop;
    voice.source.loop = loop !== null;
    if (loop) {
      voice.source.loopStart = loop.start / P[state.kind].clip.sampleRate;
      voice.source.loopEnd = loop.end / P[state.kind].clip.sampleRate;
    }
    voice.source.connect(voice.envelope).connect(voice.spatial).connect(context.destination);
    voice.spatial.gain.value = this.gain(state, listener);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    voice.envelope.gain.value = state.envelope;
    // Web Audio requires start before scheduling any stop, including a saved fade.
    voice.source.start(now, state.offset);
    this.envelope(voice, state, now);
    return voice;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenPAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = garenPAudioStates(records, tick),
      active = new Set(states.map((s) => s.key)),
      histories = new Set(
        records.flatMap((r) => ['onset', 'active'].map((k) => `${r.id}:${r.startTick}:${k}`))
      );
    for (const key of this.finished) if (!histories.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    const now = context.currentTime;
    for (const state of states) {
      if (this.finished.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener, now);
      this.envelope(voice, state, now);
      voice.spatial.gain.setTargetAtTime(this.gain(state, listener), now, 0.02);
    }
  }
}
