import { particleColorMaterial } from './particle-color-phase';
import * as THREE from 'three';
import type { EclipseSkinErosion } from './leona-eclipse-skin-material';
import type { ParticlePalette } from './particle-color-product';

export interface EclipseSoftSurface {
  /** Source centimetres. Zero deltas disable that ramp in this local adapter. */
  beginIn: number;
  deltaIn: number;
  beginOut: number;
  deltaOut: number;
  /** Native cSoftParticleControl: unsoftened/softened RGB, then alpha weights.
   * Default full RGBA fade is a local binding, not a recovered CPU default. */
  control?: readonly [number, number, number, number];
}

/** Static native mesh PS 0/9/12/69/813/950 and quad PS 0/1/128/129 arithmetic.
 * UV-mode dispatch, missing globals and soft-control defaults are caller policies.
 * Textures are borrowed. This material owns no image, depth target or geometry.
 */
export function createLeonaEclipseSurfaceMaterial(options: {
  kind: 'mesh' | 'quad';
  texture: THREE.Texture;
  lookup: THREE.Texture;
  multiplier?: THREE.Texture;
  /** Explicit caller mapping of the quad second packed UV; default retains lookup coordinates. */
  quadSecondaryUv?: 'lookup' | 'transformed';
  lockAlpha?: boolean;
  erosion?: EclipseSkinErosion;
  soft?: EclipseSoftSurface;
  remap?: THREE.Texture;
  palette?: ParticlePalette;
  vertexBgra?: boolean;
}) {
  const e = options.erosion,
    soft = options.soft,
    palette = options.palette;
  if (
    e &&
    (!e.mixer.every(Number.isFinite) ||
      e.featherIn <= 0 ||
      e.featherOut <= 0 ||
      ![e.featherIn, e.featherOut, e.sliceWidth].every(Number.isFinite))
  )
    throw RangeError('Invalid Eclipse surface erosion');
  if (
    soft &&
    (![soft.beginIn, soft.beginOut, soft.deltaIn, soft.deltaOut].every(Number.isFinite) ||
      soft.deltaIn < 0 ||
      soft.deltaOut < 0 ||
      (!soft.control?.every(Number.isFinite) && soft.control !== undefined))
  )
    throw RangeError('Invalid Eclipse surface soft parameters');
  const material = new THREE.ShaderMaterial({
    name: `Leona Eclipse source ${options.kind} surface`,
    uniforms: {
      sourceTexture: { value: options.texture },
      particleColorTexture: { value: options.lookup },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      lookupUv: { value: new THREE.Vector2(0.5, 0.5) },
      sourceUvTransform: { value: new THREE.Matrix3() },
      multiplierUvTransform: { value: new THREE.Matrix3() },
      alphaRef: { value: 0 },
      ...(options.multiplier ? { multiplierTexture: { value: options.multiplier } } : {}),
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
      ...(soft
        ? {
            softDepth: { value: null as THREE.Texture | null },
            softSize: { value: new THREE.Vector2(1, 1) },
            depthConversion: { value: new THREE.Vector2(10, -9.99) },
            softParameters: {
              value: new THREE.Vector4(
                soft.beginIn * 0.01,
                soft.beginOut * 0.01,
                soft.deltaIn ? 100 / soft.deltaIn : 0,
                soft.deltaOut ? 100 / soft.deltaOut : 0
              ),
            },
            softControl: { value: new THREE.Vector4(...(soft.control ?? [0, 1, 0, 1])) },
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
    defines: {
      ...(options.kind === 'mesh' ? { SOURCE_MESH: 1 } : {}),
      ...(options.multiplier ? { SOURCE_MULT: 1 } : {}),
      ...(options.kind === 'quad' && options.multiplier && options.quadSecondaryUv === 'transformed'
        ? { SOURCE_QUAD_SECONDARY_UV: 1 }
        : {}),
      ...(options.lockAlpha ? { SOURCE_LOCK_ALPHA: 1 } : {}),
      ...(options.vertexBgra ? { SOURCE_VERTEX_BGRA: 1 } : {}),
      ...(options.remap ? { SOURCE_REMAP: 1 } : {}),
      ...(palette ? { SOURCE_PALETTE: 1 } : {}),
      ...(e ? { SOURCE_EROSION: 1 } : {}),
      ...(soft ? { SOURCE_SOFT: 1 } : {}),
    },
    vertexShader: `
      uniform mat3 sourceUvTransform;
      uniform mat3 multiplierUvTransform;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      #ifdef SOURCE_VERTEX_BGRA
        attribute vec4 _source_vertex_bgra;
      #endif
      void main() {
        sourceUv = (sourceUvTransform * vec3(uv, 1.0)).xy;
        // Native separate-alpha VS uses (u,v,0,0), retaining the linear
        // part of the transform while omitting its translation.
        alphaUv = (sourceUvTransform * vec3(uv, 0.0)).xy;
        multUv = (multiplierUvTransform * vec3(uv, 1.0)).xy;
        #ifdef SOURCE_VERTEX_BGRA
          sourceVertexColor = _source_vertex_bgra.bgra;
        #else
          sourceVertexColor = vec4(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform sampler2D particleColorTexture;
      uniform vec4 particleColor;
      uniform vec2 lookupUv;
      uniform float alphaRef;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      #ifdef SOURCE_MULT
        uniform sampler2D multiplierTexture;
      #endif
      #ifdef SOURCE_REMAP
        uniform sampler2D remapTexture;
      #endif
      #ifdef SOURCE_EROSION
        uniform sampler2D erosionTexture;
        uniform vec4 erosionMixer;
        uniform vec4 erosionParameters;
      #endif
      #ifdef SOURCE_PALETTE
        uniform sampler2D paletteTexture;
        uniform vec4 paletteSourceMix;
        uniform float paletteRow;
        uniform vec2 paletteScroll;
      #endif
      #ifdef SOURCE_SOFT
        uniform sampler2D softDepth;
        uniform vec2 softSize;
        uniform vec2 depthConversion;
        uniform vec4 softParameters;
        uniform vec4 softControl;
      #endif
      void main() {
        vec4 base = texture2D(sourceTexture, sourceUv);
        #ifdef SOURCE_LOCK_ALPHA
          base.a = texture2D(sourceTexture, alphaUv).a;
        #endif
        #ifdef SOURCE_PALETTE
          vec2 paletteUv = vec2(clamp(dot(base, paletteSourceMix), 0.0, 1.0), paletteRow) + paletteScroll;
          base.rgb = texture2D(paletteTexture, paletteUv).rgb;
        #endif
        vec4 lit = base * particleColor * sourceVertexColor;
        // Native mesh MULT_PASS replaces its lookup slot. Native quad keeps
        // the lookup and multiplies an additional texture at its second UV.
        #if !defined(SOURCE_MESH) || !defined(SOURCE_MULT)
          #ifdef SOURCE_QUAD_SECONDARY_UV
            lit *= texture2D(particleColorTexture, multUv);
          #else
            lit *= texture2D(particleColorTexture, lookupUv);
          #endif
        #endif
        #ifdef SOURCE_MULT
          #ifdef SOURCE_MESH
            lit *= texture2D(multiplierTexture, multUv);
          #else
            // Native quad MULT_PASS shares its second coordinates with lookup.
            #ifdef SOURCE_QUAD_SECONDARY_UV
              lit *= texture2D(multiplierTexture, multUv);
            #else
              lit *= texture2D(multiplierTexture, lookupUv);
            #endif
          #endif
        #endif
        #ifdef SOURCE_REMAP
          float luma = dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec4 remapped = texture2D(remapTexture, vec2(luma, 0.5));
          if (remapped.a > 0.0) lit.rgb = remapped.rgb;
        #endif
        #ifdef SOURCE_EROSION
          float value = clamp(dot(texture2D(erosionTexture, sourceUv), erosionMixer), 0.0, 1.0);
          float threshold = erosionParameters.x - value;
          float upper = clamp((threshold + erosionParameters.y) * erosionParameters.z, 0.0, 1.0);
          float lower = clamp(threshold * erosionParameters.w, 0.0, 1.0);
          lit.a *= upper - lower;
        #endif
        #ifdef SOURCE_SOFT
          float sceneZ = texture2D(softDepth, gl_FragCoord.xy / softSize).r;
          float sceneDistance = 1.0 / (depthConversion.x + depthConversion.y * sceneZ);
          float fragmentDistance = 1.0 / (depthConversion.x + depthConversion.y * gl_FragCoord.z);
          vec2 fade = clamp((vec2(sceneDistance - fragmentDistance) - softParameters.xy) * softParameters.zw, 0.0, 1.0);
          fade = fade * fade * (3.0 - 2.0 * fade);
          float amount = fade.x - fade.y;
          lit.rgb *= softControl.x + amount * softControl.y;
          lit.a *= softControl.z + amount * softControl.w;
        #endif
        #ifdef SOURCE_MESH
          lit.rgb = clamp(lit.rgb, 0.0, 1.0);
        #endif
        if (lit.a < alphaRef) discard;
        gl_FragColor = lit;
      }
    `,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  return particleColorMaterial(material);
}
