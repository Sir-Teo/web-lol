import { GAREN_R_AUDIO as P } from '../content/garen-r-audio';
import {
  garenRAudioStates,
  type GarenRAudioKind,
  type GarenRAudioRecord,
  type GarenRAudioState,
} from './garen-r-state';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  kind: GarenRAudioKind;
  point: Point;
}
/** Source one-shots own their nodes, including the stereo kill master. Native
 * script timing, listener, shuffle/priority and bus mix remain unverified. */
export class GarenJusticeAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private loading?: Promise<void>;
  private buffers: Partial<Record<GarenRAudioKind, AudioBuffer[]>> = {};
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private fallbackCasts = new Set<string>();
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      try {
        const decoder = new OfflineAudioContext(2, 1, 44100);
        const decoded = await Promise.all(
          (['cast', 'hit', 'kill'] as const).map(async (kind) => {
            const buffers = await Promise.all(
              P[kind].variants.map(async ({ url }) => {
                const response = await fetch(import.meta.env.BASE_URL + url);
                if (!response.ok) throw new Error(`Demacian Justice audio ${response.status}`);
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
        console.warn('Source Demacian Justice audio unavailable.', error);
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
    voice.gain.disconnect();
    this.voices.delete(key);
  }
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  private gain(kind: GarenRAudioKind, point: Point, listener: Point) {
    return (
      0.2 *
      10 ** (P[kind].gainDb / 20) *
      wwise145Attenuation(
        P.attenuation.points,
        Math.hypot(point.x - listener.x, point.y - listener.y)
      ).amplitude
    );
  }
  private create(context: AudioContext, state: GarenRAudioState, listener: Point) {
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
      gain: context.createGain(),
      kind: state.kind,
      point: { x: state.x, y: state.y },
    };
    voice.source.buffer = this.buffers[state.kind]![state.variant];
    voice.source.loop = false;
    voice.gain.gain.value = this.gain(state.kind, state, listener);
    voice.source.connect(voice.gain).connect(context.destination);
    this.voices.set(state.key, voice);
    voice.source.onended = () => {
      this.finished.add(state.key);
      this.release(state.key, false);
    };
    voice.source.start(context.currentTime, state.age);
    return voice;
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly GarenRAudioRecord[],
    tick: number,
    listener: Point
  ) {
    const states = garenRAudioStates(records, tick),
      active = new Set(states.map((s) => s.key));
    const present = new Set(records.map((r) => `${r.id}:${r.startTick}:cast`));
    for (const key of this.fallbackCasts) if (!present.has(key)) this.fallbackCasts.delete(key);
    for (const key of this.finished) if (!active.has(key)) this.finished.delete(key);
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.key) || this.fallbackCasts.has(state.key)) continue;
      const voice = this.voices.get(state.key) ?? this.create(context, state, listener);
      voice.point = { x: state.x, y: state.y };
      voice.gain.gain.setTargetAtTime(
        this.gain(voice.kind, voice.point, listener),
        context.currentTime,
        0.02
      );
    }
  }
}
