import { expect, test } from '@playwright/test';

test('evicted texture uploads again with identical pixels and bounded GPU allocations', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    (window as any).__GAME__.setPaused(true);
    const T = await import('/node_modules/three/build/three.module.js');
    const { MapTextureResidency } = await import('/src/render/map-texture-residency.ts');
    const renderer = new T.WebGLRenderer();
    renderer.setSize(1, 1);
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    camera.position.z = 1;
    const data = [new Uint8Array([42, 118, 207, 255]), new Uint8Array([218, 65, 12, 255])];
    const textures = data.map((bytes) => {
      const texture = new T.DataTexture(bytes, 1, 1);
      texture.needsUpdate = true;
      return texture;
    });
    const material = new T.MeshBasicMaterial({ map: textures[0], toneMapped: false });
    const geometry = new T.PlaneGeometry(2, 2);
    scene.add(new T.Mesh(geometry, material));
    const residency = new MapTextureResidency(4),
      pixels: number[][] = [],
      counts: number[] = [];
    for (let i = 0; i < 8; i++) {
      material.map = textures[i % 2];
      residency.beginFrame();
      residency.touch(material.map, 4);
      renderer.render(scene, camera);
      residency.endFrame();
      const pixel = new Uint8Array(4),
        gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      pixels.push([...pixel]);
      counts.push(renderer.info.memory.textures);
    }
    const evictions = residency.evictions;
    textures.forEach((texture) => texture.dispose());
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    return { pixels, counts, evictions, data: data.map((bytes) => [...bytes]) };
  });
  expect(result.pixels[0]).not.toEqual(result.pixels[1]);
  for (let i = 2; i < result.pixels.length; i++)
    expect(result.pixels[i]).toEqual(result.pixels[i % 2]);
  expect(result.counts).toEqual(Array(8).fill(1));
  expect(result.evictions).toBe(7);
  expect(result.data).toEqual([
    [42, 118, 207, 255],
    [218, 65, 12, 255],
  ]);
});

test('source map releases offscreen textures and restores the overview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  const metrics = [];
  for (const view of ['overview', 'blue', 'mid', 'river', 'red', 'overview']) {
    metrics.push(
      await page.evaluate(async (view) => {
        const map = (window as any).__MAP__;
        map.viewpoint(view);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const residency = map.map.children[0].userData.textureResidency;
        let pixelHash: string | undefined;
        if (view === 'overview') {
          residency.beginFrame();
          map.renderer.render(map.scene, map.camera);
          residency.endFrame();
          const gl = map.renderer.getContext();
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
          pixelHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        }
        return {
          view,
          bytes: residency.residentBytes,
          current: residency.currentFrameBytes,
          budget: residency.budgetBytes,
          evictions: residency.evictions,
          pixelHash,
        };
      }, view)
    );
  }
  console.log('Map texture residency:', JSON.stringify(metrics));
  for (const metric of metrics) {
    expect(metric.bytes).toBeGreaterThan(0);
    expect(metric.bytes).toBeLessThanOrEqual(Math.max(metric.budget, metric.current));
  }
  expect(metrics.at(-1)!.evictions).toBeGreaterThan(0);
  expect(metrics.at(-1)!.current).toBe(metrics[0].current);
  expect(metrics.at(-1)!.pixelHash).toBe(metrics[0].pixelHash);
  await page.screenshot({ path: 'artifacts/browser-map-residency-restored.png' });
  expect(errors).toEqual([]);
});
