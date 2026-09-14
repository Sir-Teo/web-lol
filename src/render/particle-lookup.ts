/** ParticleSystem::COLOR_LOOKUP_TYPE, from the pinned renderer research.
 * Coordinates stay unbounded here: the texture sampler applies addressing.
 * Velocity is actual travel per second in source units, not stored velocity.
 */
export interface ParticleLookupAxis {
  readonly type: 0 | 1 | 2 | 3;
  readonly scale: number;
  readonly offset: number;
}
export interface ParticleLookupState {
  readonly age01: number;
  readonly travelPerSecond: readonly [number, number, number];
  readonly birthRandom: number;
}
export function particleLookupCoordinate(
  axis: ParticleLookupAxis,
  state: ParticleLookupState
): number {
  if (axis.type === 0) return axis.scale;
  const drive =
    axis.type === 1
      ? state.age01
      : axis.type === 2
        ? Math.hypot(...state.travelPerSecond)
        : state.birthRandom;
  return axis.scale * drive + axis.offset;
}
