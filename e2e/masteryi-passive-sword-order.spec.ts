import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('actual passive trails preserve full-scene sword reference pixels across camera angles', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto('/?scene=fixture&champion=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    w.gainExperience(1e6);
    for (const ability of ['e', 'r']) {
      w.learnSpell(ability);
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
    }
    w.step();
    const victim = w.spawn('dummy', 'red', { x: 150, y: 0 });
    victim.ai = false;
    victim.hp = victim.maxHp = 1e6;
    for (let i = 0; i < 4; i++) {
      w.setOrder(w.hero, { type: 'attack', target: victim.id });
      w.step(Math.max(1, w.hero.nextAttackTick - w.tick + 1));
      w.step(w.hero.releaseTick - w.tick);
      w.setOrder(w.hero, { type: 'idle' });
      if (w.player.passiveTrailVisuals.length) break;
    }
    const helper = await import('/src/simulation/masteryi-passive-trails.ts'),
      record = w.player.passiveTrailVisuals.at(-1);
    if (!record) throw Error('Missing accepted child');
    w.step(helper.passiveTrailMarkerTick(record, 1) + 2 - w.tick);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    const passive = [...g.view.passiveTrails.models.values()];
    if (passive.length !== 2) throw Error('Both actual passive events must be present');
    const url = performance
        .getEntriesByType('resource')
        .map((r: any) => r.name)
        .find((s: string) => s.includes('/node_modules/.vite/deps/three.js')),
      THREE = await import(url),
      { SwordParticleInstances } = await import('/src/render/masteryi-sword-instances.ts'),
      source = [...g.view.swordGlows.models.values()],
      production = [...g.view.swordGlows.batches.values()].map((b: any) => b.mesh),
      originalVisibility = production.map((m: any) => m.visible),
      owner = new SwordParticleInstances(g.view.scene),
      renderer = g.view.renderer,
      target = new THREE.WebGLRenderTarget(192, 192),
      previousTarget = renderer.getRenderTarget(),
      clear = renderer.getClearColor(new THREE.Color()),
      clearAlpha = renderer.getClearAlpha(),
      rows = [];
    if (!source.length) throw Error('No E/R sword source surfaces');
    target.texture.colorSpace = THREE.NoColorSpace;
    production.forEach((m: any) => (m.visible = false));
    const center = g.view.models.get(w.hero.id).root.getWorldPosition(new THREE.Vector3()),
      originalOffset = g.view.camera.position.clone().sub(center);
    try {
      for (const angle of [0, 0.8, 1.6]) {
        const camera = g.view.camera.clone();
        camera.position
          .copy(center)
          .add(originalOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle));
        camera.lookAt(center);
        camera.updateMatrixWorld();
        const pixels = [],
          calls = [];
        for (const mode of ['reference', 'instances']) {
          for (const mesh of source) mesh.visible = true;
          if (mode === 'instances') owner.prepare(source, camera);
          renderer.setRenderTarget(target);
          renderer.setClearColor(0, 0);
          renderer.clear();
          renderer.render(g.view.scene, camera);
          calls.push(renderer.info.render.calls);
          const bytes = new Uint8Array(192 * 192 * 4);
          renderer.readRenderTargetPixels(target, 0, 0, 192, 192, bytes);
          pixels.push(bytes);
        }
        const activeBatches = [...owner.batches.values()].filter((b: any) => b.mesh.visible).length;
        for (const batch of owner.batches.values()) batch.mesh.visible = false;
        let differences = 0,
          nonblack = 0;
        for (let i = 0; i < pixels[0].length; i++) {
          if (pixels[0][i] !== pixels[1][i]) differences++;
          if (i % 4 !== 3 && pixels[0][i]) nonblack++;
        }
        rows.push({ angle, differences, nonblack, calls, activeBatches });
      }
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clear, clearAlpha);
      owner.dispose();
      target.dispose();
      production.forEach((mesh: any, i: number) => (mesh.visible = originalVisibility[i]));
      g.view.render(w, 1, g.view.previousElapsed);
    }
    return {
      rows,
      passiveProfiles: passive.map((m: any) => m.userData.profileIndex).sort(),
      swordSurfaces: source.length,
    };
  });
  expect(result.passiveProfiles).toEqual([0, 1]);
  expect(result.swordSurfaces).toBeGreaterThan(0);
  for (const row of result.rows) {
    expect(row.differences).toBe(0);
    expect(row.nonblack).toBeGreaterThan(0);
  }
  writeFileSync(info.outputPath('passive-sword-gpu-order.json'), JSON.stringify(result, null, 2));
});
