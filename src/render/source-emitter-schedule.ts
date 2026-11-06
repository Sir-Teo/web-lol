import { sourceEmissionCount } from './source-emission-count';
import { sourceEmissionWindow, type SourceEmissionWindow } from './source-emission-window';
import { SourceValue, type SourceValueDefinition } from './source-value';

export interface SourceEmitterScheduleDefinition {
  rate: SourceValueDefinition;
  window: SourceEmissionWindow;
  variableStart: boolean;
  maxPerFrame: number;
  segmentLimit: number | null;
  rateScale: number;
}
export interface SourceEmitterScheduleState {
  now: number;
  lastSpawn: number;
  emitted: boolean;
  spawned: number;
}
/** An explicit-step scheduler, independent of rendering and gameplay RNG.
 * Caller gates disabled/absent emitters and supplies the chosen effects cadence.
 * `maxAccepted` models available pool slots; rejected pool births consume no
 * ordinal, while a positive planned count still advances the last-spawn clock. */
export class SourceEmitterSchedule {
  private readonly rate: SourceValue;
  private readonly rateHasProbability: boolean;
  private readonly definition: SourceEmitterScheduleDefinition;
  private state: SourceEmitterScheduleState;
  constructor(definition: SourceEmitterScheduleDefinition, state?: SourceEmitterScheduleState) {
    this.rate = new SourceValue(definition.rate);
    this.rateHasProbability = definition.rate.probabilities.length > 0;
    if (
      definition.rate.constant.length !== 1 ||
      !Number.isFinite(definition.rateScale) ||
      definition.rateScale < 0
    )
      throw RangeError('Invalid scalar source emission rate');
    sourceEmissionWindow(definition.window, 0);
    sourceEmissionCount({
      rate: 0,
      age: 0,
      lastSpawn: 0,
      emitted: false,
      singleParticle: false,
      variableStart: definition.variableStart,
      periodLength: null,
      maxPerFrame: definition.maxPerFrame,
      segmentLimit: definition.segmentLimit,
      spawned: 0,
    });
    this.definition = {
      ...definition,
      window: {
        ...definition.window,
        period: definition.window.period ? { ...definition.window.period } : null,
      },
    };
    this.state = state ? { ...state } : { now: 0, lastSpawn: 0, emitted: false, spawned: 0 };
    if (
      !Number.isFinite(this.state.now) ||
      this.state.now < 0 ||
      !Number.isFinite(this.state.lastSpawn) ||
      this.state.lastSpawn < 0 ||
      this.state.lastSpawn > this.state.now ||
      typeof this.state.emitted !== 'boolean' ||
      !Number.isSafeInteger(this.state.spawned) ||
      this.state.spawned < 0 ||
      this.state.spawned > 0xffff ||
      (!this.state.emitted && (this.state.lastSpawn !== 0 || this.state.spawned !== 0))
    )
      throw RangeError('Invalid source emitter schedule state');
  }
  snapshot(): SourceEmitterScheduleState {
    return { ...this.state };
  }
  step(
    input: { now: number; dt: number; stopped: boolean; maxAccepted?: number },
    draw: () => number
  ) {
    const { now, dt, stopped, maxAccepted } = input;
    if (
      !Number.isFinite(now) ||
      !Number.isFinite(dt) ||
      dt <= 0 ||
      now <= this.state.now ||
      Math.abs(now - this.state.now - dt) > 1e-9 * Math.max(1, now) ||
      typeof stopped !== 'boolean' ||
      (maxAccepted !== undefined && (!Number.isSafeInteger(maxAccepted) || maxAccepted < 0))
    )
      throw RangeError('Invalid source emitter step');
    const d = this.definition,
      window = sourceEmissionWindow(d.window, now);
    const births: { ordinal: number; time: number; share: number; phase: number }[] = [];
    if (
      (d.window.singleParticle && this.state.emitted) ||
      window.waiting ||
      window.ended ||
      !window.active ||
      (stopped && now > window.stopWait)
    ) {
      this.state.now = now;
      return births;
    }
    const chance = this.rateHasProbability ? draw() : 0;
    if (!Number.isFinite(chance) || chance < 0 || chance >= 1)
      throw RangeError('Invalid source rate draw');
    const rate = Math.max(this.rate.drawShared(window.phase, chance)[0] * d.rateScale, 0);
    const count = sourceEmissionCount({
      rate,
      age: now,
      lastSpawn: this.state.lastSpawn,
      emitted: this.state.emitted,
      singleParticle: d.window.singleParticle,
      variableStart: d.variableStart,
      periodLength: d.window.period?.length ?? null,
      maxPerFrame: d.maxPerFrame,
      segmentLimit: d.segmentLimit,
      spawned: this.state.spawned,
    });
    this.state.now = now;
    for (let i = 0; i < Math.min(count, maxAccepted ?? count); i++) {
      const share = (i + 1) / count;
      births.push({
        ordinal: this.state.spawned,
        time: now - dt * (1 - share),
        share,
        phase: window.phase,
      });
      this.state.spawned = (this.state.spawned + 1) & 0xffff;
    }
    if (count > 0) {
      this.state.emitted = true;
      this.state.lastSpawn = now;
    }
    return births;
  }
}
