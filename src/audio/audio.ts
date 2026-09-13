import { HAWKSHOT_ARRIVAL_AUDIO } from '../content/hawkshot-arrival-audio';
import { HAWKSHOT_CAST_AUDIO } from '../content/hawkshot-cast-audio';
import type { SimEvent } from '../simulation/types';

/** Source Hawkshot cast and arrival audio; other event cues remain synthesized. */
export class GameAudio {
  context: AudioContext | null = null;
  private audible = true;
  private paused = false;
  private lastId: number;
  private buffers: AudioBuffer[] = [];
  private bag: number[] = [];
  private arrivalBuffer: AudioBuffer | null = null;
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
  async load(): Promise<void> {
    await Promise.all([this.loadCast(), this.loadArrival()]);
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
        else if (context.state !== 'running') await context.resume();
      })
      .catch(() => {
        /* A later user gesture can retry a blocked resume. */
      });
  }
  private stopVoices(): void {
    for (const [voice, gain] of this.voices) {
      voice.stop();
      voice.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }
  private own(voice: AudioScheduledSourceNode, gain: GainNode): void {
    this.voices.set(voice, gain);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
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
    const age = Math.max(0, (tick - event.tick) / 60);
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
  unlock(): void {
    this.context ??= new AudioContext();
    this.syncContext();
  }
  update(events: SimEvent[], tick: number): void {
    for (const event of events)
      if (event.id > this.lastId) {
        this.lastId = event.id;
        if (!this.enabled || this.paused || !this.context || this.context.state !== 'running')
          continue;
        if (event.type === 'attack') this.tone(650, 260, 0.065, 0.012, 'triangle');
        if (event.type === 'cast') {
          if (event.text === 'e' && this.sourceStatus === 'ready') this.hawkshot(event, tick);
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
