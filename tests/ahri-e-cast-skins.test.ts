import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { eVisualGameplaySamples, type EVisualGameplayCase } from './helpers/ahri-e-visual-gameplay';
import { TargetPoseSampler } from '../src/render/target-pose-sampler';
import { AhriECastSkins } from '../src/render/ahri-e-cast-skins';
import { eVisualGroups } from '../src/render/ahri-e-history';
import { ahriEParticles } from '../src/render/ahri-e-particles';
import { AHRI_E_SKIN_BINDINGS } from '../src/render/ahri-e-skin-bindings';

function setup(scenario: EVisualGameplayCase = 'hit') {
  const snapshot = eVisualGameplaySamples(World, PRACTICE_FIXTURE, scenario).find(
    (s) => s.tick === 45
  )!.snapshot;
  const world = World.fromSnapshot(snapshot, PRACTICE_FIXTURE);
  const reference = new THREE.Group(),
    bone = new THREE.Bone();
  reference.scale.setScalar(0.01);
  reference.add(bone);
  const geometry = new THREE.BufferGeometry(),
    materials = ['Body', 'Eyes', 'Tails', 'Tail_Large'].map((name) => {
      const material = new THREE.MeshBasicMaterial();
      material.name = name;
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(new THREE.Skeleton([bone]));
      reference.add(mesh);
      return material;
    });
  const texture = new THREE.Texture(),
    samplers: TargetPoseSampler[] = [];
  const view = new AhriECastSkins(
    new THREE.Scene(),
    () => 2,
    () => {
      const sampler = new TargetPoseSampler(
        reference,
        Object.entries(MOBILE_CLIP_DURATIONS['ahri-base']).map(
          ([name, seconds]) => new THREE.AnimationClip(name, seconds, [])
        )
      );
      vi.spyOn(sampler, 'dispose');
      samplers.push(sampler);
      return sampler;
    }
  );
  const assets = { texture: () => texture, mesh: () => geometry };
  const draw = (w = world, tick = w.tick) => {
    const groups = eVisualGroups(w.ahriEVisuals[0]).map((group) => ({
      group,
      particles: ahriEParticles(
        group.system,
        group.seed,
        (tick - group.startTick) / 60,
        (group.stopTick - group.startTick) / 60
      ),
    }));
    view.update(w, tick, groups, assets);
    return groups;
  };
  const release = () => {
    view.dispose();
    geometry.dispose();
    texture.dispose();
    for (const m of materials) m.dispose();
  };
  return { world, view, texture, geometry, materials, samplers, draw, release };
}
function frame(view: AhriECastSkins) {
  return [...view.models].map(([key, m]) => ({
    key,
    position: m.root.position.toArray(),
    rotation: m.root.rotation.toArray(),
    color: m.material.uniforms.particleColor.value.toArray(),
    erosion: m.material.uniforms.erosionParameters.value.toArray(),
    uv: m.material.uniforms.sourceUvTransform.value.toArray(),
  }));
}
test('E cast skin draws only Tails with sampled appearance and owns no source geometry/materials', () => {
  const { world, view, draw, release, texture, geometry, materials, samplers } = setup();
  const textureDispose = vi.spyOn(texture, 'dispose'),
    geometryDispose = vi.spyOn(geometry, 'dispose');
  const borrowedDispose = materials.map((m) => vi.spyOn(m, 'dispose'));
  const before = world.snapshot(),
    groups = draw();
  expect(world.snapshot()).toBe(before);
  expect(view.models.size).toBe(1);
  const instance = [...view.models.values()][0],
    visible: string[] = [];
  instance.sampler.renderRoot.traverse((node) => {
    if (node instanceof THREE.Mesh && node.visible)
      visible.push(node.material === instance.material ? 'Tails' : 'unexpected');
  });
  expect(visible).toEqual(['Tails']);
  const binding = AHRI_E_SKIN_BINDINGS.find((p) => p.system === 'Ahri_E_cas')!;
  const packet = groups
    .find((g) => g.group.role === 'cast')!
    .particles.find((p) => p.profileIndex === binding.profileIndex)!;
  expect(instance.material.uniforms.particleColor.value.toArray()).toEqual(packet.color);
  expect(instance.material.uniforms.erosionParameters.value.x).toBe(packet.erosion);
  expect(instance.material.uniforms.fresnelPower.value).toBe(binding.fresnelPower);
  expect(instance.material.fragmentShader).toContain('if (lit.a < alphaRef) discard;');
  const ownedDispose = vi.spyOn(instance.material, 'dispose');
  draw(world, world.tick + 360);
  expect(view.models.size).toBe(0);
  expect(ownedDispose).toHaveBeenCalledTimes(1);
  expect(samplers[0].dispose).toHaveBeenCalledTimes(1);
  expect(textureDispose).not.toHaveBeenCalled();
  expect(geometryDispose).not.toHaveBeenCalled();
  for (const spy of borrowedDispose) expect(spy).not.toHaveBeenCalled();
  release();
});
test('E cast skin reconstructs the same frame after actual save restoration', () => {
  const { world, view, draw, release, samplers } = setup('moving-caster');
  draw();
  const expected = frame(view),
    saved = world.snapshot();
  const copy = World.fromSnapshot(saved, world.battlefield);
  draw(copy);
  expect(frame(view)).toEqual(expected);
  expect(copy.snapshot()).toBe(saved);
  expect(samplers[0].dispose).toHaveBeenCalledTimes(1);
  release();
});
test('a hidden cast birth cannot replay its Tails overlay after source visibility returns', () => {
  const { world, view, draw, release } = setup('hidden-reveal');
  vi.spyOn(world, 'visible').mockReturnValue(true);
  expect(world.ahriEVisuals[0].sourceFrames.at(-1)!.audience).toContain('blue');
  draw();
  expect(view.models.size).toBe(0);
  release();
});
