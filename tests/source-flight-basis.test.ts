import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-flight-basis-samples.json';
import { sourceFlightBasis } from '../src/render/source-flight-basis';
for (const [index, sample] of samples.samples.entries())
  test(`source local-Y flight basis matches external bytes ${index}`, () => {
    const direction = [...sample.direction],
      out = sourceFlightBasis(direction);
    expect(Buffer.from(out.buffer).toString('hex')).toBe(sample.hex);
    expect(direction).toEqual(sample.direction);
    if (Math.hypot(...direction) > 0) {
      const length = Math.hypot(Math.hypot(direction[0], direction[2]), direction[1]);
      for (let axis = 0; axis < 3; axis++)
        expect(out[axis * 3 + 1]).toBe(Math.fround(direction[axis] / length));
    }
  });
test('source flight fixtures reproduce without importing app arithmetic', () => {
  execFileSync(process.execPath, ['tools/assets/export-flight-basis-samples.mjs', '--check'], {
    stdio: 'pipe',
  });
});
test('flight basis owns outputs and rejects nonfinite or overflowing directions', () => {
  const a = sourceFlightBasis([0, 0, 0]);
  a.fill(99);
  expect(sourceFlightBasis([0, 0, 0])[0]).toBe(-1);
  for (const value of [
    [1, 2],
    [NaN, 0, 0],
    [0, Infinity, 0],
    [Number.MAX_VALUE, Number.MAX_VALUE, 0],
  ])
    expect(() => sourceFlightBasis(value)).toThrow();
});
