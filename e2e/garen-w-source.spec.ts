import { expect, test } from '@playwright/test';
import audit from '../docs/reference/garen-w-particles-decoded.json' with { type: 'json' };
import r from '../docs/reference/garen-r-particles-decoded.json' with { type: 'json' };
import kill from '../docs/reference/garen-r-kill-particles.json' with { type: 'json' };
import spin from '../docs/reference/garen-spin.json' with { type: 'json' };
import profiles from '../src/content/garen-w-particles.json' with { type: 'json' };
import playback from '../docs/reference/garen-w-particle-profiles.json' with { type: 'json' };

test('Courage inspection loads all frozen textures, both mesh versions and all seven source systems', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/garen-w-source-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_W_SOURCE__?.ready);
  await expect(page.locator('#textures img')).toHaveCount(18);
  expect(
    await page
      .locator('#textures img')
      .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0))
  ).toBe(true);
  await expect(page.getByLabel('System').locator('option')).toHaveCount(7);
  for (const [name, suffix, version, triangles] of [
    ['Shield', 'shield', [3, 2], 1264],
    ['Attached-mesh reference', 'attached-placeholder', [2, 2], 124],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const state = await page.evaluate(() => (window as any).__GAREN_W_SOURCE__);
    expect(state.selected).toBe(suffix);
    expect(state.triangles).toBe(triangles);
    expect(state.sourceVersion).toEqual(version);
    expect(state.bounds.every(Number.isFinite)).toBe(true);
    expect(Math.max(...state.bounds)).toBeGreaterThan(0.1);
  }
  await page.getByLabel('Wireframe').check();
  expect(await page.evaluate(() => (window as any).__GAREN_W_SOURCE__.wireframe)).toBe(true);
  await page.getByLabel('Wireframe').uncheck();
  for (const [key, system] of Object.entries(audit.systems)) {
    await page.getByLabel('System').selectOption(key);
    await expect(page.locator('#emitters tr')).toHaveCount(system.emitterCount);
    expect(await page.evaluate(() => (window as any).__GAREN_W_SOURCE__.system)).toBe(key);
  }
  await page.getByLabel('System').selectOption('Garen_W_Avatar_Fade');
  await expect(page.locator('#emitters')).toContainText('Character material override');
  await expect(page.locator('#emitters')).toContainText('VfxPrimitiveAttachedMesh');
  await page.getByLabel('System').selectOption('Garen_W_Cas');
  await page.getByRole('button', { name: 'Shield', exact: true }).click();
  await page.screenshot({ path: 'artifacts/garen-w-source-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Courage graphics load only their selected mesh/texture subset on Garen presence', async ({
  page,
}) => {
  const shared = new Set(
    [...r.textures, ...kill.textures, ...spin.textures].map((t) => t.path.replace(/^public/, ''))
  );
  const newTextures = audit.textures
    .map((t) => t.path.replace(/^public/, ''))
    .filter((path) => !shared.has(path));
  expect(newTextures).toHaveLength(13);
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/assets/models/garen-w-') || newTextures.includes(path)) requests.push(path);
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const selected = new Set(
    profiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]).map((p) => '/' + p)
  );
  expect(requests.sort()).toEqual(
    ['/assets/models/garen-w-shield.glb', ...newTextures.filter((p) => selected.has(p))].sort()
  );
  expect(requests).toHaveLength(6);
});

test('Courage live materials reproduce independent PNG texel products in every RGBA channel', async ({
  page,
}) => {
  await page.goto('/tools/qa/garen-w-source-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_W_SOURCE__?.ready);
  for (const sample of playback.gpuSamples) {
    const actual = await page.evaluate(
      async (sample) => (window as any).__GAREN_W_MATERIAL__.probe(sample),
      sample
    );
    const expected = sample.sourceRgba.map((v, i) =>
      Math.round((v * sample.tint[i] * sample.lookupRgba[i]) / 255)
    );
    for (let i = 0; i < 4; i++) expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(1);
  }
});
