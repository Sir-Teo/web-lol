/** Original Troy group types select the legacy CameraQuad path only for these
 * three Gromp billboards. Simple flash, plane, mesh and Rays stay separate. */
export function isGrompLegacyBillboard(profileIndex: number): boolean {
  return profileIndex === 1 || profileIndex === 2 || profileIndex === 3;
}

/** Native truncating CameraQuad BGRA, scoped to the finite unit colors and
 * unpremultiplied modes 4/1/1 of the three checked Gromp profiles. Color is
 * borrowed; first/count address vertices, not bytes. No clamping/rounding. */
export function writeGrompBillboardColor(
  bytes: Uint8Array,
  first: number,
  count: number,
  color: readonly number[]
): void {
  if (
    color.length !== 4 ||
    color.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  )
    throw new RangeError('Gromp billboard packing requires a finite unit RGBA color');
  const r = Math.trunc(Math.fround(Math.fround(color[0]) * 255)),
    g = Math.trunc(Math.fround(Math.fround(color[1]) * 255)),
    b = Math.trunc(Math.fround(Math.fround(color[2]) * 255)),
    a = Math.trunc(Math.fround(Math.fround(color[3]) * 255));
  for (let vertex = first; vertex < first + count; vertex++) {
    const offset = vertex * 4;
    bytes[offset] = b;
    bytes[offset + 1] = g;
    bytes[offset + 2] = r;
    bytes[offset + 3] = a;
  }
}
