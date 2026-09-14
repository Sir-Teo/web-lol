export interface ParticleColorLookupProfile {
  lookupTypes: readonly number[];
  lookupScales: readonly number[];
  lookupOffsets: readonly number[];
}
/** Source lookup coordinates before shader clamping. Birth random is fixed for the
 * particle; travel is its measured source-unit velocity, not its initial velocity.
 * Inputs retain the caller's precision; GPU attributes apply float32 conversion. */
export function particleColorLookup(
  profile: ParticleColorLookupProfile,
  phase: number,
  birthRandom: number,
  travel: readonly number[] = [0, 0, 0]
): [number, number] {
  const axis = (index: number) => {
    const scale = profile.lookupScales[index],
      offset = profile.lookupOffsets[index];
    switch (profile.lookupTypes[index]) {
      case 0:
        return scale; // Constant ignores offset in the pinned reader.
      case 1:
        return scale * phase + offset;
      case 2:
        return scale * Math.hypot(travel[0], travel[1], travel[2]) + offset;
      case 3:
        return scale * birthRandom + offset;
      default:
        throw new RangeError('Unsupported particle color lookup selector');
    }
  };
  return [axis(0), axis(1)];
}
