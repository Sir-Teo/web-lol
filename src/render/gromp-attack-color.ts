import { writeLegacyUnitBgra } from './legacy-unit-color';

/** The four checked Complex missile emitters use truncating CameraQuad/plane
 * packets. Source modes 0/2 premultiply float32 RGB and replace alpha with one. */
export function writeGrompAttackColor(
  bytes: Uint8Array,
  first: number,
  count: number,
  color: readonly number[],
  blend: number
): void {
  if (blend !== 0 && blend !== 2 && blend !== 4)
    throw new RangeError('Gromp missile color requires its audited source mode');
  const alpha = Math.fround(color[3]),
    packed =
      blend === 0 || blend === 2
        ? [
            Math.fround(Math.fround(color[0]) * alpha),
            Math.fround(Math.fround(color[1]) * alpha),
            Math.fround(Math.fround(color[2]) * alpha),
            1,
          ]
        : color;
  writeLegacyUnitBgra(bytes, first, count, packed);
}
