import { expect, test } from '@playwright/test';

test('all sixteen visual Oracle declarations contribute pixels with original assets and random seeking', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/oracle-lens|effects\/oracle-lens/.test(r.url())) requests.push(new URL(r.url()).pathname);
  });
  await page.goto('/tools/qa/oracle-particles.html');
  await page.waitForFunction(() => (window as any).__ORACLE_PARTICLES__?.ready);
  const results = [];
  const times = [
    0.8, 0.8, 0.8, 0.25, 0.7, 0.5, 0.3, 0.1, 0.08, 0, 2, 2, 0.15, 0.2, 0.08, 0.06, 0.5,
  ];
  for (let index = 0; index < times.length; index++) {
    if (index === 9) continue;
    const result = await page.evaluate(
      ({ index, time }) => {
        const a = (window as any).__ORACLE_PARTICLES__;
        a.choose(index);
        a.seek(time);
        a.fit();
        a.render();
        const models = [...a.effects.models.values()] as any[],
          gl = a.renderer.getContext(),
          width = gl.drawingBufferWidth,
          height = gl.drawingBufferHeight;
        const read = () => {
          const p = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, p);
          return p;
        };
        const visible = read();
        models.forEach((m) => (m.root.visible = false));
        a.render();
        const hidden = read();
        models.forEach((m) => (m.root.visible = true));
        a.render();
        let changed = 0;
        for (let i = 0; i < visible.length; i += 4)
          if (
            visible[i] !== hidden[i] ||
            visible[i + 1] !== hidden[i + 1] ||
            visible[i + 2] !== hidden[i + 2]
          )
            changed++;
        const sample = () =>
          JSON.stringify(
            [...a.effects.models]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, m]: any) => ({
                key,
                position: m.root.position.toArray(),
                quaternion: m.root.quaternion.toArray(),
                scale: m.root.scale.toArray(),
                particle: m.root.userData.particle,
                vertices: m.meshes.map((mesh: any) =>
                  Array.from(mesh.geometry.attributes.position.array)
                ),
                bones: m.meshes
                  .filter((mesh: any) => mesh.isSkinnedMesh)
                  .map((mesh: any) => Array.from(mesh.skeleton.boneMatrices)),
              }))
          );
        const before = sample();
        a.seek(time + 0.2);
        a.seek(time);
        a.render();
        const replay = read();
        return {
          index,
          name: a.profiles[index].name,
          role: a.profiles[index].role,
          changed,
          models: models.length,
          exactSeek: sample() === before,
          exactPixels: visible.every((v, i) => v === replay[i]),
          finite: models.every((m) => m.root.matrixWorld.elements.every(Number.isFinite)),
        };
      },
      { index, time: times[index] }
    );
    expect(result.models).toBeGreaterThan(0);
    expect(result.changed, `${result.role} ${result.name}`).toBeGreaterThan(0);
    expect(result.exactSeek, `${result.role} ${result.name}`).toBe(true);
    expect(result.exactPixels, `${result.role} ${result.name} framebuffer replay`).toBe(true);
    expect(result.finite).toBe(true);
    results.push(result);
    if ([1, 7, 10, 11, 13, 15, 16].includes(index))
      await page.screenshot({ path: `artifacts/oracle-particle-${index}.png` });
  }
  const assets = requests.filter((p) => p.startsWith('/assets/'));
  expect(new Set(assets.filter((p) => p.endsWith('.glb'))).size).toBe(4);
  expect(new Set(assets.filter((p) => p.endsWith('.png'))).size).toBe(15);
  expect(errors).toEqual([]);
  await test.info().attach('oracle-particle-gpu', {
    body: JSON.stringify({ results, assets }, null, 2),
    contentType: 'application/json',
  });
});

test('the explicit parent edge starts Death after stopping, and seeking retires owned GPU resources', async ({
  page,
}) => {
  await page.goto('/tools/qa/oracle-particles.html');
  await page.waitForFunction(() => (window as any).__ORACLE_PARTICLES__?.ready);
  await page.locator('#system').selectOption('sequence');
  const result = await page.evaluate(() => {
    const a = (window as any).__ORACLE_PARTICLES__;
    a.seek(8.5);
    const before = [...a.effects.models.values()].map(
      (m: any) => a.profiles[m.root.userData.profileIndex].role
    );
    a.seek(8.55);
    const roles = [...a.effects.models.values()].map(
      (m: any) => a.profiles[m.root.userData.profileIndex].role
    );
    const children = [...a.effects.models.values()].filter(
      (m: any) => m.root.userData.effectId === 'child'
    );
    const anchorHeights = children.map(
      (m: any) => m.root.position.y - m.root.userData.particle.offset[1] * 0.01
    );
    let disposedMaterials = 0,
      disposedGeometries = 0;
    const draws = a.effects.draws;
    const materials = new Set(draws.map((m: any) => m.material)),
      geometries = new Set(draws.map((m: any) => m.geometry));
    for (const material of materials as Set<any>)
      material.addEventListener('dispose', () => disposedMaterials++);
    for (const geometry of geometries as Set<any>)
      geometry.addEventListener('dispose', () => disposedGeometries++);
    a.seek(10);
    const remaining = a.effects.models.size;
    a.seek(0.5);
    const count = a.effects.models.size;
    a.seek(0);
    a.render();
    return {
      before,
      roles,
      anchorHeights,
      remaining,
      count,
      final: a.effects.models.size,
      disposedMaterials,
      disposedGeometries,
      materialCount: materials.size,
      geometryCount: geometries.size,
    };
  });
  expect(result.before).not.toContain('death');
  expect(result.roles).toContain('death');
  expect(result.anchorHeights.length).toBeGreaterThan(0);
  result.anchorHeights.forEach((h) => expect(h).toBeCloseTo(4.5));
  expect([result.remaining, result.final]).toEqual([0, 0]);
  expect(result.count).toBeGreaterThan(0);
  expect(result.disposedMaterials).toBe(result.materialCount);
  expect(result.disposedGeometries).toBe(result.geometryCount);
  await page.locator('#time').fill('0.3');
  await page.locator('#play').click();
  await page.waitForFunction(
    () => Number((document.querySelector('#time') as HTMLInputElement).value) > 0.4
  );
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Play');
  await page.locator('#time').fill('8.55');
  await page.locator('#fit').click();
  await page.screenshot({ path: 'artifacts/oracle-particle-child-sequence.png' });
});

test('bound Buff layers follow a moving anchor and both ground layers project onto uneven terrain', async ({
  page,
}) => {
  await page.goto('/tools/qa/oracle-particles.html');
  await page.waitForFunction(() => (window as any).__ORACLE_PARTICLES__?.ready);
  await page.locator('#move').check();
  await page.locator('#terrain').check();
  const result = await page.evaluate(() => {
    const a = (window as any).__ORACLE_PARTICLES__;
    a.seek(2);
    const anchor = a.inputs()[0].anchorAt(120);
    const rig = [...a.effects.models.values()].find(
      (m: any) => m.root.userData.profileIndex === 1
    ) as any;
    const rigPosition = rig.root.position.toArray();
    const ground = [10, 11].map((index) => {
      const m = [...a.effects.models.values()].find(
          (m: any) => m.root.userData.profileIndex === index
        ) as any,
        positions = m.meshes[0].geometry.attributes.position;
      let error = 0;
      for (let i = 0; i < positions.count; i++)
        error = Math.max(
          error,
          Math.abs(
            positions.getY(i) -
              a.ground(positions.getX(i) / 0.01, positions.getZ(i) / 0.01) -
              (index === 10 ? 0.1 : 0.02)
          )
        );
      return { index, vertices: positions.count, error };
    });
    a.fit();
    return { anchor: anchor.position, rigPosition, ground };
  });
  expect(result.rigPosition[0]).toBeCloseTo(result.anchor[0] * 0.01);
  expect(result.rigPosition[1]).toBeCloseTo(result.anchor[1] * 0.01 + 4.5);
  result.ground.forEach((g) => {
    expect(g.vertices).toBeGreaterThan(100);
    expect(g.error).toBeLessThan(1e-6);
  });
  await page.screenshot({ path: 'artifacts/oracle-particle-ground-sequence.png' });
});

test('unbound Death particles retain their birth anchors while bound sparks follow the supplied anchor', async ({
  page,
}) => {
  await page.goto('/tools/qa/oracle-particles.html');
  await page.waitForFunction(() => (window as any).__ORACLE_PARTICLES__?.ready);
  const result = await page.evaluate(() => {
    const a = (window as any).__ORACLE_PARTICLES__;
    a.effects.update(
      [
        {
          id: 'moving-death',
          ownerId: 17,
          window: { role: 'death', startTick: 0, stopTick: null },
          anchorAt: (tick: number) => ({ position: [tick * 10, 0, tick * 20], facing: 0 }),
        },
      ],
      6,
      a.camera,
      () => 0
    );
    a.render();
    return [...a.effects.models.values()].map((m: any) => {
      const p = m.root.userData.particle;
      return {
        index: p.profileIndex,
        born: p.bornTick,
        bind: p.bind,
        position: m.root.position.toArray(),
        offset: p.offset,
      };
    });
  });
  expect(new Set(result.map((p) => p.index))).toEqual(new Set([12, 13, 14, 15]));
  for (const p of result) {
    const tick = p.bind === 1 ? 6 : p.born;
    expect(p.position[0]).toBeCloseTo((tick * 10 + p.offset[0]) * 0.01);
    expect(p.position[2]).toBeCloseTo((tick * 20 + p.offset[2]) * 0.01);
  }
});
