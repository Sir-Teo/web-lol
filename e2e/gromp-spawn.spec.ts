import { expect, test } from '@playwright/test';

test('Rift emergence preserves the source pose through protected reload and exact readiness', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const prelude = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { GROMP_FIRST_SPAWN_TICK } = await import('/src/content/rift-gromp-camps.ts');
    const { GROMP_SPAWN_LEADUP_TICKS } = await import('/src/content/gromp.ts');
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units) u.ai = false;
    w.tick = GROMP_FIRST_SPAWN_TICK - GROMP_SPAWN_LEADUP_TICKS - 1;
    w.step();
    const unit = w.unit(w.jungleCamps[0].unitIds[0]),
      spawn = structuredClone(unit.monster.spawn);
    const point = w.battlefield.reachable({ x: unit.x + 300, y: unit.y }, w.hero.radius, 'blue');
    Object.assign(w.hero, point, { previous: { ...point } });
    w.step(90);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const model = g.view.models.get(unit.id),
      vertices: number[][] = [];
    const shown = model.spawnSubmeshes.filter((m: any) => m.visible).length;
    const renderer = g.view.renderer,
      gl = renderer.getContext();
    const a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
      b = new Uint8Array(a.length);
    renderer.render(g.view.scene, g.view.camera);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      a
    );
    for (const mesh of model.spawnSubmeshes) mesh.visible = false;
    renderer.render(g.view.scene, g.view.camera);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      b
    );
    for (const mesh of model.spawnSubmeshes) mesh.visible = true;
    renderer.render(g.view.scene, g.view.camera);
    let spawnPixels = 0;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) spawnPixels++;
    model.root.traverse((o: any) => {
      if (!o.isSkinnedMesh || o.material.userData.sourceSubmesh !== 'Toad_Mat') return;
      for (const i of [0, 100, 1000, 3000])
        vertices.push(o.getVertexPosition(i, o.position.clone()).toArray());
    });
    const hp = unit.hp;
    for (const type of ['physical', 'magic', 'true']) w.damage(w.hero, unit, 99999, type);
    return {
      id: unit.id,
      spawn,
      vertices,
      unchangedHp: unit.hp === hp,
      phase: unit.monster.phase,
      vulnerable: w.vulnerable(unit),
      action: model.actionName,
      clipTime: unit.animationTimeline.primary.time,
      hiddenOther: !g.view.models.get(w.jungleCamps[1].unitIds[0]).root.visible,
      shown,
      spawnPixels,
    };
  });
  expect(prelude.phase).toBe('spawning');
  expect(prelude.vulnerable).toBe(false);
  expect(prelude.unchangedHp).toBe(true);
  expect(prelude.hiddenOther).toBe(true);
  expect(prelude.action).toBe('spawn');
  expect(prelude.clipTime).toBe(1.5);
  expect(prelude.vertices).toHaveLength(4);
  expect(prelude.shown).toBe(1);
  expect(prelude.spawnPixels).toBeGreaterThan(10);
  await page.screenshot({ path: 'artifacts/gromp-spawn-protected.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  const resumed = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      unit = w.unit(id);
    g.view.render(w, 1, g.view.previousElapsed);
    const vertices: number[][] = [];
    g.view.models.get(id).root.traverse((o: any) => {
      if (!o.isSkinnedMesh || o.material.userData.sourceSubmesh !== 'Toad_Mat') return;
      for (const i of [0, 100, 1000, 3000])
        vertices.push(o.getVertexPosition(i, o.position.clone()).toArray());
    });
    return { vertices, spawn: unit.monster.spawn, phase: unit.monster.phase };
  }, prelude.id);
  expect(resumed).toEqual({ vertices: prelude.vertices, spawn: prelude.spawn, phase: 'spawning' });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const ready = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      unit = w.unit(id);
    g.setPaused(true);
    w.step(unit.monster.spawn.readyTick - w.tick - 1);
    const before = w.vulnerable(unit);
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      before,
      after: w.vulnerable(unit),
      phase: unit.monster.phase,
      action: g.view.models.get(id).actionName,
      time: unit.animationTimeline.primary.time,
    };
  }, prelude.id);
  expect(ready).toEqual({ before: false, after: true, phase: 'idle', action: 'spawn', time: 3.2 });
  await page.screenshot({ path: 'artifacts/gromp-spawn-ready.png' });
  const finished = await page.evaluate(async (id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      unit = w.unit(id);
    const { GROMP_SPAWN_CLIP_TICKS } = await import('/src/content/gromp.ts');
    w.step(unit.monster.spawn.startTick + GROMP_SPAWN_CLIP_TICKS - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      clock: unit.monster.spawn,
      clip: g.view.models.get(id).actionName,
      transition: unit.animationTimeline.transition,
      shown: g.view.models.get(id).spawnSubmeshes.filter((m: any) => m.visible).length,
    };
  }, prelude.id);
  expect(finished).toEqual({ clock: null, clip: 'idle1', transition: null, shown: 0 });
  expect(errors).toEqual([]);
});
