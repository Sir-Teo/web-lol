import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    g.hud.root.querySelector('.welcome')?.remove();
  });
}
async function poses(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.garenDecisiveStrike.models.entries()]
      .filter(([, m]: any) => m.userData.groundProfileIndex !== undefined)
      .map(([key, m]: any) => ({
        key,
        index: m.userData.groundProfileIndex,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        uvScale: m.material.uniforms.sourceUvScale.value.toArray(),
        uvOffset: m.material.uniforms.sourceUvOffset.value.toArray(),
        born: m.userData.bornTick,
        event: m.userData.eventTick,
      }));
  });
}
async function checkpoint(page: Page) {
  const save = page.getByRole('button', { name: 'Save match', exact: true });
  if (!(await save.isVisible()))
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await save.click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
}

test('source jump and all four landing layers retain event anchors and exact checkpoints, then dispose materials after death', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.learnSpell('q');
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(5);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  const jump = await poses(page);
  expect(jump).toHaveLength(2);
  expect(jump.every((p) => p.index === 0)).toBe(true);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.camera.zoom = 2.5;
    g.view.camera.updateProjectionMatrix();
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-q-jump.png' });
  await checkpoint(page);
  expect(await poses(page)).toEqual(jump);
  const event = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = w.player.garenQVisuals[0].attacks[0];
    g.hud.root.querySelector('[data-action="resume"]')?.click();
    g.setPaused(true);
    const at = Math.ceil(a.startTick + (a.releaseTick - a.startTick) * 0.9 - 1e-5);
    w.step(at - w.tick - 1);
    Object.assign(w.hero, { x: 40, y: 20, previous: { x: 40, y: 20 } });
    w.step(9);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const meshes = [...g.view.garenDecisiveStrike.models.values()] as any[];
    const alignments = meshes
      .filter((m) => m.userData.groundProfileIndex === 1)
      .map((m) => {
        const e = m.matrixWorld.elements,
          dx = m.position.x - 0.4,
          dz = m.position.z - 0.2;
        return (e[4] * dx + e[6] * dz) / (Math.hypot(e[4], e[5], e[6]) * Math.hypot(dx, dz));
      });
    return { landing: a.landing, ground: g.view.ground(a.landing.point), alignments };
  });
  expect(event.landing.point).toEqual({ x: 40, y: 20 });
  expect(event.alignments).toHaveLength(40);
  event.alignments.forEach((dot: number) => expect(dot).toBeCloseTo(1));
  const land = await poses(page);
  expect([1, 2, 3, 4].map((i) => land.filter((p) => p.index === i).length)).toEqual([40, 5, 20, 3]);
  const decal = land.find((p) => p.index === 4)!;
  expect(decal.position).toEqual([0.4, event.ground + 0.03, 0.2]);
  expect(decal.born - event.landing.tick).toBe(6);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.camera.zoom = 2.5;
    g.view.camera.updateProjectionMatrix();
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-q-land.png' });
  await checkpoint(page);
  expect(await poses(page)).toEqual(land);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, { x: 1000, y: 2000, previous: { x: 1000, y: 2000 }, facing: 2 });
    w.damage(w.hero, w.hero, 1e6, 'true');
  });
  expect(await poses(page)).toEqual(land);
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    let materials = 0,
      geometry = 0;
    for (const m of g.view.garenDecisiveStrike.models.values())
      if (m.userData.groundProfileIndex !== undefined) {
        m.material.addEventListener('dispose', () => materials++);
        m.geometry.addEventListener('dispose', () => geometry++);
      }
    w.step(100);
    g.view.render(w, 1, g.view.previousElapsed);
    return { materials, geometry, error: g.view.renderer.getContext().getError() };
  });
  expect(retired).toEqual({ materials: land.length, geometry: 0, error: 0 });
  expect(await poses(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('landing survives loss after frame 9, is suppressed before dispatch and has finite match-end tails', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    const first = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: first.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.damage(w.hero, first, 1e6, 'true');
    w.step(40);
    const missing = w.player.garenQVisuals[0].attacks[0].landing;
    w.player.cooldowns.q = 0;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const a = w.player.garenQVisuals.at(-1).attacks[0],
      at = Math.ceil(a.startTick + (a.releaseTick - a.startTick) * 0.9 - 1e-5);
    w.step(at - w.tick);
    w.damage(w.hero, target, 1e6, 'true');
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const count = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.groundProfileIndex > 0
      ).length;
    const before = count();
    w.damage(w.hero, w.spawn('nexus', 'red', { x: 500, y: 0 }), 1e6, 'true');
    const saved = w.snapshot();
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models, 8 / 60);
    const tail = count();
    w.step(100);
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models, 2);
    return {
      missing,
      impact: a.impact,
      landing: a.landing,
      before,
      tail,
      final: count(),
      unchanged: w.snapshot() === saved,
    };
  });
  expect(result.missing).toBeNull();
  expect(result.impact).toBeNull();
  expect(result.landing).not.toBeNull();
  expect(result.before).toBe(65);
  expect(result.tail).toBe(68);
  expect(result.final).toBe(0);
  expect(result.unchanged).toBe(true);
});

test('enemy ground particles use actual point visibility with a hidden caster and reveal their current phase', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('q', enemy.id);
    w.setOrder(enemy, { type: 'attack', target: w.hero.id });
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step();
    // Begin inside melee range before commitment if chasing required.
    w.step(25);
    const a = w.championState(enemy.id).garenQVisuals[0].attacks[0];
    const at = Math.ceil(a.startTick + (a.releaseTick - a.startTick) * 0.9 - 1e-5);
    if (w.tick < at + 8) w.step(at + 8 - w.tick);
    const meshes = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.groundProfileIndex > 0
      ) as any[];
    g.view.render(w, 1, g.view.previousElapsed);
    const first = meshes().length;
    Object.assign(enemy, { x: 3000, y: 0, previous: { x: 3000, y: 0 } });
    w.setOrder(enemy, { type: 'idle' });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const withoutCaster = meshes().length,
      casterVisible = w.visible(enemy),
      phase = meshes().find((m) => m.userData.groundProfileIndex === 2).scale.x;
    let disposed = 0;
    meshes().forEach((m) => m.material.addEventListener('dispose', () => disposed++));
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = meshes().length;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      first,
      withoutCaster,
      casterVisible,
      phase,
      disposed,
      hidden,
      revealed: meshes().length,
      revealedPhase: meshes().find((m) => m.userData.groundProfileIndex === 2).scale.x,
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(result.first).toBeGreaterThan(40);
  expect(result.withoutCaster).toBeGreaterThan(40);
  expect(result.casterVisible).toBe(false);
  expect(result.hidden).toBe(0);
  expect(result.disposed).toBe(result.withoutCaster);
  expect(result.revealed).toBeGreaterThan(20);
  expect(result.revealedPhase).toBeGreaterThan(result.phase);
  expect(result.error).toBe(0);
});
