import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-uv-samples.json';
import { SourceUvLayer, type SourceUvLayerDefinition } from '../src/render/source-uv-layer';
const layers = samples.definitions.map(
  (d) => new SourceUvLayer(d.definition as SourceUvLayerDefinition)
);
const hex = (array: Float32Array | Float64Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external UV ${index}: ${samples.definitions[sample.definition].name}`, () => {
    const layer = layers[sample.definition],
      birth = layer.birth(sample.birthPhase, sample.chance);
    const packed = new Float32Array([
      ...birth.offset,
      ...birth.scroll,
      0,
      0,
      0,
      birth.rotation,
      birth.phase,
      birth.rate,
    ]);
    expect(hex(packed)).toBe(sample.expected.birthHex);
    const draw = layer.sample(
      birth,
      sample.age,
      sample.life ?? Infinity,
      sample.now,
      sample.emitterScroll
    );
    expect(hex(new Float64Array(Object.values(draw)))).toBe(sample.expected.drawHex);
    expect(hex(layer.rows(draw))).toBe(sample.expected.rowsHex);
  });
test('external UV fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-uv-samples.mjs', '--check']);
});
test('base and multiplier retain the same fractional book phase with separate grids', () => {
  const baseIndex = samples.definitions.findIndex((d) => d.name === 'missile-3-base');
  const multIndex = samples.definitions.findIndex((d) => d.name === 'missile-3-mult');
  expect(baseIndex).toBeGreaterThanOrEqual(0);
  expect(multIndex).toBeGreaterThanOrEqual(0);
  expect(layers[baseIndex].birth(0, 0.375).phase).toBe(layers[multIndex].birth(0, 0.375).phase);
  const synthetic = samples.definitions.at(-1)!.definition as SourceUvLayerDefinition;
  const multiplier = new SourceUvLayer({
    ...synthetic,
    book: { ...synthetic.book, divisions: [3, 3] },
  });
  const fractional = layers.at(-1)!.birth(0, 0.375);
  expect(fractional.phase).toBe(0.75);
  const multBirth = multiplier.birth(0, 0.375);
  expect(multBirth.phase).toBe(fractional.phase);
  expect(layers.at(-1)!.sample(fractional, 0, 0.75, 0).cellV).toBe(0.5);
  expect(multiplier.sample(multBirth, 0, 0.75, 0).cellV).toBe(1 / 3);
  const layer = layers.at(-1)!,
    birth = layer.birth(0, 1);
  expect(layer.sample(birth, 0, 0.75, 0).cellV).toBe(0.5);
  expect(layer.sample(birth, 0.05, 0.75, 0).cellU).toBe(0);
});
test('prepared layers and returned birth/row buffers own their storage', () => {
  const definition = structuredClone(
    samples.definitions.at(-1)!.definition
  ) as SourceUvLayerDefinition;
  const layer = new SourceUvLayer(definition),
    birth = layer.birth(0, 0.5),
    draw = layer.sample(birth, 0.25, 0.75, 7);
  definition.book.rate = 999;
  definition.book.divisions = [100, 100];
  definition.center = [99, 99];
  expect(layer.sample(birth, 0.25, 0.75, 7)).toEqual(draw);
  layer.rows(draw).fill(999);
  expect(layer.sample(birth, 0.25, 0.75, 7)).toEqual(draw);
  birth.offset.fill(999);
  expect(layer.birth(0, 0.5).offset[0]).toBe(-0.25);
});
test('invalid layers, births and clocks reject', () => {
  const definition = samples.definitions[0].definition as SourceUvLayerDefinition;
  for (const edit of [
    { center: [1] },
    { addressMode: 9 },
    { book: { ...definition.book, rate: NaN } },
    { scale: { ...definition.scale, constant: [1] } },
  ])
    expect(
      () => new SourceUvLayer({ ...definition, ...edit } as SourceUvLayerDefinition)
    ).toThrow();
  const layer = layers[0],
    birth = layer.birth(0, 0.5);
  for (const chance of [-1, NaN, Infinity, 1.01]) expect(() => layer.birth(0, chance)).toThrow();
  for (const age of [-1, NaN, Infinity]) expect(() => layer.sample(birth, age, 1, 0)).toThrow();
  expect(() => layer.sample(birth, 0, -1, 0)).toThrow();
  expect(() => layer.sample(birth, 0, 1, NaN)).toThrow();
  expect(() => layer.rows({ ...layer.sample(birth, 0, 1, 0), turn: NaN })).toThrow();
});
