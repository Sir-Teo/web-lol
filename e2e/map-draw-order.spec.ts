import { expect, test } from '@playwright/test';

for (const encoding of ['dxt', 'webp']) {
  test(`map pixels and draw order survive reordered ${encoding} texture responses`, async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const runs = [],
      errors: string[] = [];
    for (const delayed of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        page.on('pageerror', (error) => errors.push(error.message));
        if (delayed)
          await page.route(encoding === 'dxt' ? '**/*.dds.gz' : '**/*.webp', async (route) => {
            await new Promise((resolve) =>
              setTimeout(resolve, (route.request().url().length % 7) * 15)
            );
            await route.continue();
          });
        await page.goto(encoding === 'dxt' ? '/map.html' : '/map.html?textures=webp');
        await page.waitForFunction(() => (window as any).__MAP__?.ready);
        runs.push(
          await page.evaluate(async () => {
            const map = (window as any).__MAP__;
            map.renderer.setAnimationLoop(null);
            map.viewpoint('mid');
            const order: string[] = [],
              ids: number[] = [];
            map.map.children[0].traverse((object: any) => {
              if (!object.isMesh) return;
              const previous = object.onBeforeRender;
              object.onBeforeRender = function (...args: any[]) {
                order.push(`${object.name}:${args[4].name}`);
                ids.push(args[4].id);
                previous.apply(this, args);
              };
            });
            map.renderer.render(map.scene, map.camera);
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
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))]
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('');
            return {
              hash,
              order,
              ids,
              camera: map.camera.matrixWorld.toArray(),
              projection: map.camera.projectionMatrix.toArray(),
            };
          })
        );
        if (delayed)
          await page.screenshot({ path: `artifacts/browser-map-stable-${encoding}.png` });
      } finally {
        await page.close();
      }
    }
    expect(runs[1].camera).toEqual(runs[0].camera);
    expect(runs[1].projection).toEqual(runs[0].projection);
    expect(runs[1].order).toEqual(runs[0].order);
    expect(runs[1].hash).toBe(runs[0].hash);
    expect(runs[1].order.length).toBeGreaterThan(0);
    // The delayed source response schedule really perturbs material creation.
    expect(runs[1].ids).not.toEqual(runs[0].ids);
    expect(errors).toEqual([]);
    console.log(`${encoding} stable map framebuffer: ${runs[0].hash}`);
  });
}
