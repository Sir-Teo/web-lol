import * as THREE from 'three';

export interface ParticleMeshReflectionBindings {
  texture: THREE.Texture;
  lookup: THREE.Texture;
  remap: THREE.Texture;
  environment: THREE.CubeTexture;
  uvTransform: THREE.Matrix3;
  lookupUv: readonly [number, number];
  tint: readonly [number, number, number, number];
  /** Native vReflection.xyz: exponent, minimum, maximum. */
  reflection: readonly [number, number, number];
  reflectionColor: readonly [number, number, number];
  /** Native vFresnel: RGB then exponent. */
  fresnel: readonly [number, number, number, number];
  /** In the same world units as the supplied geometry/model matrix. */
  depthPushPull: number;
}

/** Exploratory native mesh VS33/PS54 arithmetic, with fog disabled. Every texture
 * and CPU uniform is explicit: this does not select an emitter variant or supply
 * missing native bindings. In particular, SCB geometry without normals must fail
 * instead of silently using Three's missing-attribute values or generated normals.
 * The caller owns raster/blend state and all borrowed geometry/textures. */
export function createParticleMeshReflectionMaterial(
  geometry: THREE.BufferGeometry,
  bindings: ParticleMeshReflectionBindings
) {
  const position = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal');
  if (!position || !normal || normal.itemSize !== 3 || normal.count !== position.count)
    throw new Error('Reflective particle mesh requires an explicit matching normal stream');
  for (let i = 0; i < normal.count; i++) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    if (!n.every(Number.isFinite) || Math.hypot(...n) === 0)
      throw new Error('Reflective particle mesh requires finite nonzero normals');
  }
  const uv = geometry.getAttribute('uv');
  if (
    position.itemSize !== 3 ||
    !position.count ||
    !uv ||
    uv.itemSize !== 2 ||
    uv.count !== position.count
  )
    throw new Error('Reflective particle mesh requires explicit position and UV streams');
  if (
    ![
      ...bindings.uvTransform.elements,
      ...bindings.lookupUv,
      ...bindings.tint,
      ...bindings.reflection,
      ...bindings.reflectionColor,
      ...bindings.fresnel,
      bindings.depthPushPull,
    ].every(Number.isFinite) ||
    bindings.reflection[0] <= 0 ||
    bindings.fresnel[3] <= 0
  )
    throw new RangeError('Invalid reflective particle mesh bindings');
  return new THREE.ShaderMaterial({
    name: 'Source reflective ordinary particle mesh (explicit bindings)',
    uniforms: {
      sourceTexture: { value: bindings.texture },
      particleColorTexture: { value: bindings.lookup },
      remapTexture: { value: bindings.remap },
      reflectionTexture: { value: bindings.environment },
      sourceUvTransform: { value: bindings.uvTransform.clone() },
      lookupUv: { value: new THREE.Vector2(...bindings.lookupUv) },
      particleColor: { value: new THREE.Vector4(...bindings.tint) },
      reflectionParameters: { value: new THREE.Vector3(...bindings.reflection) },
      reflectionColor: { value: new THREE.Vector3(...bindings.reflectionColor) },
      fresnel: { value: new THREE.Vector4(...bindings.fresnel) },
      depthPushPull: { value: bindings.depthPushPull },
    },
    vertexShader: `
      uniform mat3 sourceUvTransform;
      uniform vec3 reflectionParameters;
      uniform vec4 fresnel;
      uniform float depthPushPull;
      varying vec2 sourceUv;
      varying vec4 sourceReflection;
      varying vec3 sourceRim;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 viewDirection = normalize(world.xyz - cameraPosition);
        // The archived shader uses the upper world matrix, not inverse transpose.
        vec3 surface = normalize(mat3(modelMatrix) * normal);
        float facing = clamp(dot(-viewDirection, surface), 0.0, 1.0);
        sourceReflection = vec4(reflect(viewDirection, surface), mix(
          reflectionParameters.y, reflectionParameters.z,
          1.0 - pow(facing, reflectionParameters.x)));
        sourceRim = (1.0 - pow(facing, fresnel.w)) * fresnel.rgb;
        sourceUv = (sourceUvTransform * vec3(uv, 1.0)).xy;
        world.xyz += viewDirection * depthPushPull;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D sourceTexture;
      uniform sampler2D particleColorTexture;
      uniform sampler2D remapTexture;
      uniform samplerCube reflectionTexture;
      uniform vec2 lookupUv;
      uniform vec4 particleColor;
      uniform vec3 reflectionColor;
      varying vec2 sourceUv;
      varying vec4 sourceReflection;
      varying vec3 sourceRim;
      void main() {
        vec4 lit = texture2D(sourceTexture, sourceUv) * particleColor
          * texture2D(particleColorTexture, lookupUv);
        vec4 remapped = texture2D(remapTexture,
          vec2(dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.5));
        if (remapped.a > 0.0) lit.rgb = remapped.rgb;
        float amount = sourceReflection.w;
        // Ordinary mesh PS54 does not alpha-gate the cube contribution. Its rim
        // uses fully tinted alpha; skin PS67 has a different alpha contract.
        vec3 cube = textureCube(reflectionTexture, sourceReflection.xyz).rgb
          * amount * mix(vec3(1.0), reflectionColor, amount);
        lit.rgb = clamp(lit.rgb + cube + lit.a * sourceRim, 0.0, 1.0);
        gl_FragColor = lit;
      }
    `,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}
