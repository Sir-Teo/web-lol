import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('source E flight, team perimeter and burst reconstruct exactly from saved phases and retire owned resources', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
    target.hp = target.maxHp = 5000;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step(23);
    g.view.center = { x: 300, y: 0 };
    g.view.zoom = 0.55;
    (window as any).__SOURCE_E__ = { lux: lux.id, target: target.id, samples: [] };
    return { lux: lux.id };
  });
  const sample = async (phase: string) =>
    page.evaluate((phase) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view,
        state = (window as any).__SOURCE_E__;
      v.render(w, 1, v.previousElapsed);
      g.hud.update(60);
      const snapshot = w.snapshot(),
        zone = w.singularities[0];
      const capture = () =>
        v.luxSingularities.models.get(zone.id).children.map((m: any) => ({
          name: m.name,
          radii: m.name.includes('teamring')
            ? Array.from({ length: m.geometry.getAttribute('position').count }, (_, i) => {
                const p = m.geometry.getAttribute('position');
                return Math.hypot(p.getX(i) * 100 - zone.x, p.getZ(i) * 100 - zone.y);
              })
            : [],
          positions: Array.from({ length: m.geometry.getAttribute('position').count }, (_, i) => {
            const p = m.geometry.getAttribute('position');
            return [p.getX(i), p.getY(i), p.getZ(i)];
          }).flat(),
          index: Array.from(m.geometry.index.array),
          drawCount: m.geometry.drawRange.count,
          tint: m.material.uniforms.particleColor.value.toArray(),
          offset: m.material.uniforms.multOffset.value.toArray(),
        }));
      const before = capture(),
        copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
      v.render(copy, 1, v.previousElapsed);
      const restored = JSON.stringify(capture()) === JSON.stringify(before);
      v.render(w, 1, v.previousElapsed);
      const repeated = JSON.stringify(capture()) === JSON.stringify(before);
      const result = {
        phase,
        layers: before.map((m: any) => ({
          name: m.name,
          corners: m.positions.length / 3,
          drawCount: m.drawCount,
          minimumRadius: m.radii.length ? Math.min(...m.radii) : null,
          maximumRadius: m.radii.length ? Math.max(...m.radii) : null,
        })),
        restored,
        repeated,
        snapshotUnchanged: w.snapshot() === snapshot,
      };
      state.samples.push(result);
      return result;
    }, phase);
  const flight = await sample('flight');
  expect(flight.layers).toHaveLength(6);
  expect(flight.restored && flight.repeated && flight.snapshotUnchanged).toBe(true);
  expect(flight.layers.some((m: any) => m.name.includes('teamring'))).toBe(false);
  await page.screenshot({ path: 'artifacts/lux-e-source-flight.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(70);
  });
  const field = await sample('armed');
  expect(field.layers).toHaveLength(5);
  expect(field.restored && field.repeated && field.snapshotUnchanged).toBe(true);
  const perimeter = field.layers.find((m: any) => m.name.includes('teamring'))!;
  expect(perimeter.corners).toBe(1440);
  expect(perimeter.drawCount).toBe(1440);
  expect(perimeter.minimumRadius).toBeCloseTo(302.69735, 2);
  expect(perimeter.maximumRadius).toBeCloseTo(366.64403, 2);
  await page.screenshot({ path: 'artifacts/lux-e-source-armed.png' });
  await page.evaluate((lux) => {
    const w = (window as any).__GAME__.world;
    w.enqueue({ type: 'cast', unit: lux, ability: 'e', point: w.unit(lux) });
    w.step(7);
  }, setup.lux);
  const burst = await sample('burst');
  expect(burst.layers).toHaveLength(6);
  expect(burst.restored && burst.repeated && burst.snapshotUnchanged).toBe(true);
  expect(burst.layers.some((m: any) => m.name.includes('teamring'))).toBe(false);
  await page.screenshot({ path: 'artifacts/lux-e-source-burst.png' });
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      zone = w.singularities[0],
      model = v.luxSingularities.models.get(zone.id);
    const resources = model.children.length * 2;
    let disposed = 0;
    for (const child of model.children) {
      child.geometry.addEventListener('dispose', () => disposed++);
      child.material.addEventListener('dispose', () => disposed++);
    }
    const hp = w.unit((window as any).__SOURCE_E__.target).hp;
    w.step(60);
    v.render(w, 1, v.previousElapsed);
    return {
      resources,
      disposed,
      zones: w.singularities.length,
      models: v.luxSingularities.models.size,
      hpUnchanged: w.unit((window as any).__SOURCE_E__.target).hp === hp,
    };
  });
  expect(retired.resources).toBeGreaterThan(0);
  expect(retired.disposed).toBe(retired.resources);
  expect(retired).toMatchObject({ zones: 0, models: 0, hpUnchanged: true });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-e-source.json',
    JSON.stringify({ flight, field, burst, retired }, null, 2) + '\n'
  );
});

test('enemy source field uses its red perimeter, disappears under fog and returns at its saved age', async ({
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
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(75);
    v.center = { x: 450, y: 0 };
    v.render(w, 1, v.previousElapsed);
    const zone = w.singularities[0],
      model = v.luxSingularities.models.get(zone.id),
      ring = model.getObjectByName('Lucent enemy 16 teamring_circle');
    const visible = model.visible,
      texture = ring.material.uniforms.sourceTexture.value.image.src;
    Object.assign(w.hero, { x: -5000, y: -5000, previous: { x: -5000, y: -5000 } });
    w.step(30);
    v.render(w, 1, v.previousElapsed);
    const hidden = !model.visible,
      empty = ring.geometry.drawRange.count === 0;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    v.render(w, 1, v.previousElapsed);
    const actual = ring.material.uniforms.particleColor.value.toArray();
    const now = w.snapshot(),
      copy = w.constructor.fromSnapshot(now, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    return {
      visible,
      texture,
      hidden,
      empty,
      revealed: model.visible,
      red: actual[0] > actual[1],
      sameSavedAge:
        JSON.stringify(actual) ===
        JSON.stringify(ring.material.uniforms.particleColor.value.toArray()),
      snapshotUnchanged: w.snapshot() === now,
    };
  });
  expect(
    result.visible &&
      result.hidden &&
      result.empty &&
      result.revealed &&
      result.red &&
      result.sameSavedAge &&
      result.snapshotUnchanged
  ).toBe(true);
  expect(result.texture).toContain('lux_base_e_indicator_red.png');
  expect(errors).toEqual([]);
});

test('all twenty source materials preserve GPU color products, locked alpha, erosion and separate framebuffer blends', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createLuxEMaterial } = await import('/src/render/lux-e-source.ts');
    const profiles = (await import('/src/content/lux-e-particles.json')).default;
    const renderer = new THREE.WebGLRenderer({ antialias: false, premultipliedAlpha: false });
    renderer.setSize(1, 1);
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    renderer.setRenderTarget(target);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;
    const scene = new THREE.Scene(),
      geometry = new THREE.PlaneGeometry(2, 2),
      clear = [0.2, 0.4, 0.6, 0.8];
    const texture = (bytes: number[], width = 1) => {
      const t = new THREE.DataTexture(new Uint8Array(bytes), width, 1);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.colorSpace = THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const results = [];
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i],
        white = texture([255, 255, 255, 255]),
        base = texture([128, 64, 192, 64, 64, 192, 128, 192], 2),
        palette = texture([32, 128, 64, 255]);
      const paths = [
        p.texture,
        p.lookup,
        p.mult,
        p.palette?.texture ?? '',
        p.erosion?.texture ?? '',
      ];
      const textures = new Map(paths.map((path: string) => [path, white]));
      textures.set(p.texture, base);
      if (p.palette) textures.set(p.palette.texture, palette);
      const m = createLuxEMaterial(i, textures),
        tint = [0.5, 0.25, 0.75, 0.5];
      if (p.blend === 0 || p.blend === 2) {
        for (let a = 0; a < 3; a++) tint[a] *= tint[3];
        if (p.blend === 0) tint[3] = 1;
      }
      m.uniforms.particleColor.value.fromArray(tint);
      m.uniforms.erosionDrive.value = 0.25;
      if (p.uvMode === 2) m.uniforms.sourceUvOffset.value.set(0.5, 0);
      const mesh = new THREE.Mesh(geometry, m);
      scene.add(mesh);
      const rgb = p.palette ? [32, 128, 64] : p.uvMode === 2 ? [128, 64, 192] : [64, 192, 128];
      const product = [
        ...rgb.map((v: number, a: number) => (v / 255) * tint[a]),
        (192 / 255) * tint[3] * (p.erosion ? 0.75 : 1),
      ];
      const render = () => {
        renderer.setClearColor(new THREE.Color(...clear.slice(0, 3)), clear[3]);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
        return [...pixels];
      };
      const blend = m.blending;
      m.blending = THREE.NoBlending;
      const raw = render();
      m.blending = blend;
      const blended = render();
      const expected =
        p.blend === 2
          ? clear.map((v, a) => v * (1 - product[a]))
          : clear.map((v, a) => v + product[a] * (p.blend === 0 ? 1 : product[3]));
      const close = (actual: number[], wanted: number[]) =>
        actual.every(
          (v, a) => Math.abs(v - Math.round(Math.min(1, Math.max(0, wanted[a])) * 255)) <= 2
        );
      results.push({
        role: p.role,
        name: p.name,
        raw,
        blended,
        productCorrect: close(raw, product),
        blendCorrect: close(blended, expected),
      });
      mesh.removeFromParent();
      m.dispose();
      base.dispose();
      white.dispose();
      palette.dispose();
    }
    geometry.dispose();
    target.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(20);
  expect(results.filter((r: any) => !r.productCorrect || !r.blendCorrect)).toEqual([]);
  writeFileSync('artifacts/lux-e-source-gpu.json', JSON.stringify(results, null, 2) + '\n');
});
