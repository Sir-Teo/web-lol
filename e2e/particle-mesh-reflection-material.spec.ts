import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const normalized = (a: number[]) => a.map((v) => v / Math.hypot(...a));
const weights = [0.5, 0.25, 0.25];
const points = [
  [-1, -1, 0],
  [3, -1, 0],
  [-1, 3, 0],
];

// Independent scalar transcription of the retained VS33 / PS54 observations.
// Tests supply synthetic streams/resources; these are not native E bindings.
function expected(o: any) {
  const vertices = points.map((p, i) => {
    const ray = normalized([p[0], p[1], -1000]),
      n = normalized(
        (o.normals?.slice(i * 3, i * 3 + 3) ?? o.normal).map(
          (v: number, j: number) => v * (o.scale?.[j] ?? 1)
        )
      ),
      f = clamp(-dot(ray, n)),
      r = o.reflection[1] + (o.reflection[2] - o.reflection[1]) * (1 - f ** o.reflection[0]);
    return {
      r,
      rim: o.fresnel.slice(0, 3).map((v: number) => (1 - f ** o.fresnel[3]) * v),
      direction: ray.map((v, j) => v - 2 * dot(ray, n) * n[j]),
    };
  });
  const r = dot(
      vertices.map((v) => v.r),
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
    ),
    axis = direction.map(Math.abs).indexOf(Math.max(...direction.map(Math.abs))),
    cube = o.cubeFaces?.[2 * axis + (direction[axis] < 0 ? 1 : 0)] ?? o.cube,
    lit = o.source.map((v: number, i: number) => ((v / 255) * o.tint[i] * o.lookup[i]) / 255),
    base = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v: number) => v / 255) : lit.slice(0, 3),
    rgb = base.map((v: number, i: number) =>
      clamp(v + (cube[i] / 255) * r * (1 + (o.reflectionColor[i] - 1) * r) + lit[3] * rim[i])
    );
  return [...rgb, lit[3]].map((v) => Math.round(v * 255));
}

const baseline = {
  source: [64, 96, 128, 128],
  lookup: [200, 160, 220, 150],
  tint: [0.2, 0.4, 0.6, 0.3],
  cube: [70, 110, 150, 255],
  normal: [0.8, 0, 0.6],
  reflection: [0.8, 0.1, 0.7],
  reflectionColor: [1, 0.4, 0.03],
  fresnel: [1, 0.43921568989753723, 0.03921568766236305, 0.15],
};

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/particle-mesh-reflection-preview.html');
  await page.waitForFunction(() => (window as any).__MESH_REFLECTION__?.ready);
  return errors;
}

async function check(page: Page, o: any, reference = o) {
  const actual = await page.evaluate(
      (options) => (window as any).__MESH_REFLECTION__.probe(options),
      o
    ),
    wanted = expected(reference);
  expect(actual.error).toBe(0);
  for (let i = 0; i < 4; i++)
    expect(
      Math.abs(actual.pixels[i] - wanted[i]),
      JSON.stringify({ o, actual, wanted })
    ).toBeLessThanOrEqual(1);
  return { actual: actual.pixels, expected: wanted };
}

test('ordinary reflection survives zero alpha while rim uses source, lookup and tint alpha', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const alpha of [0, 64, 255])
    for (const tintAlpha of [0, 0.2, 1])
      for (const lookupAlpha of [0, 100, 255])
        for (const normal of [
          [0, 0, 1],
          [0.8, 0, 0.6],
          [1, 0, 0],
        ]) {
          const o = {
            ...baseline,
            source: [64, 96, 128, alpha],
            tint: [0.2, 0.4, 0.6, tintAlpha],
            lookup: [200, 160, 220, lookupAlpha],
            normal,
          };
          results.push(await check(page, o));
        }
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('alpha-contract.json'),
    JSON.stringify({ errors, results }, null, 2)
  );
});

test('vertex reflection interpolates before cube lookup and uses upper world matrix normals', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
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
  ])
    results.push(await check(page, { ...baseline, normal, cubeFaces }));
  for (const scale of [
    [1, 1, 1],
    [2, 0.5, 1],
    [0.25, 3, 2],
  ])
    for (const reflection of [
      [0.15, 0, 0.9],
      [2, 0.4, 0.1],
    ])
      results.push(
        await check(page, {
          ...baseline,
          normals: [0, 0, 1, 1, 0, 0, 0.6, 0, 0.8],
          scale,
          reflection,
        })
      );
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('vertex-contract.json'),
    JSON.stringify({ errors, results }, null, 2)
  );
});

test('depth push moves along the camera-to-particle ray after reflection evaluation', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const depthPushPull of [-0.5, 0])
    results.push(await check(page, { ...baseline, depthPushPull, occluder: true }));
  const behind = await page.evaluate((o) => (window as any).__MESH_REFLECTION__.probe(o), {
    ...baseline,
    depthPushPull: 0.5,
    occluder: true,
  });
  expect(behind.pixels).toEqual([0, 255, 0, 255]);
  expect(behind.error).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('depth-push.json'),
    JSON.stringify({ errors, results, behind }, null, 2)
  );
});

test('remap preserves output alpha, source UV transform selects texels and context recovery is exact', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const remap of [
    [240, 20, 170, 0],
    [240, 20, 170, 1],
    [240, 20, 170, 255],
  ])
    results.push(await check(page, { ...baseline, remap }));
  for (const shift of [0, 0.5]) {
    const pixels = [
        [10, 30, 50, 70],
        [90, 110, 130, 150],
      ],
      o = {
        ...baseline,
        source: pixels.flat(),
        width: 2,
        transform: [1, 0, 0, 0, 1, 0, shift, 0, 1],
      };
    results.push(await check(page, o, { ...baseline, source: pixels[shift ? 1 : 0] }));
  }
  const recovery = await page.evaluate(async (o) => {
    const v = (window as any).__MESH_REFLECTION__,
      before = v.probe(o);
    await new Promise<void>((resolve) => {
      v.renderer.domElement.addEventListener(
        'webglcontextrestored',
        () => setTimeout(resolve, 50),
        { once: true }
      );
      v.renderer.forceContextLoss();
      setTimeout(() => v.renderer.forceContextRestore(), 250);
    });
    return { before, after: v.probe(o) };
  }, baseline);
  expect(recovery.after).toEqual(recovery.before);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('remap-uv-recovery.json'),
    JSON.stringify({ errors, results, recovery }, null, 2)
  );
});
