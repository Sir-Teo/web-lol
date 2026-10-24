import * as THREE from 'three';
import type { ParticlePalette } from './particle-color-product';

/** Expanded trail vertices use the native quad family. CPU arrays already hold
 * RGBA tint (the external prelude compensates the native input BGRA swizzle).
 * Missing lookup/remap, blend state and depth push are explicit caller policies.
 * Borrowed textures are never disposed by this material. */
export function createParticleRibbonMaterial(options: {
  texture: THREE.Texture;
  lookup: THREE.Texture;
  palette?: ParticlePalette;
  remap?: THREE.Texture;
}) {
  const palette = options.palette;
  return new THREE.ShaderMaterial({
    name: 'Source quad-family ribbon',
    uniforms: {
      sourceTexture: { value: options.texture },
      particleColorTexture: { value: options.lookup },
      alphaRef: { value: 0 },
      depthPushPull: { value: 0 },
      ...(options.remap ? { remapTexture: { value: options.remap } } : {}),
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
      ...(options.remap ? { SOURCE_REMAP: 1 } : {}),
      ...(palette ? { SOURCE_PALETTE: 1 } : {}),
    },
    vertexShader: `
      attribute vec4 particleTint;
      attribute vec2 particleLookupUv;
      uniform float depthPushPull;
      varying vec2 sourceUv;
      varying vec2 lookupUv;
      varying vec4 tint;
      void main() {
        sourceUv = uv;
        lookupUv = particleLookupUv;
        tint = particleTint;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 away = world.xyz - cameraPosition;
        world.xyz += away / max(length(away), 0.000001) * depthPushPull;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform sampler2D particleColorTexture;
      uniform float alphaRef;
      varying vec2 sourceUv;
      varying vec2 lookupUv;
      varying vec4 tint;
      #ifdef SOURCE_PALETTE
        uniform sampler2D paletteTexture;
        uniform vec4 paletteSourceMix;
        uniform float paletteRow;
        uniform vec2 paletteScroll;
      #endif
      #ifdef SOURCE_REMAP
        uniform sampler2D remapTexture;
      #endif
      void main() {
        vec4 base = texture2D(sourceTexture, sourceUv);
        #ifdef SOURCE_PALETTE
          vec2 paletteUv = vec2(clamp(dot(base, paletteSourceMix), 0.0, 1.0), paletteRow)
            + paletteScroll;
          base.rgb = texture2D(paletteTexture, paletteUv).rgb;
        #endif
        vec4 lit = base * tint * texture2D(particleColorTexture, lookupUv);
        #ifdef SOURCE_REMAP
          vec4 remapped = texture2D(remapTexture, vec2(dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.5));
          if (remapped.a > 0.0) lit.rgb = remapped.rgb;
        #endif
        if (lit.a < alphaRef) discard;
        gl_FragColor = lit;
      }
    `,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}
