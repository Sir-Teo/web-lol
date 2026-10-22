import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import profiles from '../src/content/oracle-particles.json';
import { oracleChildTick, oracleParticles, oracleValue } from '../src/render/oracle-particle-state';
import { particleTravel } from '../src/render/particle-motion';
import { createOracleParticleMaterial } from '../src/render/oracle-particles';
import * as THREE from 'three';
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const buff = { role: 'buff', startTick: 0, stopTick: 480 } as const;
const find = (name: string, tick: number) =>
  oracleParticles(17, buff, tick).filter((p) => profiles[p.profileIndex].name === name);

test('all 17 frozen declarations preserve their curves, multiplier tables and exact dependency hashes', () => {
  const audit = JSON.parse(readFileSync('docs/reference/oracle-particle-profiles.json', 'utf8'));
  expect(audit.sourcePinSha256).toBe(hash('docs/reference/oracle-lens-source.json'));
  expect(audit.assetsSha256).toBe(hash('docs/reference/oracle-lens-assets.json'));
  expect(audit.defaultsEvidenceSha256).toBe(hash('docs/reference/garen-spin-defaults.json'));
  expect(audit.readerEvidenceSha256).toBe(hash('docs/reference/garen-q-cast-reader.json'));
  expect(audit.output.sha256).toBe(hash(audit.output.path));
  const pin = JSON.parse(readFileSync('docs/reference/oracle-lens-source.json', 'utf8'));
  const fields = {
    life: 'particleLifetime',
    bind: 'bindWeight',
    size: 'birthScale0',
    scale: 'scale0',
    birthColor: 'birthColor',
    color: 'Color',
    velocity: 'birthVelocity',
    drag: 'birthDrag',
    acceleration: 'worldAcceleration',
    orbital: 'birthOrbitalVelocity',
    rotation: 'birthRotation0',
    angularVelocity: 'birthRotationalVelocity0',
    position: 'EmitterPosition',
    scroll: 'birthUvScrollRate',
    uvOffset: 'birthUVOffset',
  };
  expect(profiles.map((p) => p.role)).toEqual([
    ...Array(12).fill('buff'),
    ...Array(4).fill('death'),
    'alert',
  ]);
  for (const p of profiles) {
    const system = pin.items.records[audit.systems[p.role]],
      raw = system.complexEmitterDefinitionData[p.index];
    expect(p.name).toBe(raw.emitterName);
    expect(p.rawEmitterSha256).toBe(
      audit.profiles.find((e: any) => e.role === p.role && e.index === p.index).rawEmitterSha256
    );
    for (const [target, key] of Object.entries(fields))
      if (raw[key]) {
        const value = p[target as keyof typeof fields],
          original = raw[key];
        if (original.constantValue !== undefined)
          expect(value.constant).toEqual(
            Array.isArray(original.constantValue)
              ? original.constantValue
              : [original.constantValue]
          );
        expect(value.times).toEqual(original.dynamics?.times ?? []);
        expect(value.values).toEqual(
          (original.dynamics?.values ?? []).map((v: unknown) => (Array.isArray(v) ? v : [v]))
        );
        expect(value.probabilities.map((t) => [t.times, t.values, t.single])).toEqual(
          (original.dynamics?.probabilityTables ?? []).map((t: any) => [
            t.keyTimes ?? [],
            t.keyValues ?? [],
            t.singleValue ?? 1,
          ])
        );
      }
    expect(p.spawnAxes.length).toBe(p.spawnAngles.length);
    expect(p.atlas.frames).toBe(raw.numFrames ?? 1);
    expect(p.hudProjection).toBe(system.hudAnchorPositionFromWorldProjection ?? false);
  }
  expect(profiles[16].hudProjection).toBe(false);
  expect([profiles[8].atlas.frames, profiles[12].atlas.frames, profiles[15].atlas.frames]).toEqual([
    1, 1, 1,
  ]);
  expect(profiles[9].childRole).toBe('death');
  expect(
    pin.items.records[audit.systems.buff].complexEmitterDefinitionData[9].childParticleSetDefinition
  ).toMatchObject({ childEmitOnDeath: true, childrenIdentifiers: [{ effectKey: '{b28120e6}' }] });
});

test('birth updates honor source delay, burst counts and continuous emitter budgets', () => {
  expect(oracleParticles(17, buff, 0)).toEqual([]);
  expect(find('IconGlow', 1)).toHaveLength(2);
  expect(find('LaserBurst', 1)).toHaveLength(5);
  expect(find('IntroSparks', 1)).toHaveLength(20);
  expect(find('Trinket_Red', 6)).toHaveLength(0);
  expect(find('Trinket_Red', 7)).toHaveLength(1);
  expect(find('Lasers', 39)).toHaveLength(1);
  expect(find('Lasers', 40)).toHaveLength(2);
  expect(find('Sparkles', 8)).toHaveLength(2);
  expect(find('CoreLaser', 80)).toHaveLength(0);
});

test('temporal birth lifetimes and sizes are sampled separately from probability multipliers', () => {
  const p = profiles[5];
  expect(oracleValue(p.life, 0.95, 1)[0]).toBeCloseTo(1);
  expect(oracleValue(p.life, 0.975, 1)[0]).toBeCloseTo(0.5, 5);
  expect(oracleValue(p.life, 1, 1)[0]).toBe(0);
  expect(oracleValue(p.life, 0.975, 0)[0]).toBeCloseTo(0.25, 5);
  const size = profiles[14].size;
  oracleValue(size, 0.5, 0).forEach((v, i) => expect(v).toBeCloseTo([0.45, 0.09, 0.45][i]));
  expect(oracleValue(profiles[1].rotation, 0, 0.7)).toEqual([0, -20, 0]);
  const table = profiles[15].velocity;
  expect(oracleValue(table, 0, 0.5)[1]).toBe(-550);
  expect(oracleValue(table, 0, 0.5000010132789612)[1]).toBe(550);
});

test('atlas animation and fractional UV division remain independent of scrolling and lookup UVs', () => {
  const core = find('CoreLaser', 12)[0];
  expect(core.uvScale).toEqual([1 / profiles[6].atlas.grid[0], 1]);
  expect(core.uvScale[0]).toBeCloseTo(1.96078435);
  expect(core.frame).toBe(0);
  const intro = find('Intro', 7)[0];
  expect(intro.frame).toBe(2);
  expect(intro.uvScale).toEqual([0.5, 0.2]);
  expect(intro.uvOffset).toEqual([0, 0.2]);
  expect(intro.lookup).toEqual([intro.phase, 1]);
  const texture = new THREE.Texture(),
    material = createOracleParticleMaterial(6, texture, texture);
  expect(material.vertexShader).toContain('(uv + sourceUvOffset) * sourceUvScale + atlasOffset');
  expect(material.blendSrc).toBe(THREE.SrcAlphaFactor);
  expect(material.blendDst).toBe(THREE.OneFactor);
  material.dispose();
  texture.dispose();
});

test('source child-on-death dispatch follows parent lifetime or local stop+linger, including canceled first births', () => {
  expect(oracleChildTick(0, null)).toBe(631);
  expect(oracleChildTick(0, 480)).toBe(510);
  expect(oracleChildTick(300, 780)).toBe(810);
  expect(oracleChildTick(0, 0)).toBeNull();
  expect(oracleChildTick(0, 1)).toBeNull();
  expect(oracleChildTick(0, 2)).toBe(32);
  expect(oracleParticles(17, { ...buff, stopTick: 1 }, 10)).toEqual([]);
  const death = { role: 'death', startTick: 510, stopTick: null } as const;
  expect(oracleParticles(17, death, 510)).toEqual([]);
  expect(oracleParticles(17, death, 511)).toHaveLength(67);
  expect(oracleParticles(17, death, 513).some((p) => p.profileIndex === 15)).toBe(true);
  expect(oracleParticles(17, death, 575)).toEqual([]);
});

test('stopping cuts emission, caps source linger and keeps the original appearance phase', () => {
  const before = find('Ring', 479.9)[0],
    stopped = find('Ring', 481)[0];
  expect(stopped.life).toBe(before.life);
  expect(stopped.phase).toBeCloseTo(8 / stopped.life);
  expect(find('Trinket_Red', 480)).toEqual([]);
  expect(find('Ring', 539)).toHaveLength(1);
  expect(find('Ring', 540)).toHaveLength(0);
  expect(oracleParticles(17, buff, 600)).toEqual([]);
});

test('random seeks are exact, finite and independent of unrelated draws', () => {
  const first = oracleParticles(17, buff, 32.25);
  oracleParticles(90, { role: 'death', startTick: 1, stopTick: null }, 18);
  oracleParticles(17, buff, 450);
  expect(oracleParticles(17, buff, 32.25)).toEqual(first);
  expect(oracleParticles(18, buff, 32.25)).not.toEqual(first);
  for (const role of ['buff', 'death', 'alert'] as const)
    for (let tick = 0; tick <= 660; tick += 3.25)
      for (const p of oracleParticles(
        17,
        { role, startTick: 0, stopTick: role === 'buff' ? 480 : role === 'alert' ? 60 : null },
        tick
      )) {
        expect(
          [
            ...p.offset,
            ...p.travel,
            ...p.scale,
            ...p.rotation,
            ...p.color,
            ...p.scroll,
            ...p.lookup,
            ...p.uvScale,
            ...p.uvOffset,
          ].every(Number.isFinite)
        ).toBe(true);
        expect(p.age).toBeGreaterThanOrEqual(0);
        expect(p.phase).toBeLessThan(1);
      }
});

test('shared fixed-grid motion preserves fractional-step travel and drag without mutating inputs', () => {
  const velocity = [60, 0, 0],
    acceleration = [0, -60, 0],
    drag = [0, 0, 0];
  const motion = particleTravel(velocity, acceleration, drag, 1.5 / 60);
  expect(motion.position).toEqual([1.5, -1 / 30, 0]);
  expect(motion.travel).toEqual([60, -2, 0]);
  expect(velocity).toEqual([60, 0, 0]);
  expect(acceleration).toEqual([0, -60, 0]);
  expect(particleTravel([0, 0, 0], [0, 0, 0], [4, 4, 4], 10)).toEqual({
    position: [0, 0, 0],
    travel: [0, 0, 0],
  });
});
