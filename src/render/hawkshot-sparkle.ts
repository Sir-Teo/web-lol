import * as THREE from 'three';
import { HAWKSHOT_SPARKLE as S } from '../content/hawkshot-sparkle';
import { sparkleParticles } from './hawkshot-sparkle-state';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let texture: THREE.Texture | undefined;
export async function loadHawkshotSparkle() {
  texture = await new THREE.TextureLoader().loadAsync(
    'assets/effects/hawkshot-linger-sparkle.png'
  );
  texture.colorSpace = THREE.SRGBColorSpace;
}
export class HawkshotSparkle {
  readonly meshes = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private geometry = new THREE.PlaneGeometry(1, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, camera: THREE.Camera) {
    const active = new Set<string>();
    for (const effect of world.scoutVisuals)
      for (const p of sparkleParticles(effect, world.time)) {
        if (effect.team !== 'blue' && !world.pointVisible(p)) continue;
        const key = `${effect.flight.id}:${p.birth}`;
        active.add(key);
        let mesh = this.meshes.get(key);
        if (!mesh) {
          if (!texture) throw new Error('Hawkshot Sparkle is not loaded');
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: new THREE.Color().setRGB(S.color[0], S.color[1], S.color[2]),
            transparent: true,
            depthWrite: false,
          });
          material.blending = THREE.CustomBlending;
          material.blendSrc = THREE.SrcAlphaFactor;
          material.blendDst = THREE.OneFactor;
          material.userData.sourceEmitter = 'Sparkle';
          mesh = new THREE.Mesh(this.geometry, material);
          mesh.name = 'Hawkshot lingering Sparkle';
          mesh.renderOrder = S.renderOrder;
          this.meshes.set(key, mesh);
          this.scene.add(mesh);
        }
        mesh.position.set(p.x * 0.01, this.ground(effect) + p.height, p.y * 0.01);
        mesh.scale.setScalar(p.size);
        camera.getWorldQuaternion(mesh.quaternion);
        mesh.material.opacity = p.alpha;
      }
    for (const [key, mesh] of this.meshes)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.meshes.delete(key);
      }
  }
}
