import * as THREE from 'three';

/** Restore particle-only states that standard glTF materials cannot express. */
export function configureHawkshotMaterial(material: THREE.Material): void {
  if (material.userData.sourceBlendMode !== 4)
    throw new Error('Unsupported Hawkshot source blend mode');
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneFactor;
  material.premultipliedAlpha = false;
  material.depthWrite = false;
  // Source culling is disabled in one draw. Three's default two-pass transparency
  // flips back-face normals, which would incorrectly erase the source Fresnel rim.
  material.forceSinglePass = true;
  if (!['Owl2', 'Owl3'].includes(material.userData.sourceEmitter)) return;
  const { fresnel, fresnelColor } = material.userData;
  if (!Number.isFinite(fresnel) || fresnel <= 0 || !Array.isArray(fresnelColor))
    throw new Error('Hawkshot lacks source Fresnel parameters');
  material.customProgramCacheKey = () => 'hawkshot-source-fresnel-v1';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hawkFresnel = { value: fresnel };
    shader.uniforms.hawkFresnelColor = { value: new THREE.Vector3(...fresnelColor.slice(0, 3)) };
    shader.vertexShader =
      `uniform float hawkFresnel;
uniform vec3 hawkFresnelColor;
varying vec3 vHawkRim;\n` +
      shader.vertexShader
        // MeshBasicMaterial normally only computes normals for skinning/environment maps.
        .replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )', '#if 1')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
float hawkFacing = clamp(dot(normalize(-mvPosition.xyz), normalize(transformedNormal)), 0.0, 1.0);
vHawkRim = (1.0 - pow(hawkFacing, hawkFresnel)) * hawkFresnelColor;`
        );
    shader.fragmentShader =
      'varying vec3 vHawkRim;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight += vHawkRim * diffuseColor.a;\n#include <opaque_fragment>'
      );
  };
}
