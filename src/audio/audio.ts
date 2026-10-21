import { LuxBindingFlightAudio } from './lux-binding-flight';
import { GarenJudgmentAudio } from './garen-e';
import type { World } from '../simulation/world';
import { LUX_BINDING_CAST_AUDIO } from '../content/lux-binding-cast-audio';
import { luxBindingCastAttenuation } from './lux-binding-cast-attenuation';
import { SourceAudioVariants } from './source-audio-variants';
import { LUX_ILLUMINATION_AUDIO } from '../content/lux-illumination-audio';
import { luxIlluminationAttenuation } from './lux-illumination-attenuation';
import { LuxIlluminationVariants } from './lux-illumination-variants';
import { HAWKSHOT_FLIGHT_AUDIO } from '../content/hawkshot-flight-audio';
import { flightAudioStates } from './hawkshot-flight-state';
import { HAWKSHOT_LINGER_AUDIO } from '../content/hawkshot-linger-audio';
import { lingerAudioState, lingerFade } from './hawkshot-linger-state';
import { TICK_RATE } from '../content/rules';
import { HAWKSHOT_ARRIVAL_AUDIO } from '../content/hawkshot-arrival-audio';
import { HAWKSHOT_CAST_AUDIO } from '../content/hawkshot-cast-audio';
import type { BindingFlightStop, Projectile, ScoutVisual, SimEvent } from '../simulation/types';

/** Source Hawkshot, Light Binding, Illumination and Judgment audio; other cues remain synthesized. */
export class GameAudio {
  context: AudioContext | null = null;
  bindingFlight = new LuxBindingFlightAudio();
  garenE = new GarenJudgmentAudio();
  private audible = true;
  private paused = false;
  private resuming = false;
  private lastId: number;
  private bindingCastBuffers: AudioBuffer[] = [];
  private bindingCastVariants = new SourceAudioVariants(
    LUX_BINDING_CAST_AUDIO.variants.length,
    LUX_BINDING_CAST_AUDIO.policy.wAvoidRepeatCount
  );
  private bindingCastVoices = new Map<AudioBufferSourceNode, { x: number; y: number }>();
  bindingCastStatus: 'loading' | 'ready' | 'failed' = 'loading';
  private illuminationBuffers: AudioBuffer[] = [];
  private illuminationVariants = new LuxIlluminationVariants();
  private illuminationVoices = new Map<AudioBufferSourceNode, { x: number; y: number }>();
  illuminationStatus: 'loading' | 'ready' | 'failed' = 'loading';
  private buffers: AudioBuffer[] = [];
  private bag: number[] = [];
  private arrivalBuffer: AudioBuffer | null = null;
  private flightBuffers: AudioBuffer[] = [];
  private flightVoices = new Map<string, AudioBufferSourceNode>();
  private finishedFlight = new Set<string>();
  flightStatus: 'loading' | 'ready' | 'failed' = 'loading';
  private lingerBuffer: AudioBuffer | null = null;
  private lingerVoices = new Map<number, AudioBufferSourceNode>();
  private finishedLinger = new Set<number>();
  lingerStatus: 'loading' | 'ready' | 'failed' = 'loading';
  arrivalStatus: 'loading' | 'ready' | 'failed' = 'loading';
  private voices = new Map<AudioScheduledSourceNode, GainNode>();
  private transition = Promise.resolve();
  sourceStatus: 'loading' | 'ready' | 'failed' = 'loading';
  constructor(events: SimEvent[] = []) {
    // Existing events are history, including after a checkpoint restore.
    this.lastId = Math.max(0, ...events.map((event) => event.id));
  }
  get enabled(): boolean {
    return this.audible;
  }
  set enabled(value: boolean) {
    this.audible = value;
    if (!value) this.stopVoices();
  }
  async load(garenPresent = false): Promise<void> {
    await Promise.all([
      this.loadCast(),
      this.loadArrival(),
      this.loadLinger(),
      this.loadFlight(),
      this.loadIllumination(),
      this.loadBindingCast(),
      this.bindingFlight.load(),
      ...(garenPresent ? [this.garenE.load()] : []),
    ]);
  }
  private async loadBindingCast(): Promise<void> {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.bindingCastBuffers = await Promise.all(
        LUX_BINDING_CAST_AUDIO.variants.map(async ({ url }) => {
          const response = await fetch(import.meta.env.BASE_URL + url);
          if (!response.ok) throw new Error(`BindingCast audio asset ${response.status}`);
          return decoder.decodeAudioData(await response.arrayBuffer());
        })
      );
      this.bindingCastStatus = 'ready';
    } catch (error) {
      this.bindingCastStatus = 'failed';
      console.warn('Source BindingCast audio unavailable.', error);
    }
  }
  private bindingCast(event: SimEvent, tick: number, listener: { x: number; y: number }): void {
    if (this.bindingCastStatus !== 'ready') return;
    const buffer = this.bindingCastBuffers[this.bindingCastVariants.next(event.id)];
    const age = Math.max(0, (tick - event.tick) / TICK_RATE);
    const offset = Math.max(0, age - LUX_BINDING_CAST_AUDIO.delaySeconds);
    if (offset >= buffer.duration) return;
    // Equal-priority local interpretation of the source's two-voice, kill-oldest cap.
    while (this.bindingCastVoices.size >= LUX_BINDING_CAST_AUDIO.policy.u16MaxNumInstance) {
      const oldest = this.bindingCastVoices.keys().next().value!;
      oldest.stop();
      oldest.disconnect();
      this.voices.get(oldest)?.disconnect();
      this.voices.delete(oldest);
      this.bindingCastVoices.delete(oldest);
    }
    const context = this.context!,
      voice = context.createBufferSource(),
      gain = context.createGain();
    voice.buffer = buffer;
    gain.gain.value = this.bindingCastGain(event, listener);
    voice.connect(gain).connect(context.destination);
    this.own(voice, gain);
    this.bindingCastVoices.set(voice, { x: event.x, y: event.y });
    voice.start(
      context.currentTime + Math.max(0, LUX_BINDING_CAST_AUDIO.delaySeconds - age),
      offset
    );
  }
  private bindingCastGain(point: { x: number; y: number }, listener: { x: number; y: number }) {
    // Camera ground focus is a local listener; 0.2 is the existing presentation mix.
    return (
      0.2 *
      luxBindingCastAttenuation(Math.hypot(point.x - listener.x, point.y - listener.y)).amplitude
    );
  }
  private async loadIllumination(): Promise<void> {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.illuminationBuffers = await Promise.all(
        LUX_ILLUMINATION_AUDIO.variants.map(async ({ url }) => {
          const response = await fetch(import.meta.env.BASE_URL + url);
          if (!response.ok) throw new Error(`Illumination audio asset ${response.status}`);
          return decoder.decodeAudioData(await response.arrayBuffer());
        })
      );
      this.illuminationStatus = 'ready';
    } catch (error) {
      this.illuminationStatus = 'failed';
      console.warn('Source Illumination audio unavailable.', error);
    }
  }
  private illumination(event: SimEvent, tick: number, listener: { x: number; y: number }): void {
    if (this.illuminationStatus !== 'ready') return;
    const buffer = this.illuminationBuffers[this.illuminationVariants.next(event.id)];
    const offset = Math.max(0, (tick - event.tick) / TICK_RATE);
    if (offset >= buffer.duration) return;
    // Equal-priority local interpretation of the source's two-voice, kill-oldest cap.
    while (this.illuminationVoices.size >= LUX_ILLUMINATION_AUDIO.policy.u16MaxNumInstance) {
      const oldest = this.illuminationVoices.keys().next().value!;
      oldest.stop();
      oldest.disconnect();
      this.voices.get(oldest)?.disconnect();
      this.voices.delete(oldest);
      this.illuminationVoices.delete(oldest);
    }
    const context = this.context!,
      voice = context.createBufferSource(),
      gain = context.createGain();
    voice.buffer = buffer;
    gain.gain.value = this.illuminationGain(event, listener);
    voice.connect(gain).connect(context.destination);
    this.own(voice, gain);
    this.illuminationVoices.set(voice, { x: event.x, y: event.y });
    voice.start(context.currentTime, offset);
  }
  private illuminationGain(point: { x: number; y: number }, listener: { x: number; y: number }) {
    // Camera ground focus is a local listener; 0.2 is the existing presentation mix.
    return (
      0.2 *
      luxIlluminationAttenuation(Math.hypot(point.x - listener.x, point.y - listener.y)).amplitude
    );
  }
  private async loadFlight(): Promise<void> {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.flightBuffers = await Promise.all(
        [...HAWKSHOT_FLIGHT_AUDIO.variants, HAWKSHOT_FLIGHT_AUDIO.loop].map(async ({ url }) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Flight audio asset ${response.status}`);
          return decoder.decodeAudioData(await response.arrayBuffer());
        })
      );
      this.flightStatus = 'ready';
    } catch (error) {
      this.flightStatus = 'failed';
      console.warn('Source flight audio unavailable.', error);
    }
  }
  private async loadLinger(): Promise<void> {
    try {
      const response = await fetch(HAWKSHOT_LINGER_AUDIO.url);
      if (!response.ok) throw new Error(`Linger audio asset ${response.status}`);
      this.lingerBuffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
        await response.arrayBuffer()
      );
      this.lingerStatus = 'ready';
    } catch (error) {
      this.lingerStatus = 'failed';
      console.warn('Source linger audio unavailable.', error);
    }
  }
  private async loadArrival(): Promise<void> {
    try {
      const response = await fetch(HAWKSHOT_ARRIVAL_AUDIO.url);
      if (!response.ok) throw new Error(`Arrival audio asset ${response.status}`);
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.arrivalBuffer = await decoder.decodeAudioData(await response.arrayBuffer());
      this.arrivalStatus = 'ready';
    } catch (error) {
      this.arrivalStatus = 'failed';
      console.warn('Source arrival audio unavailable.', error);
    }
  }
  private async loadCast(): Promise<void> {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      this.buffers = await Promise.all(
        HAWKSHOT_CAST_AUDIO.variants.map(async ({ url }) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Audio asset ${response.status}: ${url}`);
          return decoder.decodeAudioData(await response.arrayBuffer());
        })
      );
      this.sourceStatus = 'ready';
    } catch (error) {
      this.sourceStatus = 'failed';
      console.warn('Source cast audio unavailable; synthesized feedback remains available.', error);
    }
  }
  setPaused(value: boolean): void {
    this.paused = value;
    this.syncContext();
  }
  private syncContext(): void {
    // Serialize asynchronous suspend/resume and read current intent each time.
    this.transition = this.transition
      .then(async () => {
        const context = this.context;
        if (!context || context.state === 'closed') return;
        if (this.paused) await context.suspend();
        else if (context.state !== 'running') {
          this.resuming = true;
          try {
            await context.resume();
          } finally {
            this.resuming = false;
          }
        }
      })
      .catch(() => {
        /* A later user gesture can retry a blocked resume. */
      });
  }
  private stopVoices(): void {
    this.bindingFlight.stop();
    this.garenE.stop();
    for (const [voice, gain] of this.voices) {
      voice.stop();
      voice.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
    this.illuminationVoices.clear();
    this.bindingCastVoices.clear();
    this.lingerVoices.clear();
    this.flightVoices.clear();
  }
  private own(voice: AudioScheduledSourceNode, gain: GainNode): void {
    this.voices.set(voice, gain);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
      this.illuminationVoices.delete(voice as AudioBufferSourceNode);
      this.bindingCastVoices.delete(voice as AudioBufferSourceNode);
      for (const [key, active] of this.flightVoices)
        if (active === voice) {
          this.finishedFlight.add(key);
          this.flightVoices.delete(key);
        }
      for (const [id, active] of this.lingerVoices)
        if (active === voice) {
          this.finishedLinger.add(id);
          this.lingerVoices.delete(id);
        }
    };
  }
  private hawkshot(event: SimEvent, tick: number): void {
    // Equal-weight shuffle bag is a local interpretation of the source shuffle
    // container. Do not consume simulation RNG for cosmetic variation.
    if (!this.bag.length) {
      this.bag = this.buffers.map((_, i) => i);
      let seed = event.id >>> 0;
      for (let i = this.bag.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = seed % (i + 1);
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    this.sample(this.buffers[this.bag.pop()!], event, tick, HAWKSHOT_CAST_AUDIO);
  }
  private sample(
    buffer: AudioBuffer,
    event: SimEvent,
    tick: number,
    profile: { delaySeconds: number; gainDb: number }
  ): void {
    const context = this.context!;
    const age = Math.max(0, (tick - event.tick) / TICK_RATE);
    const offset = Math.max(0, age - profile.delaySeconds);
    if (offset >= buffer.duration) return;
    const voice = context.createBufferSource(),
      gain = context.createGain();
    voice.buffer = buffer;
    // 0.2 is the local presentation mix. Native shared-bus gain is unresolved.
    gain.gain.value = 0.2 * 10 ** (profile.gainDb / 20);
    voice.connect(gain).connect(context.destination);
    this.own(voice, gain);
    voice.start(context.currentTime + Math.max(0, profile.delaySeconds - age), offset);
  }
  updateLinger(effects: ScoutVisual[], tick: number): void {
    // Caller supplies only currently permitted positions. Removal (including
    // fog exclusion) immediately disconnects the persistent voice.
    const active = new Set(
      effects
        .filter((e) => lingerAudioState(e, tick, this.lingerBuffer?.duration ?? 0))
        .map((e) => e.flight.id)
    );
    for (const id of this.finishedLinger) if (!active.has(id)) this.finishedLinger.delete(id);
    for (const [id, voice] of this.lingerVoices) {
      if (active.has(id)) continue;
      voice.stop();
      voice.disconnect();
      this.voices.get(voice)?.disconnect();
      this.voices.delete(voice);
      this.lingerVoices.delete(id);
    }
    const context = this.context,
      buffer = this.lingerBuffer;
    if (!this.enabled || this.paused || !context || context.state !== 'running' || !buffer) return;
    for (const effect of effects) {
      if (this.lingerVoices.has(effect.flight.id) || this.finishedLinger.has(effect.flight.id))
        continue;
      const state = lingerAudioState(effect, tick, buffer.duration);
      if (!state) continue;
      const voice = context.createBufferSource(),
        gain = context.createGain(),
        now = context.currentTime;
      const level = 0.2 * 10 ** (HAWKSHOT_LINGER_AUDIO.gainDb / 20);
      voice.buffer = buffer;
      voice.loop = true; // Source bank infinite loop; WEM has no embedded markers.
      voice.loopStart = 0;
      voice.loopEnd = buffer.duration;
      gain.gain.setValueAtTime(level * state.fade, now);
      const fadeStart = Math.max(state.age, state.stopAge);
      const curve = new Float32Array(257);
      for (let i = 0; i < curve.length; i++) {
        const age = fadeStart + ((state.endAge - fadeStart) * i) / (curve.length - 1);
        curve[i] = level * lingerFade((age - state.stopAge) / HAWKSHOT_LINGER_AUDIO.fadeSeconds);
      }
      gain.gain.setValueCurveAtTime(curve, now + fadeStart - state.age, state.endAge - fadeStart);
      voice.connect(gain).connect(context.destination);
      this.own(voice, gain);
      this.lingerVoices.set(effect.flight.id, voice);
      voice.start(now, state.offset);
      voice.stop(now + state.endAge - state.age);
    }
  }
  updateBindingFlight(
    projectiles: Projectile[],
    stops: BindingFlightStop[],
    tick: number,
    listener: { x: number; y: number }
  ): void {
    this.bindingFlight.update(
      this.context,
      this.enabled && !this.paused,
      projectiles,
      stops,
      tick,
      listener
    );
  }
  updateFlight(projectiles: Projectile[], effects: ScoutVisual[], tick: number): void {
    const states = flightAudioStates(projectiles, effects, tick);
    const active = new Set(states.flatMap((s) => [`${s.id}:variant`, `${s.id}:loop`]));
    for (const key of this.finishedFlight) if (!active.has(key)) this.finishedFlight.delete(key);
    for (const [key, voice] of this.flightVoices) {
      if (active.has(key)) continue;
      voice.stop();
      voice.disconnect();
      this.voices.get(voice)?.disconnect();
      this.voices.delete(voice);
      this.flightVoices.delete(key);
    }
    const context = this.context;
    if (
      !this.enabled ||
      this.paused ||
      !context ||
      context.state !== 'running' ||
      this.flightStatus !== 'ready'
    )
      return;
    for (const state of states)
      for (const layer of ['variant', 'loop'] as const) {
        const key = `${state.id}:${layer}`;
        if (this.flightVoices.has(key) || this.finishedFlight.has(key)) continue;
        const loop = layer === 'loop';
        const buffer = this.flightBuffers[loop ? 3 : state.variant];
        if (!loop && state.age >= buffer.duration) continue;
        const source = context.createBufferSource(),
          gain = context.createGain(),
          now = context.currentTime;
        const level =
          0.2 *
          10 **
            ((loop ? HAWKSHOT_FLIGHT_AUDIO.loopGainDb : HAWKSHOT_FLIGHT_AUDIO.variantGainDb) / 20);
        source.buffer = buffer;
        source.loop = loop;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        gain.gain.setValueAtTime(level * state.fade, now);
        if (state.age < state.stopAge)
          gain.gain.setValueAtTime(level, now + state.stopAge - state.age);
        gain.gain.linearRampToValueAtTime(0, now + state.endAge - state.age);
        source.connect(gain).connect(context.destination);
        this.own(source, gain);
        this.flightVoices.set(key, source);
        source.start(now, loop ? state.age % buffer.duration : state.age);
        source.stop(now + state.endAge - state.age);
      }
  }
  unlock(): void {
    this.context ??= new AudioContext();
    this.syncContext();
  }
  updateGaren(world: World, listener = { x: 0, y: 0 }) {
    const garens = world.units.filter((u) => u.champion === 'garen');
    if (garens.length && this.garenE.status === 'idle') void this.garenE.load();
    const records = garens
      .filter((u) => world.visible(u))
      .flatMap((u) => {
        const effect = world.championState(u.id)?.garenEVisual;
        return effect
          ? [
              {
                id: u.id,
                x: u.x,
                y: u.y,
                deadAt: u.deadAt,
                startTick: effect.startTick,
                stopTick: effect.stopTick,
              },
            ]
          : [];
      });
    this.garenE.update(this.context, this.enabled && !this.paused, records, world.tick, listener);
  }
  update(events: SimEvent[], tick: number, listener = { x: 0, y: 0 }): void {
    for (const [voice, point] of this.illuminationVoices) {
      // Local 20ms smoothing avoids steps as the camera moves.
      this.voices
        .get(voice)
        ?.gain.setTargetAtTime(
          this.illuminationGain(point, listener),
          this.context!.currentTime,
          0.02
        );
    }
    for (const [voice, point] of this.bindingCastVoices) {
      this.voices
        .get(voice)
        ?.gain.setTargetAtTime(
          this.bindingCastGain(point, listener),
          this.context!.currentTime,
          0.02
        );
    }
    // A resume promise can span animation frames. Keep live events eligible until
    // audio is running; intentional pause/mute still consumes history below.
    if (this.resuming && this.enabled && !this.paused && this.context?.state !== 'running') return;
    for (const event of events)
      if (event.id > this.lastId) {
        this.lastId = event.id;
        if (!this.enabled || this.paused || !this.context || this.context.state !== 'running')
          continue;
        if (event.type === 'illumination') this.illumination(event, tick, listener);
        if (event.type === 'judgment-hit') this.garenE.hit(this.context, event, tick, listener);
        if (event.type === 'attack') this.tone(650, 260, 0.065, 0.012, 'triangle');
        if (event.type === 'cast') {
          if (event.text === 'e' && event.champion === 'garen' && this.garenE.status === 'ready') {
            // Stateful source playback owns cast/active/stop phases, including restore.
          } else if (
            event.text === 'e' &&
            event.champion === 'ashe' &&
            this.sourceStatus === 'ready'
          )
            this.hawkshot(event, tick);
          else if (
            event.text === 'q' &&
            event.champion === 'lux' &&
            this.bindingCastStatus === 'ready'
          )
            this.bindingCast(event, tick, listener);
          else this.tone(event.text === 'r' ? 180 : 480, 1000, 0.2, 0.025, 'sine');
        }
        if (event.type === 'scout-arrival' && this.arrivalBuffer)
          this.sample(this.arrivalBuffer, event, tick, HAWKSHOT_ARRIVAL_AUDIO);
        if (event.type === 'gold') this.tone(1400, 1800, 0.12, 0.025, 'sine');
        if (event.type === 'level') this.tone(500, 1300, 0.4, 0.035, 'triangle');
        if (event.type === 'move') this.tone(700, 500, 0.045, 0.007, 'sine');
      }
  }
  private tone(
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    const c = this.context!,
      oscillator = c.createOscillator(),
      gain = c.createGain(),
      t = c.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, t);
    oscillator.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain).connect(c.destination);
    this.own(oscillator, gain);
    oscillator.start(t);
    oscillator.stop(t + duration);
  }
}
