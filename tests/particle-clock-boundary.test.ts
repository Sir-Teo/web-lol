import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/particle-clock-boundary-samples.json';
import { SourceParticleSpin } from '../src/render/source-particle-spin';
import {
  SourceParticleAppearance,
  type SourceAppearanceDefinition,
} from '../src/render/source-particle-appearance';
import { SourceParticleFrame } from '../src/render/source-particle-frame';
import { SourceUvLayer, type SourceUvLayerDefinition } from '../src/render/source-uv-layer';
import {
  sourceLifetimeSettlement,
  type SourceLifetimePolicy,
} from '../src/render/source-lifetime-settlement';
const spin = new SourceParticleSpin(samples.definitions.spin),
  appearance = new SourceParticleAppearance(
    samples.definitions.appearance as SourceAppearanceDefinition
  );
const frame = new SourceParticleFrame(samples.definitions.frame),
  uv = new SourceUvLayer(samples.definitions.uv as SourceUvLayerDefinition);
const policy = samples.definitions.lifetime as SourceLifetimePolicy,
  I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const hex = (array: Float32Array | Float64Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const sample of samples.samples)
  test(`external float32 birth boundary at ${sample.now}`, () => {
    expect(sample.age).toBe(sample.now - Math.fround(sample.now));
    const rotation = spin.sample({
      birthRotation: [0, 0, 0],
      angularVelocity: [0, 0, 1000],
      angularAcceleration: [0, 0, 0],
      age: sample.age,
      life: sample.life,
      lingering: true,
    });
    const colors = appearance.sample({
      birthScale: [1, 1, 1],
      birthColor: [1, 1, 1, 1],
      age: sample.age,
      life: sample.life,
      instanceScale: 1,
    });
    const placed = frame.sample({
      position: [1, 2, 3],
      previousPlaced: [0, 0, 0],
      bound: [0, 0, 0],
      anchor: [100, 200, 300],
      birthFrame: I,
      currentYaw: I,
      emitterPosition: [0, 0, 0],
      worldBasis: I,
      worldOffset: [0, 0, 0],
      worldHud: false,
      orbit: null,
      moved: [1, 0, 0],
      dt: 1 / 30,
      fresh: true,
      age: sample.age,
      life: sample.life,
    });
    const draw = uv.sample(uv.birth(0, 0.375), sample.age, sample.life, sample.now);
    const settled = sourceLifetimeSettlement(
      policy,
      { age: sample.now, lastSpawn: sample.now, emitted: true, finishedAt: null },
      [{ birthTime: sample.birthTime, lifetime: sample.life, lingerFrom: null }],
      { now: sample.now, stopped: true }
    );
    expect({
      rotation: hex(rotation),
      scale: hex(colors.scale),
      color: hex(colors.color),
      position: hex(placed.position),
      uv: hex(new Float64Array(Object.values(draw))),
      lifetime: hex(new Float32Array([settled.particles[0].lifetime])),
      lingerFrom: hex(new Float32Array([settled.particles[0].lingerFrom ?? -1])),
      finishedAt: settled.state.finishedAt,
    }).toEqual(sample.expected);
    expect(
      sourceLifetimeSettlement(policy, settled.state, settled.particles, {
        now: sample.now,
        stopped: true,
      })
    ).toEqual(settled);
    if (sample.age < 0) {
      expect(rotation[2]).toBeLessThan(0);
      expect(sample.birthTime).toBeGreaterThan(sample.now);
    }
  });
test('external clock boundaries reproduce without application helpers', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-particle-clock-boundary-samples.mjs',
    '--check',
  ]);
});
test('settlement rejects times beyond the current float32 bin', () => {
  const sample = samples.samples[0],
    state = { age: sample.now, lastSpawn: sample.now, emitted: true, finishedAt: null };
  const bits = new Uint32Array(new Float32Array([sample.birthTime]).buffer);
  bits[0]++;
  const later = new Float32Array(bits.buffer)[0];
  for (const particle of [
    { birthTime: later, lifetime: 1, lingerFrom: null },
    { birthTime: sample.birthTime, lifetime: 1, lingerFrom: later },
  ])
    expect(() =>
      sourceLifetimeSettlement(policy, state, [particle], { now: sample.now, stopped: true })
    ).toThrow();
});
