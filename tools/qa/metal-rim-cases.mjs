/** Synthetic inputs shared by the original Metal and reconstructed WebGL probes. */
const baseline = {
  rimOnly: true,
  source: [64, 96, 128, 128],
  lookup: [200, 160, 220, 150],
  tint: [0.2, 0.4, 0.6, 0.3],
  normal: [0.8, 0, 0.6],
  fresnel: [1, 0.43921568989753723, 0.03921568766236305, 0.8350000381469727],
};
export function metalRimCases() {
  const rows = [],
    add = (group, overrides) =>
      rows.push({ ...baseline, ...overrides, id: `${group}-${rows.length}` });
  for (const alpha of [0, 64, 255])
    for (const tintAlpha of [0, 0.2, 1])
      for (const lookupAlpha of [0, 100, 255])
        for (const normal of [
          [0, 0, 1],
          [0.8, 0, 0.6],
          [1, 0, 0],
        ])
          add('alpha', {
            source: [64, 96, 128, alpha],
            tint: [0.2, 0.4, 0.6, tintAlpha],
            lookup: [200, 160, 220, lookupAlpha],
            normal,
          });
  for (const alphaRef of [0, 5 / 255, 1])
    for (const alpha of [0, 4, 5, 6, 255])
      for (const remap of [
        [240, 20, 170, 0],
        [240, 20, 170, 1],
        [240, 20, 170, 255],
      ])
        add('threshold', {
          alphaRef,
          source: [64, 96, 128, alpha],
          lookup: [255, 255, 255, 255],
          tint: [1, 1, 1, 1],
          remap,
        });
  for (const [tintAlpha, lookupAlpha] of [
    [0, 255],
    [1, 0],
    [0.01, 255],
    [1, 2],
  ])
    add('tinted-threshold', {
      alphaRef: 5 / 255,
      source: [64, 96, 128, 255],
      lookup: [255, 255, 255, lookupAlpha],
      tint: [1, 1, 1, tintAlpha],
      remap: [240, 20, 170, 255],
    });
  for (const scale of [
    [1, 1, 1],
    [2, 0.5, 1],
    [0.25, 3, 2],
  ])
    for (const remap of [
      [240, 20, 170, 0],
      [240, 20, 170, 1],
      [240, 20, 170, 255],
    ])
      add('interpolation', { normals: [0, 0, 1, 1, 0, 0, 0.6, 0, 0.8], scale, remap });
  for (const power of [0.15, 0.8350000381469727, 5])
    for (const normal of [
      [0, 0, -1],
      [0, 0, 1],
      [0.8, 0, 0.6],
    ])
      add('power-facing', {
        fresnel: [...baseline.fresnel.slice(0, 3), power],
        normal,
        source: [10, 10, 10, 255],
        lookup: [255, 255, 255, 255],
        tint: [1, 1, 1, 1],
      });
  for (const shift of [0, 0.5])
    add('uv', {
      source: [10, 30, 50, 70, 90, 110, 130, 150],
      width: 2,
      transform: [1, 0, 0, 0, 1, 0, shift, 0, 1],
    });
  return rows;
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const normalized = (a) => a.map((v) => v / Math.hypot(...a));
/** Independent scalar transcription of VS1 and PS9/24, not a GPU implementation. */
export function expectedMetalRim(o) {
  const points = [
      [-1, -1, 0],
      [3, -1, 0],
      [-1, 3, 0],
    ],
    weights = [0.5, 0.25, 0.25];
  const vertices = points.map((p, i) => {
    const ray = normalized([p[0], p[1], -1000]);
    const normal = normalized(
      (o.normals?.slice(i * 3, i * 3 + 3) ?? o.normal).map((v, j) => v * (o.scale?.[j] ?? 1))
    );
    const facing = clamp(-dot(ray, normal));
    return o.fresnel.slice(0, 3).map((v) => (1 - facing ** o.fresnel[3]) * v);
  });
  const rim = [0, 1, 2].map((i) =>
    dot(
      vertices.map((v) => v[i]),
      weights
    )
  );
  const uv = o.uv ?? [0.25, 0.5],
    t = o.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const x = t[0] * uv[0] + t[3] * uv[1] + t[6];
  const texel = Math.min((o.width ?? 1) - 1, Math.max(0, Math.floor(x * (o.width ?? 1))));
  const source = o.source.slice(texel * 4, texel * 4 + 4);
  const lit = source.map((v, i) => ((v / 255) * o.tint[i] * o.lookup[i]) / 255);
  if (lit[3] < (o.alphaRef ?? 0)) return [0, 0, 0, 0];
  const rgb = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v) => v / 255) : lit.slice(0, 3);
  return [...rgb.map((v, i) => clamp(v + lit[3] * rim[i])), lit[3]].map((v) => Math.round(v * 255));
}
