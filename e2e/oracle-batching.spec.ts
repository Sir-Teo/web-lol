import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('ordered Oracle batches preserve separate-draw pixels, matrices and transparent scene barriers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/oracle-particles.html');
  await page.waitForFunction(() => (window as any).__ORACLE_PARTICLES__?.ready);
  const results = await page.evaluate(async () => {
    const a = (window as any).__ORACLE_PARTICLES__,
      reference = a.createReference();
    const THREE = await import('/node_modules/three/build/three.module.js');
    const barrier = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({
        color: 0x457ea0,
        opacity: 0.4,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      })
    );
    barrier.quaternion.copy(a.camera.quaternion);
    barrier.position.set(0, 4.5, 0.2);
    const other = barrier.clone();
    a.scene.add(barrier);
    reference.scene.add(other);
    const gl = a.renderer.getContext(),
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const read = () => {
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    // Both paths must receive the same intermediate seeks: the retained
    // separate-draw reference breaks equal-depth ties by object birth order.
    a.effects.clear();
    reference.effects.clear();
    const syncReference = () =>
      reference.effects.update(
        a.inputs(),
        Number((document.querySelector('#time') as HTMLInputElement).value) * 60,
        a.camera,
        a.ground,
        (document.querySelector('#layer') as HTMLSelectElement).value === 'all'
          ? null
          : Number((document.querySelector('#layer') as HTMLSelectElement).value)
      );
    const compare = (label: string, time: number, inputs: any[], profile: number | null) => {
      a.effects.update(inputs, time * 60, a.camera, a.ground, profile);
      a.render();
      const actual = read(),
        calls = a.renderer.info.render.calls;
      reference.effects.update(inputs, time * 60, a.camera, a.ground, profile);
      a.renderer.render(reference.scene, a.camera);
      const expected = read(),
        referenceCalls = a.renderer.info.render.calls;
      let changed = 0,
        maxError = 0;
      for (let i = 0; i < actual.length; i++) {
        const delta = Math.abs(actual[i] - expected[i]);
        if (delta) changed++;
        maxError = Math.max(delta, maxError);
      }
      let matricesExact = true;
      const order = [...a.effects.batches.values()].flatMap((m: any) => m.userData.particleKeys);
      const transform = new THREE.Matrix4().multiplyMatrices(
        a.camera.projectionMatrix,
        a.camera.matrixWorldInverse
      );
      const referenceOrder = [...reference.effects.models]
        .filter(([, m]: any) => !m.mixer && !m.ownedGeometry)
        .map(([key, m]: any) => {
          const mesh = m.meshes[0];
          const center = mesh.geometry.boundingSphere.center;
          const v = new THREE.Vector4(center.x, center.y, center.z, 1)
            .applyMatrix4(mesh.matrixWorld)
            .applyMatrix4(transform);
          return { key, id: mesh.id, pass: mesh.renderOrder, z: v.z };
        })
        .sort((a, b) => a.pass - b.pass || b.z - a.z || a.id - b.id)
        .map((x) => x.key);
      for (const mesh of a.effects.batches.values())
        for (const [slot, key] of mesh.userData.particleKeys.entries()) {
          const model = reference.effects.models.get(key);
          const matrix = new Float32Array(model.root.modelViewMatrix.elements);
          if (matrix.some((v, i) => v !== mesh.instanceMatrix.array[slot * 16 + i]))
            matricesExact = false;
        }
      return {
        label,
        time,
        particles: a.effects.models.size,
        batches: a.effects.batches.size,
        calls,
        referenceCalls,
        changedChannels: changed,
        maxError,
        matricesExact,
        ...(changed ? { order, referenceOrder } : {}),
      };
    };
    const results: any[] = [];
    const times = [
      0.8, 0.8, 0.8, 0.25, 0.7, 0.5, 0.3, 0.1, 0.08, 0, 2, 2, 0.15, 0.2, 0.08, 0.06, 0.5,
    ];
    barrier.visible = other.visible = false;
    for (let index = 0; index < times.length; index++) {
      if (index === 9) continue;
      a.choose(index);
      syncReference();
      a.seek(times[index]);
      syncReference();
      results.push(compare(`isolated:${index}`, times[index], a.inputs(), index));
    }
    for (const [role, time] of [
      ['buff', 0.1],
      ['buff', 2],
      ['death', 0.05],
      ['death', 0.2],
      ['sequence', 8.55],
    ] as const) {
      (document.querySelector('#system') as HTMLSelectElement).value = role;
      a.choose(null);
      syncReference();
      a.seek(time);
      syncReference();
      for (const visible of [false, true]) {
        barrier.visible = other.visible = visible;
        results.push(compare(`${role}:barrier:${visible}`, time, a.inputs(), null));
      }
    }
    a.camera.position.set(0, 24, 40);
    a.camera.lookAt(0, 2.5, 0);
    a.camera.updateMatrixWorld();
    const crowd = Array.from({ length: 10 }, (_, i) => ({
      id: `crowd:${i}`,
      ownerId: 17 + i,
      window: { role: 'death', startTick: 0, stopTick: null },
      anchorAt: () => ({
        position: [((i % 5) - 2) * 300, 450, Math.floor(i / 5) * 300],
        facing: 0,
      }),
    }));
    results.push(compare('ten-owners', 0.05, crowd, null));
    for (const time of [0.2, 0.05, 0.7, 0.05])
      results.push(compare(`crowd-seek:${time}`, time, crowd, null));
    const firstCapacity = [...a.effects.batches.values()].reduce(
      (n: any, m: any) => n + m.instanceMatrix.count,
      0
    );
    results.push({ ...compare('shrink-to-one', 0.05, crowd.slice(0, 1), null), firstCapacity });
    results.push(compare('regrow-ten', 0.05, crowd, null));
    const ownedDraws = a.effects.draws,
      ownedMaterials = new Set(ownedDraws.map((m: any) => m.material)),
      ownedGeometries = new Set(ownedDraws.map((m: any) => m.geometry));
    let materialsDisposed = 0,
      geometriesDisposed = 0;
    for (const material of ownedMaterials as Set<any>)
      material.addEventListener('dispose', () => materialsDisposed++);
    for (const geometry of ownedGeometries as Set<any>)
      geometry.addEventListener('dispose', () => geometriesDisposed++);
    a.effects.update([], 20, a.camera, a.ground);
    a.render();
    results.push({
      label: 'retirement',
      models: a.effects.models.size,
      batches: a.effects.batches.size,
      materialsDisposed,
      geometriesDisposed,
      expectedMaterials: ownedMaterials.size,
      expectedGeometries: ownedGeometries.size,
    });
    reference.effects.clear();
    a.effects.clear();
    barrier.visible = other.visible = false;
    a.camera.position.set(14, 14, 20);
    a.camera.lookAt(0, 2.5, 0);
    a.camera.updateMatrixWorld();
    a.seek(8.55);
    reference.effects.update(a.inputs(), 8.55 * 60, a.camera, a.ground);
    a.render();
    a.reference = reference;
    return results;
  });
  writeFileSync(
    'artifacts/oracle-batching-comparison.json',
    JSON.stringify(results, null, 2) + '\n'
  );
  for (const r of results.filter((r) => r.label !== 'retirement')) {
    expect(r.matricesExact, r.label).toBe(true);
    expect(r.changedChannels, r.label).toBe(0);
  }
  const end = results.find((r) => r.label === 'death:barrier:false');
  expect(end.calls).toBeLessThan(end.referenceCalls * 0.5);
  const crowd = results.find((r) => r.label === 'ten-owners');
  expect(crowd.calls).toBeLessThan(crowd.referenceCalls * 0.6);
  const retirement = results.find((r) => r.label === 'retirement');
  expect([retirement.models, retirement.batches]).toEqual([0, 0]);
  expect(retirement.materialsDisposed).toBe(retirement.expectedMaterials);
  expect(retirement.geometriesDisposed).toBe(retirement.expectedGeometries);
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    const a = (window as any).__ORACLE_PARTICLES__;
    a.renderer.render(a.reference.scene, a.camera);
  });
  await page.screenshot({ path: 'artifacts/oracle-reference-draws.png' });
  await page.evaluate(() => (window as any).__ORACLE_PARTICLES__.render());
  await page.screenshot({ path: 'artifacts/oracle-after-batching.png' });
});

test('active Oracle instance buffers recover after real WebGL context loss without advancing the match', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  await page.locator('.close-button').click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.nextWaveTick = 1e9;
    for (const u of g.world.units) u.ai = false;
    g.setPaused(false);
  });
  await page.keyboard.press('4');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.player.trinket.scan) return false;
    g.setPaused(true);
    return true;
  });
  await page.mouse.move(20, 20);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(30);
    g.view.recenter(g.world.hero);
  });
  const inspect = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.view.render(g.world, 1, 1);
      const data = [...g.view.oracleLens.particles.batches]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, mesh]: any) => ({
          key,
          count: mesh.count,
          keys: mesh.userData.particleKeys,
          matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
          attributes: [
            'particleTint',
            'particleLookupUv',
            'particleUvScroll',
            'particleUvScale',
            'particleAtlasOffset',
          ].map((name) => {
            const a = mesh.geometry.getAttribute(name);
            return { name, values: Array.from(a.array.slice(0, mesh.count * a.itemSize)) };
          }),
        }));
      return {
        snapshot: g.world.snapshot(),
        buffers: JSON.stringify(data),
        batches: data.length,
        draws: g.view.oracleLens.particles.draws.length,
      };
    });
  const before = await inspect();
  expect(before.batches).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    (window as any).__GAME__.setPaused(true);
  });
  const after = await inspect();
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/oracle-batch-context-restored.png' });
  writeFileSync(
    'artifacts/oracle-batch-context.json',
    JSON.stringify(
      { batches: before.batches, draws: before.draws, exactBuffers: true, exactSnapshot: true },
      null,
      2
    ) + '\n'
  );
});
