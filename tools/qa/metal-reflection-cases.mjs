/** Synthetic ordinary reflective-mesh inputs; no native emitter binding claim. */
const baseline = {
  rimOnly: false,
  source: [64, 96, 128, 128],
  lookup: [200, 160, 220, 150],
  tint: [0.2, 0.4, 0.6, 0.3],
  normal: [0.8, 0, 0.6],
  cube: [70, 110, 150, 255],
  reflection: [0.8, 0.1, 0.7],
  reflectionColor: [1, 0.4, 0.03],
  fresnel: [1, 0.43921568989753723, 0.03921568766236305, 0.8350000381469727],
};
export function metalReflectionCases() {
  const rows = [],
    add = (group, o) => rows.push({ ...baseline, ...o, id: `${group}-${rows.length}` });
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
  const cubeFaces = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
  ];
  for (const normal of [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
    [Math.SQRT1_2, 0, Math.SQRT1_2],
    [-Math.SQRT1_2, 0, Math.SQRT1_2],
    [0, Math.SQRT1_2, Math.SQRT1_2],
    [0, -Math.SQRT1_2, Math.SQRT1_2],
  ])
    add('cube-face', { normal, cubeFaces });
  for (const scale of [
    [1, 1, 1],
    [2, 0.5, 1],
    [0.25, 3, 2],
  ])
    for (const reflection of [
      [0.15, 0, 0.9],
      [2, 0.4, 0.1],
    ])
      add('interpolation', {
        normals: [0, 0, 1, 1, 0, 0, 0.6, 0, 0.8],
        scale,
        reflection,
        cubeFaces,
      });
  for (const remap of [
    [240, 20, 170, 0],
    [240, 20, 170, 1],
    [240, 20, 170, 255],
  ])
    add('remap', { remap });
  for (const shift of [0, 0.5])
    add('uv', {
      source: [10, 30, 50, 70, 90, 110, 130, 150],
      width: 2,
      transform: [1, 0, 0, 0, 1, 0, shift, 0, 1],
    });
  for (const reflection of [
    [0.15, 0, 1],
    [5, 0, 1],
    [2, 0.8, 0.2],
  ])
    for (const reflectionColor of [
      [1, 1, 1],
      [0.2, 0.4, 0.8],
    ])
      add('reflection-power-color', { reflection, reflectionColor });
  for (const fresnelPower of [0.15, 0.8350000381469727])
    add('rim-power', {
      fresnel: [...baseline.fresnel.slice(0, 3), fresnelPower],
      tint: [1, 1, 1, 1],
      lookup: [255, 255, 255, 255],
    });
  for (const cubeAlpha of [0, 255])
    for (const amount of [0, 0.7])
      add('isolated-cube', {
        source: [0, 0, 0, 0],
        lookup: [255, 255, 255, 255],
        tint: [1, 1, 1, 0],
        fresnel: [0, 0, 0, baseline.fresnel[3]],
        cube: [70, 110, 150, cubeAlpha],
        reflection: [0.8, amount, amount],
      });
  return rows;
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const normalized = (a) => a.map((v) => v / Math.hypot(...a));
/** Scalar transcription of retained VS33/PS54, including interpolated cube direction. */
export function expectedMetalReflection(o) {
  const points = [
      [-1, -1, 0],
      [3, -1, 0],
      [-1, 3, 0],
    ],
    weights = [0.5, 0.25, 0.25];
  const vertices = points.map((p, i) => {
    const ray = normalized([p[0], p[1], -1000]),
      n = normalized(
        (o.normals?.slice(i * 3, i * 3 + 3) ?? o.normal).map((v, j) => v * (o.scale?.[j] ?? 1))
      );
    const facing = clamp(-dot(ray, n));
    return {
      amount:
        o.reflection[1] + (o.reflection[2] - o.reflection[1]) * (1 - facing ** o.reflection[0]),
      rim: o.fresnel.slice(0, 3).map((v) => (1 - facing ** o.fresnel[3]) * v),
      direction: ray.map((v, j) => v - 2 * dot(ray, n) * n[j]),
    };
  });
  const amount = dot(
      vertices.map((v) => v.amount),
      weights
    ),
    rim = [0, 1, 2].map((i) =>
      dot(
        vertices.map((v) => v.rim[i]),
        weights
      )
    ),
    direction = [0, 1, 2].map((i) =>
      dot(
        vertices.map((v) => v.direction[i]),
        weights
      )
    );
  const axis = direction.map(Math.abs).indexOf(Math.max(...direction.map(Math.abs))),
    cube = o.cubeFaces?.[2 * axis + (direction[axis] < 0 ? 1 : 0)] ?? o.cube;
  const uv = o.uv ?? [0.25, 0.5],
    t = o.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
    x = t[0] * uv[0] + t[3] * uv[1] + t[6];
  const texel = Math.min((o.width ?? 1) - 1, Math.max(0, Math.floor(x * (o.width ?? 1)))),
    source = o.source.slice(texel * 4, texel * 4 + 4);
  const lit = source.map((v, i) => ((v / 255) * o.tint[i] * o.lookup[i]) / 255),
    base = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v) => v / 255) : lit.slice(0, 3);
  const rgb = base.map((v, i) =>
    clamp(
      v + (cube[i] / 255) * amount * (1 + (o.reflectionColor[i] - 1) * amount) + lit[3] * rim[i]
    )
  );
  return [...rgb, lit[3]].map((v) => Math.round(v * 255));
}
