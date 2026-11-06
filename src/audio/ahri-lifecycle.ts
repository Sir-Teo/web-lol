import { AHRI_LIFECYCLE_AUDIO_PROFILES as P } from '../content/ahri-lifecycle-audio-policy';
import { AHRI_LIFECYCLE_AUDIO as SOURCE } from '../content/ahri-lifecycle-audio';
import {
  lifecycleAudioStates,
  type LifecycleAudioScene,
  type LifecycleAudioState,
} from './ahri-lifecycle-state';
import { sourceEnvelopeEvents } from './source-envelope';
import type { AhriLifecycleAudioRecord } from '../simulation/ahri-lifecycle-audio';
import { wwise145Attenuation } from './wwise145-attenuation';

type Point = { x: number; y: number };
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  containerId: number;
  ownerKey: string;
  envelope: GainNode;
  stopAge: number | null;
}
/** Finite source masters, local 0.2 mix and explicit local 16-voice cue ceilings.
 * Raw source instance declarations remain zero; the death Stop stays clock-unbound.
 * Native script dispatch, global playlists, listener and bus remain unverified. */
export class AhriLifecycleAudio {
  status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private pending?: Promise<void>;
  private buffers = new Map<number, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private finished = new Map<string, string>();
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
          [
            ...new Map(
              Object.values(P).flatMap((p) => p.variants.map((v) => [v.id, v] as const))
            ).values(),
          ].map(async (clip) => {
            if (this.buffers.has(clip.id)) return;
            const response = await fetch(import.meta.env.BASE_URL + clip.url);
            if (!response.ok) throw Error(`Lifecycle source audio ${response.status}`);
            const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
            if (
              buffer.numberOfChannels !== 1 ||
              buffer.sampleRate !== clip.sampleRate ||
              buffer.length !== clip.frames
            )
              throw Error('Lifecycle source audio decode extent differs');
            this.buffers.set(clip.id, buffer);
          })
        );
        const failure = results.find((r) => r.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        this.status = 'ready';
      } catch (error) {
        this.status = 'failed';
        console.warn('Lifecycle source audio unavailable.', error);
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
    voice.envelope.disconnect();
    this.voices.delete(key);
  }
  stop() {
    for (const key of this.voices.keys()) this.release(key);
  }
  reset() {
    this.stop();
    this.finished.clear();
    this.owner = undefined;
    this.lastTick = -Infinity;
  }
  private amplitude(state: LifecycleAudioState, listener: Point) {
    return (
      0.2 *
      10 ** (P[state.kind].variants[state.variant].gainDb / 20) *
      wwise145Attenuation(
        SOURCE.attenuation,
        Math.hypot(state.x - listener.x, state.y - listener.y)
      ).amplitude
    );
  }
  private scheduleEnvelope(voice: Voice, state: LifecycleAudioState, now: number) {
    voice.envelope.gain.cancelScheduledValues(0);
    const remaining = state.endAge - state.age;
    for (const event of sourceEnvelopeEvents(state)) {
      const time = now + event.age - state.age;
      if (event.kind === 'set') voice.envelope.gain.setValueAtTime(event.value, time);
      else voice.envelope.gain.linearRampToValueAtTime(event.value, time);
    }
    voice.stopAge = state.stopAge;
    voice.source.stop(now + remaining);
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    records: readonly AhriLifecycleAudioRecord[],
    tick: number,
    listener: Point,
    owner: object,
    scene: LifecycleAudioScene
  ) {
    if (!Number.isFinite(tick)) {
      this.stop();
      return;
    }
    if (this.owner !== owner || tick < this.lastTick) this.reset();
    this.owner = owner;
    this.lastTick = tick;
    const present = new Set(records.map((r) => String(r.id)));
    const states = lifecycleAudioStates(records, tick, scene);
    const active = new Set(states.map((s) => s.key));
    for (const key of this.voices.keys()) if (!active.has(key)) this.release(key);
    for (const [key, ownerKey] of this.finished)
      if (!present.has(ownerKey)) this.finished.delete(key);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') {
      this.stop();
      return;
    }
    const now = context.currentTime;
    for (const state of states) {
      if (this.finished.has(state.key)) continue;
      let voice = this.voices.get(state.key);
      if (!voice) {
        const profile = P[state.kind];
        const retire = (matches: (voice: Voice) => boolean, limit: number) => {
          while ([...this.voices.values()].filter(matches).length >= limit) {
            const [key, oldest] = [...this.voices].find(([, voice]) => matches(voice))!;
            this.finished.set(key, oldest.ownerKey);
            this.release(key);
          }
        };
        retire((voice) => voice.containerId === profile.containerId, profile.maxVoices);
        voice = {
          source: context.createBufferSource(),
          gain: context.createGain(),
          envelope: context.createGain(),
          stopAge: state.stopAge,
          containerId: profile.containerId,
          ownerKey: state.ownerKey,
        };
        voice.source.buffer = this.buffers.get(profile.variants[state.variant].id)!;
        voice.source.loop = false;
        voice.source.playbackRate.value = state.rate;
        voice.gain.gain.value = this.amplitude(state, listener);
        voice.source.connect(voice.envelope).connect(voice.gain).connect(context.destination);
        this.voices.set(state.key, voice);
        voice.source.onended = () => {
          this.finished.set(state.key, state.ownerKey);
          this.release(state.key, false);
        };
        voice.source.start(now, state.offset);
        this.scheduleEnvelope(voice, state, now);
      }
      if (voice.stopAge !== state.stopAge) this.scheduleEnvelope(voice, state, now);
      voice.gain.gain.setTargetAtTime(this.amplitude(state, listener), now, 0.02);
    }
  }
}
