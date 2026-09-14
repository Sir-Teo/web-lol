import { expect, test } from '@playwright/test';

test('all five detonation layers render, seek exactly, and reuse owned GPU geometry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
  });
  await page.goto('/tools/qa/lux-illumination-trigger.html');
  await page.waitForFunction(() => (window as any).__ILLUMINATION_TRIGGER__?.ready);
  const result = await page.evaluate(async () => {
    const p = (window as any).__ILLUMINATION_TRIGGER__,
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
      p.draw(0.12);
      layers.push({
        name: mesh.name,
        hash: await capture(),
        vertices: mesh.geometry.drawRange.count,
      });
    }
    p.cloud.meshes.forEach((m: any) => {
      m.visible = true;
    });
    p.draw(0.12);
    const before = await capture(),
      allocations = [];
    for (const time of [0.3, 0.7, 1.7, 0.12, 1.1, 0.12]) {
      p.draw(time);
      allocations.push({ ...p.renderer.info.memory });
    }
    p.draw(0.12);
    const after = await capture();
    p.draw(1.7);
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
    'innerring',
    'outerring',
    'sparks',
    'motes',
    'rays',
  ]);
  for (const layer of result.layers) {
    expect(layer.hash).not.toBe(result.empty);
    expect(layer.vertices).toBeGreaterThan(0);
  }
  expect(result.after).toBe(result.before);
  expect(new Set(result.allocations.map((a) => a.geometries)).size).toBe(1);
  expect(new Set(result.allocations.map((a) => a.textures)).size).toBe(1);
  expect(result.expired).toEqual([0, 0, 0, 0, 0]);
  expect(result.remainingGeometry).toBe(0);
  expect(result.remainingTextures).toBe(result.borrowed);
  expect(errors).toEqual([]);
});

test('detonation preview renders palette changes and supports play, pause, and scrubbing', async ({
  page,
}) => {
  await page.goto('/tools/qa/lux-illumination-trigger.html');
  await page.waitForFunction(() => (window as any).__ILLUMINATION_TRIGGER__?.ready);
  const palette = await page.evaluate(() => {
    const p = (window as any).__ILLUMINATION_TRIGGER__;
    p.cloud.meshes.forEach((m: any) => {
      m.visible = m.name === 'sparks';
    });
    p.draw(0.12);
    const before = p.renderer.domElement.toDataURL();
    const material = p.cloud.meshes.find((m: any) => m.name === 'sparks').material;
    const row = material.uniforms.paletteRow.value;
    material.uniforms.paletteRow.value = 0.15;
    p.draw(0.12);
    const changed = p.renderer.domElement.toDataURL();
    material.uniforms.paletteRow.value = row;
    p.draw(0.12);
    const restored = p.renderer.domElement.toDataURL();
    p.cloud.meshes.forEach((m: any) => {
      m.visible = true;
    });
    p.draw(0.12);
    return { before, changed, restored };
  });
  expect(palette.changed).not.toBe(palette.before);
  expect(palette.restored).toBe(palette.before);
  await page.screenshot({ path: 'artifacts/browser-lux-illumination-trigger.png' });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('#age').inputValue())).not.toBe(0.12);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('#age').fill('1.7');
  await page.locator('#age').dispatchEvent('input');
  await expect(page.locator('#status')).toContainText('0 particles');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
