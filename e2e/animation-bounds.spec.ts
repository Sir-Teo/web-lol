import { expect, test } from '@playwright/test';

test('all building clips fit cloned bounds and native culling preserves frozen pixels and shadows', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    v.locked = false;
    v.render(w, 1, 10);
    const models = [...v.models.values()].filter((m: any) => m.submeshes) as any[];
    const unique = [...new Map(models.map((m) => [m.referenceAsset, m])).values()];
    let testedVertices = 0;
    const failures: string[] = [];
    for (const model of unique) {
      model.mixer.stopAllAction();
      for (const action of Object.values(model.actions) as any[]) {
        action.reset().play();
        for (let step = 0; step <= 16; step++) {
          action.time = (action.getClip().duration * step) / 16;
          model.mixer.update(0);
          model.root.updateMatrixWorld(true);
          for (const mesh of model.submeshes) {
            if (!mesh.isSkinnedMesh || !mesh.userData.animationBounds || !mesh.frustumCulled) {
              failures.push(`${model.referenceAsset}/${mesh.name}: no bound`);
              continue;
            }
            const point = mesh.boundingSphere.center.clone();
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
              mesh.getVertexPosition(i, point);
              testedVertices++;
              if (
                point.distanceTo(mesh.boundingSphere.center) >
                mesh.boundingSphere.radius + 1e-6
              ) {
                failures.push(
                  `${model.referenceAsset}/${mesh.name}/${action.getClip().name}/${step}/${i}`
                );
                break;
              }
            }
          }
        }
        action.stop();
      }
      model.actions.idle1.reset().play();
      model.mixer.update(0);
    }
    const gl = v.renderer.getContext();
    const width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const a = new Uint8Array(width * height * 4),
      b = new Uint8Array(a.length);
    const comparisons: any[] = [];
    const centers = [
      { x: 0, y: 0 },
      ...w.units
        .filter((u: any) => u.kind === 'nexus')
        .flatMap((u: any) => [
          { x: u.x, y: u.y },
          { x: u.x - 2200, y: u.y + 1200 },
          { x: u.x + 2200, y: u.y - 1200 },
        ]),
    ];
    for (const destroyed of [false, true]) {
      for (const center of centers) {
        v.center = center;
        v.render(w, 1, 10);
        for (const model of models) {
          if (destroyed) {
            model.mixer.stopAllAction();
            const action = model.actions[model.destroyedClip];
            if (action) {
              action.reset().play();
              action.time = action.getClip().duration * 0.6;
              model.mixer.update(0);
            }
            for (const mesh of model.submeshes) mesh.visible = !!mesh.userData.destroyedVisible;
          }
          for (const mesh of model.submeshes) mesh.frustumCulled = true;
        }
        v.renderer.render(v.scene, v.camera);
        const culledCalls = v.renderer.info.render.calls;
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, a);
        for (const model of models) for (const mesh of model.submeshes) mesh.frustumCulled = false;
        v.renderer.render(v.scene, v.camera);
        const fullCalls = v.renderer.info.render.calls;
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, b);
        let differences = 0,
          nonzero = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) differences++;
          if (a[i]) nonzero++;
        }
        comparisons.push({ center, destroyed, culledCalls, fullCalls, differences, nonzero });
      }
    }
    for (const model of models) for (const mesh of model.submeshes) mesh.frustumCulled = true;
    return { failures, testedVertices, assets: unique.length, comparisons };
  });
  expect(result.assets).toBe(6);
  expect(result.testedVertices).toBeGreaterThan(1000000);
  expect(result.failures).toEqual([]);
  for (const comparison of result.comparisons) {
    expect(comparison.nonzero).toBeGreaterThan(100000);
    expect(comparison.differences, JSON.stringify(comparison)).toBe(0);
    expect(comparison.culledCalls).toBeLessThan(comparison.fullCalls);
  }
  console.log(JSON.stringify(result));
});
