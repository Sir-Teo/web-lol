import { sourceParticleBasis } from './source-particle-spin';

/** Birth orbital channels are radians per second. The selected source reader
 * writes their age-scaled degree angles to float32 before building the basis. */
export function sourceParticleOrbit(velocity: ArrayLike<number>, age: number): Float32Array | null {
  if (
    velocity.length !== 3 ||
    !Array.from(velocity).every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v))) ||
    !Number.isFinite(age)
  )
    throw new RangeError('Invalid source particle orbit');
  const orbital = Float32Array.from(velocity);
  if (orbital.every((v) => v === 0)) return null;
  const degrees = Float32Array.from(orbital, (v) => v * age * (180 / Math.PI));
  return sourceParticleBasis(degrees);
}

export type SourceStretchGeometry =
  | 'billboard'
  | 'unit-billboard'
  | 'quad'
  | 'ray'
  | 'mesh'
  | 'trail'
  | 'beam'
  | 'projection'
  | 'segment-beam'
  | 'skin';
const geometries = new Set<SourceStretchGeometry>([
  'billboard',
  'unit-billboard',
  'quad',
  'ray',
  'mesh',
  'trail',
  'beam',
  'projection',
  'segment-beam',
  'skin',
]);
/** World travel speed stretches only camera and arbitrary quads. Zero disables
 * the control even when its minimum is nonzero; simple emitters read none. */
export function sourceParticleStretch(
  geometry: SourceStretchGeometry,
  travel: ArrayLike<number>,
  scale: number,
  minimum: number,
  simple = false
): number {
  if (
    !geometries.has(geometry) ||
    travel.length !== 3 ||
    !Array.from(travel).every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v))) ||
    ![scale, minimum].every(Number.isFinite) ||
    typeof simple !== 'boolean'
  )
    throw new RangeError('Invalid source particle stretch');
  if (scale === 0 || simple || !['billboard', 'unit-billboard', 'quad'].includes(geometry))
    return 1;
  return Math.max(minimum, Math.hypot(...Float32Array.from(travel)) * scale);
}
