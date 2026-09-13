import type { SimEvent } from '../simulation/types';

/** Temporary synthesized feedback. Replace event voices through the asset manifest. */
export class GameAudio {
  context: AudioContext | null = null;
  enabled = true;
  private lastId = 0;
  unlock(): void {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }
  update(events: SimEvent[]): void {
    for (const event of events)
      if (event.id > this.lastId) {
        this.lastId = event.id;
        if (!this.enabled || !this.context || this.context.state !== 'running') continue;
        if (event.type === 'attack') this.tone(650, 260, 0.065, 0.012, 'triangle');
        if (event.type === 'cast')
          this.tone(event.text === 'r' ? 180 : 480, 1000, 0.2, 0.025, 'sine');
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
    oscillator.start(t);
    oscillator.stop(t + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
