import { expect, test } from 'vitest';
import { arrivalAurora } from '../src/render/hawkshot-arrival-state';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const flight = {
  id: 42,
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  speed: 1400,
  launchTick: 1,
  arrivalTick: 60,
  distance: 1400,
};
test('arrival Aurora starts only at arrival and reconstructs its short rise and fade', () => {
  expect(arrivalAurora({ ...flight, arrivalTick: undefined }, 1)).toBeNull();
  expect(arrivalAurora(flight, 0.99)).toBeNull();
  const initial = arrivalAurora(flight, 1)!;
  expect(initial.alpha).toBe(0);
  expect(initial.lift).toBe(-1);
  expect(initial.life).toBeGreaterThanOrEqual(0.25);
  expect(initial.life).toBeLessThanOrEqual(0.5);
  const peak = arrivalAurora(flight, 1 + initial.life * 0.5)!;
  expect(peak.alpha).toBeCloseTo(0.2699931263923645 * 0.5700007677078247);
  expect(peak.lift).toBeGreaterThan(initial.lift);
  expect(arrivalAurora(JSON.parse(JSON.stringify(flight)), 1 + initial.life * 0.5)).toEqual(peak);
  expect(arrivalAurora(flight, 1.51)).toBeNull();
});
test('endpoint Aurora texture and emitter retain source provenance', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-arrival.json', 'utf8'));
  const definitions = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  expect(hash(definitions)).toBe(pin.definitionsSha256);
  expect(hash(readFileSync(pin.texture.path))).toBe(pin.texture.sha256);
  expect(
    JSON.parse(definitions.toString()).records[pin.record].data.complexEmitterDefinitionData
  ).toContainEqual(pin.emitter);
});
