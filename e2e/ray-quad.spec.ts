import { expect, test } from '@playwright/test';

test('ray maintains full extents and camera-facing width in actual GPU output', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    (window as any).__GAME__.setPaused(true);
    const T = await import('/node_modules/three/build/three.module.js');
    const { writeRayQuad } = await import('/src/render/ray-quad.ts');
    const renderer = new T.WebGLRenderer();
    renderer.setSize(12, 12);
    const camera = new T.OrthographicCamera(-3, 3, 3, -3, 0.1, 100),
      scene = new T.Scene();
    scene.background = new T.Color(0);
    const position = new T.BufferAttribute(new Float32Array(18), 3),
      uv = new T.BufferAttribute(new Float32Array(12), 2);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', position);
    geometry.setAttribute('uv', uv);
    const material = new T.MeshBasicMaterial({
      color: 0xffffff,
      side: T.DoubleSide,
      toneMapped: false,
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const frames: number[][] = [],
      allocations: number[] = [];
    for (const eye of [new T.Vector3(0, 0, 10), new T.Vector3(10, 0, 0)]) {
      camera.position.copy(eye);
      camera.lookAt(0, 0, 0);
      writeRayQuad(
        position,
        uv,
        0,
        {
          center: new T.Vector3(0, -2, 0),
          axis: new T.Vector3(0, 1, 0),
          fallbackAcross: new T.Vector3(-1, 0, 0),
          size: [2, 4, 0],
        },
        eye
      );
      position.needsUpdate = uv.needsUpdate = true;
      renderer.render(scene, camera);
      const gl = renderer.getContext(),
        pixels = new Uint8Array(12 * 12 * 4);
      gl.readPixels(0, 0, 12, 12, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      frames.push(Array.from({ length: 144 }, (_, i) => pixels[i * 4]));
      allocations.push(renderer.info.memory.geometries);
    }
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    return { frames, allocations };
  });
  const expected = Array.from({ length: 144 }, (_, i) => {
    const x = i % 12,
      y = Math.floor(i / 12);
    return x >= 4 && x < 8 && y >= 2 && y < 10 ? 255 : 0;
  });
  for (const frame of result.frames) expect(frame).toEqual(expected);
  expect(result.allocations).toEqual([1, 1]);
});
