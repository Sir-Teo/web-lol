import { particleColorMaterial } from './particle-color-phase';
import * as THREE from 'three';

export interface EclipseSkinErosion {
  texture: THREE.Texture;
  mixer: readonly [number, number, number, number];
  featherIn: number;
  featherOut: number;
  sliceWidth: number;
}

/** The four Eclipse attached-character layers use the animated source mesh.
 * Native skin PS 67/287 carries rim RGB by pre-tint texture alpha, saturates RGB
 * and erodes only output alpha. Unlike ordinary mesh particles, black birth tint
 * does not remove the rim. Global remapping is explicit and disabled when absent.
 * Source W has no authored cube map; this path draws its Fresnel rim only.
 * Native dispatch, global bindings, samplers and framebuffer parity remain open.
 * Geometry, skeletons and textures are borrowed; the caller owns this material.
 */
export function createLeonaEclipseSkinMaterial(options: {
  texture: THREE.Texture;
  fresnel: number;
  fresnelColor: readonly [number, number, number];
  erosion?: EclipseSkinErosion;
  remap?: THREE.Texture;
}) {
  const e = options.erosion;
  if (
    !Number.isFinite(options.fresnel) ||
    options.fresnel < 0 ||
    !options.fresnelColor.every(Number.isFinite) ||
    (e &&
      (!e.mixer.every(Number.isFinite) ||
        !Number.isFinite(e.sliceWidth) ||
        !Number.isFinite(e.featherIn) ||
        !Number.isFinite(e.featherOut) ||
        e.featherIn <= 0 ||
        e.featherOut <= 0))
  )
    throw new RangeError('Invalid Eclipse skin material parameters');
  const material = new THREE.ShaderMaterial({
    name: 'Leona Eclipse source skin particle',
    uniforms: {
      sourceTexture: { value: options.texture },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      sourceUvTransform: { value: new THREE.Matrix3() },
      fresnelPower: { value: options.fresnel },
      fresnelColor: { value: new THREE.Vector3(...options.fresnelColor) },
      ...(options.remap ? { remapTexture: { value: options.remap } } : {}),
      ...(e
        ? {
            erosionTexture: { value: e.texture },
            erosionMixer: { value: new THREE.Vector4(...e.mixer) },
            erosionParameters: {
              value: new THREE.Vector4(0, e.sliceWidth, 1 / e.featherIn, 1 / e.featherOut),
            },
          }
        : {}),
    },
    defines: { ...(e ? { SOURCE_EROSION: 1 } : {}), ...(options.remap ? { SOURCE_REMAP: 1 } : {}) },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      uniform mat3 sourceUvTransform;
      uniform float fresnelPower;
      uniform vec3 fresnelColor;
      varying vec2 sourceUv;
      varying vec3 sourceRim;
      void main() {
        sourceUv = (sourceUvTransform * vec3(uv, 1.0)).xy;
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 world = modelMatrix * vec4(transformed, 1.0);
        vec3 surface = mat3(modelMatrix) * objectNormal;
        sourceRim = vec3(0.0);
        if (dot(surface, surface) > 0.0) {
          float facing = clamp(dot(normalize(cameraPosition - world.xyz), normalize(surface)), 0.0, 1.0);
          sourceRim = (1.0 - pow(facing, fresnelPower)) * fresnelColor;
        }
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform vec4 particleColor;
      varying vec2 sourceUv;
      varying vec3 sourceRim;
      #ifdef SOURCE_REMAP
        uniform sampler2D remapTexture;
      #endif
      #ifdef SOURCE_EROSION
        uniform sampler2D erosionTexture;
        uniform vec4 erosionMixer;
        uniform vec4 erosionParameters;
      #endif
      void main() {
        vec4 texel = texture2D(sourceTexture, sourceUv);
        vec4 lit = texel * particleColor;
        #ifdef SOURCE_REMAP
          float luma = dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec4 remapped = texture2D(remapTexture, vec2(luma, 0.5));
          if (remapped.a > 0.0) lit.rgb = remapped.rgb;
        #endif
        lit.rgb = clamp(lit.rgb + sourceRim * texel.a, 0.0, 1.0);
        #ifdef SOURCE_EROSION
          float value = clamp(dot(texture2D(erosionTexture, sourceUv), erosionMixer), 0.0, 1.0);
          float threshold = erosionParameters.x - value;
          float upper = clamp((threshold + erosionParameters.y) * erosionParameters.z, 0.0, 1.0);
          float lower = clamp(threshold * erosionParameters.w, 0.0, 1.0);
          lit.a *= upper - lower;
        #endif
        gl_FragColor = lit;
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    forceSinglePass: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    toneMapped: false,
  });
  return particleColorMaterial(material);
}
