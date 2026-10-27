/** The checked Complex group4/p-type1 route selects only Gromp shadow. */
export function isGrompLegacyPlane(profileIndex: number): boolean {
  return profileIndex === 4;
}

/** Source mode1 skips premultiplication; sampled unit RGBA is borrowed. */
export { writeLegacyUnitBgra as writeGrompPlaneColor } from './legacy-unit-color';
