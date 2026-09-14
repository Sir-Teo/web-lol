import * as THREE from 'three';
import type { World } from '../simulation/world';
import { LUX_GROUND_CHARGE } from '../content/lux-ground-charge';
import { luxGroundChargeParticles } from './lux-ground-charge-particles';
import { projectGroundQuad } from './ground-quad';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxGroundChargeTextures() {
  await Promise.all(
    [...new Set(LUX_GROUND_CHARGE.flatMap((p) => [p.texture, p.mult]))].map(async (path) => {
      const t = await new THREE.TextureLoader().loadAsync(path);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      textures.set(path, t);
    })
  );
}
export class LuxGroundCharge {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(private scene: THREE.Scene) {}
  update(world: World, alpha: number) {
    const active = new Set<string>();
    for (const unit of world.units) {
      const cast = world.championState(unit.id)?.pendingCast;
      if (unit.champion !== 'lux' || cast?.ability !== 'r' || !cast.origin) continue;
      const age = (world.tick - cast.startTick + alpha - 1) / 60;
      for (const p of luxGroundChargeParticles(
        unit.id ^ Math.imul(cast.startTick, 0x9e3779b9),
        age
      )) {
        const profile = LUX_GROUND_CHARGE.find((layer) => layer.emitterIndex === p.emitterIndex)!;
        const key = `${unit.id}:${cast.startTick}:${p.name}:${p.ordinal}`;
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
              turn: { value: (profile.uvRotation * Math.PI) / 180 },
              multScale: { value: new THREE.Vector2().fromArray(profile.uvScaleMult) },
            },
            vertexShader:
              'varying vec2 at;void main(){at=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: `uniform sampler2D base;uniform sampler2D mult;uniform vec4 tint;uniform vec2 offset;uniform float turn;uniform vec2 multScale;varying vec2 at;
       void main(){vec2 c=at-0.5;vec2 b=vec2(c.x*cos(turn)-c.y*sin(turn),c.x*sin(turn)+c.y*cos(turn))+0.5;
       vec2 m=fract((at-0.5)*multScale+0.5+offset);gl_FragColor=texture2D(base,fract(b))*texture2D(mult,m)*tint;}`,
          });
          groundEffectMaterial(material);
          mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
          mesh.name = p.name;
          mesh.renderOrder = profile.pass;
          mesh.frustumCulled = false;
          setGroundRenderStage(mesh, 'ground');
          this.scene.add(mesh);
          this.models.set(key, mesh);
        }
        const g = mesh.geometry;
        // The authored charge scale never exceeds one; allocate its maximum grid once.
        const size = profile.geometry.birthSize,
          grid: [number, number] = [
            Math.max(1, Math.ceil((2 * Math.abs(size[0])) / 50)),
            Math.max(
              1,
              Math.ceil((2 * Math.abs(profile.geometry.uniformScale ? size[0] : size[1])) / 50)
            ),
          ];
        projectGroundQuad(
          g,
          {
            origin: cast.origin,
            target: cast.point,
            offset: p.offset,
            halfSize: p.halfSize,
            rotation: p.rotation,
          },
          (point) => world.battlefield.heightAt(point),
          50,
          2,
          grid
        );
        if (!g.index) continue;
        if (!g.userData.fullIndices) g.userData.fullIndices = Array.from(g.index.array);
        mesh.material.uniforms.tint.value.fromArray(p.color);
        mesh.material.uniforms.offset.value.fromArray(p.multOffset);
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
