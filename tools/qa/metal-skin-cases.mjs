/** Independent scalar reference for the explicit VS0/PS34 synthetic fixture. */
const clamp = (x) => Math.max(0, Math.min(1, x));
export const identitySkinBone = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const points = [
  [-1, -1, 0],
  [3, -1, 0],
  [-1, 3, 0],
];
const unit = (v) => {
  const length = Math.hypot(...v);
  if (!(length > 0)) throw Error('Degenerate synthetic vector');
  return v.map((x) => x / length);
};
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export function metalSkinCases() {
  const cases = [],
    base = {
      source: [100, 180, 220, 128],
      tint: [0.2, 0.4, 0.6, 0.3],
      normal: [0.9, 0, 0.4],
      power: 0.3449999988079071,
      rim: [1, 0.7411764860153198, 0.3764705955982208],
      erosion: {
        texel: [0, 0, 0, 128],
        mixer: [0, 0, 0, 1],
        drive: 0.5,
        slice: 1.5,
        in: 0.35,
        out: 0.35,
      },
      remap: [0, 0, 0, 0],
    };
  const add = (id, changes = {}) => cases.push(structuredClone({ ...base, id, ...changes }));
  for (const normal of [
    [0, 0, 1],
    [0.9, 0, 0.4],
    [0, 0, -1],
  ])
    for (const alpha of [0, 64, 255])
      for (const tintAlpha of [0, 0.2, 1])
        for (const power of [0.3449999988079071, 0.8350000381469727])
          add(`rim-${cases.length}`, {
            normal,
            source: [100, 180, 220, alpha],
            tint: [0, 0, 0, tintAlpha],
            power,
          });
  for (const power of [
    Math.fround(0.05),
    0.3449999988079071,
    Math.fround(0.15),
    0.8350000381469727,
  ])
    add(`power-${power}`, { power, tint: [0, 0, 0, 1], source: [0, 0, 0, 255] });
  for (const remap of [
    [240, 20, 170, 0],
    [240, 20, 170, 1],
    [240, 20, 170, 255],
  ])
    add(`remap-${remap[3]}`, { remap });
  for (const drive of [-1, 0, 0.4, 0.8, 1, 1.5])
    for (const mixer of [
      [0, 0, 0, 1],
      [0.5, 1, 0.25, 0.1],
      [2, 2, 2, 2],
    ])
      add(`erosion-${cases.length}`, {
        erosion: { texel: [70, 100, 150, 200], drive, mixer, in: 0.35, out: 0.25, slice: 1.5 },
      });
  for (const shift of [0, 0.5])
    add(`uv-${shift}`, {
      width: 2,
      uv: [0.25, 0.5],
      transform: [1, 0, 0, 0, 1, 0, shift, 0, 1],
      source: [200, 20, 40, 100, 30, 140, 170, 200],
      erosion: {
        texel: [50, 70, 90, 120, 160, 180, 200, 240],
        drive: 0.7,
        mixer: [0, 0, 0, 1],
        in: 0.35,
        out: 0.35,
        slice: 1.5,
      },
    });
  const bones = [
    identitySkinBone,
    [1, 0, 0, 0.125, 0, 1, 0, 0.25, 0, 0, 1, 0.5],
    [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    [2, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0],
  ];
  for (const [name, joints, weights] of [
    ['translated', [1, 1, 1, 1], [1, 0, 0, 0]],
    ['rotated', [2, 2, 2, 2], [1, 0, 0, 0]],
    ['scaled', [3, 3, 3, 3], [1, 0, 0, 0]],
    ['mixed', [0, 1, 2, 3], [0.25, 0.25, 0.25, 0.25]],
  ])
    add(`bones-${name}`, { bones, joints, weights });
  add('per-vertex-weights', {
    bones,
    joints: [0, 1, 2, 3],
    weights: [0.5, 0.25, 0.125, 0.125, 0.25, 0.5, 0.125, 0.125, 0.25, 0.25, 0.25, 0.25],
  });
  add('interpolated-normal', { normals: [0.9, 0, 0.4, 0, 0.9, 0.4, 0, 0, 1] });
  add('last-palette-bone', { joints: [255, 255, 255, 255] });
  return cases;
}
export function expectedMetalSkin(o) {
  const vertices = points.map((point, i) => {
    const normal = o.normals?.slice(i * 3, i * 3 + 3) ?? o.normal;
    const weights = (o.weights?.length === 12 ? o.weights.slice(i * 4, i * 4 + 4) : o.weights) ?? [
      1, 0, 0, 0,
    ];
    const joints = o.joints ?? [0, 0, 0, 0];
    const transform = (value, w) =>
      [0, 1, 2].map((row) =>
        weights.reduce((sum, weight, k) => {
          const bone = o.bones?.[joints[k]] ?? identitySkinBone;
          return sum + weight * dot(bone.slice(row * 4, row * 4 + 4), [...value, w]);
        }, 0)
      );
    const p = transform(point, 1),
      n = unit(transform(normal, 0)),
      ray = unit([-p[0], -p[1], 1000 - p[2]]);
    return { p, rim: o.rim.map((c) => c * (1 - Math.pow(clamp(dot(ray, n)), o.power))) };
  });
  const [[x0, y0], [x1, y1], [x2, y2]] = vertices.map((v) => v.p);
  const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const a = ((y1 - y2) * -x2 + (x2 - x1) * -y2) / denominator;
  const b = ((y2 - y0) * -x2 + (x0 - x2) * -y2) / denominator;
  const weights = [a, b, 1 - a - b];
  if (!weights.every((v) => v > 0)) throw Error('Fixture does not cover sample center');
  const uv = o.uv ?? [0.25, 0.5],
    t = o.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const u = t[0] * uv[0] + t[3] * uv[1] + t[6];
  const index = Math.min((o.width ?? 1) - 1, Math.floor(clamp(u) * (o.width ?? 1))) * 4;
  const source = o.source.slice(index, index + 4).map((v) => v / 255);
  let rgb = source.slice(0, 3).map((v, i) => v * o.tint[i]);
  if (o.remap?.[3] > 0) rgb = o.remap.slice(0, 3).map((v) => v / 255);
  rgb = rgb.map((v, c) =>
    clamp(v + source[3] * vertices.reduce((sum, vertex, i) => sum + weights[i] * vertex.rim[c], 0))
  );
  const e = o.erosion,
    texel = e.texel.slice(index, index + 4).map((v) => v / 255),
    value = clamp(dot(texel, e.mixer));
  const band = clamp((e.drive - value + e.slice) / e.in) - clamp((e.drive - value) / e.out);
  return [...rgb, source[3] * o.tint[3] * band].map((v) => Math.round(clamp(v) * 255));
}
