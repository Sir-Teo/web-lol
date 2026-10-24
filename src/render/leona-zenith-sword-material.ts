import * as THREE from 'three';
import inputs from '../content/leona-e-sword-material.json';
import normals from '../content/leona-e-sword-normals.json';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { ZENITH_PROFILES } from './leona-zenith-particles';
import { createParticleMeshRimMaterial } from './particle-mesh-reflection-material';

let remapBypass: THREE.DataTexture | undefined;

/** The identified blend-zero CPU path premultiplies combined RGB, then forces
 * kColorFactor alpha to one. This family-specific contract is distinct from
 * the earlier shared local tint policy used by other surface families. */
export function zenithSwordTint(index: number, color: readonly number[]) {
  if (index !== inputs.profileIndex) return undefined;
  return [
    color[0] * color[3],
    color[1] * color[3],
    color[2] * color[3],
    inputs.colorPacking.outputAlpha,
  ];
}

function bypass() {
  // Session-owned explicit local bypass. Native global remap binding is still
  // unobserved. It is separate from the white empty particle-lookup fallback.
  if (!remapBypass) {
    remapBypass = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    remapBypass.colorSpace = THREE.NoColorSpace;
    remapBypass.minFilter = remapBypass.magFilter = THREE.NearestFilter;
    remapBypass.generateMipmaps = false;
    remapBypass.needsUpdate = true;
  }
  return remapBypass;
}

/** Conditional generic SCB/empty-map arithmetic with explicit local resource,
 * fog/raster and saved-placement policies. Actual native E dispatch is open. */
export function zenithSwordMaterial(
  index: number,
  assets: EclipseSurfaceAssets,
  geometry: THREE.BufferGeometry | undefined
) {
  if (index !== inputs.profileIndex) return undefined;
  const profile = ZENITH_PROFILES[index];
  if (
    !geometry ||
    geometry.userData.derivedNormalSha256 !== normals.stream.sha256 ||
    profile.mesh !== inputs.sourceModel ||
    !profile.texture
  )
    throw Error('Zenith sword requires its explicitly derived source normal stream');
  const material = createParticleMeshRimMaterial(geometry, {
    texture: assets.texture(profile.texture, profile.uv.address),
    lookup: assets.texture(profile.lookup ?? '', 2),
    remap: bypass(),
    uvTransform: new THREE.Matrix3(),
    lookupUv: [0.5, 0.5],
    tint: [1, 1, 1, 1],
    fresnel: inputs.fresnel as [number, number, number, number],
    depthPushPull: inputs.depthPushPull,
    alphaRef: inputs.alphaRef,
  });
  material.side = THREE.DoubleSide;
  material.userData.sourceAdapter = 'conditional-scb-rim-no-cube';
  return material;
}
