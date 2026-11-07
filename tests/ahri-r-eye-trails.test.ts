import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { rVisualGameplaySamples } from './helpers/ahri-r-visual-gameplay';
import { rBuffVisualGroups, rBuffVisualPose } from '../src/render/ahri-r-persistent-history';
import {
  ahriRParticles,
  AHRI_R_PROFILES as profiles,
  AHRI_R_PREPARED_EYE_TRAIL_PROFILES,
} from '../src/render/ahri-r-particles';
import { rEyeTrailPoints } from '../src/render/ahri-r-eye-trails';
import { packedSourceTrailRibbon } from '../src/render/source-packed-trail-ribbon';
import { createRRibbonMaterial } from '../src/render/ahri-r-ribbon-material';
import { SourceParticleSurfaces } from '../src/render/source-particle-surfaces';
const snapshot = rVisualGameplaySamples(World, PRACTICE_FIXTURE, 'many-targets').find(
  (s) => s.tick === 60
)!.snapshot;
function setup() {
  const world = World.fromSnapshot(snapshot, PRACTICE_FIXTURE);
  world.step(110);
  const group = rBuffVisualGroups(world.ahriRVisuals[0])[0];
  const point = (tick: number) => {
    const pose = rBuffVisualPose(group, tick);
    return pose
      ? new THREE.Vector3(pose.x * 0.01 + 0.2, 3 + Math.sin(tick / 60) * 0.1, pose.y * 0.01)
      : null;
  };
  const particles = ahriRParticles(
    'Ahri_R_Eyes',
    group.seed,
    (world.tick - group.startTick) / 60,
    Infinity,
    {
      boundObjectSize: group.radius * 2,
      root: (time) => {
        const at = group.startTick + time * 60,
          position = point(at)!,
          pose = rBuffVisualPose(group, at)!;
        return {
          x: position.x * 100,
          y: position.z * 100,
          height: position.y * 100,
          facing: pose.facing,
        };
      },
    }
  );
  return { world, group, point, particles };
}
test('eye arbitrary-trail centres match shared surface placement without a missile tilt or ground projection', () => {
  const f = setup(),
    saved = f.world.snapshot(),
    texture = new THREE.Texture();
  const particles = f.particles.filter((p) =>
    AHRI_R_PREPARED_EYE_TRAIL_PROFILES.some((i) => i === p.profileIndex)
  );
  const points = rEyeTrailPoints(f.group, particles, f.point, f.world.tick, f.group.record.team);
  expect(new Set(points.map((p) => p.profileIndex))).toEqual(new Set([47, 48]));
  expect(points.every((p) => p.position[1] > 250)).toBe(true);
  const surfaces = new SourceParticleSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0, {
    name: 'eye trail placement proxy',
    attachment: 'saved eye root',
    profiles: profiles.map((p) => ({
      ...p,
      kind: p.kind === 'trail' ? 'quad' : p.kind,
      ground: false,
      uvMode: 0,
      directionVelocityScale: p.directionVelocityScale ?? 0,
      soft: null,
    })),
    assets: () => ({
      texture: () => texture,
      mesh: () => {
        throw Error('Eye trails borrow no mesh');
      },
    }),
    accepts: (index) => AHRI_R_PREPARED_EYE_TRAIL_PROFILES.some((i) => i === index),
    records: () => [
      { sourceId: f.group.record.sourceId, castTick: f.group.startTick, group: f.group },
    ],
    particles: () => particles,
    birthVisible: () => true,
    visible: () => true,
    pose: (_group, tick) => {
      const point = f.point(tick)!,
        pose = rBuffVisualPose(f.group, tick)!;
      return { x: point.x * 100, y: point.z * 100, facing: pose.facing };
    },
    attachmentPoint: (_group, tick) => f.point(tick),
    particleFacing: (p, born, current) => (p.particleLocal ? current : born),
    sampledStretch: true,
  });
  surfaces.update(f.world, 1, new THREE.PerspectiveCamera());
  points.forEach((point, index) => {
    const particle = particles[index],
      mesh = surfaces.models.get(`${f.group.key}:${particle.profileIndex}:${particle.ordinal}`)!;
    expect(mesh).toBeDefined();
    mesh.position
      .toArray()
      .forEach((value, axis) => expect(value).toBeCloseTo(point.position[axis] * 0.01, 11));
  });
  expect(f.world.snapshot()).toBe(saved);
  surfaces.dispose();
  texture.dispose();
});
test('ordinary eye ribbons need only current live points and split unavailable owned roots', () => {
  const f = setup(),
    points = rEyeTrailPoints(f.group, f.particles, f.point, f.world.tick, f.group.record.team);
  for (const index of [47, 48]) {
    const rows = points.filter((p) => p.profileIndex === index),
      profile = profiles[index];
    expect(rows.every((p) => p.odometer === 0)).toBe(true);
    const vertices = packedSourceTrailRibbon(rows, profile.trail!.cutoff!, null, 0, 3, false);
    expect(vertices.length).toBeGreaterThan(0);
    expect(vertices.every((v) => [...v.position, ...v.uv, ...v.color].every(Number.isFinite))).toBe(
      true
    );
  }
  const missing = rEyeTrailPoints(
    f.group,
    f.particles,
    () => null,
    f.world.tick,
    f.group.record.team
  );
  expect(missing.every((p) => !p.visible)).toBe(true);
  for (const index of [47, 48])
    expect(
      packedSourceTrailRibbon(
        missing.filter((p) => p.profileIndex === index),
        0,
        null,
        0,
        3,
        false
      )
    ).toEqual([]);
  const layout = rBuffVisualGroups(f.group.record).find((g) => g.system === 'Ahri_R_Ready_tar')!;
  expect(rEyeTrailPoints(layout, f.particles, f.point, f.world.tick)).toEqual([]);
});
test('eye trail materials bind their source texture without inventing soft depth or disposing borrowed assets', () => {
  const texture = new THREE.Texture(),
    disposed = vi.spyOn(texture, 'dispose');
  for (const index of [47, 48]) {
    const material = createRRibbonMaterial(index, {
      texture: () => texture,
      mesh: () => {
        throw Error('No eye mesh');
      },
    });
    expect(material.uniforms.sourceTexture.value).toBe(texture);
    expect(material.uniforms.softDepth).toBeUndefined();
    expect(material.userData.unboundPalette).toBe(false);
    material.dispose();
  }
  expect(disposed).not.toHaveBeenCalled();
  texture.dispose();
});
