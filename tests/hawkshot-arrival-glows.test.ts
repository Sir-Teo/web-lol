import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('endpoint glow evidence preserves the opaque RGB ramp and both distinct scales', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-arrival-glows.json', 'utf8'));
  const definitions = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  expect(hash(definitions)).toBe(pin.definitionsSha256);
  expect(hash(readFileSync(pin.ramp.path))).toBe(pin.ramp.sha256);
  expect(hash(readFileSync(pin.sharedGlowTexture.path))).toBe(pin.sharedGlowTexture.sha256);
  const source = JSON.parse(definitions.toString()).records[pin.record].data
    .complexEmitterDefinitionData;
  expect(pin.emitters).toEqual(
    source.filter((e: any) => ['flat_top', 'flat_top1'].includes(e.emitterName))
  );
  expect(pin.emitters.map((e: any) => e.birthScale0.constantValue[0])).toEqual([540, 140]);
  expect(pin.ramp.dimensions).toEqual([64, 64]);
  expect(pin.ramp.rgba8Samples).toHaveLength(64);
  expect(pin.ramp.rgba8Samples.every((s: number[]) => s[3] === 255)).toBe(true);
  expect(pin.ramp.rgba8Samples[0]).toEqual([0, 0, 0, 255]);
  expect(pin.ramp.rgba8Samples[32]).toEqual([123, 125, 123, 255]);
  expect(pin.ramp.rgba8Samples[63]).toEqual([0, 0, 0, 255]);
});
