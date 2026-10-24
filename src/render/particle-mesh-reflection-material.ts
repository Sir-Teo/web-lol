import * as THREE from 'three';

export interface ParticleMeshRimBindings {
  texture: THREE.Texture;
  lookup: THREE.Texture;
  remap: THREE.Texture;
  uvTransform: THREE.Matrix3;
  lookupUv: readonly [number, number];
  tint: readonly [number, number, number, number];
  /** Native vFresnel: RGB then the already mapped shader exponent. */
  fresnel: readonly [number, number, number, number];
  /** In the same world units as the supplied geometry/model matrix. */
  depthPushPull: number;
}

export interface ParticleMeshReflectionBindings extends ParticleMeshRimBindings {
  environment: THREE.CubeTexture;
  /** Native vReflection.xyz: exponent, minimum, maximum. */
  reflection: readonly [number, number, number];
  reflectionColor: readonly [number, number, number];
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
  return createParticleMeshMaterial(geometry, bindings, bindings);
}

/** Retained non-REFLECTIVE mesh VS1/PS9 arithmetic, with fog disabled. A rim
 * requires no cube or reflection parameters. All native resource selection,
 * power mapping, normals and raster/blend policy remain explicit caller inputs. */
export function createParticleMeshRimMaterial(
  geometry: THREE.BufferGeometry,
  bindings: ParticleMeshRimBindings
) {
  return createParticleMeshMaterial(geometry, bindings);
}

function createParticleMeshMaterial(
  geometry: THREE.BufferGeometry,
  bindings: ParticleMeshRimBindings,
  reflection?: ParticleMeshReflectionBindings
) {
  const position = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal');
  if (!position || !normal || normal.itemSize !== 3 || normal.count !== position.count)
    throw new Error('Particle mesh requires an explicit matching normal stream');
  for (let i = 0; i < normal.count; i++) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    if (!n.every(Number.isFinite) || Math.hypot(...n) === 0)
      throw new Error('Particle mesh requires finite nonzero normals');
  }
  const uv = geometry.getAttribute('uv');
  if (
    position.itemSize !== 3 ||
    !position.count ||
    !uv ||
    uv.itemSize !== 2 ||
    uv.count !== position.count
  )
    throw new Error('Particle mesh requires explicit position and UV streams');
  if (
    ![
      ...bindings.uvTransform.elements,
      ...bindings.lookupUv,
      ...bindings.tint,
      ...(reflection?.reflection ?? []),
      ...(reflection?.reflectionColor ?? []),
      ...bindings.fresnel,
      bindings.depthPushPull,
    ].every(Number.isFinite) ||
    (reflection && reflection.reflection[0] <= 0) ||
    bindings.fresnel[3] <= 0
  )
    throw new RangeError('Invalid particle mesh bindings');
  return new THREE.ShaderMaterial({
    name: reflection
      ? 'Source reflective ordinary particle mesh (explicit bindings)'
      : 'Source rim-only ordinary particle mesh (explicit bindings)',
    defines: reflection ? { SOURCE_REFLECTIVE: 1 } : {},
    uniforms: {
      sourceTexture: { value: bindings.texture },
      particleColorTexture: { value: bindings.lookup },
      remapTexture: { value: bindings.remap },
      sourceUvTransform: { value: bindings.uvTransform.clone() },
      lookupUv: { value: new THREE.Vector2(...bindings.lookupUv) },
      particleColor: { value: new THREE.Vector4(...bindings.tint) },
      ...(reflection
        ? {
            reflectionTexture: { value: reflection.environment },
            reflectionParameters: { value: new THREE.Vector3(...reflection.reflection) },
            reflectionColor: { value: new THREE.Vector3(...reflection.reflectionColor) },
          }
        : {}),
      fresnel: { value: new THREE.Vector4(...bindings.fresnel) },
      depthPushPull: { value: bindings.depthPushPull },
    },
    vertexShader: `
      uniform mat3 sourceUvTransform;
      uniform vec4 fresnel;
      uniform float depthPushPull;
      varying vec2 sourceUv;
      varying vec3 sourceRim;
      #ifdef SOURCE_REFLECTIVE
        uniform vec3 reflectionParameters;
        varying vec4 sourceReflection;
      #endif
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 viewDirection = normalize(world.xyz - cameraPosition);
        // The archived shader uses the upper world matrix, not inverse transpose.
        vec3 surface = normalize(mat3(modelMatrix) * normal);
        float facing = clamp(dot(-viewDirection, surface), 0.0, 1.0);
        #ifdef SOURCE_REFLECTIVE
          sourceReflection = vec4(reflect(viewDirection, surface), mix(
            reflectionParameters.y, reflectionParameters.z,
            1.0 - pow(facing, reflectionParameters.x)));
        #endif
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
      uniform vec2 lookupUv;
      uniform vec4 particleColor;
      varying vec2 sourceUv;
      varying vec3 sourceRim;
      #ifdef SOURCE_REFLECTIVE
        uniform samplerCube reflectionTexture;
        uniform vec3 reflectionColor;
        varying vec4 sourceReflection;
      #endif
      void main() {
        vec4 lit = texture2D(sourceTexture, sourceUv) * particleColor
          * texture2D(particleColorTexture, lookupUv);
        vec4 remapped = texture2D(remapTexture,
          vec2(dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.5));
        if (remapped.a > 0.0) lit.rgb = remapped.rgb;
        vec3 rgb = lit.rgb;
        #ifdef SOURCE_REFLECTIVE
          float amount = sourceReflection.w;
          // Ordinary mesh PS54 does not alpha-gate the cube contribution. Its rim
          // uses fully tinted alpha; skin PS67 has a different alpha contract.
          rgb += textureCube(reflectionTexture, sourceReflection.xyz).rgb
            * amount * mix(vec3(1.0), reflectionColor, amount);
        #endif
        lit.rgb = clamp(rgb + lit.a * sourceRim, 0.0, 1.0);
        gl_FragColor = lit;
      }
    `,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}
