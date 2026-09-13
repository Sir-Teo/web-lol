import * as THREE from 'three';
import { HAWKSHOT_LINGER_AURORA as D } from '../content/hawkshot-linger-aurora';
import { lingerAurora } from './hawkshot-linger-aurora-state';
import { hawkshotSmokeTextures } from './hawkshot-smoke';
import { hawkshotWindErosion } from './hawkshot-wind';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let multiply: THREE.Texture | undefined;
export async function loadLingerAurora() {
  multiply = await new THREE.TextureLoader().loadAsync(
    '/assets/effects/hawkshot-linger-multiply.png'
  );
  multiply.colorSpace = THREE.NoColorSpace;
  multiply.wrapS = multiply.wrapT = THREE.RepeatWrapping;
}
export class HawkshotLingerAurora {
  readonly meshes = new Map<number, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private geometry = new THREE.PlaneGeometry(1, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World) {
    const active = new Set<number>();
    for (const area of world.scoutVisuals) {
      const p = lingerAurora(area, world.time);
      if (!p) continue;
      const point = { x: p.x, y: p.y };
      if (area.team !== 'blue' && !world.pointVisible(point)) continue;
      const id = area.flight.id;
      active.add(id);
      let mesh = this.meshes.get(id);
      if (!mesh) {
        if (!multiply) throw new Error('Linger multiplier is not loaded');
        const { texture } = hawkshotSmokeTextures();
        const erosion = hawkshotWindErosion();
        const uniforms = {
          darknessFrame: { value: p.frame },
          darknessDrive: { value: p.erosion },
          darknessErosion: { value: erosion },
          auroraMultiply: { value: multiply },
          auroraScroll: { value: new THREE.Vector2() },
        };
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          color: new THREE.Color().setRGB(D.color[0], D.color[1], D.color[2]),
          transparent: true,
          depthWrite: false,
        });
        material.blending = THREE.CustomBlending;
        material.blendSrc = THREE.SrcAlphaFactor;
        material.blendDst = THREE.OneFactor;
        material.userData = { sourceEmitter: 'LingerAurora', uniforms };
        material.customProgramCacheKey = () => 'hawkshot-linger-mult-blue-erosion-v1';
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.fragmentShader =
            'uniform sampler2D auroraMultiply;\nuniform vec2 auroraScroll;\nuniform float darknessFrame;\nuniform float darknessDrive;\nuniform sampler2D darknessErosion;\n' +
            shader.fragmentShader.replace(
              '#include <map_fragment>',
              `
vec2 darknessUv = vMapUv * 0.5 + vec2(mod(darknessFrame, 2.0), 1.0 - floor(darknessFrame / 2.0)) * 0.5;
diffuseColor *= texture2D(map, darknessUv);
diffuseColor *= texture2D(auroraMultiply, vec2(vMapUv.x, 1.0-vMapUv.y) + auroraScroll);
float threshold = darknessDrive - texture2D(darknessErosion, darknessUv).b;
diffuseColor.a *= clamp((threshold + 1.5) * 10.0, 0.0, 1.0) - clamp(threshold / ${D.featherOut}, 0.0, 1.0);`
            );
        };
        mesh = new THREE.Mesh(this.geometry, material);
        mesh.name = 'Hawkshot lingering Aurora';
        mesh.rotation.set(
          (D.rotation[0] * Math.PI) / 180,
          (D.rotation[1] * Math.PI) / 180,
          (D.rotation[2] * Math.PI) / 180,
          'ZYX'
        );
        mesh.scale.fromArray(D.scale).multiplyScalar(0.01);
        material.side = THREE.DoubleSide;
        material.forceSinglePass = true;
        this.scene.add(mesh);
        this.meshes.set(id, mesh);
      }
      mesh.position.set(point.x * 0.01, this.ground(area) + p.height, point.y * 0.01);
      mesh.material.opacity = p.alpha;
      mesh.material.userData.uniforms.auroraScroll.value.set(
        D.scroll[0] * p.age,
        D.scroll[1] * p.age
      );
      mesh.material.userData.uniforms.darknessFrame.value = p.frame;
      mesh.material.userData.uniforms.darknessDrive.value = p.erosion;
    }
    for (const [id, mesh] of this.meshes)
      if (!active.has(id)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.meshes.delete(id);
      }
  }
}
