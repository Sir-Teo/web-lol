import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function fixture(page: Page, team = 'blue') {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate((team) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    const unit = team === 'blue' ? w.hero : w.spawn('champion', 'red', { x: 100, y: 0 }, 'garen');
    unit.hp -= 400;
    w.step(120);
    v.center = { x: unit.x, y: unit.y };
    v.zoom = 0.48;
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const capture = () => {
      const mesh = v.garenPerseverance.models.get(unit.id);
      return mesh
        ? {
            count: mesh.geometry.drawRange.count,
            visible: mesh.visible,
            attributes: Object.fromEntries(
              Object.entries(mesh.geometry.attributes).map(([k, a]: any) => [
                k,
                Array.from(a.array),
              ])
            ),
            indices: Array.from(mesh.geometry.index.array),
          }
        : null;
    };
    const read = () => {
      const gl = v.renderer.getContext(),
        p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p
      );
      return p;
    };
    (window as any).__GAREN_PASSIVE__ = { id: unit.id, capture, read };
  }, team);
}

test('source recovery sparks preserve buffers and pixels through save, seeking and actual graphics loss', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fixture(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__GAREN_PASSIVE__;
    v.render(w, 1, v.previousElapsed);
    s.saved = w.snapshot();
    s.buffers = JSON.stringify(s.capture());
    s.pixels = s.read();
    const mesh = v.garenPerseverance.models.get(s.id);
    mesh.visible = false;
    v.renderer.render(v.scene, v.camera);
    const without = s.read(),
      contribution = without.reduce(
        (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
        0
      );
    v.render(w, 1, v.previousElapsed);
    const copy = w.constructor.fromSnapshot(s.saved, w.battlefield);
    copy.step(60);
    v.render(copy, 1, v.previousElapsed);
    v.render(w, 1, v.previousElapsed);
    const seek = JSON.stringify(s.capture()) === s.buffers;
    return {
      contribution,
      seek,
      particles: mesh.userData.liveParticles,
      count: mesh.geometry.drawRange.count,
    };
  });
  expect(before.contribution).toBeGreaterThan(100);
  expect(before.seek).toBe(true);
  expect(before.particles).toBeGreaterThan(4);
  await page.screenshot({
    path: 'artifacts/garen-passive-source-recovering.png',
    style: '.modal-backdrop {visibility:hidden!important}',
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__GAREN_PASSIVE__;
    v.render(w, 1, v.previousElapsed);
    const pixels = s.read();
    return {
      different: pixels.reduce(
        (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
        0
      ),
      buffers: JSON.stringify(s.capture()) === s.buffers,
      snapshot: w.snapshot() === s.saved,
    };
  });
  expect(after).toEqual({ different: 0, buffers: true, snapshot: true });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/garen-passive-source-recovery.json',
    JSON.stringify({ before, after }, null, 2) + '\n'
  );
});

test('bound sparks enforce current fog and finish their saved death/victory tails with disposal', async ({
  page,
}) => {
  await fixture(page, 'red');
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__GAREN_PASSIVE__,
      unit = w.unit(s.id);
    const visible = w.visible.bind(w),
      pointVisible = w.pointVisible.bind(w);
    w.visible = (u: any, team: any) => (u.id === unit.id ? false : visible(u, team));
    w.pointVisible = () => false;
    v.render(w, 1, v.previousElapsed);
    const hidden = s.capture();
    w.step(17);
    w.visible = visible;
    w.pointVisible = pointVisible;
    v.render(w, 1, v.previousElapsed);
    const current = JSON.stringify(s.capture()),
      copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = JSON.stringify(s.capture()) === current;
    w.damage(w.hero, unit, 1e6, 'true');
    const stopped = w.championState(unit.id).garenPassiveVisuals[0],
      at = { ...stopped.point };
    unit.x += 1000;
    unit.y += 1000;
    v.render(w, 1, v.previousElapsed);
    const frozen = w.championState(unit.id).garenPassiveVisuals[0].point;
    let disposed = 0;
    const mesh = v.garenPerseverance.models.get(unit.id);
    mesh.geometry.addEventListener('dispose', () => disposed++);
    mesh.material.addEventListener('dispose', () => disposed++);
    w.step(183);
    v.render(w, 1, v.previousElapsed);
    const death = {
      disposed,
      models: v.garenPerseverance.models.size,
      records: w.championState(unit.id).garenPassiveVisuals.length,
    };
    // Exercise the actual winner branch on a new source interval.
    w.hero.hp -= 200;
    w.step(100);
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      active = v.garenPerseverance.models.size;
    v.garenPerseverance.update(w, 1, 4);
    return {
      hidden: !hidden.visible && hidden.count === 0,
      restored,
      frozen: JSON.stringify(at) === JSON.stringify(frozen),
      death,
      terminal: {
        active,
        drained: v.garenPerseverance.models.size === 0,
        unchanged: w.snapshot() === saved,
      },
    };
  });
  expect(result.hidden).toBe(true);
  expect(result.restored).toBe(true);
  expect(result.frozen).toBe(true);
  expect(result.death).toEqual({ disposed: 2, models: 0, records: 0 });
  expect(result.terminal).toEqual({ active: 1, drained: true, unchanged: true });
  writeFileSync(
    'artifacts/garen-passive-source-lifecycle.json',
    JSON.stringify(result, null, 2) + '\n'
  );
});

test('one source batch matches separate arbitrary quads across sustained emission and stopped tails', async ({
  page,
}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'),
      { garenPassiveParticles } = await import('/src/render/garen-passive-particles.ts'),
      { createParticleColorProductMaterial } =
        await import('/src/render/particle-color-product.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__GAREN_PASSIVE__,
      unit = w.unit(s.id);
    const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x121212, 1);
    const camera = v.camera.clone();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    const read = () => {
      const gl = renderer.getContext(),
        p = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return p;
    };
    for (const tick of [2, 11, 31, 61, 91, 121, 181, 301, 601, 660, 720, 783, 873]) {
      const copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield),
        u = copy.unit(unit.id);
      copy.tick = tick;
      const records = [
        {
          startTick: 1,
          stopTick: tick >= 660 ? 650 : null,
          point: tick >= 660 ? { x: u.x, y: u.y } : null,
        },
      ];
      copy.championState(unit.id).garenPassiveVisuals = records;
      v.garenPerseverance.update(copy, 1);
      const mesh = v.garenPerseverance.models.get(unit.id),
        scene = new T.Scene();
      const samples = garenPassiveParticles(unit.id, records, tick);
      if (mesh) scene.add(mesh.clone());
      renderer.render(scene, camera);
      const batched = read(),
        batchCalls = renderer.info.render.calls;
      scene.clear();
      if (mesh)
        for (const particle of samples) {
          const geo = new T.PlaneGeometry(2, 2),
            uv = geo.getAttribute('uv');
          for (let i = 0; i < 4; i++) {
            const a = uv.getX(i),
              b = uv.getY(i);
            uv.setXY(i, b, 1 - a);
          }
          const material = createParticleColorProductMaterial(
            mesh.material.uniforms.sourceTexture.value,
            mesh.material.uniforms.particleColorTexture.value
          );
          Object.assign(material, {
            side: T.DoubleSide,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            forceSinglePass: true,
            blending: T.CustomBlending,
            blendEquation: T.AddEquation,
            blendSrc: T.SrcAlphaFactor,
            blendDst: T.OneFactor,
          });
          material.uniforms.particleColor.value.fromArray(particle.color);
          material.uniforms.lookupUv.value.fromArray(particle.lookup);
          const quad = new T.Mesh(geo, material),
            at = particle.point ?? u;
          quad.position.set(
            (at.x + particle.offset[0]) * 0.01,
            v.ground(at) + particle.offset[1] * 0.01,
            (at.y + particle.offset[2]) * 0.01
          );
          quad.scale.set(particle.scale[0] * 0.01, particle.scale[1] * 0.01, 1);
          scene.add(quad);
        }
      renderer.render(scene, camera);
      const separate = read(),
        separateCalls = renderer.info.render.calls;
      let delta = 0;
      for (let i = 0; i < separate.length; i++)
        delta = Math.max(delta, Math.abs(separate[i] - batched[i]));
      for (const child of scene.children as any[]) {
        child.geometry.dispose();
        child.material.dispose();
      }
      (window as any).__PASSIVE_GPU_SAMPLES__ ??= [];
      (window as any).__PASSIVE_GPU_SAMPLES__.push({
        tick,
        particles: samples.length,
        delta,
        batchCalls,
        separateCalls,
      });
    }
    const results = (window as any).__PASSIVE_GPU_SAMPLES__;
    renderer.dispose();
    renderer.forceContextLoss();
    v.render(w, 1, v.previousElapsed);
    return results;
  });
  expect(result).toHaveLength(13);
  expect(result.every((r: any) => r.delta <= 1)).toBe(true);
  expect(result.some((r: any) => r.separateCalls > 8 && r.batchCalls === 1)).toBe(true);
  writeFileSync(
    'artifacts/garen-passive-source-batch.json',
    JSON.stringify(result, null, 2) + '\n'
  );
});
