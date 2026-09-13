import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ARRIVAL_GLOWS, ARRIVAL_GLOW_RAMP } from '../src/content/hawkshot-arrival-glows';

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
  expect(ARRIVAL_GLOW_RAMP).toEqual(pin.ramp.rgba8Samples);
  expect(ARRIVAL_GLOWS).toEqual(
    pin.emitters.map((e: any) => ({
      name: e.emitterName,
      rate: e.rate.constantValue,
      duration: e.lifetime,
      life: e.particleLifetime.constantValue,
      scale: e.birthScale0.constantValue[0],
      scaleRange: e.birthScale0.dynamics.probabilityTables[0].keyValues,
      offset: e.EmitterPosition.constantValue,
      color: e.Color.constantValue,
      rotation: e.birthRotation0.constantValue,
    }))
  );
  expect(pin.ramp.dimensions).toEqual([64, 64]);
  expect(pin.ramp.rgba8Samples).toHaveLength(64);
  expect(pin.ramp.rgba8Samples.every((s: number[]) => s[3] === 255)).toBe(true);
  expect(pin.ramp.rgba8Samples[0]).toEqual([0, 0, 0, 255]);
  expect(pin.ramp.rgba8Samples[32]).toEqual([123, 125, 123, 255]);
  expect(pin.ramp.rgba8Samples[63]).toEqual([0, 0, 0, 255]);
});

test('glow sampling keeps RGB modulation separate from alpha and persists across restoration', async () => {
  const { arrivalGlowRamp, arrivalGlows } =
    await import('../src/render/hawkshot-arrival-glow-state');
  const flight = {
    id: 17,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 1400,
    launchTick: 1,
    arrivalTick: 45,
    distance: 700,
  };
  expect(arrivalGlowRamp(32 / 63)).toEqual([123 / 255, 125 / 255, 123 / 255, 1]);
  expect(arrivalGlowRamp(-1)).toEqual([0, 0, 0, 1]);
  expect(arrivalGlows(flight, 0.84)).toEqual([]);
  const birth = arrivalGlows(flight, 0.85);
  expect(birth).toHaveLength(2);
  expect(birth.every((p) => p.alpha === 1 && p.color.every((c) => c === 0))).toBe(true);
  const visible = arrivalGlows(flight, 0.95);
  expect(visible[0].size).toBeGreaterThan(4.8);
  expect(visible[1].size).toBeLessThanOrEqual(1.4);
  expect(visible.every((p) => p.color[2] > 0 && p.alpha < 1)).toBe(true);
  expect(arrivalGlows(JSON.parse(JSON.stringify(flight)), 0.95)).toEqual(visible);
  expect(arrivalGlows(flight, 1.26)).toEqual([]);
});
