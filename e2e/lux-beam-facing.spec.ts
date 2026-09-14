import { expect, test } from '@playwright/test';

test('warning and fired beams face the camera while preserving source width', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { LUX_BEAM_LAYERS } = await import('/src/content/lux-beam-layers.ts');
    const { sampleBeamCurve } = await import('/src/render/lux-beams.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    const results = [];
    for (const phase of ['charge', 'fired']) {
      w.step(phase === 'charge' ? 30 : 32);
      const elapsed =
        phase === 'charge'
          ? (w.tick - w.championState(lux.id).pendingCast.startTick) / 60
          : 1 + (w.tick - w.luxBeams[0].startTick) / 60;
      for (const z of [-12, 12]) {
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(0, 18, z);
        v.luxBeams.update(w, 1, camera);
        for (const group of v.luxBeams.models.values())
          for (const mesh of group.children) {
            if (!mesh.visible) continue;
            const positions = mesh.geometry.getAttribute('position');
            const a = new THREE.Vector3().fromBufferAttribute(positions, 0),
              b = new THREE.Vector3().fromBufferAttribute(positions, 1);
            const count = mesh.geometry.drawRange.count;
            const end = new THREE.Vector3()
              .fromBufferAttribute(positions, count - 1)
              .add(new THREE.Vector3().fromBufferAttribute(positions, count - 2))
              .multiplyScalar(0.5);
            const center = a.clone().add(b).multiplyScalar(0.5),
              width = b.sub(a);
            const profile = LUX_BEAM_LAYERS.find((p: any) => p.name === mesh.name);
            results.push({
              phase,
              name: mesh.name,
              width: width.length(),
              expected:
                profile.width *
                sampleBeamCurve(profile.scale, (elapsed - profile.delay) / profile.life)[0] *
                0.01,
              eyeDot: width
                .clone()
                .normalize()
                .dot(camera.position.clone().sub(center).normalize()),
              handedness: width
                .clone()
                .normalize()
                .dot(
                  end.clone().sub(center).cross(camera.position.clone().sub(center)).normalize()
                ),
              beamDot: width.clone().normalize().dot(end.clone().sub(center).normalize()),
              vertical: width.y,
            });
          }
      }
    }
    return results;
  });
  expect(result).toHaveLength(22);
  for (const layer of result) {
    expect(layer.width).toBeCloseTo(Math.abs(layer.expected), 5);
    expect(layer.handedness).toBeCloseTo(Math.sign(layer.expected), 5);
    expect(Math.abs(layer.eyeDot)).toBeLessThan(1e-5);
    expect(Math.abs(layer.beamDot)).toBeLessThan(1e-5);
    expect(Math.abs(layer.vertical)).toBeGreaterThan(0.01);
  }
});
