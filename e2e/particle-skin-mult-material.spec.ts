import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
function expected(o: any) {
  const base = o.source.map((v: number, i: number) => (v / 255) * (o.multiplier[i] / 255)),
    tint = base.map((v: number, i: number) => v * o.tint[i]);
  if (o.alphaRef !== undefined && tint[3] < o.alphaRef) return [0.02, 0.04, 0.06, 0.25];
  const rgb = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v: number) => v / 255) : tint.slice(0, 3),
    rim = 1 - Math.pow(o.facing ?? 1, o.power ?? 1);
  return [
    ...rgb.map((v: number, i: number) => clamp(v + rim * (o.rim?.[i] ?? 0) * base[3])),
    tint[3],
  ];
}
async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/particle-skin-mult-preview.html');
  await page.waitForFunction(() => (window as any).__SKIN_MULT__?.ready);
  return errors;
}

test('skin MULT_PASS samples independent textures, carries rim by pre-tint product alpha and preserves remap alpha', async ({
  page,
}, info) => {
  const errors = await open(page),
    cases: any[] = [];
  for (const sourceAlpha of [0, 128, 255])
    for (const multAlpha of [0, 64, 255])
      for (const tintAlpha of [0, 0.3, 1])
        for (const facing of [0, 0.4, 1])
          cases.push({
            source: [100, 180, 220, sourceAlpha],
            multiplier: [200, 90, 160, multAlpha],
            tint: [0.3, 0.8, 2, tintAlpha],
            facing,
            power: 0.15,
            rim: [1, 0.7, 0.3],
          });
  for (const alpha of [0, 1, 255])
    cases.push({
      source: [128, 200, 255, 128],
      multiplier: [255, 128, 90, 180],
      tint: [0.4, 0.8, 0.2, 0.3],
      facing: 0.4,
      power: 0.15,
      rim: [1, 0.7, 0.3],
      remap: [240, 30, 170, alpha],
    });
  const results = await page.evaluate(
    (cases) => cases.map((o) => (window as any).__SKIN_MULT__.probe(o)),
    cases
  );
  for (const [i, r] of results.entries()) {
    expect(r.error).toBe(0);
    const wanted = expected(cases[i]).map((v) => Math.round(v * 255));
    for (let c = 0; c < 4; c++)
      expect(
        Math.abs(r.pixels[c] - wanted[c]),
        JSON.stringify({ o: cases[i], r, wanted })
      ).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('products.json'),
    JSON.stringify({ cases, results, errors }, null, 2)
  );
});

test('skin alpha reference keeps equality, tests pre-remap alpha and uses separate affine UV rows', async ({
  page,
}, info) => {
  const errors = await open(page),
    cases: any[] = [];
  for (const alphaRef of [undefined, 0.499, 0.5, 0.501])
    cases.push({
      source: [255, 255, 255, 255],
      multiplier: [255, 255, 255, 255],
      tint: [0.2, 0.4, 0.6, 0.5],
      alphaRef,
      remap: [200, 10, 100, 255],
    });
  const results = await page.evaluate(
    (cases) => cases.map((o) => (window as any).__SKIN_MULT__.probe(o)),
    cases
  );
  writeFileSync(
    info.outputPath('alpha-inputs.json'),
    JSON.stringify({ cases, results, errors }, null, 2)
  );
  for (const [i, r] of results.entries()) {
    expect(r.error).toBe(0);
    const wanted = expected(cases[i]).map((v) => Math.round(v * 255));
    for (let c = 0; c < 4; c++) expect(Math.abs(r.pixels[c] - wanted[c])).toBeLessThanOrEqual(1);
  }
  const uv = {
      source: [255, 0, 0, 255, 0, 255, 0, 128],
      sourceWidth: 2,
      multiplier: [0, 255, 255, 255, 255, 255, 0, 64],
      multWidth: 2,
      tint: [1, 1, 1, 1],
      uv: [0.25, 0.5],
    },
    uvCases = [
      { ...uv, multTransform: [1, 0, 0, 0, 1, 0, 0.5, 0, 1] },
      { ...uv, sourceTransform: [1, 0, 0, 0, 1, 0, 0.5, 0, 1] },
    ],
    uvResults = await page.evaluate(
      (cases) => cases.map((o) => (window as any).__SKIN_MULT__.probe(o)),
      uvCases
    );
  expect(uvResults.map((r) => r.pixels)).toEqual([
    [255, 0, 0, 64],
    [0, 255, 0, 128],
  ]);
  expect(uvResults.every((r) => r.error === 0)).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('alpha-uv.json'),
    JSON.stringify({ cases, results, uvCases, uvResults, errors }, null, 2)
  );
});

test('skin RGB saturates while float alpha stays raw and graphics recovery reproduces the probe', async ({
  page,
}, info) => {
  const errors = await open(page),
    options = {
      source: [255, 255, 255, 255],
      multiplier: [255, 255, 255, 255],
      tint: [2, 3, 4, 2],
      float: true,
    },
    before = await page.evaluate((o) => (window as any).__SKIN_MULT__.probe(o), options);
  expect(before.error).toBe(0);
  expect(before.pixels).toEqual([1, 1, 1, 2]);
  await page.evaluate(async () => {
    const r = (window as any).__SKIN_MULT__.renderer;
    await new Promise<void>((resolve) => {
      r.domElement.addEventListener('webglcontextrestored', () => setTimeout(resolve, 100), {
        once: true,
      });
      r.forceContextLoss();
      setTimeout(() => r.forceContextRestore(), 250);
    });
  });
  const recovered = await page.evaluate((o) => (window as any).__SKIN_MULT__.probe(o), options);
  expect(recovered).toEqual(before);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('float-recovery.json'),
    JSON.stringify({ options, before, recovered, errors }, null, 2)
  );
});
