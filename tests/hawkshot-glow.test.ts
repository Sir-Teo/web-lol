import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { HAWKSHOT_GLOW } from '../src/content/hawkshot-glow';

test('Hawkshot glow profiles and texture remain tied to the extracted source', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-glow.json', 'utf8'));
  const definitions = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(hash(definitions)).toBe(pin.definitionsSha256);
  expect(hash(readFileSync(pin.texture.path))).toBe(pin.texture.sha256);
  expect(pin.texture.size).toEqual([256, 256]);
  const original = JSON.parse(definitions.toString()).records[pin.record].data
    .complexEmitterDefinitionData;
  HAWKSHOT_GLOW.forEach((layer, i) => {
    const source = original.find((e: any) => e.emitterName === layer.name);
    expect(source).toEqual(pin.emitters[i]);
    expect(layer.color).toEqual(source.Color.constantValue);
    expect(layer.offset).toEqual(source.SpawnShape.emitOffset);
    expect(layer.birthScale).toEqual(source.birthScale0.constantValue);
    expect(layer.scale).toEqual(source.scale0.constantValue);
    expect(layer.delay).toBe(source.timeBeforeFirstEmission);
    expect(layer.lifetime).toBe(source.particleLifetime.constantValue);
    expect(layer.blendMode).toBe(source.blendMode);
    expect(layer.renderOrder).toBe(source.pass);
  });
});
