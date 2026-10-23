import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { LUX_E_BURST_TICKS } from '../src/content/lux-e-particle-timing';

test('late source E motes retain saved buffers and pixels through real graphics loss, then retire without gameplay', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
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
      dummy = w.spawn('dummy', 'red', { x: 600, y: 0 });
    dummy.hp = dummy.maxHp = 5000;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: dummy });
    w.step(45);
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: dummy });
    w.step(17);
    v.center = { x: 400, y: 0 };
    v.zoom = 0.55;
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const zone = w.singularities[0],
      state = { id: zone.id, target: dummy.id, hp: dummy.hp, samples: [] };
    (window as any).__E_BURST__ = state;
    return { detonation: zone.detonatedTick, earlyTick: w.tick };
  });
  await page.screenshot({ path: 'artifacts/lux-e-hit-regression-burst-burst.png' });
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      state = (window as any).__E_BURST__;
    w.step(38);
    v.render(w, 1, v.previousElapsed);
    const capture = () =>
      v.luxSingularities.models.get(state.id).children.map((m: any) => ({
        name: m.name,
        attributes: Object.fromEntries(
          Object.entries(m.geometry.attributes).map(([key, value]: any) => [
            key,
            Array.from(value.array),
          ])
        ),
        index: Array.from(m.geometry.index.array),
        drawCount: m.geometry.drawRange.count,
        live: m.userData.liveParticles,
      }));
    const saved = w.snapshot(),
      data = JSON.stringify(capture()),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = JSON.stringify(capture()) === data;
    v.render(w, 1, v.previousElapsed);
    state.capture = capture;
    state.data = data;
    state.saved = saved;
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
    state.pixels = pixels;
    const layers = capture().map((m: any) => ({
      name: m.name,
      live: m.live,
      drawCount: m.drawCount,
    }));
    v.renderer.forceContextLoss();
    return {
      restored,
      layers,
      tick: w.tick,
      lateSeconds: (w.tick - w.singularities[0].detonatedTick) / 60,
    };
  });
  expect(before.restored).toBe(true);
  expect(before.layers).toHaveLength(3);
  expect(before.layers.some((m: any) => m.drawCount > 0)).toBe(true);
  expect(before.lateSeconds).toBeGreaterThan(43 / 60);
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      state = (window as any).__E_BURST__;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(state.pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    return {
      buffers: JSON.stringify(state.capture()) === state.data,
      snapshot: w.snapshot() === state.saved,
      differentBytes: pixels.reduce(
        (n: number, v: number, i: number) => n + Number(v !== state.pixels[i]),
        0
      ),
      nonzero: pixels.some((v) => v > 0),
    };
  });
  expect(after).toEqual({ buffers: true, snapshot: true, differentBytes: 0, nonzero: true });
  await page.screenshot({ path: 'artifacts/lux-e-hit-regression-burst-restored.png' });
  const retired = await page.evaluate((tail) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      state = (window as any).__E_BURST__,
      model = v.luxSingularities.models.get(state.id);
    let disposed = 0;
    for (const m of model.children) {
      m.geometry.addEventListener('dispose', () => disposed++);
      m.material.addEventListener('dispose', () => disposed++);
    }
    w.step(tail);
    v.render(w, 1, v.previousElapsed);
    return {
      disposed,
      models: v.luxSingularities.models.size,
      zones: w.singularities.length,
      hpUnchanged: w.unit(state.target).hp === state.hp,
    };
  }, LUX_E_BURST_TICKS);
  expect(retired).toEqual({ disposed: 6, models: 0, zones: 0, hpUnchanged: true });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-e-hit-regression-burst-recovery.json',
    JSON.stringify({ setup, before, after, retired }, null, 2) + '\n'
  );
});

test('three E motion batches match separate particle draws and each source layer contributes pixels', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { LuxEBurstCloud } = await import('/src/render/lux-e-burst.ts');
    const { loadLuxParticleTextures } = await import('/src/render/lux-particle-textures.ts');
    const profiles = (await import('/src/content/lux-e-burst.json')).default;
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const textures = await loadLuxParticleTextures(
      profiles.flatMap((p: any) => [p.texture, p.lookup]).filter(Boolean)
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
    const cloud = new LuxEBurstCloud(textures);
    scene.add(...cloud.meshes);
    const savedTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const render = (s: any) => {
      renderer.render(s, camera);
      const pixels = new Uint8Array(256 * 256 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
      return { pixels, calls: renderer.info.render.calls };
    };
    const comparisons = [];
    for (const age of [0.05, 0.15, 0.3, 0.65, 0.9, 1.3]) {
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
      if (age === 0.15)
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
    target.dispose();
    renderer.setRenderTarget(savedTarget);
    return comparisons;
  });
  expect(result.every((r: any) => r.batchCalls <= 3 && r.maxDelta <= 1)).toBe(true);
  const main = result.find((r: any) => r.age === 0.15)!;
  expect(main.batchCalls).toBe(3);
  expect(main.separateCalls).toBeGreaterThan(40);
  expect(main.contributions).toHaveLength(3);
  expect(main.contributions.every((r: any) => r.differentBytes > 0)).toBe(true);
  writeFileSync(
    'artifacts/lux-e-hit-regression-burst-batches.json',
    JSON.stringify(result, null, 2) + '\n'
  );
});

test('enemy explosion particles disappear under fog and return at their continued saved phase', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const lux = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    lux.ai = false;
    w.setOrder(lux, { type: 'idle' });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(45);
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(13);
    v.center = { x: 450, y: 0 };
    v.render(w, 1, v.previousElapsed);
    const zone = w.singularities[0],
      root = v.luxSingularities.models.get(zone.id);
    const moving = () =>
      root.children.filter((m: any) => m.userData.movingBurstIndex !== undefined);
    const capture = () =>
      moving().map((m: any) => ({
        positions: Array.from(m.geometry.getAttribute('position').array),
        tint: Array.from(m.geometry.getAttribute('particleTint').array),
        lookup: Array.from(m.geometry.getAttribute('particleLookupUv').array),
        drawCount: m.geometry.drawRange.count,
      }));
    const first = JSON.stringify(capture()),
      visible = root.visible && moving().some((m: any) => m.geometry.drawRange.count > 0);
    Object.assign(w.hero, { x: -5000, y: -5000, previous: { x: -5000, y: -5000 } });
    w.step(4);
    v.render(w, 1, v.previousElapsed);
    const hidden = !root.visible && moving().every((m: any) => m.geometry.drawRange.count === 0);
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    v.render(w, 1, v.previousElapsed);
    const continued = JSON.stringify(capture()),
      revealed = root.visible && moving().some((m: any) => m.geometry.drawRange.count > 0);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    return {
      visible,
      hidden,
      revealed,
      phaseContinued: continued !== first,
      restoredExactly: JSON.stringify(capture()) === continued,
      snapshotUnchanged: w.snapshot() === saved,
    };
  });
  expect(result).toEqual({
    visible: true,
    hidden: true,
    revealed: true,
    phaseContinued: true,
    restoredExactly: true,
    snapshotUnchanged: true,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-e-hit-regression-burst-fog.json',
    JSON.stringify(result, null, 2) + '\n'
  );
});
