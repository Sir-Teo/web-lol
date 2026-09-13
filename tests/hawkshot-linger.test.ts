import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('lingering effect pins all emitters, new textures and byte-identical erosion alias', () => {
  const p = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8'));
  const source = readFileSync('docs/reference/hawkshot-effects.json');
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  expect(hash(source)).toBe(p.definitionsSha256);
  expect(p.emitters).toEqual(
    JSON.parse(source.toString()).records[p.record].data.complexEmitterDefinitionData
  );
  for (const t of [...p.newTextures, ...p.reusedTextures, p.erosionAlias])
    expect(hash(readFileSync(t.path))).toBe(t.sha256);
  expect(p.erosionAlias.source.sha256).toBe(p.erosionAlias.identicalSource.sha256);
  expect(p.newTextures).toHaveLength(2);
  expect(p.reusedTextures).toHaveLength(2);
});

test('linger preparation preserves missing fields and identifies tails beyond vision expiry', () => {
  const p = JSON.parse(readFileSync('docs/reference/hawkshot-linger.json', 'utf8'));
  const [aurora, snow1, snow2, sparkle] = p.profiles;
  expect(p.emitters[0].particleLifetime.constantValue).toBeUndefined();
  expect(aurora.particleLife).toBe(3);
  expect(aurora.lifeRange).toEqual([0.5, 1]);
  expect(aurora.uncappedEndUpperBoundSeconds).toBe(3);
  expect(snow1.uncappedEndUpperBoundSeconds).toBeGreaterThan(6);
  expect(snow2.uncappedEndUpperBoundSeconds).toBe(6);
  expect(sparkle.uncappedEndUpperBoundSeconds).toBeCloseTo(5.4);
  expect(snow1.uniformScale).toBeNull();
  expect(snow2.uniformScale).toBe(1);
  expect(snow1.directionOriented).toBe(1);
  expect(snow2.directionOriented).toBeNull();
  expect(sparkle.atlas).toBeNull();
  expect(aurora.textureMult.birthUvScrollRateMult.constantValue).toEqual([
    0.10000000149011612, -0.10000000149011612,
  ]);
});
