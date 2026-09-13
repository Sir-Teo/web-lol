import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_DARKNESS as D } from '../src/content/hawkshot-darkness';
import { arrivalDarkness, darknessLife } from '../src/render/hawkshot-darkness-state';

test('DarknessFollow uses pinned source data, smoke atlas and separate blue erosion pack', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-darkness.json', 'utf8'));
  const raw = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  expect(hash(raw)).toBe(pin.definitionsSha256);
  expect(
    JSON.parse(raw.toString()).records[pin.record].data.complexEmitterDefinitionData.find(
      (e: any) => e.emitterName === 'DarknessFollow'
    )
  ).toEqual(pin.emitter);
  expect(D).toEqual(pin.profile);
  for (const t of pin.textures) expect(hash(readFileSync(t.path))).toBe(t.sha256);
  expect(pin.textures[1].source.path).toContain('ashe_base_ba_erosionpack01');
  expect(pin.emitter.alphaErosionDefinition.erosionMapChannelMixer.constantValue).toEqual([
    0, 0, 1, 0,
  ]);
});

test('delayed single particle uses the lifetime probability kink and deterministic motion', () => {
  expect(darknessLife(0)).toBe(0.25);
  expect(darknessLife(D.lifeProbability.keyTimes[1])).toBeCloseTo(0.4);
  expect(darknessLife(1)).toBe(0.5);
  expect(darknessLife(0.4)).toBeCloseTo(0.325);
  const f = {
    id: 23,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 1400,
    launchTick: 1,
    arrivalTick: 45,
    distance: 700,
  };
  expect(arrivalDarkness(f, 0.79)).toBeNull();
  const a = arrivalDarkness(f, 0.85)!,
    b = arrivalDarkness(f, 0.95)!;
  expect(a.frame).toBeGreaterThanOrEqual(0);
  expect(a.frame).toBeLessThan(4);
  expect(b.offset[1] - a.offset[1]).toBeCloseTo(20);
  expect(b.alpha).toBeLessThan(a.alpha);
  expect(b.erosion).toBeGreaterThan(a.erosion);
  expect(arrivalDarkness(JSON.parse(JSON.stringify(f)), 0.95)).toEqual(b);
  expect(arrivalDarkness(f, 1.31)).toBeNull();
});
