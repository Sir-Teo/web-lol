import { expect, test } from 'vitest';
import { LUX_GROUND_CHARGE } from '../src/content/lux-ground-charge';
import { luxGroundChargeParticles } from '../src/render/lux-ground-charge-particles';
import { luxBeamBirthOffset } from '../src/render/lux-beam-birth-offset';

test('ground charge retains thirteen source layers and both width-indicator particles', () => {
  const particles = luxGroundChargeParticles(12345, 0);
  expect(LUX_GROUND_CHARGE).toHaveLength(13);
  expect(particles).toHaveLength(14);
  expect(particles.filter((p) => p.name === 'CHARGE_GROUND_LIGHT1').map((p) => p.ordinal)).toEqual([
    1, 2,
  ]);
  for (const p of particles) {
    const profile = LUX_GROUND_CHARGE.find((v) => v.name === p.name)!;
    expect(p.offset).toEqual(profile.geometry.offset);
    expect(p.color[3]).toBe(0);
    expect(p.halfSize[0]).toBeCloseTo(profile.geometry.birthSize[0] * 0.800000011920929, 9);
    expect(p.rotation).toEqual(profile.geometry.rotation);
  }
});

test('ground origin glows apply uniform size after scale; other axes keep their source dimensions', () => {
  const age = 0.4,
    particles = luxGroundChargeParticles(99, age);
  for (const p of particles) {
    const profile = LUX_GROUND_CHARGE.find((v) => v.name === p.name)!,
      scale = 0.800000011920929 + ((1 - 0.800000011920929) * age) / p.life;
    expect(p.halfSize[0]).toBeCloseTo(profile.geometry.birthSize[0] * scale, 9);
    expect(p.halfSize[1]).toBeCloseTo(
      profile.geometry.uniformScale ? p.halfSize[0] : profile.geometry.birthSize[1],
      9
    );
    p.offset.forEach((v, i) =>
      expect(v).toBeCloseTo(profile.geometry.offset[i] + profile.geometry.velocity[i] * age, 9)
    );
  }
  for (const stem of ['Far_Refraction_', 'Far_Refraction_1', 'CLOSE_Refraction_']) {
    const left = stem === 'Far_Refraction_1' ? 'Far_Refraction_L1' : `${stem}L`,
      right = left.replace('_L', '_R');
    expect(
      particles.find((p) => p.name === left)!.offset[0] +
        particles.find((p) => p.name === right)!.offset[0]
    ).toBeCloseTo(0, 9);
  }
});

test('ground UV scroll matches independent linear-rate accumulation and stable birth phases', () => {
  const age = 19.25 / 60,
    particles = luxGroundChargeParticles(472, age),
    born = luxGroundChargeParticles(472, 0);
  for (let index = 0; index < particles.length; index++) {
    const p = particles[index],
      profile = LUX_GROUND_CHARGE.find((v) => v.name === p.name)!;
    const rate = profile.multScrollCurve.dynamics!.values.at(-1)![0];
    const integral = (rate * ((19 * 20) / 2 + 0.25 * 20)) / (3600 * p.life);
    expect(p.multOffset[0] - born[index].multOffset[0]).toBeCloseTo(integral, 10);
    expect(p.multOffset[1]).toBe(born[index].multOffset[1]);
    expect(born[index].multOffset).toEqual(luxBeamBirthOffset(profile.multBirth, p.chance));
  }
  const width = born.filter((p) => p.name === 'CHARGE_GROUND_LIGHT1');
  expect(width[0].multOffset).not.toEqual(width[1].multOffset);
  expect(luxGroundChargeParticles(472, age)).toEqual(particles);
  expect(luxGroundChargeParticles(473, age).map((p) => p.multOffset)).not.toEqual(
    particles.map((p) => p.multOffset)
  );
});

test('source peak colors include birth tint and all ground charges expire before release', () => {
  const life = LUX_GROUND_CHARGE[0].life;
  for (const profile of LUX_GROUND_CHARGE) {
    const curve = profile.color.dynamics!;
    for (let i = 0; i < curve.times.length; i++) {
      if (curve.times[i] >= 1) continue;
      const p = luxGroundChargeParticles(55, profile.life * curve.times[i]).find(
        (v) => v.name === profile.name
      )!;
      p.color.forEach((v, axis) =>
        expect(v).toBeCloseTo(curve.values[i][axis] * profile.birthColor[axis], 9)
      );
    }
  }
  for (const age of [-1, NaN, Infinity, life, 1])
    expect(luxGroundChargeParticles(55, age)).toEqual([]);
  expect(luxGroundChargeParticles(55, life - 1e-6)).toHaveLength(14);
});
