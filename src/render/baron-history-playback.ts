import { BARON_ATTACK_PATH_FRAMES } from '../content/baron-attack-presentation';
import { TICK_RATE } from '../content/rules';
import { BaronAttackSystem, type BaronSystemOptions } from './baron-attack-system';
import type { BaronAttackProgram, BaronAttackRole } from './baron-attack-program';

export interface BaronPlaybackRoot {
  /** Source centimetres. The caller owns bone/height/orientation calibration. */
  origin: ArrayLike<number>;
  orientation: ArrayLike<number>;
  visible: boolean;
  stopped: boolean;
}
/** Reconstructs from complete saved roots. Whole ticks commit to the cache;
 * fractional draws use a separate scratch system and never advance that cache.
 * Hidden emissions still consume source RNG, but never gain birth visibility
 * from a later reveal. No World, gameplay RNG or live skeleton is mutated. */
export class BaronHistoryPlayback {
  private readonly system: BaronAttackSystem;
  private readonly draft: BaronAttackSystem;
  private readonly initial;
  private completed = 0;
  private births = new Map<number, boolean>();
  constructor(
    program: BaronAttackProgram,
    role: BaronAttackRole,
    seed: number,
    readonly startTick: number,
    options: BaronSystemOptions
  ) {
    if (!Number.isSafeInteger(startTick) || startTick < 0)
      throw RangeError('Invalid Baron playback start');
    this.system = new BaronAttackSystem(program, role, seed, options);
    this.draft = new BaronAttackSystem(program, role, seed, options);
    this.initial = this.system.checkpoint();
  }
  get completedTicks() {
    return this.completed;
  }
  private track(system: BaronAttackSystem, births: Map<number, boolean>, visible: boolean) {
    const packets = system.packets(),
      live = new Set(packets.map((p) => p.serial));
    for (const packet of packets)
      if (!births.has(packet.serial)) births.set(packet.serial, visible);
    for (const serial of births.keys()) if (!live.has(serial)) births.delete(serial);
    return packets;
  }
  sample(tick: number, rootAt: (tick: number) => BaronPlaybackRoot) {
    if (!Number.isFinite(tick) || tick > this.startTick + BARON_ATTACK_PATH_FRAMES)
      throw RangeError('Invalid Baron playback clock');
    const age = tick - this.startTick,
      whole = Math.max(0, Math.floor(age));
    if (whole < this.completed) {
      this.system.restore(this.initial);
      this.completed = 0;
      this.births.clear();
    }
    const advance = (system: BaronAttackSystem, from: number, to: number) => {
      const previous = rootAt(from),
        current = rootAt(to);
      if (
        typeof current.visible !== 'boolean' ||
        typeof current.stopped !== 'boolean' ||
        previous.origin.length !== 3 ||
        !Array.from(previous.origin).every(Number.isFinite)
      )
        throw RangeError('Invalid Baron playback root');
      system.step({
        dt: (to - from) / TICK_RATE,
        origin: Array.from(current.origin),
        moved: Array.from(current.origin, (v, axis) => v - previous.origin[axis]),
        orientation: current.orientation,
        stopped: current.stopped,
      });
      return current.visible;
    };
    for (let step = this.completed + 1; step <= whole; step++) {
      const visible = advance(this.system, this.startTick + step - 1, this.startTick + step);
      this.track(this.system, this.births, visible);
      this.completed = step;
    }
    if (age <= 0) return { packets: [], bornVisible: new Set<number>() };
    const fraction = age - whole;
    if (fraction > 0) {
      this.draft.restore(this.system.checkpoint());
      const births = new Map(this.births),
        visible = advance(this.draft, this.startTick + whole, tick);
      const packets = this.track(this.draft, births, visible);
      return {
        packets,
        bornVisible: new Set(
          [...births].filter(([, visible]) => visible).map(([serial]) => serial)
        ),
      };
    }
    return {
      packets: this.system.packets(),
      bornVisible: new Set(
        [...this.births].filter(([, visible]) => visible).map(([serial]) => serial)
      ),
    };
  }
}
