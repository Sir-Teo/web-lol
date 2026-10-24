import { sampleParticleCurve, accumulateParticleCurve } from './particle-curves';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';

export interface EclipseValue {
  constant: readonly number[];
  times: readonly number[];
  values: readonly (readonly number[])[];
  probabilities: readonly { times: readonly number[]; values: readonly number[]; single: number }[];
}

export function eclipseValue(v: EclipseValue, phase: number, chance?: number): number[] {
  const sample = v.values[0].map((_x, i) => sampleParticleCurve(v, phase, i));
  return chance === undefined
    ? sample
    : luxBeamBirthOffset({ value: sample, probabilities: v.probabilities }, chance);
}

export function eclipsePeak(v: EclipseValue): number {
  const peak = Math.max(...v.values.map((r) => r[0]));
  if (peak < 0) return Infinity; // Explicit local phase-owned interpretation.
  const p = v.probabilities[0];
  return peak * (p ? Math.max(...p.values, p.single) : 1);
}

export interface EclipseUvLayer {
  scale: EclipseValue;
  offset: EclipseValue;
  birthScroll: EclipseValue;
  scroll: EclipseValue;
  clamp: boolean;
  address: number;
  divisions: readonly number[];
  frames: number;
  randomStart: boolean;
}

/** Fixed-grid integrated scroll with independent layer samplers. Native UV basis,
 * CPU update cadence and source-to-shader routing remain separate acceptance. */
export function eclipseUv(
  layer: EclipseUvLayer,
  age: number,
  life: number,
  birthPhase: number,
  phase: number,
  chance: number,
  roll: number
) {
  const offset = eclipseValue(layer.offset, birthPhase, chance),
    scroll = eclipseValue(layer.birthScroll, birthPhase, chance);
  for (let i = 0; i < 2; i++) {
    const ramp = offset[i] + age * scroll[i];
    const bounded = layer.clamp ? Math.max(-1, Math.min(1, ramp)) : ramp - Math.floor(ramp);
    const integrated =
      layer.scroll.times.length === 1
        ? layer.scroll.values[0][i] * age
        : accumulateParticleCurve(layer.scroll, age, life, i);
    const period = layer.address === 0 ? 1 : layer.address === 1 ? 2 : 0;
    offset[i] = bounded + integrated;
    if (period) offset[i] = ((offset[i] % period) + period) % period;
  }
  const columns = Math.max(1, Math.round(layer.divisions[0])),
    rows = Math.max(1, Math.round(layer.divisions[1]));
  const cell = layer.randomStart ? Math.floor(roll * layer.frames) % (columns * rows) : 0;
  return {
    scale: eclipseValue(layer.scale, phase),
    offset,
    cell: [(cell % columns) / columns, Math.floor(cell / columns) / rows],
    cellSize: [1 / columns, 1 / rows],
    address: layer.address,
  };
}
