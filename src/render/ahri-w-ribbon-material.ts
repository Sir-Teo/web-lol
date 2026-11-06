import * as THREE from 'three';
import data from '../content/ahri-w-particles.json';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { createLeonaEclipseSurfaceMaterial } from './leona-eclipse-surface-material';
/** Quad-family fragment arithmetic with packed per-vertex tint, lookup,
 * erosion and independent UV coordinates. Textures remain page-owned. */
export function createWRibbonMaterial(index: number, assets: EclipseSurfaceAssets) {
  const p = data.profiles[index];
  if (
    !p ||
    p.kind !== 'trail' ||
    p.palette ||
    p.soft ||
    p.distortion ||
    p.uv.divisions.some((v) => v !== 1) ||
    (p.multiplier?.uv.divisions.some((v) => v !== 1) ?? false) ||
    ![1, 4].includes(p.blend)
  )
    throw Error('Unsupported Ahri W ribbon material');
  const e = p.erosion;
  const material = createLeonaEclipseSurfaceMaterial({
    kind: 'quad',
    texture: assets.texture(p.texture, p.uv.address),
    lookup: assets.texture(p.lookup ?? '', 2),
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
  material.name = 'Ahri W ' + p.role + ' ' + p.name + ' packed ribbon';
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
        sourceUv = uv;
        alphaUv = uv;
        multUv = sourceMultUv;
        particleColor = sourceTint;
        lookupUv = sourceLookup;
        particleErosion = sourceErosion;
        sourceVertexColor = vec4(1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;
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
