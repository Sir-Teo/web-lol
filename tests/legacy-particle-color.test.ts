import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import source from '../src/content/gromp-death.json';
import fixtures from '../docs/reference/gromp-ray-raw-color-fixtures.json';
import {
  prepareLegacyParticleColor,
  sampleLegacyParticleColor,
} from '../src/render/legacy-particle-color';
import { grompDeathParticles } from '../src/render/gromp-death-particles';
import { writeRayColor } from '../src/render/particle-ray-color';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const words = (values: readonly number[]) =>
  values.map((value) => {
    const bytes = Buffer.alloc(4);
    bytes.writeFloatLE(value);
    return bytes.readUInt32LE().toString(16).padStart(8, '0');
  });
const curves = new Map(
  [5, 7].map((index) => [
    index,
    prepareLegacyParticleColor(source.profiles[index].color, source.profiles[index].colorCurve),
  ])
);

test('legacy color fixtures retain the independent compiler and native/source witness identities', () => {
  expect(fixtures.compiler.flags).toEqual([
    '-std=c11',
    '-O2',
    '-ffp-contract=off',
    '-fno-fast-math',
  ]);
  expect(fixtures.compiler.nativeExecuted).toBe(false);
  expect(sha('tools/qa/lib/legacy-ray-color-reference.py')).toBe(fixtures.referenceToolSha256);
  for (const [path, expected] of Object.entries(fixtures.compiler.sourcePins))
    expect(sha(path)).toBe(expected);
  const witness = JSON.parse(
    readFileSync('docs/reference/native-legacy-color-curves.json', 'utf8')
  );
  for (const [index, curve] of curves) {
    expect(curve.map((key) => words([key.time])[0])).toEqual(
      witness.source.profiles[index].keys.map((key: any) => key.timeWord)
    );
    expect(curve.map((key) => words(key.value))).toEqual(
      witness.source.profiles[index].keys.map((key: any) => key.preparedWords)
    );
  }
});

for (const row of fixtures.rows)
  test(`legacy Ray ${row.profileIndex} matches independent C at phase ${row.phase}`, () => {
    const color = sampleLegacyParticleColor(curves.get(row.profileIndex)!, row.phase),
      bytes = new Uint8Array(4);
    expect(words(color)).toEqual(row.words);
    expect(color).toEqual(row.rgba);
    writeRayColor(bytes, 0, 1, color, row.profileIndex === 5 ? 1 : 0);
    expect([...bytes]).toEqual(row.bgra);
  });

test('the retained tick-eight shard uses the checked float32 alpha before byte premultiplication', () => {
  const particle = grompDeathParticles(0, 8, 0).find(
    (p) => p.profileIndex === 7 && p.ordinal === 8
  )!;
  expect(particle.phase).toBe(0.7291666666666665);
  expect(words(particle.color)).toEqual(['3ecccccd', '3e4ccccd', '3f4ccccd', '3f0aaaaa']);
  const bytes = new Uint8Array(4);
  writeRayColor(bytes, 0, 1, particle.color, 0);
  expect([...bytes]).toEqual([110, 28, 55, 255]);
});

test('prepared inputs stay immutable and endpoint samples own their output tuples', () => {
  const base = Object.freeze([0.4, 0.2, 0.8, 1]),
    keys = Object.freeze(
      [
        { time: 0, value: Object.freeze([1, 1, 1, 0]) },
        { time: 1, value: Object.freeze([1, 1, 1, 1]) },
      ].map((key) => Object.freeze(key))
    );
  const curve = prepareLegacyParticleColor(base, keys);
  for (const phase of [0, 0.5, 1]) {
    const a = sampleLegacyParticleColor(curve, phase),
      b = sampleLegacyParticleColor(curve, phase);
    a[0] = 999;
    expect(b[0]).toBe(Math.fround(0.4));
    expect(curve[0].value[0]).toBe(Math.fround(0.4));
  }
  expect(base).toEqual([0.4, 0.2, 0.8, 1]);
  expect(keys[0].value).toEqual([1, 1, 1, 0]);
});

for (const [name, base, keys] of [
  ['missing keys', [1, 1, 1, 1], []],
  ['base arity', [1, 1, 1], [{ time: 0, value: [1, 1, 1, 1] }]],
  ['nonfinite base', [1, 1, NaN, 1], [{ time: 0, value: [1, 1, 1, 1] }]],
  ['key arity', [1, 1, 1, 1], [{ time: 0, value: [1, 1, 1] }]],
  ['nonfinite value', [1, 1, 1, 1], [{ time: 0, value: [1, 1, Infinity, 1] }]],
  ['nonfinite time', [1, 1, 1, 1], [{ time: Infinity, value: [1, 1, 1, 1] }]],
  [
    'unordered keys',
    [1, 1, 1, 1],
    [
      { time: 1, value: [1, 1, 1, 1] },
      { time: 0, value: [1, 1, 1, 1] },
    ],
  ],
  [
    'collapsed float32 times',
    [1, 1, 1, 1],
    [
      { time: 0.5, value: [1, 1, 1, 1] },
      { time: 0.5 + Number.EPSILON, value: [1, 1, 1, 1] },
    ],
  ],
] as const)
  test(`unsupported legacy color preparation rejects ${name}`, () => {
    expect(() => prepareLegacyParticleColor(base, keys)).toThrow(RangeError);
  });

for (const input of [NaN, Infinity, -0.1, 1.1])
  test(`legacy color sampling rejects invalid phase ${input}`, () => {
    expect(() => sampleLegacyParticleColor(curves.get(5)!, input)).toThrow(RangeError);
  });
test('finite double inputs cannot overflow prepared float32 storage', () => {
  expect(() =>
    prepareLegacyParticleColor([1, 1, 1e100, 1], [{ time: 0, value: [1, 1, 1, 1] }])
  ).toThrow(RangeError);
  expect(() =>
    prepareLegacyParticleColor([1, 1, 1e30, 1], [{ time: 0, value: [1, 1, 1e30, 1] }])
  ).toThrow(RangeError);
});

test('exact raw-key knots advance to the next interval or return the stored last tuple', () => {
  const base = [1, 1, 1, 1],
    value = (v: number) => [v, v, v, v];
  const middle = prepareLegacyParticleColor(base, [
    { time: 0, value: value(1) },
    { time: 0.5, value: value(0.2) },
    { time: 1, value: value(0.7) },
  ]);
  const last = prepareLegacyParticleColor(base, [
    { time: 0, value: value(1) },
    { time: 1, value: value(0.2) },
  ]);
  expect(words(sampleLegacyParticleColor(middle, 0.5))).toEqual(Array(4).fill('3e4ccccd'));
  expect(words(sampleLegacyParticleColor(last, 1))).toEqual(Array(4).fill('3e4ccccd'));
  const reading = fixtures.rawKeyBoundary;
  expect(sha(reading.parentWitness.path)).toBe(reading.parentWitness.sha256);
  const witness = JSON.parse(readFileSync(reading.parentWitness.path, 'utf8'));
  expect(
    witness.functionSpans.some(
      (span: any) => span.start === reading.start && span.sha256 === reading.sha256
    )
  ).toBe(true);
  expect(reading.instructions['0x10191c240']).toBe('54ffff2d');
});
