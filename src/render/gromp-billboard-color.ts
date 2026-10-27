/** Original Troy group types select the legacy CameraQuad path only for these
 * three Gromp billboards. Simple flash, plane, mesh and Rays stay separate. */
export function isGrompLegacyBillboard(profileIndex: number): boolean {
  return profileIndex === 1 || profileIndex === 2 || profileIndex === 3;
}

export { writeLegacyUnitBgra as writeGrompBillboardColor } from './legacy-unit-color';
