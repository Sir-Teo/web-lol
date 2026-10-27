import { particleUnorm8 } from './particle-unorm8';

/** Write the native Ray color word into an owned normalized BGRA stream.
 * Mode0/2 premultiplies float32 RGB and replaces A with1 before conversion.
 * The source tuple is borrowed; first/count address vertices, not bytes. */
export function writeRayColor(
  bytes: Uint8Array,
  first: number,
  count: number,
  color: readonly number[],
  blend: number
): void {
  const alpha = Math.fround(color[3]),
    premultiply = blend === 0 || blend === 2,
    r = Math.round(
      particleUnorm8(premultiply ? Math.fround(Math.fround(color[0]) * alpha) : color[0]) * 255
    ),
    g = Math.round(
      particleUnorm8(premultiply ? Math.fround(Math.fround(color[1]) * alpha) : color[1]) * 255
    ),
    b = Math.round(
      particleUnorm8(premultiply ? Math.fround(Math.fround(color[2]) * alpha) : color[2]) * 255
    ),
    a = Math.round(particleUnorm8(premultiply ? 1 : alpha) * 255);
  for (let vertex = first; vertex < first + count; vertex++) {
    const offset = vertex * 4;
    bytes[offset] = b;
    bytes[offset + 1] = g;
    bytes[offset + 2] = r;
    bytes[offset + 3] = a;
  }
}
