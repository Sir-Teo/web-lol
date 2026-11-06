import { BARON_BASIC_AUDIO as P, BARON_BASIC_ATTENUATION as A } from '../content/baron-basic-audio';
import {
  baronBasicAudioStates,
  type BaronBasicAudioRecord,
  type BaronBasicAudioState,
} from './baron-basic-state';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  profileIndex: number;
}
/** Private encounter preview. Source gains/attenuation feed a local 0.2 mix;
 * native dispatch, global bus and shuffle are deliberately not certified. */
export class BaronBasicAttackAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private pending?: Promise<void>;
  private buffers = new Map<number, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private finished = new Set<string>();
  private records = new Map<string, BaronBasicAudioRecord>();
  private owner?: object;
  private lastTick = -Infinity;
  get activeVoices() {
    return this.voices.size;
  }
  load(): Promise<void> {
    if (this.pending && this.status !== 'failed') return this.pending;
    this.status = 'loading';
    return (this.pending = (async () => {
      try {
        const decoder = new OfflineAudioContext(1, 1, 44100);
        const results = await Promise.allSettled(
          P.flatMap((p) => [...p.variants]).map(async (clip) => {
            if (this.buffers.has(clip.id)) return;
            const response = await fetch(import.meta.env.BASE_URL + clip.url);
            if (!response.ok) throw Error(`Baron candidate audio ${response.status}`);
            const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
            if (
              buffer.numberOfChannels !== 1 ||
              buffer.sampleRate !== clip.sampleRate ||
              buffer.length !== clip.frames
            )
              throw Error('Baron candidate audio decode extent differs');
            this.buffers.set(clip.id, buffer);
          })
        );
        const failure = results.find((r) => r.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Baron candidate audio unavailable.', error);
      }
    })());
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
  reset() {
    this.stop();
    this.records.clear();
    this.finished.clear();
    this.owner = undefined;
    this.lastTick = -Infinity;
  }
  private amplitude(state: BaronBasicAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.profileIndex].gainDb / 20) *
      wwise145Attenuation(A, Math.hypot(state.x - listener.x, state.y - listener.y)).amplitude
    );
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    incoming: readonly BaronBasicAudioRecord[],
    tick: number,
    listener: Point,
    owner: object
  ) {
    if (!Number.isFinite(tick)) {
      this.stop();
      return;
    }
    if (this.owner !== owner || tick < this.lastTick) this.reset();
    this.owner = owner;
    this.lastTick = tick;
    const present = new Set<string>();
    for (const record of incoming) {
      const key = `${record.id}:${record.launchTick}`;
      present.add(key);
      this.records.set(key, structuredClone(record));
    }
    // Retain an already observed cue through its finite audio tail even if its
    // shorter visual history was pruned (e.g. a missed projectile).
    for (const [key, record] of this.records)
      if (!present.has(key) && !baronBasicAudioStates([record], tick).length)
        this.records.delete(key);
    const states = baronBasicAudioStates([...this.records.values()], tick),
      active = new Set(states.map((s) => s.key));
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    for (const key of this.finished)
      if (!this.records.has(key.slice(0, key.lastIndexOf(':')))) this.finished.delete(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') {
      this.stop();
      return;
    }
    const now = context.currentTime;
    for (const state of states) {
      if (this.finished.has(state.key)) continue;
      let voice = this.voices.get(state.key);
      if (!voice) {
        const profile = P[state.profileIndex];
        while (
          [...this.voices.values()].filter((v) => v.profileIndex === state.profileIndex).length >=
          profile.maxVoices
        ) {
          const oldest = [...this.voices].find(
            ([, v]) => v.profileIndex === state.profileIndex
          )![0];
          this.finished.add(oldest);
          this.release(oldest);
        }
        voice = {
          source: context.createBufferSource(),
          gain: context.createGain(),
          profileIndex: state.profileIndex,
        };
        voice.source.buffer = this.buffers.get(profile.variants[state.variant].id)!;
        voice.source.loop = false;
        voice.source.playbackRate.value = state.rate;
        voice.gain.gain.value = this.amplitude(state, listener);
        voice.source.connect(voice.gain).connect(context.destination);
        this.voices.set(state.key, voice);
        voice.source.onended = () => {
          this.finished.add(state.key);
          this.release(state.key, false);
        };
        voice.source.start(now, state.offset);
      }
      voice.gain.gain.setTargetAtTime(this.amplitude(state, listener), now, 0.02);
    }
  }
}
