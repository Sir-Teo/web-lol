/** Native ray's finite float32 color path, represented as a normalized byte.
 * Keep this separate from the fast quad packer's truncation policy. */
export function particleUnorm8(value: number): number {
  const component = Math.fround(value);
  if (component <= 0) return 0;
  if (component >= 1) return 1;
  // Float32 x 255 is exact in double; one final float32 rounding preserves
  // the native FMA before unsigned truncation at every byte boundary.
  return Math.trunc(Math.fround(component * 255 + 0.5)) / 255;
}
