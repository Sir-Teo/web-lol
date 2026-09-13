import { expect, test } from 'vitest';
import { arrowGlowColor } from '../src/render/ashe-arrow-glow';

for (const empowered of [false, true]) {
  test(`${empowered ? 'Q' : 'ordinary'} glow fades in and out without extending its source lifetime`, () => {
    expect(arrowGlowColor(empowered, 0, -1)).toEqual([0, 0, 0, 0]);
    expect(arrowGlowColor(empowered, 0, 0)[3]).toBe(0);
    expect(arrowGlowColor(empowered, 0, 0.1)[3]).toBeCloseTo(0.2399939);
    expect(arrowGlowColor(empowered, 0, 0.55)[3]).toBeCloseTo(0.11999695);
    expect(arrowGlowColor(empowered, 0, 1)).toEqual([0, 0, 0, 0]);
    expect(arrowGlowColor(empowered, 0, Infinity)).toEqual([0, 0, 0, 0]);
    expect(arrowGlowColor(empowered, 1, 0.1)[3]).toBeCloseTo(empowered ? 0.45882353 : 0.510002315);
  });
}
