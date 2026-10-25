import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import descriptions from '../docs/reference/leona-w-skin-materials.json' with { type: 'json' };
import samples from '../docs/reference/leona-w-skin-samples.json' with { type: 'json' };
async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/leona-eclipse-skin-preview.html');
  await page.waitForFunction(() => (window as any).__ECLIPSE_SKIN__?.ready);
  const columns = await page.evaluate(() => {
    const pixels = (window as any).__ECLIPSE_SKIN__.frame(),
      visible = [0, 0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 30 || pixels[i + 1] > 30 || pixels[i + 2] > 40)
        visible[Math.floor(((i / 4) % 1280) / 320)]++;
    return visible;
  });
  expect(
    columns.every((n) => n > 100),
    JSON.stringify(columns)
  ).toBe(true);
  return errors;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function expected(o: any) {
  const t = o.source.map((v: number) => v / 255),
    lit = t.map((v: number, i: number) => v * o.tint[i]);
  const rgb = o.remap?.[3] > 0 ? o.remap.slice(0, 3).map((v: number) => v / 255) : lit.slice(0, 3);
  const out = rgb.map((v: number, i: number) =>
    clamp(v + (1 - Math.pow(o.facing, o.power)) * o.rim[i] * t[3])
  );
  let alpha = lit[3];
  if (o.erosion) {
    const e = o.erosion,
      value = clamp(
        e.texel.reduce((s: number, v: number, i: number) => s + (v / 255) * e.mixer[i], 0)
      );
    alpha *= clamp((e.drive - value + e.slice) / e.in) - clamp((e.drive - value) / e.out);
  }
  return [...out, alpha].map((v) => Math.round(v * 255));
}
async function check(page: Page, o: any) {
  const actual = await page.evaluate(
    (options) => (window as any).__ECLIPSE_SKIN__.probe(options),
    o
  );
  expect(actual.error).toBe(0);
  const wanted = expected(o);
  for (let i = 0; i < 4; i++)
    expect(
      Math.abs(actual.pixels[i] - wanted[i]),
      JSON.stringify({ o, actual, wanted })
    ).toBeLessThanOrEqual(1);
  return { actual: actual.pixels, expected: wanted };
}
test('skin rim uses pre-tint alpha, saturates RGB and remaps without replacing alpha', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const facing of [0, 0.4, 1])
    for (const alpha of [0, 64, 255])
      for (const tintAlpha of [0, 0.2, 1])
        for (const power of [0.05, 0.15, 0.3449999988079071, 0.8350000381469727]) {
          const o = {
            source: [100, 180, 220, alpha],
            tint: [0, 0, 0, tintAlpha],
            facing,
            power,
            rim: [1, 0.741176486, 0.376470596],
          };
          results.push(await check(page, o));
        }
  for (const remap of [
    [240, 20, 170, 0],
    [240, 20, 170, 1],
    [240, 20, 170, 255],
  ])
    results.push(
      await check(page, {
        source: [180, 190, 200, 128],
        tint: [0.2, 0.4, 0.6, 0.3],
        facing: 0.3,
        power: 0.15,
        rim: [1, 0.7, 0.3],
        remap,
      })
    );
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('rim-remap.json'), JSON.stringify({ errors, results }, null, 2));
});
test('erosion affects alpha only, uses clamped channel mixing and follows transformed base UVs', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const drive of [-1, 0, 0.4, 0.8, 1, 1.5])
    for (const mixer of [
      [0, 0, 0, 1],
      [0.5, 1, 0.25, 0.1],
      [2, 2, 2, 2],
    ])
      results.push(
        await check(page, {
          source: [70, 100, 150, 200],
          tint: [0.4, 0.3, 0.1, 0.6],
          facing: 0.4,
          power: 0.15,
          rim: [1, 0.7, 0.3],
          erosion: { texel: [70, 100, 150, 200], drive, mixer, in: 0.35, out: 0.25, slice: 1.5 },
        })
      );
  for (const shift of [0, 0.5]) {
    const base = [
        [200, 20, 40, 100],
        [30, 140, 170, 200],
      ],
      erosion = [
        [50, 70, 90, 120],
        [160, 180, 200, 240],
      ];
    const i = shift ? 1 : 0;
    const o = {
      source: base[i],
      tint: [0.4, 0.2, 0.7, 0.6],
      facing: 0.4,
      power: 0.15,
      rim: [1, 0.7, 0.3],
      erosion: {
        texel: erosion[i],
        drive: 0.7,
        mixer: [0, 0, 0, 1],
        in: 0.35,
        out: 0.35,
        slice: 1.5,
      },
    };
    const actual = await page.evaluate((o) => (window as any).__ECLIPSE_SKIN__.probe(o), {
      ...o,
      source: base.flat(),
      width: 2,
      erosion: { ...o.erosion, texel: erosion.flat() },
      uv: [0.25, 0.5],
      transform: [1, 0, 0, 0, 1, 0, shift, 0, 1],
    });
    const wanted = expected(o);
    for (let c = 0; c < 4; c++)
      expect(Math.abs(actual.pixels[c] - wanted[c])).toBeLessThanOrEqual(1);
    expect(actual.error).toBe(0);
    results.push({ actual: actual.pixels, expected: wanted });
  }
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('erosion-uv.json'), JSON.stringify({ errors, results }, null, 2));
});
test('all four actual source skin materials match pinned mask texels on the GPU', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const p of descriptions.profiles)
    for (const s of samples.samples)
      for (const phase of [0.1, 0.5, 0.9]) {
        const o = {
          source: s.source,
          sourcePath: p.texture,
          tint: p.birthColor,
          facing: 0.4,
          power: p.fresnelPower,
          rim: p.fresnelColor,
          uv: s.uv,
          ...(p.erosion
            ? {
                erosionPath: p.erosion.texture,
                erosion: {
                  texel: s.erosion,
                  drive: phase,
                  mixer: p.erosion.mixer,
                  in: p.erosion.featherIn,
                  out: p.erosion.featherOut,
                  slice: p.erosion.sliceWidth,
                },
              }
            : {}),
        };
        results.push(await check(page, o));
      }
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('source-skin.png') });
  writeFileSync(
    info.outputPath('source-texels.json'),
    JSON.stringify({ errors, results }, null, 2)
  );
});
test('animated skin stays within its CPU reference budget and recovers exact pixels', async ({
  page,
}, info) => {
  const errors = await open(page),
    results = [];
  for (const [clip, time] of [
    ['spell2_idle', 0.4],
    ['spell2_run', 0.22],
    ['spell2_attack', 0.35],
  ] as const) {
    const result = await page.evaluate(
      ({ clip, time }) => {
        const v = (window as any).__ECLIPSE_SKIN__;
        v.pose(clip, time, 0.45, false);
        const a = v.frame();
        v.pose(clip, time, 0.45, true);
        const b = v.frame();
        let max = 0,
          changed = 0,
          significant = 0,
          visible = 0;
        const differences = [];
        for (let i = 0; i < a.length; i += 4) {
          let delta = 0;
          for (let j = 0; j < 3; j++) delta = Math.max(delta, Math.abs(a[i + j] - b[i + j]));
          max = Math.max(max, delta);
          if (delta) changed++;
          if (delta > 1) {
            significant++;
            if (differences.length < 50)
              differences.push({
                x: (i / 4) % 1280,
                y: Math.floor(i / 4 / 1280),
                before: [...a.slice(i, i + 4)],
                after: [...b.slice(i, i + 4)],
              });
          }
          if (a[i] > 30 || a[i + 1] > 30 || a[i + 2] > 40) visible++;
        }
        v.pose(clip, time, 0.45, false);
        return { clip, time, max, changed, significant, visible, differences };
      },
      { clip, time }
    );
    expect(result.visible).toBeGreaterThan(100);
    results.push(result);
  }
  const recovery = await page.evaluate(async () => {
    const v = (window as any).__ECLIPSE_SKIN__,
      before = v.frame();
    const compare = (a: Uint8Array, b: Uint8Array) => {
      let changed = 0,
        max = 0;
      const differences = [];
      for (let i = 0; i < a.length; i += 4) {
        let d = 0;
        for (let j = 0; j < 4; j++) d = Math.max(d, Math.abs(a[i + j] - b[i + j]));
        if (d) {
          changed++;
          max = Math.max(max, d);
          if (differences.length < 50)
            differences.push({
              x: (i / 4) % 1280,
              y: Math.floor(i / 4 / 1280),
              before: [...a.slice(i, i + 4)],
              after: [...b.slice(i, i + 4)],
            });
        }
      }
      return { changed, max, differences };
    };
    v.pose('spell2_attack', 0.35, 0.45, false);
    const repeated = compare(before, v.frame());
    await new Promise<void>((resolve) => {
      v.renderer.domElement.addEventListener(
        'webglcontextrestored',
        () => setTimeout(resolve, 50),
        { once: true }
      );
      v.renderer.forceContextLoss();
      setTimeout(() => v.renderer.forceContextRestore(), 250);
    });
    v.pose('spell2_attack', 0.35, 0.45, false);
    const after = v.frame();
    return {
      same: before.every((n: number, i: number) => n === after[i]),
      error: v.renderer.getContext().getError(),
      repeated,
      difference: compare(before, after),
    };
  });
  await page.screenshot({ path: info.outputPath('animated-skin.png') });
  writeFileSync(
    info.outputPath('animated-recovery.json'),
    JSON.stringify({ errors, results, recovery }, null, 2)
  );
  expect(recovery.same, JSON.stringify(recovery)).toBe(true);
  expect(recovery.error).toBe(0);
  expect(errors).toEqual([]);
  // CPU evaluates skin matrices in doubles; WebGL evaluates them in float32.
  // Bound sparse image differences at the mapped source exponents explicitly;
  // this does not claim native-frame parity.
  for (const result of results) {
    expect(result.max, JSON.stringify(result)).toBeLessThanOrEqual(8);
    expect(result.significant / result.visible, JSON.stringify(result)).toBeLessThanOrEqual(0.0001);
  }
});
