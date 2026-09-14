import { expect, test } from '@playwright/test';

test('all four mark layers render, seek exactly, and reuse owned GPU geometry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
  });
  await page.goto('/tools/qa/lux-illumination.html');
  await page.waitForFunction(() => (window as any).__ILLUMINATION__?.ready);
  const result = await page.evaluate(async () => {
    const p = (window as any).__ILLUMINATION__,
      gl = p.renderer.getContext();
    const capture = async () => {
      const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bytes
      );
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].join(',');
    };
    p.cloud.root.visible = false;
    p.renderer.render(p.scene, p.camera);
    const empty = await capture();
    p.cloud.root.visible = true;
    const layers = [];
    for (const mesh of p.cloud.meshes) {
      p.cloud.meshes.forEach((m: any) => {
        m.visible = m === mesh;
      });
      p.draw(0.22);
      layers.push({
        name: mesh.name,
        hash: await capture(),
        vertices: mesh.geometry.drawRange.count,
      });
    }
    p.cloud.meshes.forEach((m: any) => {
      m.visible = true;
    });
    p.draw(0.22);
    const before = await capture(),
      allocations = [];
    for (const time of [3.5, 6.5, 7.2, 0.22, 4.1, 0.22]) {
      p.draw(time);
      allocations.push({ ...p.renderer.info.memory });
    }
    p.draw(0.22);
    const after = await capture();
    p.draw(7.2);
    const expired = p.cloud.meshes.map((m: any) => m.geometry.drawRange.count);
    const borrowed = p.renderer.info.memory.textures;
    p.cloud.dispose();
    p.renderer.render(p.scene, p.camera);
    return {
      empty,
      layers,
      before,
      after,
      allocations,
      expired,
      borrowed,
      remainingGeometry: p.renderer.info.memory.geometries,
      remainingTextures: p.renderer.info.memory.textures,
    };
  });
  expect(result.layers.map((p) => p.name)).toEqual([
    'luxdebuff1',
    'luxdebuff2',
    'rays',
    'smallball',
  ]);
  for (const layer of result.layers) {
    expect(layer.hash).not.toBe(result.empty);
    expect(layer.vertices).toBeGreaterThan(0);
  }
  expect(result.after).toBe(result.before);
  expect(new Set(result.allocations.map((a) => a.geometries)).size).toBe(1);
  expect(new Set(result.allocations.map((a) => a.textures)).size).toBe(1);
  expect(result.expired).toEqual([0, 0, 0, 0]);
  expect(result.remainingGeometry).toBe(0);
  expect(result.remainingTextures).toBe(result.borrowed);
  expect(errors).toEqual([]);
});

test('preview exposes source keyword exclusion and a complete mark capture', async ({ page }) => {
  await page.goto('/tools/qa/lux-illumination.html');
  await page.waitForFunction(() => (window as any).__ILLUMINATION__?.ready);
  await page.getByLabel('Steel Legion keyword').check();
  expect(
    await page.evaluate(
      () => (window as any).__ILLUMINATION__.cloud.meshes[3].geometry.drawRange.count
    )
  ).toBe(0);
  await page.getByLabel('Steel Legion keyword').uncheck();
  expect(
    await page.evaluate(
      () => (window as any).__ILLUMINATION__.cloud.meshes[3].geometry.drawRange.count
    )
  ).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/browser-lux-illumination.png' });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
