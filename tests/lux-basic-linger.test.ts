import { expect, it } from 'vitest';
import source from '../docs/reference/lux-basic-attack.json';
import {
  LUX_BASIC_LINGER as policies,
  luxBasicParticleLife,
  type LuxBasicEmitter,
} from '../src/content/lux-basic-linger';
import {
  LUX_ATTACK_PATH_FRAMES,
  LUX_ATTACK_VISUAL_TAIL_TICKS,
} from '../src/content/lux-attack-presentation';
import { luxHoopBirth } from '../src/render/lux-hoop-particles';

function binHash(name: string) {
  let hash = 0x811c9dc5;
  for (const c of name.toLowerCase()) hash = Math.imul(hash ^ c.charCodeAt(0), 0x01000193);
  return `{${(hash >>> 0).toString(16).padStart(8, '0')}}`;
}
it('matches authored linger values and verifies that named and hashed override fields are absent', () => {
  const names = { crescent: 'crescentwhite', trail: 'Trail', hoop: 'hoop' };
  for (const key of Object.keys(policies) as LuxBasicEmitter[]) {
    const e: any = source.data.complexEmitterDefinitionData.find(
      (e) => e.emitterName === names[key]
    );
    expect(policies[key].particleLinger).toBe(e.particleLinger);
    expect(policies[key].nominalLife).toBe(e.particleLifetime.constantValue);
    for (const field of ['particleLingerType', 'emitterLinger']) {
      expect(e).not.toHaveProperty(field);
      expect(e).not.toHaveProperty(binHash(field));
    }
    expect(policies[key].type).toBe(0);
    expect(policies[key].emitterLinger).toBe(0);
  }
});
it('caps total life at a stop without granting a fresh duration after impact', () => {
  expect(luxBasicParticleLife('trail', 0.5, true)).toBe(0.5);
  expect(luxBasicParticleLife('trail', 0.5, true) - 0.4).toBeCloseTo(0.1);
  expect(luxBasicParticleLife('trail', 2, true)).toBe(0.5);
  expect(luxBasicParticleLife('trail', 2, false)).toBe(2);
  expect(luxBasicParticleLife('crescent', 20, true)).toBe(policies.crescent.nominalLife + 10);
});
it('leaves every authored natural lifetime unchanged, including all hoop probability intervals', () => {
  for (const key of ['crescent', 'trail'] as const)
    expect(luxBasicParticleLife(key, policies[key].nominalLife, true)).toBe(
      policies[key].nominalLife
    );
  for (let i = 0; i <= 1000; i++) {
    const life = luxHoopBirth(i / 1000).life;
    expect(life).toBeLessThanOrEqual(policies.hoop.maxNaturalLife);
    expect(luxBasicParticleLife('hoop', life, true)).toBe(life);
  }
});
it('derives a retained tail covering the source float maximum and sufficient birth history', () => {
  expect(LUX_ATTACK_VISUAL_TAIL_TICKS).toBe(37);
  expect(LUX_ATTACK_PATH_FRAMES).toBe(40);
  const longest = Math.max(...Object.values(policies).map((p) => p.maxNaturalLife));
  expect((LUX_ATTACK_VISUAL_TAIL_TICKS - 1) / 60).toBeLessThan(longest);
  expect(LUX_ATTACK_VISUAL_TAIL_TICKS / 60).toBeGreaterThan(longest);
  expect((LUX_ATTACK_PATH_FRAMES - 1) / 60).toBeGreaterThan(longest);
});
