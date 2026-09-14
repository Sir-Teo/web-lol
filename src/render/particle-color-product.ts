import * as THREE from 'three';

/** Initial RGBA product verified in native mesh PS 740 and quad PS 2.
 * This is an inspection building block, not a complete native particle material:
 * framebuffer blending, remap, fog and native sampler state are caller concerns.
 * Textures are borrowed. Disposing the material does not dispose either texture.
 */
export function createParticleColorProductMaterial(
  texture: THREE.Texture,
  lookup: THREE.Texture,
  coordinates: 'uniform' | 'vertex' = 'uniform'
) {
  return new THREE.ShaderMaterial({
    name: 'Native particle initial color product',
    uniforms: {
      sourceTexture: { value: texture },
      particleColorTexture: { value: lookup },
      lookupUv: { value: new THREE.Vector2(0.5, 0.5) },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
    },
    defines: coordinates === 'vertex' ? { VERTEX_LOOKUP: 1 } : {},
    vertexShader: `
      varying vec2 sourceUv;
      varying vec2 colorUv;
      uniform vec2 lookupUv;
      #ifdef VERTEX_LOOKUP
        attribute vec2 particleLookupUv;
      #endif
      void main() {
        sourceUv = uv;
        #ifdef VERTEX_LOOKUP
          colorUv = particleLookupUv;
        #else
          colorUv = lookupUv;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform sampler2D particleColorTexture;
      uniform vec4 particleColor;
      varying vec2 sourceUv;
      varying vec2 colorUv;
      void main() {
        gl_FragColor = texture2D(sourceTexture, sourceUv)
          * particleColor * texture2D(particleColorTexture, colorUv);
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
