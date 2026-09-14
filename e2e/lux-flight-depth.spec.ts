import { expect, test } from '@playwright/test';
import audit from '../docs/reference/lux-flight-depth.json' with { type: 'json' };

test('Lux flight preserves distinct hoop and ribbon/crescent depth behavior', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { LuxHoopCloud } = await import('/src/render/lux-hoop-cloud.ts');
    const { LuxCrescentMesh } = await import('/src/render/lux-attack-crescents.ts');
    const { createLuxTrailMaterial } = await import('/src/render/lux-attack-trails.ts');
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(2, 2);
    plane.setAttribute('particleLookupUv', new THREE.BufferAttribute(new Float32Array(8), 2));
    plane.setAttribute('particleTint', new THREE.BufferAttribute(new Float32Array(16).fill(1), 4));
    const hoop = new LuxHoopCloud(white, white);
    const crescent = new LuxCrescentMesh(plane, white, white);
    const trail = createLuxTrailMaterial(white, white);
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);
    renderer.setClearColor(0, 1);
    const target = new THREE.WebGLRenderTarget(1, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0 });
    const wall = new THREE.Mesh(plane, wallMaterial);
    wall.position.z = 1;
    scene.add(wall);
    const results = [];
    for (const [name, material] of [
      ['hoop', hoop.mesh.material],
      ['crescentwhite', crescent.mesh.material],
      ['Trail', trail],
    ] as const) {
      const depthTest = material.depthTest;
      material.uniforms.particleColor.value.set(1, 0, 1, 1);
      const mesh = new THREE.Mesh(plane, material);
      scene.add(mesh);
      const read = (depth: boolean) => {
        material.depthTest = depth;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        return [...pixel];
      };
      results.push({
        name,
        depthTest,
        depthWrite: material.depthWrite,
        authored: read(depthTest),
        inverse: read(!depthTest),
      });
      scene.remove(mesh);
    }
    renderer.setRenderTarget(null);
    hoop.dispose();
    crescent.dispose();
    trail.dispose();
    plane.dispose();
    white.dispose();
    wallMaterial.dispose();
    target.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(3);
  for (const result of results) {
    const expected = audit.emitters.find((e) => e.name === result.name)!;
    expect(result.depthTest).toBe(expected.depthTest);
    expect(result.depthWrite).toBe(false);
    expect(result.authored).toEqual(expected.depthTest ? [0, 0, 0, 255] : [255, 0, 255, 255]);
    expect(result.inverse).toEqual(expected.depthTest ? [255, 0, 255, 255] : [0, 0, 0, 255]);
  }
});
