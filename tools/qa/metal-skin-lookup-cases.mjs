/** PS11 lookup controls. Only explicit white-RGBA lookup has a local material path. */
import { metalSkinCases, expectedMetalSkin } from './metal-skin-cases.mjs';

const noErosion = (width = 1) => ({
  texel: Array(width * 4).fill(0),
  mixer: [0, 0, 0, 1],
  drive: 0,
  slice: 1,
  in: 1,
  out: 1,
});
export function metalSkinLookupCases() {
  const cases = metalSkinCases()
    .filter((o) => !o.id.startsWith('erosion-'))
    .map((o) => ({
      ...o,
      id: 'white-' + o.id,
      lookup: [255, 255, 255, 255],
      erosion: noErosion(o.width),
      webglSupported: true,
    }));
  const base = structuredClone(cases.find((o) => o.id === 'white-bones-mixed'));
  for (const alpha of [0, 64, 128, 255])
    for (const tintAlpha of [0, 0.2, 1])
      for (const power of [0.3449999988079071, 0.8350000381469727])
        cases.push({
          ...structuredClone(base),
          id: `lookup-alpha-${alpha}-${tintAlpha}-${power}`,
          lookup: [255, 255, 255, alpha],
          tint: [0.2, 0.4, 0.6, tintAlpha],
          power,
          webglSupported: alpha === 255,
        });
  for (const baseUv of [0.25, 0.75])
    for (const lookupUv of [0.25, 0.75])
      cases.push({
        ...structuredClone(base),
        id: `lookup-uv-${baseUv}-${lookupUv}`,
        source: [200, 20, 40, 100, 30, 140, 170, 200],
        width: 2,
        uv: [baseUv, 0.5],
        lookup: [255, 255, 255, 0, 128, 255, 64, 255],
        lookupWidth: 2,
        lookupUv: [lookupUv, 0.5],
        erosion: noErosion(2),
        webglSupported: false,
      });
  for (const alpha of [1, 255])
    cases.push({
      ...structuredClone(base),
      id: `lookup-zero-remap-${alpha}`,
      lookup: [255, 255, 255, 0],
      remap: [240, 20, 170, alpha],
      webglSupported: false,
    });
  return cases;
}
export function expectedMetalSkinLookup(o) {
  const uv = o.lookupUv ?? [0.5, 0.5],
    index =
      Math.min(
        (o.lookupWidth ?? 1) - 1,
        Math.floor(Math.max(0, Math.min(1, uv[0])) * (o.lookupWidth ?? 1))
      ) * 4;
  const lookup = o.lookup.slice(index, index + 4);
  // Scalar arithmetic folds the two float samples without byte quantization.
  // The Metal draw keeps the actual independent base and lookup textures.
  const source = o.source.map((value, i) => (value * lookup[i % 4]) / 255);
  return expectedMetalSkin({ ...o, source, erosion: noErosion(o.width) });
}
