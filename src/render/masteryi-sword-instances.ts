import * as THREE from 'three';
import { particleColorMaterial } from './particle-color-phase';

type Surface = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
interface Batch {
  mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  capacity: number;
  textures: THREE.Texture[];
}
const fields = {
  sourceUvTransform: 9,
  multiplierUvTransform: 9,
  particleColor: 4,
  lookupUv: 2,
  instanceOptions: 4,
} as const;

/** Batches the additive, unprojected sword quads in Three's default transparent
 * depth/id order. Interleaving draws use the original surfaces. The caller must
 * prepare after changing particles or camera and before rendering that camera.
 * Logical surfaces keep their source uniforms/poses; textures remain borrowed. */
export class SwordParticleInstances {
  readonly batches = new Map<number, Batch>();
  private readonly cameraInverse = new THREE.Matrix4();
  private readonly modelView = new THREE.Matrix4();
  constructor(private readonly scene: THREE.Scene) {}

  prepare(surfaces: Iterable<Surface>, camera: THREE.Camera) {
    camera.updateMatrixWorld();
    this.cameraInverse.copy(camera.matrixWorldInverse);
    const input = [...surfaces];
    for (const surface of input) this.validate(surface);
    const projection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const position = new THREE.Vector4();
    const ordered = input
      .map((surface) => {
        surface.updateWorldMatrix(true, false);
        if (!surface.geometry.boundingSphere) surface.geometry.computeBoundingSphere();
        const center = surface.geometry.boundingSphere!.center;
        position
          .set(center.x, center.y, center.z, 1)
          .applyMatrix4(surface.matrixWorld)
          .applyMatrix4(projection);
        return { surface, z: position.z };
      })
      .sort((a, b) => b.z - a.z || a.surface.id - b.surface.id)
      .map((row) => row.surface);
    const groups = new Map<number, Surface[]>();
    if (ordered.length) groups.set(0, ordered);
    for (const batch of this.batches.values()) {
      batch.mesh.visible = false;
      batch.mesh.geometry.instanceCount = 0;
    }
    // A single draw must not jump across another transparent draw. Retain
    // the original surfaces whenever their depth interval is interleaved.
    const own = new Set<THREE.Object3D>(ordered);
    for (const batch of this.batches.values()) own.add(batch.mesh);
    let interleaved = false;
    if (ordered.length) {
      const depths = ordered.map((surface) => {
        const c = surface.geometry.boundingSphere!.center;
        return position
          .set(c.x, c.y, c.z, 1)
          .applyMatrix4(surface.matrixWorld)
          .applyMatrix4(projection).z;
      });
      const near = depths.at(-1)!,
        far = depths[0];
      this.scene.updateMatrixWorld();
      this.scene.traverseVisible((object) => {
        if (interleaved || own.has(object)) return;
        const draw = object as THREE.Mesh;
        if (
          !draw.isMesh &&
          !(draw as unknown as THREE.Line).isLine &&
          !(draw as unknown as THREE.Points).isPoints &&
          !(draw as unknown as THREE.Sprite).isSprite
        )
          return;
        const materials = Array.isArray(draw.material) ? draw.material : [draw.material];
        if (!materials.some((material) => material?.visible && material.transparent)) return;
        // Different renderOrder values are already separate transparent phases.
        if (object.renderOrder !== ordered[0].renderOrder) return;
        if (
          !draw.geometry ||
          'boundingSphere' in object ||
          (draw as unknown as THREE.Sprite).isSprite
        ) {
          interleaved = true;
          return;
        }
        if (!draw.geometry.boundingSphere) draw.geometry.computeBoundingSphere();
        const c = draw.geometry.boundingSphere!.center;
        const z = position
          .set(c.x, c.y, c.z, 1)
          .applyMatrix4(object.matrixWorld)
          .applyMatrix4(projection).z;
        if (z >= near && z <= far) interleaved = true;
      });
    }
    if (interleaved) {
      for (const surface of ordered) surface.visible = true;
      return;
    }
    for (const [index, group] of groups) {
      let batch = this.batches.get(index);
      const textures = [
        ...new Set(
          group.flatMap((surface) =>
            ['sourceTexture', 'particleColorTexture', 'multiplierTexture']
              .map((name) => surface.material.uniforms[name]?.value as THREE.Texture | undefined)
              .filter((t): t is THREE.Texture => !!t)
          )
        ),
      ];
      if (
        !batch ||
        batch.capacity < group.length ||
        textures.some((t) => !batch!.textures.includes(t))
      ) {
        const capacity = 2 ** Math.ceil(Math.log2(group.length));
        if (batch) this.retire(batch);
        batch = this.create(group[0], capacity, textures);
        this.batches.set(index, batch);
      }
      const { mesh } = batch,
        geometry = mesh.geometry;
      mesh.visible = true;
      // Only sorting uses this mesh's transform; vertex positions use the
      // original per-particle CPU model-view matrices.
      mesh.position.copy(group[0].position);
      mesh.quaternion.copy(group[0].quaternion);
      mesh.scale.copy(group[0].scale);
      mesh.userData.sourceIds = group.map((surface) => surface.id);
      geometry.instanceCount = group.length;
      group.forEach((surface, i) => {
        this.modelView.multiplyMatrices(camera.matrixWorldInverse, surface.matrixWorld);
        (geometry.getAttribute('instanceModelView').array as Float32Array).set(
          this.modelView.elements,
          i * 16
        );
        for (const [name, size] of Object.entries(fields)) {
          const value = surface.material.uniforms[name]?.value;
          const array = geometry.getAttribute(name).array as Float32Array;
          if (name === 'instanceOptions') {
            const u = surface.material.uniforms;
            // Quad UV is (v,1-u); billboard UV is (u,1-v).
            const billboard = surface.geometry.getAttribute('uv').getX(0) === 0;
            array.set(
              [
                batch!.textures.indexOf(u.sourceTexture.value),
                batch!.textures.indexOf(u.particleColorTexture.value),
                u.multiplierTexture ? batch!.textures.indexOf(u.multiplierTexture.value) : -1,
                (surface.material.defines.SOURCE_LOCK_ALPHA ? 1 : 0) + (billboard ? 2 : 0),
              ],
              i * size
            );
          } else array.set(value.elements ?? value.toArray(), i * size);
        }
        surface.visible = false;
      });
      for (const name of ['instanceModelView', ...Object.keys(fields)]) {
        const attribute = geometry.getAttribute(name) as THREE.InstancedBufferAttribute;
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, group.length * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
  }

  private validate(reference: Surface) {
    const source = reference.material;
    if (
      source.blending !== THREE.CustomBlending ||
      source.blendDst !== THREE.OneFactor ||
      source.blendSrc !== THREE.SrcAlphaFactor ||
      source.blendEquation !== THREE.AddEquation ||
      reference.castShadow ||
      source.depthWrite ||
      reference.geometry.getAttribute('position').count !== 4 ||
      reference.geometry.index?.count !== 6 ||
      source.side !== THREE.DoubleSide ||
      source.forceSinglePass !== true ||
      Object.keys(source.defines).some((k) => !['SOURCE_MULT', 'SOURCE_LOCK_ALPHA'].includes(k))
    )
      throw Error('Instance batching requires additive source quads');
    if (
      reference.renderOrder !== 0 ||
      reference.parent !== this.scene ||
      source.uniforms.alphaRef.value !== 5 / 255 ||
      !source.depthTest ||
      source.polygonOffset
    )
      throw Error('Unsupported sword instance state');
  }

  private create(reference: Surface, capacity: number, textures: THREE.Texture[]): Batch {
    const source = reference.material;
    if (textures.length > 12) throw Error('Too many sword texture samplers');
    const geometry = new THREE.InstancedBufferGeometry();
    for (const name of ['position', 'uv'])
      geometry.setAttribute(name, reference.geometry.getAttribute(name).clone());
    const uv = geometry.getAttribute('uv');
    uv.setXY(0, 1, 1);
    uv.setXY(1, 1, 0);
    uv.setXY(2, 0, 1);
    uv.setXY(3, 0, 0);
    geometry.setIndex(reference.geometry.index!.clone());
    for (const [name, size] of Object.entries({ instanceModelView: 16, ...fields }))
      geometry.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(
          THREE.DynamicDrawUsage
        )
      );
    const material = new THREE.ShaderMaterial();
    // Base Material.copy retains raster state without ShaderMaterial.copy's
    // cloned texture uniforms. Static uniforms borrow the verified originals.
    THREE.Material.prototype.copy.call(material, source);
    material.uniforms = Object.fromEntries(
      textures.map((texture, i) => [`sourceSampler${i}`, { value: texture }])
    );
    material.uniforms.alphaRef = source.uniforms.alphaRef;
    const samplers = textures.map((_, i) => `uniform sampler2D sourceSampler${i};`).join('\n');
    const sample = `vec4 sampleSource(float slot, vec2 coord) {
      ${textures.map((_, i) => `if (slot < ${i + 0.5}) return texture2D(sourceSampler${i}, coord);`).join('\n')}
      return vec4(1.0);
    }`;
    material.vertexShader = `
      attribute mat4 instanceModelView;
      attribute mat3 sourceUvTransform;
      attribute mat3 multiplierUvTransform;
      attribute vec4 particleColor;
      attribute vec2 lookupUv;
      attribute vec4 instanceOptions;
      flat varying vec4 instanceColor;
      flat varying vec2 instanceLookup;
      flat varying vec4 options;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      void main() {
        instanceColor=particleColor;instanceLookup=lookupUv;options=instanceOptions;
        vec2 baseUv = instanceOptions.w >= 2.0 ? vec2(1.0-uv.y,1.0-uv.x) : uv;
        sourceUv=(sourceUvTransform*vec3(baseUv,1.0)).xy;
        alphaUv=(sourceUvTransform*vec3(baseUv,0.0)).xy;
        multUv=(multiplierUvTransform*vec3(baseUv,1.0)).xy;
        sourceVertexColor=vec4(1.0);
        gl_Position=projectionMatrix*instanceModelView*vec4(position,1.0);
      }`;
    material.fragmentShader = `
      ${samplers}
      ${sample}
      uniform float alphaRef;
      flat varying vec4 instanceColor;
      flat varying vec2 instanceLookup;
      flat varying vec4 options;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      void main() {
        vec4 base=sampleSource(options.x,sourceUv);
        if (mod(options.w,2.0) > 0.5) base.a=sampleSource(options.x,alphaUv).a;
        vec4 lit=base*instanceColor*sourceVertexColor;
        lit*=sampleSource(options.y,instanceLookup);
        if(options.z >= 0.0) lit*=sampleSource(options.z,instanceLookup);
        if(lit.a < alphaRef) discard;
        gl_FragColor=lit;
      }`;
    particleColorMaterial(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${reference.name} instances`;
    mesh.renderOrder = reference.renderOrder;
    mesh.frustumCulled = false;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      if (!camera.matrixWorldInverse.equals(this.cameraInverse))
        throw Error('Prepare particle instances for the render camera');
    };
    this.scene.add(mesh);
    return { mesh, capacity, textures };
  }
  private retire(batch: Batch) {
    batch.mesh.removeFromParent();
    batch.mesh.geometry.dispose();
    batch.mesh.material.dispose();
  }
  dispose() {
    for (const batch of this.batches.values()) this.retire(batch);
    this.batches.clear();
  }
}
