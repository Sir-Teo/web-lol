import { expect, test } from 'vitest';
import data from '../src/content/ahri-r-particles.json';
import { rPaletteBinding, AHRI_R_PALETTE_POLICY } from '../src/render/ahri-r-palette';
const native = data.profiles.find((p) => p.system === 'Ahri_R_mis_02' && p.name === 'Ribbon_1')!;
test('R palette binder reads the exact native constant and preserves explicit local omissions', () => {
  const before = JSON.stringify(native),
    binding = rPaletteBinding(native)!;
  expect(binding).toMatchObject({
    texture: 'assets/effects/ahri-r-c9eea0dcd2a24e6e.png',
    sourceMix: [0.9499961733818054, 0, 0, 0],
    count: 1,
    row: 0.5,
    countOmitted: true,
    selectorOmitted: true,
    nativeConstructorVerified: false,
  });
  expect(AHRI_R_PALETTE_POLICY.spelling).toBe('palleteSrcMixColor');
  expect(JSON.stringify(native)).toBe(before);
  binding.sourceMix[0] = 0;
  expect(rPaletteBinding(native)!.sourceMix[0]).toBe(0.9499961733818054);
});
test('R palette binder does not infer palette bindings for other profiles', () => {
  const bound = data.profiles.filter((p) => rPaletteBinding(p) !== null);
  expect(bound).toHaveLength(1);
  expect(bound[0]).toBe(native);
});
test('R palette binder rejects wrong classes, dynamic values, unknown fields and missing texture', () => {
  for (const change of [
    (p: any) => {
      p.palette.selector.values = [[1, 0, 0]];
    },
    (p: any) => {
      p.palette.selector.times = [];
    },
    (p: any) => {
      p.palette.unresolvedFields['{143f06d1}'].__type = 'ValueVector4';
    },
    (p: any) => {
      p.palette.unresolvedFields['{143f06d1}'].constantValue = [1, 0, 0];
    },
    (p: any) => {
      p.palette.unresolvedFields['{143f06d1}'].constantValue = [Infinity, 0, 0, 0];
    },
    (p: any) => {
      p.palette.unresolvedFields['{143f06d1}'].dynamics = {};
    },
    (p: any) => {
      p.palette.unresolvedFields.extra = {};
    },
    (p: any) => {
      p.palette.texture = null;
    },
    (p: any) => {
      p.palette.sourceMix = [1, 0, 0, 0];
    },
    (p: any) => {
      p.palette.selector.sourceType = 'ValueVector3';
    },
    (p: any) => {
      p.palette.count = 0;
    },
    (p: any) => {
      p.palette.count = 0.5;
    },
  ]) {
    const changed = structuredClone(native);
    change(changed);
    expect(() => rPaletteBinding(changed)).toThrow();
  }
});
test('an explicit positive palette count remains authored rather than converted to the fallback', () => {
  const changed = structuredClone(native);
  changed.palette!.count = 4;
  expect(rPaletteBinding(changed)).toMatchObject({ count: 4, row: 0.125, countOmitted: false });
});
