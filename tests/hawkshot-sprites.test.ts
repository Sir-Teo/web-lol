import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('prepared Hawkshot sprite assets retain their source identities, complete cells and output hashes', () => {
  const definitions = readFileSync('docs/reference/hawkshot-effects.json');
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-sprites.json', 'utf8'));
  expect(pin.definitionsSha256).toBe(hash(definitions));
  const source = JSON.parse(definitions.toString());
  const emitters = source.records[pin.record].data.complexEmitterDefinitionData;
  expect(pin.emitters).toEqual(
    emitters.filter((e: any) => ['Dust', 'Smoke_Trail'].includes(e.emitterName))
  );
  for (const texture of pin.textures) {
    expect(source.extraction.files).toContainEqual(texture.source);
    const bytes = readFileSync(texture.path);
    expect(bytes.length).toBe(texture.bytes);
    expect(hash(bytes)).toBe(texture.sha256);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(texture.dimensions);
    if (texture.frames) {
      const [w, h] = texture.dimensions;
      expect(texture.frames.map((f: any) => f.rect)).toEqual([
        [0, 0, w / 2, h / 2],
        [w / 2, 0, w, h / 2],
        [0, h / 2, w / 2, h],
        [w / 2, h / 2, w, h],
      ]);
      expect(new Set(texture.frames.map((f: any) => f.rgbaSha256)).size).toBe(4);
    }
  }
  expect(pin.textures.map((t: any) => t.colorSpace)).toEqual(['sRGB', 'sRGB', 'linear']);
  expect(pin.profiles.map((p: any) => p.frameRate)).toEqual([null, null]);
  expect(pin.profiles.map((p: any) => p.bindWeight)).toEqual([null, null]);
  expect(pin.profiles[1].erosion.erosionMapChannelMixer.constantValue).toEqual([1, 0, 0, 0]);
});
