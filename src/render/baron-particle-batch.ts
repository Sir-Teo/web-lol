import * as THREE from 'three';
import { baronFlag, type BaronAttackProfile, type BaronAttackRole } from './baron-attack-program';
import type { BaronAttackSystem } from './baron-attack-system';
import type { BaronParticleResources } from './baron-particle-resources';
import { createBaronParticleMaterial } from './baron-particle-material';
import { sourceParticleBasis } from './source-particle-spin';
import { baronRibbon } from './baron-ribbon';

type Packet = ReturnType<BaronAttackSystem['packets']>[number];
const widths = {
  sourceTint: 4,
  sourceUvTurn: 3,
  sourceUvShift: 4,
  sourceMultTurn: 3,
  sourceMultShift: 4,
  sourceErosionMix: 4,
  sourceErosionDrive: 1,
};
const identityUv = { turn: 0, scaleU: 1, scaleV: 1, offsetU: 0, offsetV: 0, cellU: 0, cellV: 0 };
function fields(packet: Packet, ribbon = false) {
  const uv = ribbon ? identityUv : packet.uv,
    mult = packet.multUv ?? identityUv;
  return {
    sourceTint: packet.color,
    sourceUvTurn: [uv.turn, uv.scaleU, uv.scaleV],
    sourceUvShift: [uv.offsetU, uv.offsetV, uv.cellU, uv.cellV],
    sourceMultTurn: [mult.turn, mult.scaleU, mult.scaleV],
    sourceMultShift: [mult.offsetU, mult.offsetV, mult.cellU, mult.cellV],
    sourceErosionMix: packet.erosionMixer ?? [0, 0, 0, 1],
    sourceErosionDrive: [packet.erosion],
  };
}
function basis(packet: Packet) {
  const spin = sourceParticleBasis(packet.rotation),
    frame = packet.standingFrame,
    out = new Float32Array(9);
  for (let row = 0; row < 3; row++)
    for (let column = 0; column < 3; column++)
      out[row * 3 + column] =
        frame[row * 3] * spin[column] +
        frame[row * 3 + 1] * spin[3 + column] +
        frame[row * 3 + 2] * spin[6 + column];
  return out;
}
interface Batch {
  profile: BaronAttackProfile;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  trail: boolean;
}
/** One draw per emitter. Source centimetres become metres exactly once here;
 * mesh transports already contain metre vertices, so their scale is dimensionless.
 * Owner placement/height and birth-size calibration are explicit upstream policies. */
export class BaronParticleBatch {
  readonly root = new THREE.Group();
  private readonly batches: Batch[] = [];
  private closed = false;
  constructor(
    resources: BaronParticleResources,
    role: BaronAttackRole,
    private readonly capacity = 512
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 65535)
      throw RangeError('Invalid Baron draw capacity');
    this.root.name = `Baron source ${role} particles`;
    try {
      for (const profile of resources.program.profiles.filter((p) => p.role === role)) {
        const trail =
          profile.geometry.kind === 'arbitrary-trail' || profile.geometry.kind === 'camera-trail';
        let geometry: THREE.BufferGeometry;
        if (profile.geometry.kind === 'mesh') {
          const source = resources.meshes.get(profile.geometry.asset);
          if (!source) throw Error('Missing Baron drawing geometry');
          geometry = source.clone();
        } else if (trail) {
          if (
            !('mode' in profile.geometry) ||
            profile.geometry.mode !== 1 ||
            profile.geometry.smoothing !== 0 ||
            profile.material.multiplier
          )
            throw Error('Unsupported Baron ribbon closure');
          geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(capacity * 6 * 3), 3).setUsage(
              THREE.DynamicDrawUsage
            )
          );
          geometry.setAttribute(
            'uv',
            new THREE.BufferAttribute(new Float32Array(capacity * 6 * 2), 2).setUsage(
              THREE.DynamicDrawUsage
            )
          );
          geometry.setDrawRange(0, 0);
        } else {
          geometry = new THREE.PlaneGeometry(2, 2);
          const uv = geometry.getAttribute('uv'),
            position = geometry.getAttribute('position');
          for (let i = 0; i < uv.count; i++)
            uv.setXY(
              i,
              profile.geometry.kind === 'quad'
                ? position.getY(i) * 0.5 + 0.5
                : position.getX(i) * 0.5 + 0.5,
              profile.geometry.kind === 'quad'
                ? position.getX(i) * 0.5 + 0.5
                : 0.5 - position.getY(i) * 0.5
            );
        }
        for (const [name, width] of Object.entries(widths))
          geometry.setAttribute(
            name,
            trail
              ? new THREE.BufferAttribute(new Float32Array(capacity * 6 * width), width).setUsage(
                  THREE.DynamicDrawUsage
                )
              : new THREE.InstancedBufferAttribute(
                  new Float32Array(capacity * width),
                  width
                ).setUsage(THREE.DynamicDrawUsage)
          );
        const material = createBaronParticleMaterial(profile, resources.textures);
        const mesh = trail
          ? new THREE.Mesh(geometry, material)
          : new THREE.InstancedMesh(geometry, material, capacity);
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.count = 0;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        }
        mesh.name = `Baron ${role} ${profile.index} ${profile.name}`;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.renderOrder = profile.settings.pass ?? 0;
        this.root.add(mesh);
        this.batches.push({ profile, geometry, material, mesh, trail });
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  update(
    packets: readonly Packet[],
    camera: THREE.Camera,
    visible: (packet: Packet) => boolean = () => true
  ) {
    if (this.closed) throw Error('Baron particle batch is disposed');
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize(),
      up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize(),
      forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const matrix = new THREE.Matrix4();
    const write = (batch: Batch, index: number, packet: Packet, ribbon = false) => {
      for (const [name, value] of Object.entries(fields(packet, ribbon))) {
        const attribute = batch.geometry.getAttribute(name) as THREE.BufferAttribute;
        (attribute.array as Float32Array).set(value, index * attribute.itemSize);
      }
    };
    for (const batch of this.batches) {
      let selected = packets.filter((p) => p.emitter === batch.profile.index);
      if (selected.length > this.capacity)
        throw RangeError('Baron particle batch capacity exceeded');
      if (batch.trail) {
        const geometry = batch.profile.geometry;
        if (!('cutoff' in geometry)) throw Error('Missing Baron ribbon definition');
        const points = selected
          .sort((a, b) => a.serial - b.serial)
          .map((p) => {
            const b = basis(p);
            return { ...p, side: [b[0], b[3], b[6]], halfWidth: p.scale[0] };
          });
        const runs: (typeof points)[] = [];
        let run: typeof points = [];
        for (const point of points) {
          if (visible(point)) run.push(point);
          else {
            if (run.length) runs.push(run);
            run = [];
          }
        }
        if (run.length) runs.push(run);
        const vertices = runs.flatMap((points) =>
          baronRibbon(
            points,
            geometry.cutoff,
            geometry.kind === 'camera-trail' ? forward.toArray() : null
          )
        );
        const position = batch.geometry.getAttribute('position') as THREE.BufferAttribute,
          uv = batch.geometry.getAttribute('uv') as THREE.BufferAttribute;
        for (const [i, v] of vertices.entries()) {
          position.setXYZ(i, v.position[0] * 0.01, v.position[1] * 0.01, v.position[2] * 0.01);
          uv.setXY(i, v.uv[0], v.uv[1]);
          write(batch, i, v.point, true);
        }
        batch.geometry.setDrawRange(0, vertices.length);
        batch.mesh.visible = vertices.length > 0;
      } else {
        selected = selected.filter(visible);
        if (batch.profile.settings.blendMode === 1) {
          const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
          const depth = (packet: Packet) =>
            Math.fround(
              Array.from(packet.position).reduce(
                (sum, value, axis) => sum + (value * 0.01 - eye.getComponent(axis)) ** 2,
                0
              )
            );
          selected.sort((a, b) => depth(b) - depth(a));
        }
        const mesh = batch.mesh as THREE.InstancedMesh;
        for (const [i, p] of selected.entries()) {
          let x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3;
          if (batch.profile.geometry.kind === 'billboard') {
            let angle = (-p.rotation[0] * Math.PI) / 180;
            if (baronFlag(batch.profile.settings.isDirectionOriented)) {
              const travel = new THREE.Vector3(...p.travel),
                projected = new THREE.Vector2(travel.dot(right), travel.dot(up));
              if (projected.lengthSq() === 0) projected.set(0, 1);
              else projected.normalize();
              angle = -Math.atan2(projected.x, projected.y);
            }
            x = right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle));
            y = up.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right, -Math.sin(angle));
            z = new THREE.Vector3().crossVectors(x, y);
          } else {
            const b = basis(p);
            x = new THREE.Vector3(b[0], b[3], b[6]);
            y = new THREE.Vector3(b[1], b[4], b[7]);
            z = new THREE.Vector3(b[2], b[5], b[8]);
          }
          const scale = batch.profile.geometry.kind === 'mesh' ? 1 : 0.01;
          const speed = Math.hypot(...p.travel),
            velocityScale = batch.profile.settings.directionVelocityScale ?? 0;
          const stretch =
            velocityScale === 0
              ? 1
              : Math.max(
                  batch.profile.settings.directionVelocityMinScale ?? 1,
                  speed * velocityScale
                );
          x.multiplyScalar(
            p.scale[0] * scale * (batch.profile.geometry.kind === 'quad' ? stretch : 1)
          );
          y.multiplyScalar(
            p.scale[1] * scale * (batch.profile.geometry.kind === 'billboard' ? stretch : 1)
          );
          z.multiplyScalar(p.scale[2] * scale);
          matrix
            .makeBasis(x, y, z)
            .setPosition(p.position[0] * 0.01, p.position[1] * 0.01, p.position[2] * 0.01);
          mesh.setMatrixAt(i, matrix);
          write(batch, i, p);
        }
        mesh.count = selected.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = mesh.count > 0;
      }
      for (const attribute of Object.values(batch.geometry.attributes))
        if (
          attribute instanceof THREE.BufferAttribute &&
          attribute.usage === THREE.DynamicDrawUsage
        )
          attribute.needsUpdate = true;
    }
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const batch of this.batches) {
      batch.geometry.dispose();
      batch.material.dispose();
      if (batch.mesh instanceof THREE.InstancedMesh) batch.mesh.dispose();
    }
    this.batches.length = 0;
    this.root.clear();
    this.root.removeFromParent();
  }
}
