import * as THREE from 'three';
import { HAWKSHOT_DARKNESS as D } from '../content/hawkshot-darkness';
import { arrivalDarkness } from './hawkshot-darkness-state';
import { hawkshotSmokeTextures } from './hawkshot-smoke';
import { hawkshotWindErosion } from './hawkshot-wind';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

export class HawkshotDarkness {
  readonly meshes = new Map<number, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private geometry = new THREE.PlaneGeometry(1, 1);
  private spin = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 0, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, camera: THREE.Camera) {
    const active = new Set<number>();
    for (const area of world.visionAreas) {
      if (area.kind !== 'scout' || !area.flight) continue;
      const p = arrivalDarkness(area.flight, world.time);
      if (!p) continue;
      const point = { x: area.x + p.offset[0], y: area.y + p.offset[2] };
      if (area.team !== 'blue' && !world.pointVisible(point)) continue;
      const id = area.flight.id;
      active.add(id);
      let mesh = this.meshes.get(id);
      if (!mesh) {
        const { texture } = hawkshotSmokeTextures();
        const erosion = hawkshotWindErosion();
        const uniforms = {
          darknessFrame: { value: p.frame },
          darknessDrive: { value: p.erosion },
          darknessErosion: { value: erosion },
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
        material.userData = { sourceEmitter: 'DarknessFollow', uniforms };
        material.customProgramCacheKey = () => 'hawkshot-darkness-blue-erosion-v1';
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.fragmentShader =
            'uniform float darknessFrame;\nuniform float darknessDrive;\nuniform sampler2D darknessErosion;\n' +
            shader.fragmentShader.replace(
              '#include <map_fragment>',
              `
vec2 darknessUv = vMapUv * 0.5 + vec2(mod(darknessFrame, 2.0), 1.0 - floor(darknessFrame / 2.0)) * 0.5;
diffuseColor *= texture2D(map, darknessUv);
float threshold = darknessDrive - texture2D(darknessErosion, darknessUv).b;
diffuseColor.a *= clamp((threshold + 1.5) * 10.0, 0.0, 1.0) - clamp(threshold * 10.0, 0.0, 1.0);`
            );
        };
        mesh = new THREE.Mesh(this.geometry, material);
        mesh.name = 'DarknessFollow';
        this.scene.add(mesh);
        this.meshes.set(id, mesh);
      }
      mesh.position.set(point.x * 0.01, this.ground(area) + p.offset[1] * 0.01, point.y * 0.01);
      mesh.scale.setScalar(p.size);
      camera
        .getWorldQuaternion(mesh.quaternion)
        .multiply(this.spin.setFromAxisAngle(this.axis, p.rotation));
      mesh.material.opacity = p.alpha;
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
