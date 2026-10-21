import * as THREE from 'three';

export interface ParticlePalette {
  texture: THREE.Texture;
  sourceMix: readonly [number, number, number, number];
  /** Already normalized row coordinate; native CPU selector conversion is caller-owned. */
  row: number;
  scroll?: readonly [number, number];
}

/** Initial RGBA product verified in native mesh PS 740/615 and quad PS 2/4.
 * For mesh MULT_PASS, pass TEXTUREMULT as the second texture.
 * Quad MULT_PASS keeps the lookup and adds a multiplier sampled at the same UV.
 * This is an inspection building block, not a complete native particle material:
 * framebuffer blending, remap, fog and native sampler state are caller concerns.
 * Optional palette replacement precedes that product (native quad PS 12/23/33).
 * Textures are borrowed. Disposing the material does not dispose any texture.
 * sourceUvOffset scrolls only the base texture; lookup/multiplier coordinates
 * retain their independent mapping. The default zero preserves unscrolled draws.
 */
export function createParticleColorProductMaterial(
  texture: THREE.Texture,
  lookup: THREE.Texture,
  coordinates: 'uniform' | 'vertex' = 'uniform',
  quadMultiplier?: THREE.Texture,
  vertexTint = false,
  palette?: ParticlePalette
) {
  return new THREE.ShaderMaterial({
    name: 'Native particle initial color product',
    uniforms: {
      sourceTexture: { value: texture },
      sourceUvOffset: { value: new THREE.Vector2() },
      ...(palette
        ? {
            paletteTexture: { value: palette.texture },
            paletteSourceMix: { value: new THREE.Vector4(...palette.sourceMix) },
            paletteRow: { value: palette.row },
            paletteScroll: { value: new THREE.Vector2(...(palette.scroll ?? ([0, 0] as const))) },
          }
        : {}),
      particleColorTexture: { value: lookup },
      ...(quadMultiplier ? { multiplierTexture: { value: quadMultiplier } } : {}),
      lookupUv: { value: new THREE.Vector2(0.5, 0.5) },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
    },
    defines: {
      ...(palette ? { PALETTIZE_TEXTURES: 1 } : {}),
      ...(coordinates === 'vertex' ? { VERTEX_LOOKUP: 1 } : {}),
      ...(vertexTint ? { VERTEX_TINT: 1 } : {}),
      ...(quadMultiplier ? { QUAD_MULT_PASS: 1 } : {}),
    },
    vertexShader: `
      varying vec2 sourceUv;
      varying vec2 colorUv;
      uniform vec2 lookupUv;
      uniform vec2 sourceUvOffset;
      #ifdef VERTEX_TINT
        attribute vec4 particleTint;
        varying vec4 vertexColor;
      #endif
      #ifdef VERTEX_LOOKUP
        attribute vec2 particleLookupUv;
      #endif
      void main() {
        sourceUv = uv + sourceUvOffset;
        #ifdef VERTEX_TINT
          vertexColor = particleTint;
        #endif
        #ifdef VERTEX_LOOKUP
          colorUv = particleLookupUv;
        #else
          colorUv = lookupUv;
        #endif
        vec4 localPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          localPosition = instanceMatrix * localPosition;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * localPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      #ifdef PALETTIZE_TEXTURES
        uniform sampler2D paletteTexture;
        uniform vec4 paletteSourceMix;
        uniform float paletteRow;
        uniform vec2 paletteScroll;
      #endif
      uniform sampler2D particleColorTexture;
      uniform vec4 particleColor;
      #ifdef QUAD_MULT_PASS
        uniform sampler2D multiplierTexture;
      #endif
      varying vec2 sourceUv;
      varying vec2 colorUv;
      #ifdef VERTEX_TINT
        varying vec4 vertexColor;
      #endif
      void main() {
        vec4 sourceColor = texture2D(sourceTexture, sourceUv);
        #ifdef PALETTIZE_TEXTURES
          // Native quad PS 12/23/33: clamp the source dot before adding scroll;
          // replace RGB only, then apply particle tint and color lookup.
          vec2 paletteUv = vec2(clamp(dot(sourceColor, paletteSourceMix), 0.0, 1.0), paletteRow)
            + paletteScroll;
          sourceColor.rgb = texture2D(paletteTexture, paletteUv).rgb;
        #endif
        gl_FragColor = sourceColor * particleColor * texture2D(particleColorTexture, colorUv);
        #ifdef VERTEX_TINT
          gl_FragColor *= vertexColor;
        #endif
        #ifdef QUAD_MULT_PASS
          gl_FragColor *= texture2D(multiplierTexture, colorUv);
        #endif
      }
    `,
    // Preserve the product in all four channels for render-target verification.
    // No implicit sRGB output conversion, tone mapping or alpha blending here.
    blending: THREE.NoBlending,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
