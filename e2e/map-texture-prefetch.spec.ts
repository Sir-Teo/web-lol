import { expect, test } from '@playwright/test';

test('near-view preparation reduces visible texture uploads during a full-resolution map pan', async ({
  page,
}) => {
  test.setTimeout(45000);
  const runs = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const enabled of [false, true]) {
    await page.goto('/map.html');
    await page.waitForFunction(() => (window as any).__MAP__?.ready);
    runs.push(
      await page.evaluate(async (enabled) => {
        const map = (window as any).__MAP__,
          renderer = map.renderer;
        renderer.setAnimationLoop(null);
        const { textureResidency: residency, texturePrefetch: prefetch } =
          map.map.children[0].userData;
        const gl = renderer.getContext();
        let bytes = 0;
        const originals = [gl.compressedTexImage2D.bind(gl), gl.compressedTexSubImage2D.bind(gl)];
        gl.compressedTexImage2D = (...args: any[]) => {
          bytes += args[6].byteLength;
          return originals[0](...args);
        };
        gl.compressedTexSubImage2D = (...args: any[]) => {
          bytes += args[7].byteLength;
          return originals[1](...args);
        };
        const draw = () => {
          residency.beginFrame();
          renderer.render(map.scene, map.camera);
          residency.endFrame();
        };
        const next = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const pixelHash = async () => {
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(
            0,
            0,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
          );
          return [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(',');
        };
        try {
          map.viewpoint('mid');
          draw();
          const referenceHash = await pixelHash();
          map.viewpoint('blue');
          for (let i = 0; i < 30; i++) {
            await next();
            draw();
            if (enabled) prefetch.update(renderer, map.camera);
          }
          const start = map.camera.position.clone();
          map.viewpoint('mid');
          const end = map.camera.position.clone();
          let visibleUploads = 0,
            preparedUploads = 0,
            maxResident = 0;
          for (let i = 1; i <= 200; i++) {
            await next();
            map.camera.position.lerpVectors(start, end, i / 200);
            // Both view presets have identical camera orientation and distance.
            map.camera.updateMatrixWorld();
            let before = bytes;
            draw();
            visibleUploads += bytes - before;
            before = bytes;
            if (enabled) prefetch.update(renderer, map.camera);
            preparedUploads += bytes - before;
            maxResident = Math.max(maxResident, residency.residentBytes);
          }
          draw();
          const hash = await pixelHash();
          return {
            enabled,
            visibleUploads,
            preparedUploads,
            maxResident,
            budget: residency.budgetBytes,
            hash,
            referenceHash,
          };
        } finally {
          gl.compressedTexImage2D = originals[0];
          gl.compressedTexSubImage2D = originals[1];
        }
      }, enabled)
    );
  }
  console.log('Map pan prefetch:', JSON.stringify(runs));
  expect(runs[0].visibleUploads).toBeGreaterThan(0);
  expect(runs[1].preparedUploads).toBeGreaterThan(0);
  expect(runs[1].visibleUploads).toBeLessThan(runs[0].visibleUploads);
  expect(runs[1].maxResident).toBeLessThanOrEqual(runs[1].budget);
  for (const run of runs) expect(run.hash).toBe(run.referenceHash);
  expect(errors).toEqual([]);
});
