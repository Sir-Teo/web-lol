import { writeRayQuad } from './ray-quad';
import * as THREE from 'three';
import profiles from '../content/lux-e-field.json';
import { LUX_E_FIELD_BIRTHS, luxEFieldParticles, luxEFlightOrigin } from './lux-e-field-particles';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import { createParticleColorProductMaterial } from './particle-color-product';
import { particleAtlasUv } from './particle-atlas';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';

export function createLuxEFieldMaterial(
  index: number,
  textures: ReadonlyMap<string, THREE.Texture>
) {
  const p = profiles[index];
  const get = (path: string) => {
    const t = textures.get(path);
    if (!t) throw Error(`Missing Lucent burst texture ${path}`);
    return t;
  };
  const material = createParticleColorProductMaterial(
    get(p.texture),
    get(p.lookup),
    'vertex',
    undefined,
    true,
    p.palette
      ? {
          texture: get(p.palette.texture),
          sourceMix: p.palette.mix as [number, number, number, number],
          row: p.palette.row,
        }
      : undefined
  );
  if (p.mult || p.uvRotation) {
    Object.assign(material.uniforms, {
      fieldMultTexture: { value: get(p.mult) },
      fieldBaseRotation: { value: (p.uvRotation * Math.PI) / 180 },
    });
    material.vertexShader = material.vertexShader
      .replace(
        'varying vec2 sourceUv;',
        'varying vec2 sourceUv; varying vec2 fieldRawUv; varying vec2 fieldMultScale; varying vec2 fieldMultOffset; attribute vec2 particleMultScale; attribute vec2 particleMultOffset;'
      )
      .replace(
        'void main() {',
        'void main() {fieldRawUv=uv;fieldMultScale=particleMultScale;fieldMultOffset=particleMultOffset;'
      );
    material.fragmentShader = material.fragmentShader.replace(
      'varying vec2 sourceUv;',
      `varying vec2 sourceUv; varying vec2 fieldRawUv; varying vec2 fieldMultScale; varying vec2 fieldMultOffset;
      uniform sampler2D fieldMultTexture; uniform float fieldBaseRotation;
      vec2 fieldTurn(vec2 uv){vec2 q=uv-0.5;float c=cos(fieldBaseRotation),s=sin(fieldBaseRotation);return vec2(c*q.x-s*q.y,s*q.x+c*q.y)+0.5;}`
    );
    if (p.uvRotation)
      material.fragmentShader = material.fragmentShader.replace(
        'texture2D(sourceTexture, sourceUv)',
        'texture2D(sourceTexture,fract(fieldTurn(sourceUv)))'
      );
    if (p.mult)
      material.fragmentShader = material.fragmentShader.replace(
        /}\s*$/,
        'gl_FragColor *= texture2D(fieldMultTexture,fract((fieldRawUv-0.5)*fieldMultScale+0.5+fieldMultOffset));}'
      );
  }
  Object.assign(material, {
    name: `Lucent ${p.role} field motion ${p.index} ${p.name}`,
    transparent: true,
    depthTest: p.depthTest,
    depthWrite: false,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  if (p.ground) groundEffectMaterial(material);
  return material;
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];

/** One fixed-capacity draw per emitter. Every corner retains its own tint,
 * birth-random lookup and authored atlas cell. Images remain borrowed. */
export class LuxEFieldCloud {
  readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private center = new THREE.Vector3();
  private vertex = new THREE.Vector3();
  private sourcePosition = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private across = new THREE.Vector3();
  private eye = new THREE.Vector3();
  private rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  private frame = new THREE.Matrix3();
  private size = new THREE.Vector3();
  constructor(
    readonly role: 'ally' | 'enemy' | 'flight',
    textures: ReadonlyMap<string, THREE.Texture>,
    private templates: ReadonlyMap<string, THREE.BufferGeometry> = new Map()
  ) {
    for (const [i, p] of profiles.entries()) {
      if (p.role !== role) continue;
      const capacity = Math.max(1, LUX_E_FIELD_BIRTHS[i].length);
      const template = p.mesh ? templates.get(p.mesh) : undefined;
      if (p.mesh && !template) throw Error(`Missing Lucent mesh ${p.mesh}`);
      const stride = template?.getAttribute('position').count ?? 6;
      if (stride % 3 || template?.index) throw Error('Expected expanded source triangle corners');
      const geometry = new THREE.BufferGeometry();
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['particleTint', 4],
        ['particleLookupUv', 2],
        ['particleMultOffset', 2],
        ['particleMultScale', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * stride * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(capacity * stride), 1));
      geometry.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geometry, createLuxEFieldMaterial(i, textures));
      mesh.name = mesh.material.name;
      mesh.renderOrder = p.passOrder;
      mesh.frustumCulled = false;
      mesh.userData.fieldProfileIndex = i;
      if (p.ground) setGroundRenderStage(mesh, 'ground');
      mesh.userData.capacity = capacity;
      mesh.userData.particleVertexCount = stride;
      this.meshes.push(mesh);
    }
  }
  draw(
    world: World,
    seed: number,
    age: number,
    at: Vec2,
    origin: Vec2,
    target: Vec2,
    team: string,
    camera: THREE.Camera,
    ground: (p: Vec2) => number
  ) {
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.eye);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const length = Math.hypot(target.x - origin.x, target.y - origin.y),
      fx = length ? (target.x - origin.x) / length : 0,
      fy = length ? (target.y - origin.y) / length : 1;
    const particles = luxEFieldParticles(
      this.role,
      seed,
      age,
      this.role === 'flight' ? (seconds) => luxEFlightOrigin(length, seconds) : undefined
    );
    for (const mesh of this.meshes) {
      const profileIndex = mesh.userData.fieldProfileIndex,
        p = profiles[profileIndex],
        selected = particles.filter((q) => q.profileIndex === profileIndex),
        g = mesh.geometry;
      if (selected.length > mesh.userData.capacity) throw Error('Lucent field capacity exceeded');
      const position = g.getAttribute('position') as THREE.BufferAttribute,
        uv = g.getAttribute('uv'),
        tint = g.getAttribute('particleTint'),
        lookup = g.getAttribute('particleLookupUv'),
        multOffset = g.getAttribute('particleMultOffset'),
        multScale = g.getAttribute('particleMultScale'),
        index = g.index!;
      // Retired slots remain deterministic across reverse seeks and fresh
      // restores; the next cast must not inherit unused GPU buffer bytes.
      for (const a of Object.values(g.attributes)) a.array.fill(0);
      index.array.fill(0);
      let count = 0;
      selected.forEach((q, slot) => {
        const x = p.local ? -fy * q.position[0] + fx * q.position[2] : q.position[0],
          y = p.local ? fx * q.position[0] + fy * q.position[2] : q.position[2];
        this.center.set(
          (at.x + x) * 0.01,
          ground(at) + 1 + q.position[1] * 0.01,
          (at.y + y) * 0.01
        );
        this.direction.set(
          p.local ? -fy * q.travel[0] + fx * q.travel[2] : q.travel[0],
          q.travel[1],
          p.local ? fx * q.travel[0] + fy * q.travel[2] : q.travel[2]
        );
        let dx = this.direction.dot(this.right),
          dy = this.direction.dot(this.up),
          d = Math.hypot(dx, dy);
        if (!p.direction || d === 0) {
          dx = 0;
          dy = 1;
          d = 1;
        }
        dx /= d;
        dy /= d;
        const stride = mesh.userData.particleVertexCount,
          first = slot * stride;
        this.sourcePosition.fromArray(q.position);
        this.rotation.set(
          ...(q.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
          'YXZ'
        );
        this.frame.set(
          ...((p.local ? [-fy, 0, fx, 0, 1, 0, fx, 0, fy] : [-1, 0, 0, 0, 1, 0, 0, 0, 1]) as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
          ])
        );
        if (p.primitive === 'ray') {
          this.axis.set(0, 0, 1).applyEuler(this.rotation).applyMatrix3(this.frame);
          this.across.set(1, 0, 0).applyEuler(this.rotation).applyMatrix3(this.frame);
          writeRayQuad(
            position as THREE.BufferAttribute,
            uv as THREE.BufferAttribute,
            first,
            {
              center: this.center,
              axis: this.axis,
              fallbackAcross: this.across,
              size: q.scale.map((v) => v * 0.01) as [number, number, number],
            },
            this.eye
          );
        }
        const template = p.mesh ? this.templates.get(p.mesh) : undefined;
        this.size.fromArray(q.scale);
        for (let corner = 0; corner < stride; corner++) {
          const [cx, cy] = corners[corner % 6];
          if (p.primitive === 'mesh') {
            this.vertex
              .fromBufferAttribute(template!.getAttribute('position'), corner)
              .multiplyScalar(100)
              .multiply(this.size)
              .applyEuler(this.rotation)
              .add(this.sourcePosition)
              .applyMatrix3(this.frame);
            position.setXYZ(
              first + corner,
              (at.x + this.vertex.x) * 0.01,
              ground(at) + 1 + this.vertex.y * 0.01,
              (at.y + this.vertex.z) * 0.01
            );
            const sourceUv = template!.getAttribute('uv');
            uv.setXY(
              first + corner,
              ...particleAtlasUv(
                p.atlas.grid[0],
                p.atlas.grid[1],
                q.frame,
                sourceUv.getX(corner),
                sourceUv.getY(corner)
              )
            );
          } else if (p.primitive === 'quad') {
            this.vertex
              .set(cx * q.scale[0], cy * q.scale[1], 0)
              .applyEuler(this.rotation)
              .add(this.sourcePosition);
            const x = p.local ? -fy * this.vertex.x + fx * this.vertex.z : this.vertex.x,
              y = p.local ? fx * this.vertex.x + fy * this.vertex.z : this.vertex.z;
            const horizontal = { x: at.x + x, y: at.y + y };
            position.setXYZ(
              first + corner,
              horizontal.x * 0.01,
              ground(horizontal) + 1 + this.vertex.y * 0.01,
              horizontal.y * 0.01
            );
            uv.setXY(first + corner, (cy + 1) / 2, (1 - cx) / 2);
          } else if (p.primitive === 'camera') {
            const roll = (-q.rotation[0] * Math.PI) / 180,
              c = Math.cos(roll),
              s = Math.sin(roll),
              rx = cx * c - cy * s,
              ry = cx * s + cy * c;
            const sx = q.scale[0] * 0.01,
              sy = q.scale[1] * q.stretch * 0.01;
            const a = dy * rx * sx + dx * ry * sy,
              b = -dx * rx * sx + dy * ry * sy;
            this.vertex
              .copy(this.center)
              .addScaledVector(this.right, a)
              .addScaledVector(this.up, b);
            position.setXYZ(first + corner, this.vertex.x, this.vertex.y, this.vertex.z);
            uv.setXY(
              first + corner,
              ...particleAtlasUv(
                p.atlas.grid[0],
                p.atlas.grid[1],
                q.frame,
                (cx + 1) / 2,
                (1 - cy) / 2
              )
            );
          }
          multOffset.setXY(first + corner, ...(q.multOffset as [number, number]));
          multScale.setXY(first + corner, ...(q.multScale as [number, number]));
          tint.setXYZW(first + corner, ...(q.color as [number, number, number, number]));
          lookup.setXY(first + corner, ...q.lookup);
        }
        for (let tri = 0; tri < stride; tri += 3)
          if (
            team === 'blue' ||
            [0, 1, 2].every((j) =>
              world.pointVisible({
                x: position.getX(first + tri + j) * 100,
                y: position.getZ(first + tri + j) * 100,
              })
            )
          )
            for (let j = 0; j < 3; j++) index.setX(count++, first + tri + j);
      });
      g.setDrawRange(0, count);
      mesh.visible = count > 0;
      index.needsUpdate = true;
      for (const a of Object.values(g.attributes)) a.needsUpdate = true;
      mesh.userData.liveParticles = selected.length;
    }
    return particles;
  }
  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
