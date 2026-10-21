import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import profiles from '../src/content/garen-q-cast-particles.json';
import audit from '../docs/reference/garen-q-particle-profiles.json';
import source from '../docs/reference/garen-q-particles.json';
import { garenQCastParticles } from '../src/render/garen-q-particles';
import { createGarenQCastMaterial } from '../src/render/garen-decisive-strike';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../src/content/garen-q-audio-timing';
import type { ChampionState } from '../src/simulation/types';
const record: ChampionState['garenQVisuals'][number] = {
  startTick: 100,
  rank: 1,
  stopTick: null,
  endReason: null,
  attacks: [],
};
const sample = (at: number, r = record) => garenQCastParticles(1, [r], 100 + at);

test('all eight cast emitters preserve their source fields, reader pins and complete selected/deferred accounting', () => {
  const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(hash(audit.castOutput.path)).toBe(audit.castOutput.sha256);
  expect(hash('docs/reference/garen-q-cast-reader.json')).toBe(audit.readerEvidenceSha256);
  expect(audit.implemented).toHaveLength(16);
  expect(audit.deferred).toHaveLength(15);
  expect(audit.castRetentionBoundTicks).toBeLessThan(GAREN_Q_AUDIO_TAIL_TICKS);
  expect(profiles).toHaveLength(8);
  for (const p of profiles) {
    const e = (source.resources as any)[p.system].definition.complexEmitterDefinitionData[p.index];
    expect(p.explicitFields).toEqual(Object.keys(e).sort());
    expect(p.rate).toBe(e.rate.constantValue);
    expect(p.emitterLife).toBe(e.lifetime ?? null);
    expect(p.scale.values).toEqual(
      e.scale0?.dynamics?.values ?? [e.scale0?.constantValue ?? [1, 1, 1]]
    );
  }
  expect(profiles[2].blend).toBe(2);
  expect(profiles[4].atlas).toEqual({ grid: [1, 1], frames: 4, start: 0, random: true });
  expect(profiles[6]).toMatchObject({
    multiplier: null,
    multiplierDeclared: true,
    emitterLinger: 1,
    linger: 1,
    lingerType: 0,
  });
});
test('Q casts emit source-sized bursts and first budget births, preserving independent particle lives', () => {
  expect(sample(-1)).toEqual([]);
  expect(sample(0)).toEqual([]);
  expect(garenQCastParticles(1, [record], NaN)).toEqual([]);
  const first = sample(1);
  expect(profiles.map((_, i) => first.filter((p) => p.profileIndex === i).length)).toEqual([
    2, 1, 10, 1, 2, 1, 1, 1,
  ]);
  expect(first.every((p) => p.age === 0)).toBe(true);
  expect(first.find((p) => p.profileIndex === 3)!.scale).toEqual([0, 0, 0]);
  expect(sample(9).some((p) => p.profileIndex === 2)).toBe(false);
  expect(sample(31).some((p) => p.profileIndex === 3)).toBe(false);
  const births: number[] = [];
  for (let at = 1; at <= 100; at++)
    if (sample(at).some((p) => p.profileIndex === 6 && p.age === 0)) births.push(at);
  expect(births).toEqual([1, 18, 26, 35, 43, 52, 60, 69, 78, 86, 95]);
});
test('activation one-shots survive an early armed stop; armed emitters cannot birth on or after it', () => {
  const stopped = { ...record, stopTick: 120, endReason: 'consumed' as const };
  expect(sample(20, stopped).some((p) => p.profileIndex === 3)).toBe(true);
  for (let at = 20; at < 100; at++) {
    const particles = sample(at, stopped).filter((p) => profiles[p.profileIndex].role === 'armed');
    expect(particles.every((p) => p.age > 0 && at - p.age * 60 < 20)).toBe(true);
  }
  const immediate = { ...record, stopTick: 100, endReason: 'death' as const };
  expect(sample(1, immediate).map((p) => p.profileIndex)).toEqual(
    sample(1)
      .filter((p) => p.profileIndex < 4)
      .map((p) => p.profileIndex)
  );
});
test('the mesh uses an absolute one-second emitter-age wait then caps total life and rephases curves', () => {
  const stopped = { ...record, stopTick: 120, endReason: 'consumed' as const };
  const mesh = (at: number) => sample(at, stopped).filter((p) => p.profileIndex === 6);
  expect(mesh(60.99).every((p) => !p.finished && p.life >= 3)).toBe(true);
  expect(mesh(61).length).toBeGreaterThan(0);
  expect(mesh(61).every((p) => p.finished && p.life === 1 && p.naturalLife >= 3)).toBe(true);
  expect(mesh(61).some((p) => p.ordinal === 1)).toBe(false);
  const capped = mesh(61)[0];
  expect(capped.color[3]).toBe(0); // The source mesh reaches zero alpha at phase 0.25.
  expect(mesh(100)).toEqual([]);
  const late = sample(181, { ...record, stopTick: 280, endReason: 'expired' }).filter(
    (p) => p.profileIndex === 6
  );
  expect(late.every((p) => p.finished && p.life === 1 && p.age < 1)).toBe(true);
});
test('Q birth sampling, scroll, atlas and curve replay are finite, deterministic and bounded after every stop', () => {
  const r = { ...record, stopTick: 370, endReason: 'expired' as const };
  const a = garenQCastParticles(1, [r], 340.5);
  garenQCastParticles(2, [r], 180);
  expect(garenQCastParticles(1, JSON.parse(JSON.stringify([r])), 340.5)).toEqual(a);
  expect(garenQCastParticles(2, [r], 340.5)).not.toEqual(a);
  for (let tick = 101; tick < 500; tick += 2.5) {
    const particles = garenQCastParticles(1, [r], tick);
    expect(particles.length).toBeLessThan(75);
    expect(
      particles
        .flatMap((p) => [
          ...p.offset,
          ...p.scale,
          ...p.rotation,
          ...p.color,
          ...p.lookup,
          ...p.scroll,
        ])
        .every(Number.isFinite)
    ).toBe(true);
    expect(particles.every((p) => p.frame === 0)).toBe(true); // Four frames with an absent 1×1 grid wrap to the same cell.
  }
  for (const endReason of ['consumed', 'expired', 'death', 'match-end', 'recast'] as const)
    expect(
      garenQCastParticles(1, [{ ...r, endReason }], r.stopTick + GAREN_Q_AUDIO_TAIL_TICKS - 1)
    ).toEqual([]);
});
test('Q subtract has separate source-color and source-alpha destination factors; absent mesh multiplier adds no texture pass', () => {
  const t = new THREE.Texture(),
    dark = createGarenQCastMaterial(2, t, t),
    mesh = createGarenQCastMaterial(6, t, t);
  expect(dark.blendSrc).toBe(THREE.ZeroFactor);
  expect(dark.blendDst).toBe(THREE.OneMinusSrcColorFactor);
  expect(dark.blendSrcAlpha).toBe(THREE.ZeroFactor);
  expect(dark.blendDstAlpha).toBe(THREE.OneMinusSrcAlphaFactor);
  expect(dark.blendEquation).toBe(THREE.AddEquation);
  expect(mesh.defines.QUAD_MULT_PASS).toBeUndefined();
  expect(mesh.uniforms.multiplierTexture).toBeUndefined();
  dark.dispose();
  mesh.dispose();
  t.dispose();
});
