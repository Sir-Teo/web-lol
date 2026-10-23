import * as THREE from 'three';

/** Native distortion_ps 0/1 and distortion_mesh_ps 0/1, frozen 16.18 Metal AIR.
 * This material reconstructs fragment arithmetic, not CPU distortion-mode routing,
 * render-list timing, native sampler setup or source-to-DistortionPower conversion.
 * Input tint is already RGBA; native quad VS swizzles its packed BGRA attribute.
 * Textures are borrowed. Frame and screenRect are supplied by the copy pass. */
export function createParticleDistortionMaterial(options: {
  texture: THREE.Texture;
  lookup: THREE.Texture;
  normal: THREE.Texture;
  coordinates?: 'uniform' | 'vertex';
  alphaTest?: boolean;
  vertexTint?: boolean;
}) {
  return new THREE.ShaderMaterial({
    name: 'Source particle distortion',
    uniforms: {
      sourceTexture: { value: options.texture },
      particleColorTexture: { value: options.lookup },
      normalTexture: { value: options.normal },
      backBuffer: { value: null as THREE.Texture | null },
      particleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      lookupUv: { value: new THREE.Vector2(0.5, 0.5) },
      distortionPower: { value: 0 },
      alphaRef: { value: 0 },
      screenRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
    defines: {
      ...(options.coordinates === 'vertex' ? { VERTEX_LOOKUP: 1 } : {}),
      ...(options.alphaTest ? { SOURCE_ALPHA_TEST: 1 } : {}),
      ...(options.vertexTint ? { VERTEX_TINT: 1 } : {}),
    },
    vertexShader: `
      varying vec2 sourceUv;
      varying vec2 colorUv;
      varying vec2 copiedUv;
      #ifdef VERTEX_TINT
        varying vec4 sourceTint;
      #endif
      uniform vec2 lookupUv;
      uniform vec4 screenRect;
      #ifdef VERTEX_TINT
        attribute vec4 particleTint;
      #endif
      #ifdef VERTEX_LOOKUP
        attribute vec2 particleLookupUv;
      #endif
      void main() {
        sourceUv=uv;
        #ifdef VERTEX_TINT
          sourceTint=particleTint;
        #endif
        #ifdef VERTEX_LOOKUP
          colorUv=particleLookupUv;
        #else
          colorUv=lookupUv;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        // Native VS divides clip XY by W before perspective interpolation.
        // Keep that behavior, including non-billboard quads with varying depth.
        copiedUv=screenRect.xy+(gl_Position.xy/gl_Position.w*.5+.5)*screenRect.zw;
        copiedUv.y=1.0-copiedUv.y;
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform sampler2D particleColorTexture;
      uniform sampler2D normalTexture;
      uniform sampler2D backBuffer;
      uniform vec4 particleColor;
      uniform float distortionPower;
      uniform float alphaRef;
      varying vec2 sourceUv;
      varying vec2 colorUv;
      varying vec2 copiedUv;
      #ifdef VERTEX_TINT
        varying vec4 sourceTint;
      #endif
      void main() {
        vec4 ramp=texture2D(particleColorTexture,colorUv);
        vec4 normal=texture2D(normalTexture,sourceUv);
        vec2 at=copiedUv+(normal.xy-.5)*2.0*ramp.a*distortionPower;
        // Metal copy is top-left; the WebGL framebuffer copy is bottom-left.
        vec4 frame=texture2D(backBuffer,vec2(at.x,1.0-at.y));
        vec4 base=texture2D(sourceTexture,sourceUv);
        float alpha=normal.a*ramp.a;
        #ifdef SOURCE_ALPHA_TEST
          if(alpha<alphaRef)discard;
        #endif
        #ifdef VERTEX_TINT
          vec3 tint=sourceTint.rgb;
        #else
          vec3 tint=particleColor.rgb;
        #endif
        gl_FragColor=vec4(ramp.rgb*tint*frame.rgb*base.rgb,alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    forceSinglePass: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}
