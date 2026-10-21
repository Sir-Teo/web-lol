import { GAREN_E_AUDIO as P } from '../content/garen-e-audio';
import {
  garenEAudioStates,
  garenEVariant,
  type GarenEAudioKind,
  type GarenEAudioRecord,
  type GarenEAudioState,
} from './garen-e-state';
import { wwise145Attenuation } from './wwise145-attenuation';
import type { SimEvent } from '../simulation/types';

interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  kind: GarenEAudioKind;
  x: number;
  y: number;
  stopTick: number | null | undefined;
}
const kinds = ['cast', 'active', 'end', 'hit'] as const;
/** Owns its nodes, borrows the app context, and loads source recordings only
 * when Garen is present. Native priority/shuffle/bus behavior remains unverified. */
export class GarenJudgmentAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<GarenEAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        await Promise.all(
          kinds.map(async (kind) => {
            this.buffers[kind] = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Judgment audio ${response.status}`);
                return decoder.decodeAudioData(await response.arrayBuffer());
              })
            );
          })
        );
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Source Judgment audio unavailable.', error);
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
  private gain(
    kind: GarenEAudioKind,
    point: { x: number; y: number },
    listener: { x: number; y: number }
  ) {
    // Camera ground focus and 0.2 presentation master match the existing local mix.
    return (
      0.2 *
      10 ** (P[kind].gainDb / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(point.x - listener.x, point.y - listener.y)
      ).amplitude
    );
  }
  private create(
    context: AudioContext,
    state: GarenEAudioState,
    listener: { x: number; y: number }
  ) {
    const kind = state.kind;
    // Equal-priority, global per-container kill-oldest interpretation of the source caps.
    while (
      [...this.voices.values()].filter((v) => v.kind === kind).length >=
      P[kind].policy.u16MaxNumInstance
    ) {
      const key = [...this.voices].find(([, v]) => v.kind === kind)![0];
      this.finished.add(key);
      this.release(key);
    }
    const voice: Voice = {
      source: context.createBufferSource(),
      envelope: context.createGain(),
      spatial: context.createGain(),
      kind,
      x: state.x,
      y: state.y,
      stopTick: undefined,
    };
    voice.source.buffer = this.buffers[kind]![state.variant];
    voice.source.loop = false;
    voice.source.connect(voice.envelope).connect(voice.spatial).connect(context.destination);
    voice.spatial.gain.value = this.gain(kind, state, listener);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    this.envelope(voice, state, context.currentTime);
    voice.source.start(context.currentTime, state.age);
    return voice;
  }
  private envelope(voice: Voice, state: GarenEAudioState, now: number) {
    if (voice.stopTick === state.stopTick) return;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(state.fade, now);
    if (state.remainingFade !== null)
      voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingFade);
    voice.stopTick = state.stopTick;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenEAudioRecord[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const states = garenEAudioStates(records, tick),
      active = new Set(states.map((s) => s.key));
    for (const key of this.finished) if (!active.has(key)) this.finished.delete(key);
    for (const [key, voice] of this.voices)
      if (voice.kind !== 'hit' && !active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener);
      voice.x = state.x;
      voice.y = state.y;
      this.envelope(voice, state, context.currentTime);
    }
    for (const voice of this.voices.values())
      voice.spatial.gain.setTargetAtTime(
        this.gain(voice.kind, voice, listener),
        context.currentTime,
        0.02
      );
  }
  hit(context: AudioContext, event: SimEvent, tick: number, listener: { x: number; y: number }) {
    if (this.status !== 'ready' || context.state !== 'running') return;
    if (this.voices.has(`hit:${event.id}`)) return;
    const variant = garenEVariant(event.id, event.tick, 'hit'),
      age = Math.max(0, (tick - event.tick) / 60);
    if (age >= P.hit.variants[variant].durationSeconds) return;
    this.create(
      context,
      {
        key: `hit:${event.id}`,
        kind: 'hit',
        variant,
        age,
        fade: 1,
        remainingFade: null,
        stopTick: null,
        x: event.x,
        y: event.y,
      },
      listener
    );
  }
}
