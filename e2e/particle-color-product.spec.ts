import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import samples from '../docs/reference/particle-color-samples.json' with { type: 'json' };
import garen from '../docs/reference/garen-spin.json' with { type: 'json' };

test('native initial color product matches source RGBA for uniform and vertex lookup UVs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/tools/qa/particle-color-preview.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_COLOR__?.ready);
  for (const [path, hash] of Object.entries(samples.files)) {
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(hash);
  }
  const cases = samples.samples;
  for (const quadMultiplier of [false, true]) {
    for (const coordinates of ['uniform', 'vertex']) {
      for (const sample of cases) {
        const result = await page.evaluate(
          async ({ sample, coordinates, quadMultiplier }) => {
            const source = sample.sourceRgba;
            const lookup = sample.lookupRgba;
            const multiplier = quadMultiplier ? sample.multiplierRgba : [255, 255, 255, 255];
            const color = [0.25, 0.6, 0.9, 0.35];
            const actual = await (window as any).__PARTICLE_COLOR__.probe({
              ...sample,
              coordinates,
              color,
              quadMultiplier,
            });
            const expected = source.map((value, i) =>
              Math.round((((value * lookup[i]) / 255) * color[i] * multiplier[i]) / 255)
            );
            return { actual, expected };
          },
          { sample, coordinates, quadMultiplier }
        );
        for (let i = 0; i < 4; i++)
          expect(
            Math.abs(result.actual[i] - result.expected[i]),
            `${coordinates} MULT=${quadMultiplier} ${sample.emitter} channel ${i}`
          ).toBeLessThanOrEqual(1);
      }
    }
  }
  await page.getByLabel('Emitter').selectOption('trail');
  await page.locator('#x').fill('0.55');
  await page.locator('#y').fill('0.53');
  await expect(page.locator('#status')).toContainText('trail · lookup (0.55, 0.53)');
  await page.screenshot({ path: 'artifacts/particle-trail-mult-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Garen glow lookup preserves raw RGBA, source UV scrolling and lifetime coordinates on the GPU', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/particle-color-preview.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_COLOR__?.ready);
  for (const coordinates of ['uniform', 'vertex'])
    for (const shifted of [false, true])
      for (const sample of garen.gpuSamples) {
        const result = await page.evaluate(
          async ({ sample, coordinates, shifted }) => {
            const color = [0.4, 0.7, 0.2, 0.35];
            const actual = await (window as any).__PARTICLE_COLOR__.probe({
              emitter: 'garenGlow',
              coordinates,
              color,
              sourcePixel: sample.sourcePixel,
              lookupPixel: sample.lookupPixel,
              sourceOffset: shifted
                ? sample.shiftedSourcePixel.map((n, i) => (n - sample.sourcePixel[i]) / 256)
                : [0, 0],
            });
            const source = shifted ? sample.shiftedSourceRgba : sample.sourceRgba;
            const expected = source.map((v, i) =>
              Math.round(((v * sample.lookupRgba[i]) / 255) * color[i])
            );
            return { actual, expected };
          },
          { sample, coordinates, shifted }
        );
        for (let i = 0; i < 4; i++)
          expect(
            Math.abs(result.actual[i] - result.expected[i]),
            `${coordinates} shifted=${shifted} pixel=${sample.lookupPixel} channel=${i}`
          ).toBeLessThanOrEqual(1);
      }
  await page.getByLabel('Emitter').selectOption('garenGlow');
  await page.locator('#use-life').check();
  await page.locator('#age').fill('0.5');
  await expect(page.locator('#status')).toContainText('garenGlow · lookup (0.5, 1)');
  await page.screenshot({ path: 'artifacts/garen-glow-lookup.png', fullPage: true });
  expect(errors).toEqual([]);
});
