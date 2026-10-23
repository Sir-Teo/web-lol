import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('an armed field restores all wave/spark buffer bytes and pixels after actual graphics loss, then retires at recast', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
      target = w.spawn('dummy', 'red', { x: 600, y: 0 });
    target.hp = target.maxHp = 5000;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step(195);
    v.center = { x: 400, y: 0 };
    v.zoom = 0.55;
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const zone = w.singularities[0],
      capture = () =>
        v.luxSingularities.models.get(zone.id).children.map((m: any) => ({
          name: m.name,
          attributes: Object.fromEntries(
            Object.entries(m.geometry.attributes).map(([key, a]: any) => [key, Array.from(a.array)])
          ),
          index: Array.from(m.geometry.index.array),
          count: m.geometry.drawRange.count,
          live: m.userData.liveParticles,
        }));
    const saved = w.snapshot(),
      data = JSON.stringify(capture()),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = JSON.stringify(capture()) === data;
    const stale = w.constructor.fromSnapshot(saved, w.battlefield);
    stale.step(120);
    v.render(stale, 1, v.previousElapsed);
    v.render(w, 1, v.previousElapsed);
    const seek = JSON.stringify(capture()) === data;
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    (window as any).__E_FIELD__ = {
      id: zone.id,
      lux: lux.id,
      target: target.id,
      capture,
      data,
      saved,
      pixels,
    };
    return {
      restored,
      seek,
      fieldAge: (w.tick - zone.arrivalTick) / 60,
      layers: capture()
        .filter((m: any) => m.live !== undefined)
        .map((m: any) => ({ name: m.name, count: m.count, live: m.live })),
    };
  });
  expect(before.restored).toBe(true);
  expect(before.seek).toBe(true);
  expect(before.fieldAge).toBe(2.5);
  expect(before.layers).toHaveLength(8);
  expect(before.layers.filter((m: any) => m.count > 0)).toHaveLength(7);
  await page.screenshot({
    path: 'artifacts/lux-e-glows-armed.png',
    style: '.modal-backdrop { visibility: hidden !important; }',
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__E_FIELD__;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(s.pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const buffers = JSON.stringify(s.capture()) === s.data,
      snapshot = w.snapshot() === s.saved;
    const different = pixels.reduce(
      (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
      0
    );
    const model = v.luxSingularities.models.get(s.id),
      resources = model.children.length * 2;
    let disposed = 0;
    for (const m of model.children) {
      m.geometry.addEventListener('dispose', () => disposed++);
      m.material.addEventListener('dispose', () => disposed++);
    }
    w.enqueue({ type: 'cast', unit: s.lux, ability: 'e', point: w.unit(s.target) });
    w.step();
    v.render(w, 1, v.previousElapsed);
    return {
      buffers,
      snapshot,
      different,
      resources,
      disposed,
      retiredField: !model.children.some((m: any) => m.userData.fieldProfileIndex !== undefined),
    };
  });
  expect(after.buffers).toBe(true);
  expect(after.snapshot).toBe(true);
  expect(after.different).toBe(0);
  expect(after.disposed).toBe(after.resources);
  expect(after.retiredField).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-e-glows-recovery.json',
    JSON.stringify({ before, after }, null, 2) + '\n'
  );
});

test('enemy field waves and sparks filter triangles at fog boundaries and return at their continued saved phase', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'red', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(195);
    let seen = true;
    w.pointVisible = () => seen;
    v.render(w, 1, v.previousElapsed);
    const model = v.luxSingularities.models.get(w.singularities[0].id),
      fields = () => model.children.filter((m: any) => m.userData.fieldProfileIndex !== undefined);
    const capture = () =>
      fields().map((m: any) => Array.from(m.geometry.getAttribute('position').array));
    const before = JSON.stringify(capture());
    seen = false;
    v.render(w, 1, v.previousElapsed);
    const hidden = !model.visible && fields().every((m: any) => m.geometry.drawRange.count === 0);
    w.step(30);
    seen = true;
    v.render(w, 1, v.previousElapsed);
    const continued = JSON.stringify(capture());
    const saved = w.snapshot();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.pointVisible = () => true;
    v.render(copy, 1, v.previousElapsed);
    return {
      hidden,
      changed: continued !== before,
      visible: model.visible,
      triangles: fields().every((m: any) => m.geometry.drawRange.count > 0),
      restored: continued === JSON.stringify(capture()),
    };
  });
  expect(Object.values(result).every(Boolean)).toBe(true);
  writeFileSync('artifacts/lux-e-glows-fog.json', JSON.stringify(result, null, 2) + '\n');
});

test('field glow/ray/motion batches match separate particle draws and each source layer contributes pixels', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { LuxEFieldCloud } = await import('/src/render/lux-e-field.ts');
    const { loadLuxParticleTextures } = await import('/src/render/lux-particle-textures.ts');
    const profiles = (await import('/src/content/lux-e-field.json')).default;
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const textures = await loadLuxParticleTextures(
      profiles
        .flatMap((p: any) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
        .filter(Boolean)
    );
    const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
    camera.position.set(7, 11, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const renderer = g.view.renderer,
      target = new THREE.WebGLRenderTarget(256, 256),
      scene = new THREE.Scene(),
      reference = new THREE.Scene();
    scene.background = reference.background = new THREE.Color(0.025, 0.04, 0.035);

    const savedTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const render = (s: any) => {
      renderer.render(s, camera);
      const pixels = new Uint8Array(256 * 256 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
      return { pixels, calls: renderer.info.render.calls };
    };
    const comparisons = [];
    for (const role of ['ally', 'enemy'] as const) {
      const cloud = new LuxEFieldCloud(role, textures);
      scene.add(...cloud.meshes);
      for (const age of [0.25, 1, 2.5, 4.0, 4.8]) {
        cloud.draw(
          w,
          91,
          age,
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          'blue',
          camera,
          () => 0
        );
        const full = render(scene),
          separate: any[] = [];
        for (const batch of cloud.meshes) {
          for (let slot = 0; slot < batch.userData.liveParticles; slot++) {
            const geometry = new THREE.BufferGeometry();
            for (const [name, attribute] of Object.entries(batch.geometry.attributes) as any) {
              const size = attribute.itemSize;
              geometry.setAttribute(
                name,
                new THREE.BufferAttribute(
                  attribute.array.slice(slot * 6 * size, (slot + 1) * 6 * size),
                  size
                )
              );
            }
            const mesh = new THREE.Mesh(geometry, batch.material);
            mesh.renderOrder = batch.renderOrder;
            mesh.frustumCulled = false;
            reference.add(mesh);
            separate.push(mesh);
          }
        }
        const split = render(reference);
        let maxDelta = 0,
          different = 0;
        for (let i = 0; i < full.pixels.length; i++) {
          const delta = Math.abs(full.pixels[i] - split.pixels[i]);
          maxDelta = Math.max(maxDelta, delta);
          if (delta) different++;
        }
        const contributions = [];
        if (age === 1)
          for (const batch of cloud.meshes) {
            batch.visible = false;
            const without = render(scene);
            batch.visible = true;
            contributions.push({
              name: batch.name,
              differentBytes: full.pixels.reduce(
                (n: number, v: number, i: number) => n + Number(v !== without.pixels[i]),
                0
              ),
            });
          }
        comparisons.push({
          role,
          age,
          batchCalls: full.calls,
          separateCalls: split.calls,
          particles: separate.length,
          maxDelta,
          different,
          contributions,
        });
        for (const mesh of separate) {
          mesh.removeFromParent();
          mesh.geometry.dispose();
        }
      }
      cloud.dispose();
    }
    target.dispose();
    renderer.setRenderTarget(savedTarget);
    return comparisons;
  });
  expect(
    result.every((r: any) => r.batchCalls <= (r.role === 'ally' ? 8 : 7) && r.maxDelta <= 1)
  ).toBe(true);
  const main = result.find((r: any) => r.age === 1)!;
  expect(main.batchCalls).toBe(8);
  expect(main.separateCalls).toBeGreaterThan(10);
  expect(main.contributions).toHaveLength(8);
  expect(main.contributions.every((r: any) => r.differentBytes > 0)).toBe(true);
  expect(
    result
      .filter((r: any) => r.age === 1)
      .every(
        (r: any) =>
          r.contributions.length === (r.role === 'ally' ? 8 : 7) &&
          r.contributions.every((c: any) => c.differentBytes > 0)
      )
  ).toBe(true);
  writeFileSync('artifacts/lux-e-glows-batches.json', JSON.stringify(result, null, 2) + '\n');
});
