import { loadLuxParticleTextures } from './lux-particle-textures';
import * as THREE from 'three';
import { LUX_ILLUMINATION_VFX } from '../content/lux-illumination-vfx';
import { luxIlluminationParticles } from './lux-illumination-particles';
import { writeRayQuad } from './ray-quad';

export async function loadIlluminationTextures(base = import.meta.env.BASE_URL) {
  const paths = new Set<string>(
    LUX_ILLUMINATION_VFX.flatMap((p) => [
      p.texture,
      ...(p.lookup ? [p.lookup] : []),
      ...(p.mult ? [p.mult] : []),
    ])
  );
  return loadLuxParticleTextures(paths, base);
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** Complete four-layer mark at an explicitly supplied attachment frame. Textures
 * are borrowed; gameplay timing, visibility and attachment selection are caller-owned. */
export class LuxIlluminationCloud {
  readonly root = new THREE.Group();
  readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private eye = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private across = new THREE.Vector3();
  private rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(textures: ReadonlyMap<string, THREE.Texture>) {
    this.root.name = 'Lux Illumination';
    for (const profile of LUX_ILLUMINATION_VFX) {
      const table = profile.life.probabilities?.[0];
      const factor = table ? Math.max(...(table.values.length ? table.values : [table.single])) : 1;
      const capacity = profile.single
        ? 1
        : Math.ceil(profile.rate * profile.life.value[0] * factor) + 1;
      const geometry = new THREE.BufferGeometry();
      for (const [name, size] of [
        ['position', 3],
        ['uv', 2],
        ['tint', 4],
        ['lookupUV', 2],
        ['multOffset', 2],
      ] as const)
        geometry.setAttribute(
          name,
          new THREE.BufferAttribute(new Float32Array(capacity * 6 * size), size).setUsage(
            THREE.DynamicDrawUsage
          )
        );
      geometry.setDrawRange(0, 0);
      const texture = (path: string | null) => {
        const found = textures.get(path ?? '');
        if (!found) throw new Error(`Missing Illumination texture: ${path}`);
        return found;
      };
      const material = new THREE.ShaderMaterial({
        uniforms: {
          source: { value: texture(profile.texture) },
          lookup: { value: texture(profile.lookup) },
          mult: { value: texture(profile.mult) },
          multScale: { value: new THREE.Vector2(...profile.multScale) },
        },
        vertexShader: `attribute vec4 tint; attribute vec2 lookupUV; attribute vec2 multOffset;
          varying vec2 vUV; varying vec2 vLookup; varying vec2 vOffset; varying vec4 vTint;
          void main(){vUV=uv;vLookup=lookupUV;vOffset=multOffset;vTint=tint;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform sampler2D source; uniform sampler2D lookup; uniform sampler2D mult;
          uniform vec2 multScale; varying vec2 vUV; varying vec2 vLookup; varying vec2 vOffset; varying vec4 vTint;
          void main(){vec2 multUV=fract((vUV-.5)*multScale+.5+vOffset);
            vec4 color=texture2D(source,fract(vUV))*texture2D(lookup,clamp(vLookup,0.0,1.0))*texture2D(mult,multUV)*vTint;
            if(color.a < 5.0/255.0) discard;gl_FragColor=color;}`,
        transparent: true,
        depthTest: (profile.miscRenderFlags & 1) === 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendEquationAlpha: THREE.AddEquation,
        blendSrc: profile.blend === 4 ? THREE.SrcAlphaFactor : THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: profile.blend === 4 ? THREE.SrcAlphaFactor : THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = profile.name;
      mesh.renderOrder = profile.pass;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.root.add(mesh);
    }
  }
  /** Positions and frame axes are world-space; authored sizes convert at 0.01.
   * sourceFrame must be the orthonormal reflected source frame at the attachment. */
  draw(
    seed: number,
    time: number,
    camera: THREE.Camera,
    center: THREE.Vector3,
    sourceFrame: THREE.Matrix3,
    stopSeconds = Infinity,
    keywords: readonly string[] = []
  ) {
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.eye);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const particles = luxIlluminationParticles(seed, time, stopSeconds, keywords);
    this.meshes.forEach((mesh, index) => {
      const profile = LUX_ILLUMINATION_VFX[index],
        selected = particles.filter((p) => p.profileIndex === index);
      const geometry = mesh.geometry,
        position = geometry.getAttribute('position') as THREE.BufferAttribute,
        uv = geometry.getAttribute('uv') as THREE.BufferAttribute,
        tint = geometry.getAttribute('tint'),
        lookup = geometry.getAttribute('lookupUV'),
        mult = geometry.getAttribute('multOffset');
      if (selected.length * 6 > position.count)
        throw new RangeError('Illumination particle capacity exceeded');
      selected.forEach((p, ordinal) => {
        const first = ordinal * 6;
        if (p.primitive === 'ray') {
          this.rotation.set(
            ...(p.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
            'YXZ'
          );
          this.axis.set(0, 0, 1).applyEuler(this.rotation).applyMatrix3(sourceFrame);
          this.across.set(1, 0, 0).applyEuler(this.rotation).applyMatrix3(sourceFrame);
          writeRayQuad(
            position,
            uv,
            first,
            {
              center,
              axis: this.axis,
              fallbackAcross: this.across,
              size: p.size.map((v) => v * 0.01) as [number, number, number],
            },
            this.eye
          );
        } else {
          const angle = (-p.rotation[0] * Math.PI) / 180,
            c = Math.cos(angle),
            s = Math.sin(angle);
          corners.forEach(([x, y], i) => {
            const a = (x * c - y * s) * p.size[0] * 0.01,
              b = (x * s + y * c) * p.size[1] * 0.01;
            position.setXYZ(
              first + i,
              center.x + this.right.x * a + this.up.x * b,
              center.y + this.right.y * a + this.up.y * b,
              center.z + this.right.z * a + this.up.z * b
            );
            uv.setXY(first + i, (x + 1) / 2, (1 - y) / 2);
          });
        }
        for (let i = first; i < first + 6; i++) {
          const [r, g, b, a] = p.color,
            add = profile.blend === 0;
          tint.setXYZW(i, r * (add ? a : 1), g * (add ? a : 1), b * (add ? a : 1), add ? 1 : a);
          lookup.setXY(i, ...p.lookup);
          mult.setXY(i, p.multOffset[0], p.multOffset[1]);
        }
      });
      geometry.setDrawRange(0, selected.length * 6);
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    });
    return particles;
  }
  dispose() {
    this.root.removeFromParent();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.root.clear();
  }
}
