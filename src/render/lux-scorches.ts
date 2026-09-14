import * as THREE from 'three';
import { LUX_SCORCHES } from '../content/lux-scorches';
import type { World } from '../simulation/world';
import { projectGroundQuad } from './ground-quad';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxScorchTextures() {
  await Promise.all(
    [...new Set(LUX_SCORCHES.map((p) => p.texture))].map(async (path) => {
      const t = await new THREE.TextureLoader().loadAsync(path);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      textures.set(path, t);
    })
  );
}
export class LuxScorches {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(private scene: THREE.Scene) {}
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<string>();
    for (const beam of world.luxBeams)
      for (const p of LUX_SCORCHES) {
        const age =
          (world.tick - beam.startTick + alpha - 1) / 60 + (world.winner ? terminalAge : 0);
        if (age < 0 || age >= p.life) continue;
        const key = `${beam.id}:${p.name}`;
        let mesh = this.models.get(key);
        if (!mesh) {
          const geometry = new THREE.BufferGeometry();
          projectGroundQuad(
            geometry,
            {
              origin: beam.origin,
              target: beam.point,
              offset: p.geometry.offset,
              halfSize: p.geometry.birthSize,
              rotation: p.geometry.rotation,
            },
            (point) => world.battlefield.heightAt(point)
          );
          if (!geometry.index) {
            geometry.dispose();
            continue;
          }
          geometry.userData.fullIndices = Array.from(geometry.index.array);
          const material = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendEquationAlpha: THREE.AddEquation,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha: THREE.SrcAlphaFactor,
            blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
            uniforms: {
              base: { value: textures.get(p.texture) },
              tint: { value: new THREE.Vector4() },
            },
            vertexShader:
              'varying vec2 at; void main(){at=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:
              'uniform sampler2D base; uniform vec4 tint; varying vec2 at; void main(){gl_FragColor=texture2D(base,fract(at))*tint;}',
          });
          groundEffectMaterial(material);
          mesh = new THREE.Mesh(geometry, material);
          mesh.name = p.name;
          mesh.renderOrder = p.pass;
          mesh.frustumCulled = false;
          setGroundRenderStage(mesh, 'ground');
          this.scene.add(mesh);
          this.models.set(key, mesh);
        }
        const curve = p.color.dynamics!;
        const phase = age / p.life;
        let i = 1;
        while (i < curve.times.length - 1 && phase > curve.times[i]) i++;
        const fraction = (phase - curve.times[i - 1]) / (curve.times[i] - curve.times[i - 1]);
        mesh.material.uniforms.tint.value.fromArray(
          curve.values[i].map(
            (v, axis) =>
              (curve.values[i - 1][axis] + (v - curve.values[i - 1][axis]) * fraction) *
              p.birthColor[axis]
          )
        );
        // Static cast footprint can reuse geometry; visibility changes only its index list.
        const geometry = mesh.geometry,
          position = geometry.getAttribute('position');
        const all = geometry.userData.fullIndices as number[],
          visible: number[] = [];
        for (let at = 0; at < all.length; at += 3) {
          const a = all[at],
            b = all[at + 1],
            c = all[at + 2];
          if (
            beam.team === 'blue' ||
            world.pointVisible({
              x: ((position.getX(a) + position.getX(b) + position.getX(c)) * 100) / 3,
              y: ((position.getZ(a) + position.getZ(b) + position.getZ(c)) * 100) / 3,
            })
          )
            visible.push(a, b, c);
        }
        const indices = geometry.index!;
        visible.forEach((v, i) => indices.setX(i, v));
        indices.needsUpdate = true;
        geometry.setDrawRange(0, visible.length);
        if (visible.length) active.add(key);
      }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(key);
      }
  }
}
