import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-integrated-value-samples.json';
import { SourceIntegratedValue } from '../src/render/source-integrated-value';
const decode = (hex: string) => {
  const bytes = Buffer.from(hex, 'hex');
  return Array.from({ length: bytes.length / 8 }, (_, i) => bytes.readDoubleLE(i * 8));
};
const definition = (index: number) => {
  const row = samples.definitions[index];
  return {
    ...row.value,
    constant: decode(row.inputHex.constant),
    values: row.inputHex.values.map(decode),
  };
};
for (const [index, sample] of samples.samples.entries())
  test(`external integral ${index}: ${samples.definitions[sample.definition].name}`, () => {
    const value = new SourceIntegratedValue(definition(sample.definition));
    const out = value.sample(sample.age01, sample.order as 1 | 2);
    expect(Buffer.from(out.buffer).toString('hex')).toBe(sample.expectedHex);
  });
test('external integral fixtures reproduce without the application adapter', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-integrated-value-samples.mjs',
    '--check',
  ]);
});
test('constants retain fixed amounts while authored constant curves integrate', () => {
  const constant = new SourceIntegratedValue(definition(0)),
    keyed = new SourceIntegratedValue(definition(1));
  expect(constant.sample(0.5, 1)[0]).toBe(3);
  expect(keyed.sample(0.5, 1)[0]).toBeCloseTo(1.5, 6);
  expect(keyed.sample(1, 2)[0]).toBeCloseTo(1.5, 6);
});
test('cached tables and input retain independent storage across order and seek', () => {
  const input = definition(2),
    value = new SourceIntegratedValue(input);
  const first = value.sample(0.3, 1),
    second = value.sample(0.3, 2);
  input.values.forEach((v) => v.fill(999));
  input.constant.fill(999);
  value.sample(0.8, 2).fill(999);
  value.sample(0.3, 1).fill(999);
  expect(value.sample(0.3, 1)).toEqual(first);
  expect(value.sample(0.3, 2)).toEqual(second);
  const fresh = new SourceIntegratedValue(definition(2));
  expect(fresh.sample(0.3, 2)).toEqual(second);
  expect(fresh.sample(0.3, 1)).toEqual(first);
});
test('invalid integral clocks, order and structure reject', () => {
  const value = new SourceIntegratedValue(definition(0));
  for (const phase of [NaN, Infinity]) expect(() => value.sample(phase, 1)).toThrow();
  expect(() => value.sample(0.5, 3 as 1)).toThrow();
  expect(() => new SourceIntegratedValue({ ...definition(0), authoredKeyCount: 0.5 })).toThrow();
});
