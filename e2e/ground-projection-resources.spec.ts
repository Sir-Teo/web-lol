import { expect, test } from '@playwright/test';
test('projection releases GPU index buffers when topology changes without changing vertex count', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    (window as any).__GAME__.setPaused(true);
    const T = await import('/node_modules/three/build/three.module.js'),
      { projectGroundQuad } = await import('/src/render/ground-quad.ts');
    const renderer = new T.WebGLRenderer(),
      gl = renderer.getContext(),
      live = new Set<WebGLBuffer>();
    const create = gl.createBuffer.bind(gl),
      remove = gl.deleteBuffer.bind(gl);
    gl.createBuffer = () => {
      const buffer = create();
      if (buffer) live.add(buffer);
      return buffer;
    };
    gl.deleteBuffer = (buffer) => {
      if (buffer) live.delete(buffer);
      remove(buffer);
    };
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);
    renderer.setSize(8, 8);
    const geometry = new T.BufferGeometry(),
      material = new T.MeshBasicMaterial({ side: T.DoubleSide }),
      mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    const counts = [],
      vertices = [];
    for (let i = 0; i < 12; i++) {
      const subdivisions: [number, number] = i % 2 ? [2, 5] : [5, 2];
      projectGroundQuad(
        geometry,
        {
          origin: { x: 0, y: 0 },
          target: { x: 1000, y: 0 },
          offset: [0, 0, 0],
          halfSize: [100, 100],
          rotation: [90, 0, 0],
        },
        () => 0,
        50,
        2,
        subdivisions
      );
      renderer.render(scene, camera);
      counts.push(live.size);
      vertices.push(geometry.getAttribute('position').count);
    }
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
    const remaining = live.size;
    renderer.dispose();
    gl.createBuffer = create;
    gl.deleteBuffer = remove;
    return { counts, vertices, remaining };
  });
  expect(new Set(result.vertices)).toEqual(new Set([18]));
  expect(new Set(result.counts).size).toBe(1);
  expect(result.remaining).toBe(0);
});
