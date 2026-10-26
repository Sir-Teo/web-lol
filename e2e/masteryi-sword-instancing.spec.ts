import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('sword instances preserve reference GPU pixels while reducing actual draw calls', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.goto('/?scene=fixture&champion=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      renderer = g.view.renderer;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    w.gainExperience(1e6);
    for (const ability of ['e', 'r', 'w']) w.learnSpell(ability);
    for (const ability of ['e', 'r'])
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
    w.step();
    const start = w.tick;
    await g.view.swordGlows.load();
    const url = performance
      .getEntriesByType('resource')
      .map((r: any) => r.name)
      .find((s: string) => s.includes('/node_modules/.vite/deps/three.js'));
    const THREE = await import(url),
      { SwordParticleInstances } = await import('/src/render/masteryi-sword-instances.ts');
    const target = new THREE.WebGLRenderTarget(192, 192),
      a = new THREE.Scene(),
      b = new THREE.Scene();
    target.texture.colorSpace = THREE.NoColorSpace;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.001, 1000),
      batches = new SwordParticleInstances(b),
      fullBatches = new SwordParticleInstances(g.view.scene);
    const previous = renderer.getRenderTarget(),
      color = renderer.getClearColor(new THREE.Color()),
      alpha = renderer.getClearAlpha();
    const rows = [],
      coveredFamilies = new Set();
    try {
      for (const tick of [8, 29, 61, 91, 121]) {
        w.step(start + tick - w.tick);
        g.view.render(w, 1, g.view.previousElapsed);
        a.clear();
        b.clear();
        const logical = [...g.view.swordGlows.models.values()].map((m: any) => {
          const c = m.clone();
          c.visible = true;
          return c;
        });
        for (const mesh of logical) {
          a.add(mesh.clone());
          b.add(mesh);
        }
        const bounds = new THREE.Box3().setFromObject(a),
          center = bounds.getCenter(new THREE.Vector3()),
          radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
        for (const angle of [0, 1, 2]) {
          camera.position
            .copy(center)
            .add(
              new THREE.Vector3(
                Math.cos(angle * 2) * radius * 3,
                radius * 1.4,
                Math.sin(angle * 2) * radius * 3
              )
            );
          camera.lookAt(center);
          camera.updateMatrixWorld();
          batches.prepare(logical, camera);
          // Re-add retained batch meshes after the per-sample scene clear.
          for (const batch of batches.batches.values()) b.add(batch.mesh);
          const pixels = [];
          const calls = [];
          for (const scene of [a, b]) {
            renderer.setRenderTarget(target);
            renderer.setClearColor(0, 0);
            renderer.clear();
            renderer.render(scene, camera);
            calls.push(renderer.info.render.calls);
            const bytes = new Uint8Array(192 * 192 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 192, 192, bytes);
            pixels.push(bytes);
          }
          let differences = 0,
            maxDelta = 0,
            nonblack = 0;
          for (let i = 0; i < pixels[0].length; i++) {
            const delta = Math.abs(pixels[0][i] - pixels[1][i]);
            if (delta) differences++;
            maxDelta = Math.max(maxDelta, delta);
            if (pixels[0][i]) nonblack++;
          }
          rows.push({
            tick,
            angle,
            logical: logical.length,
            calls,
            differences,
            maxDelta,
            nonblack,
          });
        }
        {
          const families = [...new Set(logical.map((mesh: any) => mesh.userData.profileIndex))];
          for (const profile of families) {
            if (coveredFamilies.has(profile)) continue;
            const reference = new THREE.Scene(),
              instanced = new THREE.Scene(),
              owner = new SwordParticleInstances(instanced);
            const family = logical
              .filter((mesh: any) => mesh.userData.profileIndex === profile)
              .map((mesh: any) => {
                const clone = mesh.clone();
                clone.visible = true;
                return clone;
              });
            for (const mesh of family) {
              reference.add(mesh.clone());
              instanced.add(mesh);
            }
            const bounds = new THREE.Box3().setFromObject(reference),
              center = bounds.getCenter(new THREE.Vector3()),
              radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
            for (const angle of [0, 1, 2]) {
              camera.position
                .copy(center)
                .add(
                  new THREE.Vector3(
                    Math.cos(angle * 2) * radius * 3,
                    radius * 1.4,
                    Math.sin(angle * 2) * radius * 3
                  )
                );
              camera.lookAt(center);
              camera.updateMatrixWorld();
              owner.prepare(family, camera);
              const pixels = [],
                calls = [];
              for (const scene of [reference, instanced]) {
                renderer.setRenderTarget(target);
                renderer.setClearColor(0, 0);
                renderer.clear();
                renderer.render(scene, camera);
                calls.push(renderer.info.render.calls);
                const bytes = new Uint8Array(192 * 192 * 4);
                renderer.readRenderTargetPixels(target, 0, 0, 192, 192, bytes);
                pixels.push(bytes);
              }
              let differences = 0,
                maxDelta = 0,
                nonblack = 0;
              for (let i = 0; i < pixels[0].length; i++) {
                const delta = Math.abs(pixels[0][i] - pixels[1][i]);
                if (delta) differences++;
                maxDelta = Math.max(maxDelta, delta);
                if (pixels[0][i]) nonblack++;
              }
              rows.push({
                tick,
                angle,
                profile,
                logical: family.length,
                calls,
                differences,
                maxDelta,
                nonblack,
              });
            }
            if (rows.some((row) => row.profile === profile && row.nonblack > 0))
              coveredFamilies.add(profile);
            owner.dispose();
          }
        }
        const source = [...g.view.swordGlows.models.values()];
        const productionBatches = [...g.view.swordGlows.batches.values()].map(
          (batch: any) => batch.mesh
        );
        const originalVisibility = productionBatches.map((mesh: any) => mesh.visible);
        for (const mesh of productionBatches) mesh.visible = false;
        for (const blockerPresent of [false, true]) {
          const blocker = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({
              color: 0xabcdef,
              transparent: true,
              opacity: 0.4,
              depthWrite: false,
              side: THREE.DoubleSide,
            })
          );
          blocker.position.copy(source[0].position);
          if (blockerPresent) g.view.scene.add(blocker);
          const fullPixels = [],
            fullCalls = [];
          for (const mode of ['reference', 'instances']) {
            for (const surface of source) surface.visible = true;
            if (mode === 'instances') fullBatches.prepare(source, g.view.camera);
            renderer.setRenderTarget(target);
            renderer.setClearColor(0, 0);
            renderer.clear();
            renderer.render(g.view.scene, g.view.camera);
            fullCalls.push(renderer.info.render.calls);
            const bytes = new Uint8Array(192 * 192 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 192, 192, bytes);
            fullPixels.push(bytes);
          }
          const activeBatches = [...fullBatches.batches.values()].filter(
            (batch) => batch.mesh.visible
          ).length;
          for (const batch of fullBatches.batches.values()) batch.mesh.visible = false;
          let differences = 0,
            maxDelta = 0,
            nonblack = 0;
          for (let i = 0; i < fullPixels[0].length; i++) {
            const delta = Math.abs(fullPixels[0][i] - fullPixels[1][i]);
            if (delta) differences++;
            maxDelta = Math.max(maxDelta, delta);
            if (fullPixels[0][i]) nonblack++;
          }
          rows.push({
            tick,
            angle: blockerPresent ? -2 : -1,
            logical: source.length,
            calls: fullCalls,
            differences,
            maxDelta,
            nonblack,
            activeBatches,
          });
          blocker.removeFromParent();
          blocker.geometry.dispose();
          blocker.material.dispose();
        }
        productionBatches.forEach((mesh: any, i: number) => (mesh.visible = originalVisibility[i]));
        for (const surface of source) surface.visible = !originalVisibility.some(Boolean);
      }
    } finally {
      batches.dispose();
      fullBatches.dispose();
      target.dispose();
      renderer.setRenderTarget(previous);
      renderer.setClearColor(color, alpha);
      g.view.render(w, 1, g.view.previousElapsed);
    }
    return rows;
  });
  writeFileSync(info.outputPath('instance-pixel-comparison.json'), JSON.stringify(result, null, 2));
  expect(errors).toEqual([]);
  for (const row of result) {
    if (!('profile' in row)) expect(row.nonblack).toBeGreaterThan(0);
    expect(row.differences, JSON.stringify(row)).toBe(0);
    if (row.angle >= 0) {
      expect(row.calls[1]).toBe(1);
      expect(row.calls[0]).toBe(row.logical);
    } else {
      if (row.angle === -2) expect(row.activeBatches).toBe(0);
      expect(row.calls[0] - row.calls[1]).toBe(
        row.activeBatches ? row.logical - row.activeBatches : 0
      );
    }
  }
  const families = result.filter((row) => 'profile' in row);
  expect(new Set(families.map((row) => row.profile)).size).toBe(11);
  for (const profile of new Set(families.map((row) => row.profile)))
    expect(families.some((row) => row.profile === profile && row.nonblack > 0)).toBe(true);
  expect(result.at(-1)!.logical).toBeGreaterThan(150);
  expect(
    result.some((row) => row.angle === -1 && row.logical > 150 && row.activeBatches === 1)
  ).toBe(true);
});
