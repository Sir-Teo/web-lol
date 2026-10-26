import { LazyMasterYiMeditateAudio } from './masteryi-w-lazy';
import { LazyMasterYiAttackAudio } from './masteryi-aa-lazy';
import { LazyMasterYiHighlanderAudio } from './masteryi-r-lazy';
import { LazyMasterYiAlphaAudio } from './masteryi-q-lazy';
import { LazyGarenBasicAttackAudio } from './garen-aa-lazy';
import { LazyGarenPerseveranceAudio } from './garen-p-lazy';
import { LuxSingularityAudio } from './lux-e';
import { luxEAudioStates } from './lux-e-state';
import { LuxBindingFlightAudio } from './lux-binding-flight';
import { LazyGarenJusticeAudio } from './garen-r-lazy';
import { LazyGarenCourageAudio } from './garen-w-lazy';
import { LazyLeonaEclipseAudio } from './leona-w-lazy';
import { LazyLeonaZenithAudio } from './leona-e-lazy';
import { LazyLeonaSolarAudio } from './leona-r-lazy';
import { LazyLeonaDaybreakAudio } from './leona-q-lazy';
import { LazyLeonaBasicAttackAudio } from './leona-aa-lazy';
import { LazyLeonaSunlightAudio } from './leona-sunlight-lazy';
import { LazyLeonaDeathAudio } from './leona-death-lazy';
import { LazyOracleAudio } from './oracle-lazy';
import { LazyGarenDecisiveStrikeAudio } from './garen-q-lazy';
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

/** Source Hawkshot, Light Binding, Illumination, Garen and Leona SFX.
 * Other cues retain synthesized feedback. */
export class GameAudio {
  context: AudioContext | null = null;
  luxE = new LuxSingularityAudio();
  private luxEWorld?: World;
  private luxETerminalStart = 0;
  private luxETerminal = false;
  bindingFlight = new LuxBindingFlightAudio();
  garenAA = new LazyGarenBasicAttackAudio();
  masterYiAA = new LazyMasterYiAttackAudio();
  masterYiW = new LazyMasterYiMeditateAudio();
  masterYiR = new LazyMasterYiHighlanderAudio();
  masterYiQ = new LazyMasterYiAlphaAudio();
  garenP = new LazyGarenPerseveranceAudio();
  private garenPTerminalWorld?: World;
  private garenPTerminalStart = 0;
  garenE = new GarenJudgmentAudio();
  garenR = new LazyGarenJusticeAudio();
  garenW = new LazyGarenCourageAudio();
  leonaW = new LazyLeonaEclipseAudio();
  leonaE = new LazyLeonaZenithAudio();
  leonaR = new LazyLeonaSolarAudio();
  leonaQ = new LazyLeonaDaybreakAudio();
  leonaAA = new LazyLeonaBasicAttackAudio();
  leonaSunlight = new LazyLeonaSunlightAudio();
  leonaDeath = new LazyLeonaDeathAudio();
  private leonaTerminalWorld?: World;
  private leonaTerminalStart = 0;
  garenQ = new LazyGarenDecisiveStrikeAudio();
  oracle = new LazyOracleAudio();
  private oracleTerminalWorld?: World;
  private oracleTerminalStart = 0;
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
  async load(garenPresent = false, masterYiPresent = false): Promise<void> {
    await Promise.all([
      this.loadCast(),
      this.loadArrival(),
      this.loadLinger(),
      this.loadFlight(),
      this.loadIllumination(),
      this.loadBindingCast(),
      this.bindingFlight.load(),
      this.luxE.load(),
      ...(masterYiPresent
        ? [
            this.masterYiAA.load(),
            this.masterYiR.load(),
            this.masterYiQ.load(),
            this.masterYiW.load(),
          ]
        : []),
      ...(garenPresent
        ? [
            this.garenAA.load(),
            this.garenP.load(),
            this.garenQ.load(),
            this.garenW.load(),
            this.garenE.load(),
            this.garenR.load(),
          ]
        : []),
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
    this.luxE.stop();
    this.garenAA.stop();
    this.masterYiAA.stop();
    this.masterYiR.stop();
    this.masterYiW.stop();
    this.masterYiQ.stop();
    this.garenP.stop();
    this.garenE.stop();
    this.garenR.stop();
    this.garenW.stop();
    this.leonaW.stop();
    this.leonaE.stop();
    this.leonaR.stop();
    this.leonaQ.stop();
    this.leonaAA.stop();
    this.leonaSunlight.stop();
    this.leonaDeath.stop();
    this.garenQ.stop();
    this.oracle.stop();
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
  updateLuxE(world: World, listener = { x: 0, y: 0 }) {
    if (this.luxEWorld !== world) {
      this.luxE.reset();
      this.luxEWorld = world;
      this.luxETerminal = false;
    }
    let tick = world.tick;
    if (world.winner && this.context) {
      if (!this.luxETerminal) {
        this.luxETerminalStart = this.context.currentTime;
        this.luxETerminal = true;
      }
      tick += Math.max(0, this.context.currentTime - this.luxETerminalStart) * 60;
    }
    const records = world.luxEAudio.records;
    const allied = new Set(
      records.filter((r) => r.team === world.hero.team).map((r) => `${r.sourceId}:${r.startTick}`)
    );
    const states = luxEAudioStates(records, tick).filter(
      (s) =>
        allied.has(s.key.slice(0, s.key.lastIndexOf(':'))) || world.pointVisible(s, world.hero.team)
    );
    this.luxE.update(this.context, this.enabled && !this.paused, records, states, listener);
  }
  updateOracle(world: World, listener = { x: 0, y: 0 }) {
    const records = world.units.flatMap((u) => {
      const s = world.championState(u.id)?.trinket;
      if (!s) return [];
      if ((s.kind === 'oracle' || s.visuals.length) && this.oracle.status === 'idle')
        void this.oracle.load();
      return s.visuals.map((r) => ({
        ...r,
        id: u.id,
        x: u.x,
        y: u.y,
        visible: u.team === world.hero.team || world.visible(u, world.hero.team),
        endVisible:
          u.team === world.hero.team ||
          world.pointVisible(r.childAnchor?.point ?? u, world.hero.team),
      }));
    });
    // Continue the result's audio tail without mutating the frozen checkpoint.
    // AudioContext time pauses with menus/hidden tabs, independently of rendering.
    let tick = world.tick;
    if (!world.winner) this.oracleTerminalWorld = undefined;
    else if (this.context) {
      if (this.oracleTerminalWorld !== world) {
        this.oracleTerminalWorld = world;
        this.oracleTerminalStart = this.context.currentTime;
      }
      tick += Math.max(0, this.context.currentTime - this.oracleTerminalStart) * 60;
    }
    this.oracle.update(this.context, this.enabled && !this.paused, records, tick, listener);
  }
  updateLeona(world: World, listener = { x: 0, y: 0 }) {
    const leonas = world.units.filter((u) => u.champion === 'leona');
    if (leonas.length && this.leonaW.status === 'idle') void this.leonaW.load();
    if (leonas.length && this.leonaE.status === 'idle') void this.leonaE.load();
    if (leonas.length && this.leonaR.status === 'idle') void this.leonaR.load();
    if (leonas.length && this.leonaQ.status === 'idle') void this.leonaQ.load();
    if (leonas.length && this.leonaAA.status === 'idle') void this.leonaAA.load();
    if (leonas.length && this.leonaSunlight.status === 'idle') void this.leonaSunlight.load();
    if (leonas.length && this.leonaDeath.status === 'idle') void this.leonaDeath.load();
    const team = world.hero.team;
    const records = leonas.flatMap((u) =>
      world.championState(u.id)!.leonaWVisuals.map((r) => ({
        ...r,
        id: u.id,
        castVisible:
          r.frames[0].audience.includes(team) && world.pointVisible(r.frames.at(-1)!, team),
        burstVisible:
          !!r.detonation?.audience.includes(team) && world.pointVisible(r.detonation!.point, team),
      }))
    );
    // Continue finite result sounds on the audio clock without changing saved ticks.
    let tick = world.tick;
    if (!world.winner) this.leonaTerminalWorld = undefined;
    else if (this.context) {
      if (this.leonaTerminalWorld !== world) {
        this.leonaTerminalWorld = world;
        this.leonaTerminalStart = this.context.currentTime;
      }
      tick += Math.max(0, this.context.currentTime - this.leonaTerminalStart) * 60;
    }
    this.leonaW.update(this.context, this.enabled && !this.paused, records, tick, listener);
    this.leonaDeath.update(
      this.context,
      this.enabled && !this.paused,
      leonas.flatMap((u) =>
        world.championState(u.id)!.leonaDeathVisuals.map((r) => ({ ...r, id: u.id }))
      ),
      tick,
      listener,
      team
    );
    this.leonaSunlight.update(
      this.context,
      this.enabled && !this.paused,
      world.sunlightVisuals,
      tick,
      listener,
      (point) => world.pointVisible(point, team),
      team
    );
    this.leonaAA.update(
      this.context,
      this.enabled && !this.paused,
      leonas.flatMap((u) =>
        world.championState(u.id)!.leonaAAVisuals.map((r) => ({ ...r, id: u.id }))
      ),
      tick,
      listener,
      (point) => world.pointVisible(point, team),
      team
    );
    this.leonaQ.update(
      this.context,
      this.enabled && !this.paused,
      leonas.flatMap((u) =>
        world.championState(u.id)!.leonaQVisuals.map((r) => ({ ...r, id: u.id }))
      ),
      tick,
      listener,
      (point) => world.pointVisible(point, team),
      team
    );
    this.leonaE.update(
      this.context,
      this.enabled && !this.paused,
      leonas.flatMap((u) =>
        world.championState(u.id)!.leonaEVisuals.map((r) => ({ ...r, id: u.id }))
      ),
      tick,
      listener,
      (point) => world.pointVisible(point, team),
      team
    );
    this.leonaR.update(
      this.context,
      this.enabled && !this.paused,
      leonas.flatMap((u) =>
        world.championState(u.id)!.leonaRVisuals.map((r) => ({ ...r, id: u.id }))
      ),
      tick,
      listener,
      (point) => world.pointVisible(point, team),
      team
    );
  }
  updateGaren(world: World, listener = { x: 0, y: 0 }) {
    const garens = world.units.filter((u) => u.champion === 'garen');
    if (garens.length && this.garenP.status === 'idle') void this.garenP.load();
    const recovery = garens.flatMap((u) =>
      world.championState(u.id)!.garenPassiveVisuals.map((r) => {
        const at = r.point ?? u;
        return {
          ...r,
          id: u.id,
          x: at.x,
          y: at.y,
          visible:
            u.team === world.hero.team ||
            (world.visible(u, world.hero.team) && world.pointVisible(at, world.hero.team)),
        };
      })
    );
    let recoveryTick = world.tick;
    if (!world.winner) this.garenPTerminalWorld = undefined;
    else if (this.context) {
      if (this.garenPTerminalWorld !== world) {
        this.garenPTerminalWorld = world;
        this.garenPTerminalStart = this.context.currentTime;
      }
      recoveryTick += Math.max(0, this.context.currentTime - this.garenPTerminalStart) * 60;
    }
    const yiUnits = world.units.filter((u) => u.champion === 'masteryi');
    if (yiUnits.length && this.masterYiAA.status === 'idle') void this.masterYiAA.load();
    if (yiUnits.length && this.masterYiW.status === 'idle') void this.masterYiW.load();
    if (yiUnits.length && this.masterYiR.status === 'idle') void this.masterYiR.load();
    if (yiUnits.length && this.masterYiQ.status === 'idle') void this.masterYiQ.load();
    this.masterYiQ.update(
      this.context,
      this.enabled && !this.paused,
      yiUnits.flatMap((u) =>
        world.championState(u.id)!.alphaAudio.map((r) => ({
          ...r,
          id: u.id,
          castVisible: r.castAudience.includes(world.hero.team),
          contacts: r.contacts.map((contact) => ({
            ...contact,
            visible: contact.audience.includes(world.hero.team),
          })),
        }))
      ),
      recoveryTick,
      listener
    );
    const yiAttacks = yiUnits.flatMap((u) =>
      world.championState(u.id)!.masterYiAAAudio.map((r) => ({
        ...r,
        id: u.id,
        x: u.x,
        y: u.y,
        castVisible:
          r.castAudience.includes(world.hero.team) &&
          (u.team === world.hero.team || world.visible(u, world.hero.team)),
        hitVisible: r.impact?.audience.includes(world.hero.team) ?? false,
      }))
    );
    this.masterYiAA.update(
      this.context,
      this.enabled && !this.paused,
      yiAttacks,
      recoveryTick,
      listener
    );
    this.masterYiR.update(
      this.context,
      this.enabled && !this.paused,
      yiUnits.flatMap((u) =>
        world.championState(u.id)!.highlanderAudio.map((r) => ({
          ...r,
          id: u.id,
          x: u.x,
          y: u.y,
          castVisible:
            r.castAudience.includes(world.hero.team) &&
            (u.team === world.hero.team || world.visible(u, world.hero.team)),
          stopVisible: r.stop?.audience.includes(world.hero.team) ?? false,
        }))
      ),
      recoveryTick,
      listener
    );
    this.masterYiW.update(
      this.context,
      this.enabled && !this.paused,
      yiUnits.flatMap((u) =>
        world.championState(u.id)!.meditateAudio.map((r) => ({
          ...r,
          id: u.id,
          x: u.x,
          y: u.y,
          castVisible:
            r.castAudience.includes(world.hero.team) &&
            (u.team === world.hero.team || world.visible(u, world.hero.team)),
          stopVisible: r.stop?.audience.includes(world.hero.team) ?? false,
        }))
      ),
      recoveryTick,
      listener
    );
    if (garens.length && this.garenAA.status === 'idle') void this.garenAA.load();
    const attacks = garens.flatMap((u) =>
      world.championState(u.id)!.garenAAVisuals.map((r) => ({
        ...r,
        id: u.id,
        x: u.x,
        y: u.y,
        castVisible:
          r.castAudience.includes(world.hero.team) &&
          (u.team === world.hero.team || world.visible(u, world.hero.team)),
        hitVisible: r.impact?.audience.includes(world.hero.team) ?? false,
      }))
    );
    this.garenAA.update(
      this.context,
      this.enabled && !this.paused,
      attacks,
      recoveryTick,
      listener
    );
    this.garenP.update(
      this.context,
      this.enabled && !this.paused,
      recovery,
      recoveryTick,
      listener
    );
    if (garens.length && this.garenQ.status === 'idle') void this.garenQ.load();
    const decisive = garens.flatMap((u) =>
      world.championState(u.id)!.garenQVisuals.map((r) => ({
        ...r,
        id: u.id,
        x: u.x,
        y: u.y,
        visible: u.team === 'blue' || world.visible(u),
      }))
    );
    this.garenQ.update(this.context, this.enabled && !this.paused, decisive, world.tick, listener);
    if (garens.length && this.garenE.status === 'idle') void this.garenE.load();
    if (garens.length && this.garenR.status === 'idle') void this.garenR.load();
    if (garens.length && this.garenW.status === 'idle') void this.garenW.load();
    const courage = garens.flatMap((u) => {
      const effect = world.championState(u.id)?.garenWVisual;
      return effect
        ? [{ ...effect, id: u.id, x: u.x, y: u.y, visible: u.team === 'blue' || world.visible(u) }]
        : [];
    });
    this.garenW.update(this.context, this.enabled && !this.paused, courage, world.tick, listener);
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
    const justice = garens.flatMap((u) => {
      const effect = world.championState(u.id)?.garenRVisual;
      return effect
        ? [
            {
              ...effect,
              id: u.id,
              x: u.x,
              y: u.y,
              castVisible: world.visible(u),
              // R reveals its opposing champion through release: caster and recipient
              // teams both observe the hit. Retain that audience after death/fog.
              impactVisible: effect.releaseTick !== null,
            },
          ]
        : [];
    });
    this.garenR.update(this.context, this.enabled && !this.paused, justice, world.tick, listener);
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
        if (event.type === 'attack') {
          if (
            event.leonaQStartTick !== undefined &&
            event.leonaQAttackStartTick !== undefined &&
            event.unit !== undefined
          ) {
            if (this.leonaQ.status !== 'ready') {
              this.leonaQ.suppressAttack(
                event.unit,
                event.leonaQStartTick,
                event.leonaQAttackStartTick
              );
              this.tone(650, 260, 0.065, 0.012, 'triangle');
            }
          } else if (event.leonaAAStartTick !== undefined && event.unit !== undefined) {
            if (this.leonaAA.status !== 'ready') {
              this.leonaAA.suppressSwing(event.unit, event.leonaAAStartTick);
              this.tone(650, 260, 0.065, 0.012, 'triangle');
            }
          } else if (event.masterYiAAStartTick !== undefined && event.unit !== undefined) {
            if (this.masterYiAA.status !== 'ready') {
              this.masterYiAA.suppressSwing(event.unit, event.masterYiAAStartTick);
              this.tone(650, 260, 0.065, 0.012, 'triangle');
            }
          } else if (event.garenAAStartTick !== undefined && event.unit !== undefined) {
            if (this.garenAA.status !== 'ready') {
              this.garenAA.suppressSwing(event.unit, event.garenAAStartTick);
              this.tone(650, 260, 0.065, 0.012, 'triangle');
            }
          } else if (
            event.champion !== 'garen' ||
            event.garenQStartTick === undefined ||
            this.garenQ.status !== 'ready'
          ) {
            if (event.garenQStartTick !== undefined && event.unit !== undefined)
              this.garenQ.suppressAttack(event.unit, event.garenQStartTick);
            this.tone(650, 260, 0.065, 0.012, 'triangle');
          }
        }
        if (event.type === 'cast') {
          if (
            event.text === 'q' &&
            event.champion === 'masteryi' &&
            this.masterYiQ.status === 'ready'
          ) {
            // Saved accepted Q cast/contact histories own the declared source cues.
          } else if (
            event.text === 'w' &&
            event.champion === 'masteryi' &&
            this.masterYiW.status === 'ready'
          ) {
            // Saved Meditate cast/ending histories own the finite source cues.
          } else if (
            event.text === 'r' &&
            event.champion === 'masteryi' &&
            this.masterYiR.status === 'ready'
          ) {
            // Saved Highlander onset/expiry histories own the two finite source cues.
          } else if (
            event.text === 'q' &&
            event.champion === 'leona' &&
            this.leonaQ.status === 'ready'
          ) {
            // Saved Daybreak activation, attack attempts, contact and stop own Q audio.
          } else if (
            event.text === 'w' &&
            event.champion === 'leona' &&
            this.leonaW.status === 'ready'
          ) {
            // Saved Eclipse histories own all five finite source phases.
          } else if (
            event.text === 'e' &&
            event.champion === 'leona' &&
            this.leonaE.status === 'ready'
          ) {
            // Saved Zenith phase histories own the six finite source SFX roles.
          } else if (
            event.text === 'r' &&
            event.champion === 'leona' &&
            this.leonaR.status === 'ready'
          ) {
            // Saved Solar Flare facts own the three finite source SFX roles.
          } else if (
            event.text === 'e' &&
            event.champion === 'lux' &&
            this.luxE.status === 'ready'
          ) {
            // Saved E dispatch history owns the finite source layers.
          } else if (
            event.text === 'q' &&
            event.champion === 'garen' &&
            this.garenQ.status === 'ready'
          ) {
            // Saved Q activation/commitment history owns all five source actions.
          } else if (
            event.text === 'w' &&
            event.champion === 'garen' &&
            this.garenW.status === 'ready'
          ) {
            // Saved Courage history owns cast, authored loop and ending phases.
          } else if (
            event.text === 'r' &&
            event.champion === 'garen' &&
            this.garenR.status === 'ready'
          ) {
            // Saved release history owns the source cast/hit/kill one-shots.
          } else if (
            event.text === 'e' &&
            event.champion === 'garen' &&
            this.garenE.status === 'ready'
          ) {
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
          else {
            if (event.text === 'q' && event.champion === 'masteryi' && event.unit !== undefined)
              this.masterYiQ.suppressCast(event.unit, event.tick);
            if (event.text === 'w' && event.champion === 'masteryi' && event.unit !== undefined)
              this.masterYiW.suppressCast(event.unit, event.tick);
            if (event.text === 'r' && event.champion === 'masteryi' && event.unit !== undefined)
              this.masterYiR.suppressCast(event.unit, event.tick);
            if (event.text === 'q' && event.champion === 'leona' && event.unit !== undefined)
              this.leonaQ.suppressCast(event.unit, event.tick);
            if (event.text === 'w' && event.champion === 'leona' && event.unit !== undefined)
              this.leonaW.suppressCast(event.unit, event.tick);
            if (event.text === 'e' && event.champion === 'leona' && event.unit !== undefined)
              this.leonaE.suppressCast(event.unit, event.tick);
            if (event.text === 'r' && event.champion === 'leona' && event.unit !== undefined)
              this.leonaR.suppressCast(event.unit, event.tick);
            if (event.text === 'e' && event.champion === 'lux' && event.unit !== undefined)
              this.luxE.suppressCast(event.unit, event.tick);
            if (event.text === 'q' && event.champion === 'garen' && event.unit !== undefined)
              this.garenQ.suppressCast(event.unit, event.tick);
            if (event.text === 'r' && event.champion === 'garen' && event.unit !== undefined)
              this.garenR.suppressCast(event.unit, event.tick);
            if (event.text === 'w' && event.champion === 'garen' && event.unit !== undefined)
              this.garenW.suppressCast(event.unit, event.tick);
            this.tone(event.text === 'r' ? 180 : 480, 1000, 0.2, 0.025, 'sine');
          }
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
