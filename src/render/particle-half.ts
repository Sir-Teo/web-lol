const float = new Float32Array(1),
  bits = new Uint32Array(float.buffer);

/** Float32 vertex input rounded to IEEE binary16, ties to even. This is the
 * explicit local quad-packet rounding policy; live native FPCR is unobserved. */
export function particleHalf(value: number): number {
  float[0] = value;
  const word = bits[0],
    sign = word >>> 31 ? -1 : 1,
    exponent = (word >>> 23) & 255,
    mantissa = word & 0x7fffff;
  if (exponent === 255) return float[0];
  if (exponent < 102) return sign * 0;
  if (exponent > 142) return sign * Infinity;
  const shift = exponent < 113 ? 126 - exponent : 13,
    significand = mantissa | 0x800000,
    whole = significand >>> shift,
    remainder = significand - whole * 2 ** shift,
    halfway = 2 ** (shift - 1),
    rounded = whole + Number(remainder > halfway || (remainder === halfway && (whole & 1) !== 0)),
    result = rounded * (exponent < 113 ? 2 ** -24 : 2 ** (exponent - 137));
  return sign * (result > 65504 ? Infinity : result);
}
