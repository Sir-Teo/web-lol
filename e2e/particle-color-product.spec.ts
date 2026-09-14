import { expect, test } from '@playwright/test';

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
  const cases = [
    {
      emitter: 'crescent',
      source: 'ring04',
      lookup: 'color-rampdown',
      sourcePixel: [132, 187],
      lookupPixel: [1, 0],
    },
    {
      emitter: 'crescent',
      source: 'ring04',
      lookup: 'color-rampdown',
      sourcePixel: [132, 187],
      lookupPixel: [32, 2],
    },
    {
      emitter: 'crescent',
      source: 'ring04',
      lookup: 'color-rampdown',
      sourcePixel: [128, 128],
      lookupPixel: [63, 3],
    },
    {
      emitter: 'hoop',
      source: 'lux_base_r_mote',
      lookup: 'color-spectralbell',
      sourcePixel: [61, 61],
      lookupPixel: [35, 34],
    },
    {
      emitter: 'hoop',
      source: 'lux_base_r_mote',
      lookup: 'color-spectralbell',
      sourcePixel: [80, 42],
      lookupPixel: [12, 49],
    },
    {
      emitter: 'hoop',
      source: 'lux_base_r_mote',
      lookup: 'color-spectralbell',
      sourcePixel: [64, 64],
      lookupPixel: [63, 0],
    },
  ];
  for (const coordinates of ['uniform', 'vertex']) {
    for (const sample of cases) {
      const result = await page.evaluate(
        async ({ sample, coordinates }) => {
          async function pixel(name: string, point: number[]) {
            const image = new Image();
            image.src = `/assets/effects/lux-ba-${name}.png`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            return Array.from(context.getImageData(point[0], point[1], 1, 1).data);
          }
          const source = await pixel(sample.source, sample.sourcePixel);
          const lookup = await pixel(sample.lookup, sample.lookupPixel);
          const color = [0.25, 0.6, 0.9, 0.35];
          const actual = await (window as any).__PARTICLE_COLOR__.probe({
            ...sample,
            coordinates,
            color,
          });
          const expected = source.map((value, i) =>
            Math.round(((value * lookup[i]) / 255) * color[i])
          );
          return { actual, expected };
        },
        { sample, coordinates }
      );
      for (let i = 0; i < 4; i++)
        expect(
          Math.abs(result.actual[i] - result.expected[i]),
          `${coordinates} ${sample.emitter} channel ${i}`
        ).toBeLessThanOrEqual(1);
    }
  }
  await page.getByLabel('Emitter').selectOption('hoop');
  await page.locator('#x').fill('0.55');
  await page.locator('#y').fill('0.53');
  await expect(page.locator('#status')).toContainText('hoop · lookup (0.55, 0.53)');
  await page.screenshot({ path: 'artifacts/particle-color-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});
