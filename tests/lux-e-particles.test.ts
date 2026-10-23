import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pin from '../docs/reference/lux-e-vfx.json';
import coverage from '../docs/reference/lux-e-particle-coverage.json';
import profiles from '../src/content/lux-e-particles.json';
import { LUX_E_BURST_TICKS } from '../src/content/lux-e-particle-timing';
import { luxEParticles } from '../src/render/lux-e-particles';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

test('the complete six-resource pin preserves all emitter coverage and shipped source-image identities', () => {
  expect(Object.keys(pin.resources)).toHaveLength(6);
  expect(coverage.inventory).toHaveLength(65);
  expect(coverage.inventory.filter((e) => e.status === 'rendered static layer')).toHaveLength(
    profiles.length
  );
  for (const texture of pin.textures) expect(hash(texture.output)).toBe(texture.pngSHA256);
  const mesh = JSON.parse(readFileSync('public/assets/models/lux-e-indicator.json', 'utf8'));
  expect(hash('public/' + mesh.output.path)).toBe(mesh.output.sha256);
  expect(mesh.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  expect(mesh.source.sha256).toBe(
    pin.meshes.find((m) => m.path.endsWith('_indicator.scb'))!.sha256
  );
  expect(mesh.triangles).toBe(480);
});
test('source bursts begin on the phase update, seek independently and preserve shared birth choices', () => {
  expect(luxEParticles('flight', 817, -1 / 60)).toEqual([]);
  expect(luxEParticles('flight', 817, 0).length).toBeGreaterThan(0);
  const a = luxEParticles('flight', 817, 0.2);
  luxEParticles('enemy', 123, 4);
  expect(luxEParticles('flight', 817, 0.2)).toEqual(a);
  expect(luxEParticles('flight', 818, 0.2)).not.toEqual(a);
  expect(a.every((p) => [...p.scale, ...p.color, ...p.rotation].every(Number.isFinite))).toBe(true);
  const flash = a.filter((p) => profiles[p.profileIndex].name === 'LaunchFlash');
  expect(flash).toHaveLength(2);
  expect(flash[0].rotation).not.toEqual(flash[1].rotation);
});
test('blue and red source fields use distinct authored tint/texture records without changing perimeter geometry', () => {
  const blue = profiles.find((p) => p.role === 'ally' && p.primitive === 'mesh')!;
  const red = profiles.find((p) => p.role === 'enemy' && p.primitive === 'mesh')!;
  expect(blue.texture).not.toBe(red.texture);
  expect(blue.color).not.toEqual(red.color);
  expect(blue.size).toEqual(red.size);
  expect(blue.size.value).toEqual([12, 0, 12]);
  expect(luxEParticles('ally', 91, 5).length).toBeGreaterThan(0);
  expect(luxEParticles('enemy', 91, 5).length).toBeGreaterThan(0);
});
test('the longest selected burst survives beyond the old tail and retires at its source-derived bound', () => {
  expect(
    luxEParticles('burst', 51, 0.4).some((p) => profiles[p.profileIndex].name === 'CenterFlare2')
  ).toBe(true);
  expect(luxEParticles('burst', 51, LUX_E_BURST_TICKS / 60)).toEqual([]);
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: lux });
  w.step(16);
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: lux });
  w.step();
  const detonation = w.singularities[0].detonatedTick!;
  expect(detonation).toBe(w.tick);
  w.step(24);
  expect(w.singularities).toHaveLength(1);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  w.step(LUX_E_BURST_TICKS - 24);
  copy.step(LUX_E_BURST_TICKS - 24);
  expect(w.singularities).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
});
