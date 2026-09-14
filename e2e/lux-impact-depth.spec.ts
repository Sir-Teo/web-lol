import { expect, test } from '@playwright/test';
import audit from '../docs/reference/lux-impact-depth.json' with { type: 'json' };

test('source impact flags disable geometry depth occlusion for every gameplay material', async ({
  page,
}) => {
  for (const emitter of audit.activeEmitters) {
    expect(emitter.miscRenderFlags).toBe(1);
    expect(emitter.depthTest).toBe(false);
  }
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const probes = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', w.hero, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
    w.projectiles[0].critical = true;
    w.setOrder(lux, { type: 'idle' });
    while (w.projectiles.length) w.step();
    w.step();
    g.view.render(w, 1, 0);
    const cloud = g.view.luxImpacts.clouds.get(w.luxImpactVisuals[0].id);
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);
    renderer.setClearColor(0, 1);
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const scene = new THREE.Scene(),
      wallGeometry = new THREE.PlaneGeometry(2, 2);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0 });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.z = 1;
    scene.add(wall);
    const results = [];
    for (const source of [...cloud.rings.map((r: any) => r.mesh), cloud.sparks.mesh]) {
      const geometry = source.geometry.clone(),
        material = source.material.clone();
      const authored = material.depthTest;
      material.uniforms.sourceTexture.value = white;
      material.uniforms.particleColorTexture.value = white;
      if (material.uniforms.paletteTexture) material.uniforms.paletteTexture.value = white;
      material.uniforms.particleColor.value.set(1, 0, 1, 1);
      const tint = geometry.getAttribute('particleTint');
      if (tint) tint.setXYZW(0, 1, 1, 1, 1);
      const mesh = new THREE.InstancedMesh(geometry, material, 1);
      mesh.setMatrixAt(0, new THREE.Matrix4());
      scene.add(mesh);
      const read = (depthTest: boolean) => {
        material.depthTest = depthTest;
        renderer.setRenderTarget(buffer);
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(buffer, 0, 0, 1, 1, pixel);
        return [...pixel];
      };
      results.push({
        name: source.name,
        depthTest: authored,
        depthWrite: material.depthWrite,
        authored: read(authored),
        forcedDepth: read(true),
      });
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    }
    renderer.setRenderTarget(null);
    wallGeometry.dispose();
    wallMaterial.dispose();
    white.dispose();
    buffer.dispose();
    renderer.dispose();
    return results;
  });
  expect(probes).toHaveLength(5);
  for (const probe of probes) {
    expect(probe.depthTest).toBe(false);
    expect(probe.depthWrite).toBe(false);
    expect(probe.authored).toEqual([255, 0, 255, 255]);
    expect(probe.forcedDepth).toEqual([0, 0, 0, 255]);
  }
  expect(errors).toEqual([]);
});
