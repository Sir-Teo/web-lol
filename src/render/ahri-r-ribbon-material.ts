import * as THREE from 'three';
import data from '../content/ahri-r-particles.json';
import { AHRI_R_BOUND_SPELL_PROFILES } from './ahri-r-particles';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { createLeonaEclipseSurfaceMaterial } from './leona-eclipse-surface-material';
/** Omitted ramps are disabled by this explicit local material adapter. */
export function rSoftParameters(
  soft: { beginIn?: number; deltaIn?: number; beginOut?: number; deltaOut?: number } | null
) {
  return soft
    ? {
        beginIn: soft.beginIn ?? 0,
        deltaIn: soft.deltaIn ?? 0,
        beginOut: soft.beginOut ?? 0,
        deltaOut: soft.deltaOut ?? 0,
      }
    : null;
}
/** Quad-family fragment arithmetic with packed per-vertex tint, lookup,
 * erosion, flipbook cells and independent UV coordinates. Missing global
 * palette input remains neutral; soft control is a local blend-aware adapter.
 * Textures remain page-owned. */
export function createRRibbonMaterial(index: number, assets: EclipseSurfaceAssets) {
  const p = data.profiles[index];
  if (
    !p ||
    !AHRI_R_BOUND_SPELL_PROFILES.includes(index) ||
    p.kind !== 'trail' ||
    (p.palette && p.palette.texture !== null) ||
    p.distortion ||
    p.uv.divisions.some((v) => !Number.isSafeInteger(v) || v <= 0) ||
    ![1, 4].includes(p.blend)
  )
    throw Error('Unsupported Ahri R ribbon material');
  const e = p.erosion,
    soft = rSoftParameters(p.soft);
  const material = createLeonaEclipseSurfaceMaterial({
    kind: 'quad',
    texture: assets.texture(p.texture, p.uv.address),
    lookup: assets.texture(p.lookup ?? '', 2),
    ...(soft
      ? {
          soft: {
            ...soft,
            control: [1, 0, 0, 1] as const,
          },
        }
      : {}),
    ...(p.multiplier
      ? {
          multiplier: assets.texture(p.multiplier.texture, p.multiplier.uv.address),
          quadSecondaryUv: 'transformed' as const,
        }
      : {}),
    ...(e
      ? {
          erosion: {
            texture: assets.texture(e.texture, e.address),
            mixer: e.mixer.constant as [number, number, number, number],
            featherIn: e.featherIn,
            featherOut: e.featherOut,
            sliceWidth: e.sliceWidth,
          },
        }
      : {}),
  });
  material.name = 'Ahri R ' + p.role + ' ' + p.name + ' packed ribbon';
  const replace = (source: string, from: string, to: string) => {
    if (!source.includes(from)) throw Error('Quad fragment contract changed');
    return source.replace(from, to);
  };
  try {
    material.fragmentShader = replace(
      material.fragmentShader,
      'uniform vec4 particleColor;',
      'varying vec4 particleColor;'
    );
    material.fragmentShader = replace(
      material.fragmentShader,
      'uniform vec2 lookupUv;',
      'varying vec2 lookupUv;'
    );
    material.fragmentShader = replace(
      material.fragmentShader,
      'uniform vec4 erosionParameters;',
      'uniform vec4 erosionParameters; varying float particleErosion;'
    );
    material.fragmentShader = replace(
      material.fragmentShader,
      'erosionParameters.x - value',
      'particleErosion - value'
    );
    material.vertexShader = `
      attribute vec2 sourceCell;
      attribute vec2 sourceMultCell;
      uniform vec2 sourceCellSize;
      uniform vec2 sourceMultCellSize;
      attribute vec4 sourceTint;
      attribute vec2 sourceLookup;
      attribute float sourceErosion;
      attribute vec2 sourceMultUv;
      varying vec4 particleColor;
      varying vec2 lookupUv;
      varying float particleErosion;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      void main() {
        sourceUv = uv * sourceCellSize + sourceCell;
        alphaUv = sourceUv;
        multUv = sourceMultUv * sourceMultCellSize + sourceMultCell;
        particleColor = sourceTint;
        lookupUv = sourceLookup;
        particleErosion = sourceErosion;
        sourceVertexColor = vec4(1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;
    material.uniforms.sourceCellSize = {
      value: new THREE.Vector2(1 / p.uv.divisions[0], 1 / p.uv.divisions[1]),
    };
    material.uniforms.sourceMultCellSize = {
      value: new THREE.Vector2(
        1 / (p.multiplier?.uv.divisions[0] ?? 1),
        1 / (p.multiplier?.uv.divisions[1] ?? 1)
      ),
    };
    material.userData.unboundPalette = !!p.palette && !p.palette.texture;
    material.uniforms.alphaRef.value = p.alphaRef;
    Object.assign(material, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
      depthTest: (p.miscRenderFlags & 1) === 0,
      polygonOffset: p.depthBias.some((v) => v !== 0),
      polygonOffsetFactor: p.depthBias[0],
      polygonOffsetUnits: p.depthBias[1],
    });
    return material;
  } catch (error) {
    material.dispose();
    throw error;
  }
}
