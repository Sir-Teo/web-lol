import * as THREE from 'three';
import { baronFlag, type BaronAttackProfile } from './baron-attack-program';

/** Batched source surfaces. Geometry supplies tint, UV layers and erosion per vertex.
 * Textures are borrowed; actor placement and geometry dispatch are separate owners. */
export function createBaronParticleMaterial(
  profile: BaronAttackProfile,
  textures: ReadonlyMap<string, THREE.Texture>
) {
  const get = (key: string) => {
    const texture = textures.get(key);
    if (!texture) throw Error('Missing Baron particle texture: ' + key);
    return texture;
  };
  const material = profile.material,
    mesh = profile.geometry.kind === 'mesh';
  const divisions = (profile.settings.texDiv ?? [1, 1]).map((v) => Math.max(Math.round(v), 1));
  const shader = new THREE.ShaderMaterial({
    name: `Baron source surface ${profile.role}/${profile.name}`,
    uniforms: {
      map: { value: get(material.texture) },
      cell: { value: new THREE.Vector2(1 / divisions[0], 1 / divisions[1]) },
      alphaRef: { value: (profile.settings.alphaRef ?? 5) / 255 },
      ...(material.multiplier ? { mapMult: { value: get(material.multiplier.texture) } } : {}),
      ...(material.erosion ? { mapErosion: { value: get(material.erosion.texture) } } : {}),
      ...(material.palette
        ? {
            mapPalette: { value: get(material.palette.texture) },
            paletteRow: { value: 0.5 / material.palette.count },
          }
        : {}),
    },
    defines: {
      ...(mesh ? { SOURCE_MESH: 1 } : {}),
      ...(material.multiplier ? { SOURCE_MULT: 1 } : {}),
      ...(material.erosion ? { SOURCE_EROSION: 1 } : {}),
      ...(material.palette ? { SOURCE_PALETTE: 1 } : {}),
    },
    vertexShader: `
      attribute vec4 sourceTint;
      attribute vec3 sourceUvTurn;
      attribute vec4 sourceUvShift;
      attribute vec3 sourceMultTurn;
      attribute vec4 sourceMultShift;
      attribute vec4 sourceErosionMix;
      attribute float sourceErosionDrive;
      #ifdef SOURCE_MESH
      attribute vec4 _source_vertex_bgra;
      #endif
      varying vec2 vUv;
      varying vec4 vTint;
      varying vec3 vTurn;
      varying vec4 vShift;
      varying vec3 vMultTurn;
      varying vec4 vMultShift;
      varying vec4 vErosionMix;
      varying float vErosionDrive;
      void main() {
        vUv = uv;
        vTint = sourceTint;
        #ifdef SOURCE_MESH
        vTint *= _source_vertex_bgra.bgra;
        #endif
        vTurn = sourceUvTurn;
        vShift = sourceUvShift;
        vMultTurn = sourceMultTurn;
        vMultShift = sourceMultShift;
        vErosionMix = sourceErosionMix;
        vErosionDrive = sourceErosionDrive;
        vec4 placed = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        placed = instanceMatrix * placed;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * placed;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec2 cell;
      uniform float alphaRef;
      #ifdef SOURCE_MULT
      uniform sampler2D mapMult;
      #endif
      #ifdef SOURCE_EROSION
      uniform sampler2D mapErosion;
      #endif
      #ifdef SOURCE_PALETTE
      uniform sampler2D mapPalette;
      uniform float paletteRow;
      #endif
      varying vec2 vUv;
      varying vec4 vTint;
      varying vec3 vTurn;
      varying vec4 vShift;
      varying vec3 vMultTurn;
      varying vec4 vMultShift;
      varying vec4 vErosionMix;
      varying float vErosionDrive;
      vec2 layerUv(vec2 uv, vec3 turn, vec4 shift) {
        vec2 placed = (uv - 0.5) * turn.yz;
        float c = cos(turn.x), s = sin(turn.x);
        return vec2(placed.x*c - placed.y*s, placed.x*s + placed.y*c) + 0.5 + shift.xy;
      }
      vec4 fetchLayer(sampler2D tex, vec2 placed, vec2 origin, vec2 size, int mode) {
        vec2 held = mode == 1 ? 1.0 - abs(mod(placed, 2.0) - 1.0) : fract(placed);
        return texture2D(tex, origin + held * size);
      }
      void main() {
        vec2 placed = layerUv(vUv, vTurn, vShift);
        vec4 texel = fetchLayer(map, placed, vShift.zw, cell, 0);
        float share = 1.0;
        #ifdef SOURCE_EROSION
        vec4 eroded = fetchLayer(mapErosion, vShift.zw + placed * cell, vec2(0.0), vec2(1.0), 1);
        float value = clamp(dot(eroded, vErosionMix), 0.0, 1.0);
        // Pinned reader defaults: feather in/out .1, slice width 1.5.
        share = clamp((vErosionDrive - value + 1.5)*10.0, 0.0, 1.0)
              - clamp((vErosionDrive - value)*10.0, 0.0, 1.0);
        #endif
        #ifdef SOURCE_PALETTE
        float luma = clamp(dot(texel, vec4(0.299, 0.587, 0.114, 0.0)), 0.0, 1.0);
        texel.rgb = fetchLayer(mapPalette, vec2(luma, paletteRow), vec2(0.0), vec2(1.0), 1).rgb;
        #endif
        #ifdef SOURCE_MULT
        vec2 multUv = layerUv(vUv, vMultTurn, vMultShift);
        texel *= fetchLayer(mapMult, multUv, vMultShift.zw, vec2(1.0), 0);
        #endif
        texel.a *= share;
        vec4 lit = texel * vTint;
        if (lit.a < alphaRef) discard;
        gl_FragColor = lit;
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: (profile.settings.depthBiasFactors ?? [0, 0]).some((value) => value !== 0),
    polygonOffsetFactor: profile.settings.depthBiasFactors?.[0] ?? 0,
    polygonOffsetUnits: profile.settings.depthBiasFactors?.[1] ?? 0,
    depthTest: ((profile.settings.miscRenderFlags ?? 0) & 1) === 0,
    side:
      mesh && !baronFlag(profile.settings.disableBackfaceCull) ? THREE.FrontSide : THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: profile.settings.blendMode === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    blendSrcAlpha: THREE.SrcAlphaFactor,
    blendDstAlpha:
      profile.settings.blendMode === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    forceSinglePass: true,
    toneMapped: false,
  });
  if (![1, 4].includes(profile.settings.blendMode ?? 0)) {
    shader.dispose();
    throw Error('Unsupported Baron source blend mode');
  }
  return shader;
}
