import { LUX_BINDING_FLIGHT_AUDIO as profile } from '../content/lux-binding-flight-audio';
import { LUX_BINDING_ATTENUATION } from '../content/lux-binding-attenuation';
import { wwise145Attenuation } from './wwise145-attenuation';
import { bindingFlightAudioStates } from './lux-binding-flight-state';
import type { BindingFlightStop, Projectile } from '../simulation/types';
import { TICK_RATE } from '../content/rules';

interface Voice {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  spatial: GainNode;
  stopTick: number;
}
/** Borrowed AudioContext; this adapter owns and releases its source/envelope/spatial nodes. */
export class LuxBindingFlightAudio {
  status: 'loading' | 'ready' | 'failed' = 'loading';
  private buffers: AudioBuffer[] = [];
  private voices = new Map<number, Voice>();
  private finished = new Set<number>();
  async load() {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.buffers = await Promise.all(
        profile.variants.map(async ({ url }) => {
          const response = await fetch(import.meta.env.BASE_URL + url);
          if (!response.ok) throw new Error(`Light Binding flight audio ${response.status}`);
          return decoder.decodeAudioData(await response.arrayBuffer());
        })
      );
      this.status = 'ready';
    } catch (error) {
      this.status = 'failed';
      console.warn('Source Light Binding flight audio unavailable.', error);
    }
  }
  private release(id: number, stop = true) {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.envelope.disconnect();
    voice.spatial.disconnect();
    this.voices.delete(id);
  }
  stop() {
    for (const id of this.voices.keys()) this.release(id);
  }
  update(
    context: AudioContext | null,
    audible: boolean,
    projectiles: Projectile[],
    stops: BindingFlightStop[],
    tick: number,
    listener: { x: number; y: number }
  ) {
    const states = bindingFlightAudioStates(projectiles, stops, tick);
    const active = new Set(states.map((s) => s.id));
    for (const id of this.finished) if (!active.has(id)) this.finished.delete(id);
    for (const id of this.voices.keys()) if (!active.has(id)) this.release(id);
    if (!audible || !context || context.state !== 'running' || this.status !== 'ready') return;
    for (const state of states) {
      if (this.finished.has(state.id)) continue;
      let voice = this.voices.get(state.id);
      const now = context.currentTime;
      const created = !voice;
      if (!voice) {
        // Local equal-priority kill-oldest interpretation of the four-instance cap.
        while (this.voices.size >= profile.policy.u16MaxNumInstance) {
          const oldest = this.voices.keys().next().value!;
          this.finished.add(oldest);
          this.release(oldest);
        }
        voice = {
          source: context.createBufferSource(),
          envelope: context.createGain(),
          spatial: context.createGain(),
          stopTick: NaN,
        };
        voice.source.buffer = this.buffers[state.variant];
        voice.source.connect(voice.envelope).connect(voice.spatial).connect(context.destination);
        this.voices.set(state.id, voice);
        voice.source.onended = () => {
          this.finished.add(state.id);
          this.release(state.id, false);
        };
      }
      const level =
        0.2 *
        10 ** (profile.gainDb / 20) *
        wwise145Attenuation(
          LUX_BINDING_ATTENUATION.points,
          Math.hypot(state.x - listener.x, state.y - listener.y)
        ).amplitude;
      // Keep camera/emitter gain independent of the authored stop envelope.
      if (Number.isNaN(voice.stopTick)) voice.spatial.gain.value = level;
      else voice.spatial.gain.setTargetAtTime(level, now, 0.02);
      if (voice.stopTick !== state.stopTick) {
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setValueAtTime(state.fade, now);
        if (state.stopTick > tick)
          voice.envelope.gain.setValueAtTime(1, now + (state.stopTick - tick) / TICK_RATE);
        voice.envelope.gain.linearRampToValueAtTime(0, now + state.remainingFade);
        voice.stopTick = state.stopTick;
      }
      if (created) voice.source.start(now, state.age);
    }
  }
}
