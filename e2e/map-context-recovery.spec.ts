import { expect, test } from '@playwright/test';

test('context restoration clears stale residency and restores exact map pixels', async ({
  page,
}) => {
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  const before = await page.evaluate(async () => {
    const map = (window as any).__MAP__;
    map.renderer.setAnimationLoop(null);
    map.viewpoint('blue');
    const residency = map.map.children[0].userData.textureResidency;
    residency.beginFrame();
    map.renderer.render(map.scene, map.camera);
    residency.endFrame();
    const gl = map.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(',');
    const lost = new Promise((resolve) =>
      map.renderer.domElement.addEventListener('webglcontextlost', resolve, { once: true })
    );
    const bytes = residency.residentBytes;
    map.renderer.forceContextLoss();
    await lost;
    return { hash, bytes };
  });
  const after = await page.evaluate(async () => {
    const map = (window as any).__MAP__,
      residency = map.map.children[0].userData.textureResidency;
    const restored = new Promise((resolve) =>
      map.renderer.domElement.addEventListener('webglcontextrestored', resolve, { once: true })
    );
    map.renderer.forceContextRestore();
    await restored;
    const empty = residency.residentBytes;
    residency.beginFrame();
    map.renderer.render(map.scene, map.camera);
    residency.endFrame();
    const gl = map.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(',');
    return { empty, bytes: residency.residentBytes, visible: residency.currentFrameBytes, hash };
  });
  expect(before.bytes).toBeGreaterThan(after.visible);
  expect(after.empty).toBe(0);
  expect(after.bytes).toBe(after.visible);
  expect(after.visible).toBeGreaterThan(0);
  expect(after.hash).toBe(before.hash);
});
