import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HAWKSHOT_RADIAL as R } from '../src/content/hawkshot-radial';
import { radialBirth, radialParticles } from '../src/render/hawkshot-radial-state';

test('endpoint radial profile preserves animated alpha rather than stale constant alpha', () => {
  const pin = JSON.parse(readFileSync('docs/reference/hawkshot-radial.json', 'utf8'));
  const raw = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  expect(hash(raw)).toBe(pin.definitionsSha256);
  expect(
    JSON.parse(raw.toString()).records[pin.record].data.complexEmitterDefinitionData.find(
      (e: any) => e.emitterName === 'smoke'
    )
  ).toEqual(pin.emitter);
  expect(R).toEqual(pin.profile);
  expect(R.color[3]).toBe(pin.emitter.Color.dynamics.values[0][3]);
  expect(R.color[3]).not.toBe(pin.emitter.Color.constantValue[3]);
  expect(hash(readFileSync(pin.texture.path))).toBe(pin.texture.sha256);
});

test('rising-rate birth schedule, expanding launch radius and drag survive restoration', () => {
  expect(radialBirth(50)).toBe(0.25);
  expect(radialBirth(1)).toBeGreaterThan(0);
  expect(radialBirth(50) - radialBirth(49)).toBeLessThan(radialBirth(2) - radialBirth(1));
  const f = {
    id: 33,
    origin: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 1400,
    launchTick: 1,
    arrivalTick: 60,
    distance: 700,
  };
  expect(radialParticles(f, 1)).toEqual([]);
  const all = radialParticles(f, 1.25);
  expect(all).toHaveLength(50);
  const first = all.find((p) => p.index === 1)!;
  const later = radialParticles(f, 1.26).find((p) => p.index === 1)!;
  expect(Math.hypot(later.offset[0], later.offset[2])).toBeGreaterThan(
    Math.hypot(first.offset[0], first.offset[2])
  );
  expect(Math.hypot(later.velocity[0], later.velocity[2])).toBeLessThan(
    Math.hypot(first.velocity[0], first.velocity[2])
  );
  expect(later.alpha).toBeLessThan(first.alpha);
  expect(radialParticles(JSON.parse(JSON.stringify(f)), 1.25)).toEqual(all);
  expect(radialParticles(f, 2.14)).toEqual([]);
});
