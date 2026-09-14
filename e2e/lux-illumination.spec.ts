import { expect, test } from '@playwright/test';

test('queued Lux Q leaves a visible mark after root ends, and her attack consumes it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('dummy', 'red', { x: 200, y: 0 });
    Object.assign(target, { hp: 5000, maxHp: 5000, armor: 0, magicResist: 0 });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
    w.step(145);
    g.view.render(w, 1, performance.now() / 1000);
    const cloud = g.view.luxIllumination.models.get(`${target.id}:${lux.id}`);
    if (!cloud || cloud.meshes.slice(0, 3).some((m: any) => !m.geometry.drawRange.count))
      throw new Error('Q mark did not render its live starburst/ray layers');
    if (cloud.root.userData.attachment !== 'local-centre-fallback')
      throw new Error('Procedural dummy must use the documented local fallback');
    return { lux: lux.id, target: target.id };
  });
  await expect(page.locator(`.unit-bar[data-unit="${ids.target}"] .unit-status`)).toHaveText(
    'ILLUMINATED'
  );
  await page.screenshot({ path: 'artifacts/browser-lux-illumination-gameplay.png' });
  const result = await page.evaluate(({ lux, target }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const before = w.unit(target).hp;
    w.enqueue({ type: 'order', unit: lux, order: { type: 'attack', target } });
    w.step(30);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      damage: before - w.unit(target).hp,
      marks: w.unit(target).illumination.length,
      clouds: g.view.luxIllumination.models.size,
    };
  }, ids);
  expect(result).toEqual({ damage: 84, marks: 0, clouds: 0 });
  await expect(page.locator(`.unit-bar[data-unit="${ids.target}"] .unit-status`)).toHaveText('');
  expect(errors).toEqual([]);
});

test('Illumination follows the live rig, respects fog, restores exactly, and releases removed clouds', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { luxHitBone } = await import('/src/render/lux-hit-bone.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('champion', 'red', { x: 200, y: 0 }, 'ashe');
    target.hp = target.maxHp = 5000;
    for (const u of w.units) w.setOrder(u, { type: 'idle' });
    w.applyIllumination(lux, target);
    w.step(13);
    const key = `${target.id}:${lux.id}`;
    const render = () => v.render(w, 1, v.previousElapsed);
    const cloud = () => v.luxIllumination.models.get(key);
    const positions = () =>
      cloud().meshes.map((m: any) => [...m.geometry.attributes.position.array]);
    const center = () => {
      const a = cloud().meshes[0].geometry.attributes.position.array;
      return [0, 1, 2].map((axis) => (a[axis] + a[6 + axis]) / 2);
    };
    const bone = () =>
      luxHitBone(v.models.get(target.id).root, false)!
        .getWorldPosition(new THREE.Vector3())
        .toArray();
    v.center = { x: target.x, y: target.y };
    v.zoom = 0.55;
    render();
    const initial = {
      counts: cloud().meshes.map((m: any) => m.geometry.drawRange.count),
      attachment: cloud().root.userData.attachment,
      center: center(),
      bone: bone(),
    };
    w.setOrder(target, { type: 'move', point: { x: 600, y: 0 } });
    w.step(3);
    render();
    const moved = { center: center(), bone: bone() };
    w.setOrder(target, { type: 'idle' });
    render();
    const beforeFog = positions();
    const sources = [w.hero, lux].map((u) => ({ u, x: u.x, y: u.y, previous: u.previous }));
    for (const { u } of sources)
      Object.assign(u, { x: -10000, y: -10000, previous: { x: -10000, y: -10000 } });
    render();
    const hidden = {
      visible: w.visible(target),
      clouds: v.luxIllumination.models.size,
      marks: target.illumination.length,
    };
    for (const { u, x, y, previous } of sources) Object.assign(u, { x, y, previous });
    render();
    const revealedExactly = JSON.stringify(positions()) === JSON.stringify(beforeFog);
    const saved = w.snapshot();
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    v.luxIllumination.update(restored, 1, v.camera, v.models);
    const restoredExactly = JSON.stringify(positions()) === JSON.stringify(beforeFog);
    const oldStart = cloud().root.userData.startTick;
    w.applyIllumination(lux, target);
    render();
    const refresh = {
      oldStart,
      start: cloud().root.userData.startTick,
      tick: w.tick,
      clouds: v.luxIllumination.models.size,
      counts: cloud().meshes.map((m: any) => m.geometry.drawRange.count),
    };
    w.step(13);
    render();
    w.damage(target, lux, 1e6, 'true');
    render();
    const casterDeath = { alive: w.alive(lux), clouds: v.luxIllumination.models.size };
    target.illumination[0].endTick = w.tick;
    render();
    const expired = v.luxIllumination.models.size;
    // Repeated visible apply/remove cycles must release per-cloud GPU allocations.
    const memory = () => ({
      geometries: v.renderer.info.memory.geometries,
      textures: v.renderer.info.memory.textures,
    });
    const baseline = memory();
    for (let i = 0; i < 12; i++) {
      target.illumination = [{ sourceId: lux.id, endTick: w.tick + 347 }];
      render();
      target.illumination = [];
      render();
    }
    const afterCycles = memory();
    target.illumination = [{ sourceId: lux.id, endTick: w.tick + 347 }];
    render();
    w.damage(w.hero, target, 1e6, 'true');
    render();
    const targetDeath = { alive: w.alive(target), clouds: v.luxIllumination.models.size };
    return {
      initial,
      moved,
      hidden,
      revealedExactly,
      restoredExactly,
      refresh,
      casterDeath,
      expired,
      baseline,
      afterCycles,
      targetDeath,
    };
  });
  expect(result.initial.counts.every((n: number) => n > 0)).toBe(true);
  expect(result.initial.attachment.toLowerCase()).toBe('c_buffbone_glb_center_loc');
  for (const sample of [result.initial, result.moved])
    for (let axis = 0; axis < 3; axis++)
      expect(sample.center[axis]).toBeCloseTo(sample.bone[axis], 5);
  expect(result.moved.center).not.toEqual(result.initial.center);
  expect(result.hidden).toEqual({ visible: false, clouds: 0, marks: 1 });
  expect(result.revealedExactly).toBe(true);
  expect(result.restoredExactly).toBe(true);
  expect(result.refresh.start).toBe(result.refresh.tick);
  expect(result.refresh.start).toBeGreaterThan(result.refresh.oldStart);
  expect(result.refresh.clouds).toBe(1);
  expect(result.refresh.counts).toEqual([0, 0, 0, 0]);
  expect(result.casterDeath).toEqual({ alive: false, clouds: 1 });
  expect(result.expired).toBe(0);
  expect(result.afterCycles).toEqual(result.baseline);
  expect(result.targetDeath).toEqual({ alive: false, clouds: 0 });
  expect(errors).toEqual([]);
});
