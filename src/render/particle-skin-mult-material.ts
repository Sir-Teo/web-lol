import { particleColorMaterial } from './particle-color-phase';
import * as THREE from 'three';

/** Native skin MULT_PASS VS34 and no-FOW PS0/23 arithmetic. Resources are
 * borrowed. Explicit rim/remap/alpha-test bindings do not imply recovered CPU
 * defaults, sampler state or native per-emitter technique selection. */
export function createParticleSkinMultMaterial(options: {
  texture: THREE.Texture;
  multiplier: THREE.Texture;
  fresnel: number;
  fresnelColor: readonly [number, number, number];
  alphaRef?: number;
  remap?: THREE.Texture;
}) {
  if (
    !Number.isFinite(options.fresnel) ||
    options.fresnel < 0 ||
    !options.fresnelColor.every(Number.isFinite) ||
    (options.alphaRef !== undefined && !Number.isFinite(options.alphaRef))
  )
    throw RangeError('Invalid skin multiplier material parameters');
  const material = new THREE.ShaderMaterial({
    name: 'Source skin multiplier particle',
    uniforms: {
      sourceTexture: { value: options.texture },
      multiplierTexture: { value: options.multiplier },
      sourceUvTransform: { value: new THREE.Matrix3() },
      multiplierUvTransform: { value: new THREE.Matrix3() },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      fresnelPower: { value: options.fresnel },
      fresnelColor: { value: new THREE.Vector3(...options.fresnelColor) },
      ...(options.alphaRef !== undefined ? { alphaRef: { value: options.alphaRef } } : {}),
      ...(options.remap ? { remapTexture: { value: options.remap } } : {}),
    },
    defines: {
      ...(options.alphaRef !== undefined ? { SOURCE_ALPHA_TEST: 1 } : {}),
      ...(options.remap ? { SOURCE_REMAP: 1 } : {}),
    },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      uniform mat3 sourceUvTransform;
      uniform mat3 multiplierUvTransform;
      uniform float fresnelPower;
      uniform vec3 fresnelColor;
      varying vec2 sourceUv;
      varying vec2 multUv;
      varying vec3 sourceRim;
      void main() {
        sourceUv = (sourceUvTransform * vec3(uv, 1.0)).xy;
        multUv = (multiplierUvTransform * vec3(uv, 1.0)).xy;
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
      uniform sampler2D multiplierTexture;
      uniform vec4 particleColor;
      varying vec2 sourceUv;
      varying vec2 multUv;
      varying vec3 sourceRim;
      #ifdef SOURCE_REMAP
        uniform sampler2D remapTexture;
      #endif
      #ifdef SOURCE_ALPHA_TEST
        uniform float alphaRef;
      #endif
      void main() {
        vec4 base = texture2D(sourceTexture, sourceUv) * texture2D(multiplierTexture, multUv);
        vec4 tinted = base * particleColor;
        #ifdef SOURCE_ALPHA_TEST
          if (tinted.a < alphaRef) discard;
        #endif
        vec3 rgb = tinted.rgb;
        #ifdef SOURCE_REMAP
          float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
          vec4 remapped = texture2D(remapTexture, vec2(luma, 0.5));
          if (remapped.a > 0.0) rgb = remapped.rgb;
        #endif
        gl_FragColor = vec4(clamp(rgb + sourceRim * base.a, 0.0, 1.0), tinted.a);
      }
    `,
    side: THREE.FrontSide,
    transparent: true,
    forceSinglePass: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    toneMapped: false,
  });
  return particleColorMaterial(material);
}
