import * as THREE from 'three';
import { LUX_R } from '../content/lux-r';
import { TICK_RATE } from '../content/rules';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LuxBeam } from '../simulation/types';

// Interim spatial presentation, not the native Lux particle system.
const SEGMENTS = 64;
const SCALE = 0.01;
export class LuxBeams {
  readonly models = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private readonly ribbon = this.createRibbon();
  private createRibbon(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 128, 0);
    for (const [at, alpha] of [
      [0, 0],
      [0.25, 0.15],
      [0.43, 0.65],
      [0.5, 1],
      [0.57, 0.65],
      [0.75, 0.15],
      [1, 0],
    ])
      gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 1);
    return new THREE.CanvasTexture(canvas);
  }
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}

  update(world: World, alpha: number): void {
    const beams: (LuxBeam & { charging?: boolean })[] = [...world.luxBeams];
    for (const source of world.units) {
      const cast = world.championState(source.id)?.pendingCast;
      if (source.champion === 'lux' && cast?.ability === 'r' && cast.origin)
        beams.push({
          id: -source.id,
          sourceId: source.id,
          team: source.team,
          origin: cast.origin,
          point: cast.point,
          startTick: cast.startTick,
          charging: true,
        });
    }
    const active = new Set<number>();
    for (const beam of beams) {
      active.add(beam.id);
      let mesh = this.models.get(beam.id);
      if (!mesh) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(SEGMENTS * 18), 3).setUsage(
            THREE.DynamicDrawUsage
          )
        );
        const uv = new Float32Array(SEGMENTS * 12);
        for (let i = 0; i < SEGMENTS; i++) uv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * 12);
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            transparent: true,
            map: this.ribbon,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          })
        );
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.models.set(beam.id, mesh);
      }
      mesh.material.color.setHex(beam.charging ? 0xe65338 : 0xffe6a3);
      const age = Math.max(0, world.tick - beam.startTick + alpha - 1) / TICK_RATE;
      mesh.material.opacity = beam.charging
        ? 0.55
        : Math.max(0, 1 - age / LUX_R.presentationSeconds);
      const dx = beam.point.x - beam.origin.x,
        dy = beam.point.y - beam.origin.y;
      const length = Math.hypot(dx, dy),
        width = beam.charging ? 8 : LUX_R.halfWidth;
      const ox = (-dy / length) * width,
        oy = (dx / length) * width;
      const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      let vertex = 0;
      for (let i = 0; i < SEGMENTS; i++) {
        const a = {
          x: beam.origin.x + (dx * i) / SEGMENTS,
          y: beam.origin.y + (dy * i) / SEGMENTS,
        };
        const b = {
          x: beam.origin.x + (dx * (i + 1)) / SEGMENTS,
          y: beam.origin.y + (dy * (i + 1)) / SEGMENTS,
        };
        if (beam.team !== 'blue' && (!world.pointVisible(a) || !world.pointVisible(b))) continue;
        for (const [point, side] of [
          [a, -1],
          [a, 1],
          [b, 1],
          [a, -1],
          [b, 1],
          [b, -1],
        ] as const)
          positions.setXYZ(
            vertex++,
            (point.x + ox * side) * SCALE,
            this.ground(point) + 0.18,
            (point.y + oy * side) * SCALE
          );
      }
      positions.needsUpdate = true;
      mesh.geometry.setDrawRange(0, vertex);
      mesh.visible = vertex > 0;
    }
    for (const [id, mesh] of this.models)
      if (!active.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(id);
      }
  }
}
