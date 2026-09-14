import * as THREE from 'three';
import type { World } from '../simulation/world';
import { LUX_GROUND_WARNINGS } from '../content/lux-ground-warnings';
import { sampleParticleCurve, accumulateParticleCurve } from './particle-curves';
import { projectGroundBeam } from './ground-beam';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxGroundWarningTextures() {
  await Promise.all(
    [...new Set(LUX_GROUND_WARNINGS.flatMap((p) => [p.texture, p.mult]))].map(async (path) => {
      const t = await new THREE.TextureLoader().loadAsync(path);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      textures.set(path, t);
    })
  );
}
export class LuxGroundWarnings {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(private scene: THREE.Scene) {}
  update(world: World, alpha: number) {
    const active = new Set<string>();
    for (const unit of world.units) {
      const cast = world.championState(unit.id)?.pendingCast;
      if (unit.champion !== 'lux' || cast?.ability !== 'r' || !cast.origin) continue;
      const age = (world.tick - cast.startTick + alpha - 1) / 60;
      for (const profile of LUX_GROUND_WARNINGS) {
        if (age < 0 || age >= profile.life) continue;
        const phase = age / profile.life;
        const width =
          profile.geometry.birthSize[0] *
          sampleParticleCurve(profile.geometry.scale.dynamics!, phase, 0);
        const color = profile.birthColor.map(
          (v, axis) => v * sampleParticleCurve(profile.color.dynamics!, phase, axis)
        );
        const scroll = [0, 1].map((axis) =>
          accumulateParticleCurve(profile.scrollCurve.dynamics!, age, profile.life, axis)
        );
        const key = `${unit.id}:${cast.startTick}:${profile.name}`;
        let mesh = this.models.get(key);
        if (!mesh) {
          const material = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendEquationAlpha: THREE.AddEquation,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendSrcAlpha: THREE.SrcAlphaFactor,
            blendDstAlpha: THREE.OneFactor,
            uniforms: {
              base: { value: textures.get(profile.texture) },
              mult: { value: textures.get(profile.mult) },
              tint: { value: new THREE.Vector4() },
              offset: { value: new THREE.Vector2() },
            },
            vertexShader:
              'varying vec2 at;void main(){at=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:
              'uniform sampler2D base;uniform sampler2D mult;uniform vec4 tint;uniform vec2 offset;varying vec2 at;void main(){gl_FragColor=texture2D(base,fract(at+offset.yx))*texture2D(mult,clamp(at,0.001,0.999))*tint;}',
          });
          groundEffectMaterial(material);
          mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
          mesh.name = profile.name;
          mesh.renderOrder = profile.pass;
          mesh.frustumCulled = false;
          setGroundRenderStage(mesh, 'ground');
          this.scene.add(mesh);
          this.models.set(key, mesh);
        }
        const g = mesh.geometry;
        const maxWidth =
          profile.geometry.birthSize[0] *
          Math.max(...profile.geometry.scale.dynamics!.values.map((v) => Math.abs(v[0])));
        projectGroundBeam(
          g,
          {
            origin: cast.origin,
            target: cast.point,
            halfWidth: width,
            sourceOffset: profile.geometry.beam!.mLocalSpaceSourceOffset[2],
            targetOffset: 0,
          },
          (point) => world.battlefield.heightAt(point),
          maxWidth
        );
        if (!g.index) continue;
        if (!g.userData.fullIndices) g.userData.fullIndices = Array.from(g.index.array);
        mesh.material.uniforms.tint.value.fromArray(color);
        mesh.material.uniforms.offset.value.fromArray(scroll);
        const position = g.getAttribute('position'),
          all = g.userData.fullIndices as number[];
        let count = 0;
        for (let i = 0; i < all.length; i += 3) {
          const a = all[i],
            b = all[i + 1],
            c = all[i + 2];
          if (
            unit.team !== 'blue' &&
            !world.pointVisible({
              x: ((position.getX(a) + position.getX(b) + position.getX(c)) * 100) / 3,
              y: ((position.getZ(a) + position.getZ(b) + position.getZ(c)) * 100) / 3,
            })
          )
            continue;
          g.index.setX(count++, a);
          g.index.setX(count++, b);
          g.index.setX(count++, c);
        }
        g.index.needsUpdate = true;
        g.setDrawRange(0, count);
        if (count) active.add(key);
      }
    }
    for (const [key, m] of this.models)
      if (!active.has(key)) {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        this.models.delete(key);
      }
  }
}
