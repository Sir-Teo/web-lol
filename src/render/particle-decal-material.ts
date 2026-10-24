import { particleColorMaterial } from './particle-color-phase';
import * as THREE from 'three';
import type { ParticlePalette } from './particle-color-product';

export interface ParticleDecalBindings {
  diffuse: THREE.Texture;
  lookup: THREE.Texture;
  /** Receiving-triangle local position -> world, in the caller's render units. */
  world: THREE.Matrix4;
  /** Native stored rows 0/2 yield U and pre-flipped V. */
  worldToUv: THREE.Matrix4;
  /** Center world Y, full-opacity range, fading distance, in the same units. */
  heightRange: readonly [number, number, number];
  color: readonly [number, number, number, number];
  lookupUv: readonly [number, number];
  fog?: { texture: THREE.Texture; transform: readonly [number, number, number, number] };
  palette?: ParticlePalette;
}

/** Native UNLIT_DECAL VS0/1 and PS0/8/11/38 arithmetic on caller-supplied receiving
 * triangles. No terrain selection, footprint, matrix, normal, ground plane or
 * missing-resource fallback is generated. Matrix/vector uniforms are copied;
 * geometry and images remain borrowed. Render states are inspection defaults.
 * Actual R CPU dispatch/resources/state still require independent recovery. */
export function createParticleDecalMaterial(
  geometry: THREE.BufferGeometry,
  bindings: ParticleDecalBindings
) {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize !== 3 || position.count < 3)
    throw Error('Decal needs receiving triangle positions');
  for (let i = 0; i < position.count; i++)
    if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite))
      throw Error('Non-finite decal receiving position');
  const index = geometry.getIndex();
  const corners = index?.count ?? position.count;
  if (corners < 3 || corners % 3 !== 0) throw Error('Decal needs complete receiving triangles');
  if (index)
    for (let i = 0; i < index.count; i++) {
      const value = index.getX(i);
      if (!Number.isInteger(value) || value < 0 || value >= position.count)
        throw Error('Invalid decal receiving index');
    }
  if (
    ![
      ...bindings.world.elements,
      ...bindings.worldToUv.elements,
      ...bindings.heightRange,
      ...bindings.color,
      ...bindings.lookupUv,
      ...(bindings.fog?.transform ?? []),
      ...(bindings.palette?.sourceMix ?? []),
      ...(bindings.palette?.scroll ?? []),
      ...(bindings.palette ? [bindings.palette.row] : []),
    ].every(Number.isFinite)
  )
    throw RangeError('Non-finite decal binding');
  // Native divides directly; this explicit-input adapter excludes its undefined zero-distance case.
  if (bindings.heightRange[2] <= 0) throw RangeError('Decal fading distance must be positive');
  const palette = bindings.palette,
    fog = bindings.fog;
  const material = new THREE.ShaderMaterial({
    name: 'Native unlit particle decal',
    uniforms: {
      diffuseTexture: { value: bindings.diffuse },
      particleColorTexture: { value: bindings.lookup },
      decalWorld: { value: bindings.world.clone() },
      worldToUv: { value: bindings.worldToUv.clone() },
      heightRange: { value: new THREE.Vector3(...bindings.heightRange) },
      particleColor: { value: new THREE.Vector4(...bindings.color) },
      lookupUv: { value: new THREE.Vector2(...bindings.lookupUv) },
      ...(fog
        ? {
            fogTexture: { value: fog.texture },
            fogTransform: { value: new THREE.Vector4(...fog.transform) },
          }
        : {}),
      ...(palette
        ? {
            paletteTexture: { value: palette.texture },
            paletteSourceMix: { value: new THREE.Vector4(...palette.sourceMix) },
            paletteRow: { value: palette.row },
            paletteScroll: { value: new THREE.Vector2(...(palette.scroll ?? [0, 0])) },
          }
        : {}),
    },
    defines: { ...(fog ? { SOURCE_FOW: 1 } : {}), ...(palette ? { SOURCE_PALETTE: 1 } : {}) },
    vertexShader: `
      uniform mat4 decalWorld;
      uniform mat4 worldToUv;
      uniform vec3 heightRange;
      varying vec2 sourceUv;
      varying float heightFade;
      #ifdef SOURCE_FOW
        uniform vec4 fogTransform;
        varying vec2 fogUv;
      #endif
      void main() {
        vec4 world = decalWorld * vec4(position, 1.0);
        vec4 mapped = worldToUv * world;
        sourceUv = vec2(mapped.x, 1.0 - mapped.z);
        float gap = abs(world.y - heightRange.x);
        heightFade = gap <= heightRange.y ? 1.0 : 1.0 - (gap - heightRange.y) / heightRange.z;
        #ifdef SOURCE_FOW
          fogUv = world.xz * fogTransform.xy + fogTransform.zw;
        #endif
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D diffuseTexture;
      uniform sampler2D particleColorTexture;
      uniform vec4 particleColor;
      uniform vec2 lookupUv;
      varying vec2 sourceUv;
      varying float heightFade;
      #ifdef SOURCE_FOW
        uniform sampler2D fogTexture;
        varying vec2 fogUv;
      #endif
      #ifdef SOURCE_PALETTE
        uniform sampler2D paletteTexture;
        uniform vec4 paletteSourceMix;
        uniform float paletteRow;
        uniform vec2 paletteScroll;
      #endif
      void main() {
        vec4 base = texture2D(diffuseTexture, sourceUv);
        #ifdef SOURCE_PALETTE
          vec2 paletteUv = vec2(clamp(dot(base, paletteSourceMix), 0.0, 1.0), paletteRow) + paletteScroll;
          base.rgb = texture2D(paletteTexture, paletteUv).rgb;
        #endif
        vec4 lit = base * texture2D(particleColorTexture, lookupUv) * particleColor;
        #ifdef SOURCE_FOW
          lit.rgb *= texture2D(fogTexture, fogUv).a;
        #endif
        lit.a *= max(heightFade, 0.0);
        gl_FragColor = lit;
      }
    `,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  return particleColorMaterial(material);
}
