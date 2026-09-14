import { expect, test } from '@playwright/test';
import pin from '../docs/reference/lux-beam-layers.json' with { type: 'json' };

test('all six source beam flags bypass opaque geometry depth', async ({ page }) => {
  for (const emitter of pin.emitters) expect(emitter.miscRenderFlags).toBe(1);
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const group = [...g.view.luxBeams.models.values()][0] as any;
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);
    const target = new THREE.WebGLRenderTarget(1, 1),
      scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(2, 2),
      wallMaterial = new THREE.MeshBasicMaterial({ color: 0 });
    const wall = new THREE.Mesh(plane, wallMaterial);
    wall.position.z = 1;
    scene.add(wall);
    const results = [];
    for (const source of group.children) {
      const material = source.material.clone(),
        authored = material.depthTest;
      material.uniforms.base.value = white;
      material.uniforms.mult.value = white;
      material.uniforms.tint.value.set(1, 0, 1, 1);
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
        name: source.name,
        depth: authored,
        visible: read(authored),
        occluded: read(true),
      });
      scene.remove(mesh);
      material.dispose();
    }
    renderer.setRenderTarget(null);
    plane.dispose();
    wallMaterial.dispose();
    white.dispose();
    target.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(6);
  for (const result of results) {
    expect(result.depth).toBe(false);
    expect(result.visible).toEqual([255, 0, 255, 255]);
    expect(result.occluded).toEqual([0, 0, 0, 255]);
  }
});
