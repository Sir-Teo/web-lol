import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a settled map redraws after input without continuously submitting terrain', async ({
  page,
}) => {
  await page.goto('/map.html');
  await page.locator('#status').waitFor({ state: 'hidden' });
  const frames = () =>
    page.evaluate(() => {
      const { renderer } = (
        window as typeof window & {
          __MAP__: { renderer: { info: { render: { frame: number } } } };
        }
      ).__MAP__;
      return new Promise<{ start: number; end: number }>((resolve) => {
        requestAnimationFrame(() => {
          const start = renderer.info.render.frame;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve({ start, end: renderer.info.render.frame }));
          });
        });
      });
    });
  let settled = await frames();
  expect(settled.end).toBe(settled.start);
  for (const [name, selector] of [
    ['Navigation', '#grid'],
    ['Mid lane', '[data-view="mid"]'],
  ]) {
    const button = page.getByRole('button', { name, exact: true });
    await button.click();
    await expect(page.locator(selector)).toHaveAttribute('aria-pressed', 'true');
    const changed = await frames();
    expect(changed.end).toBeGreaterThan(settled.end);
    expect(changed.end).toBe(changed.start);
    settled = changed;
  }
});

test('full map loads original compressed mips, preserves alpha, and overlays navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  // Exercise both hosting conventions in one load: Vite sends Content-Encoding
  // for the other DDS files, while this route returns untouched gzip bytes.
  await page.route('**/grasstint_srx.dds.gz', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: await readFile('public/assets/maps/textures/grasstint_srx.dds.gz'),
    })
  );
  await page.route('**/rift-geometry.bin.gz', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: await readFile('public/assets/maps/rift-geometry.bin.gz'),
    })
  );
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  const state = await page.evaluate(() => {
    const map = (window as any).__MAP__;
    const textures = new Map();
    map.map.children[0].traverse((object: any) => {
      for (const material of object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : []) {
        if (material.map) textures.set(material.map.uuid, material.map);
      }
    });
    return {
      encoding: map.map.children[0].userData.textureEncoding,
      count: textures.size,
      compressed: [...textures.values()].every((t) => t.isCompressedTexture),
      // Three's RGBA DXT1 constant; RGB DXT1 (33776) would lose cutout alpha.
      alpha: [...textures.values()].every((t) => t.format === 33777 || t.format === 33779),
      mips: [...textures.values()].every((t) => t.mipmaps.length > 1),
    };
  });
  expect(state).toEqual({
    encoding: 'original-dxt',
    count: 137,
    compressed: true,
    alpha: true,
    mips: true,
  });
  expect(requests.filter((url) => url.endsWith('/rift-geometry.bin'))).toHaveLength(0);
  expect(requests.filter((url) => url.endsWith('/rift-geometry.bin.gz'))).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith('.dds.gz'))).toHaveLength(138);
  expect(requests.filter((url) => url.endsWith('.webp'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Navigation' }).click();
  await expect(page.getByRole('button', { name: 'Navigation' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(await page.evaluate(() => (window as any).__MAP__.map.children[1].visible)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-map-navigation.png' });
  await page.getByRole('button', { name: 'Navigation' }).click();
  await page.getByRole('button', { name: 'Mid lane' }).click();
  await page.screenshot({ path: 'artifacts/browser-map-mid.png' });
  expect(errors).toEqual([]);
});

test('map retains a full-resolution WebP path for GPUs without S3TC', async ({ page }) => {
  await page.route('**/rift-geometry.bin.gz', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: await readFile('public/assets/maps/rift-geometry.bin'),
    })
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/map.html?textures=webp');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  expect(
    await page.evaluate(() => (window as any).__MAP__.map.children[0].userData.textureEncoding)
  ).toBe('lossless-webp');
  await page.getByRole('button', { name: 'Mid lane' }).click();
  await page.screenshot({ path: 'artifacts/browser-map-webp.png' });
  expect(errors).toEqual([]);
});
