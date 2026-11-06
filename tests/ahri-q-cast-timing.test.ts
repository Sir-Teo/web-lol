import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI_Q_CAST_TIMING as T } from '../src/content/ahri-q-cast-timing';
import source from '../docs/reference/ahri/q-particles.json';
import binding from '../docs/reference/ahri/q-particle-bindings.json';
test('native ANM float samples independently agree with the explicit nearest-tick adapter', () => {
  const header = readFileSync('docs/reference/ahri/q-cast-animation-header.bin');
  const fps = Math.fround(1 / header.readFloatLE(36));
  const frame = binding.animationEvents.find((e) => e.resourceKey === 'Ahri_Q_Cas')!.declaration
    .mStartFrame!;
  const seconds = Math.fround(frame / fps);
  expect(header.readUInt32LE(32)).toBe(14);
  expect(Math.round(seconds * 60)).toBe(T.delayTicks);
  expect(T.delayTicks).toBe(10);
  expect(Math.ceil(seconds * 60)).toBe(11);
});
test('independent source lifetimes retain four seconds after delayed birth without adding raw linger', () => {
  const e = source.resources.Ahri_Q_Cas.definition.complexEmitterDefinitionData;
  expect(Math.ceil(Math.max(...e.map((e) => e.particleLifetime.constantValue)) * 60)).toBe(
    T.maximumParticleTicks
  );
  expect(T.historyTicks).toBe(T.delayTicks + T.maximumParticleTicks);
  expect(T.historyTicks).toBe(250);
});
