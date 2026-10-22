import { expect, test } from '@playwright/test';

test('Red Brambleback renders its source rig, fights with real Lux input and restores its own camp calendar', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  page.on('request', (r) => requests.push(r.url()));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/');
  await ready();
  // Rift practice prepares every scheduled camp before simulation resumes.
  expect(requests.some((u) => u.endsWith('/sru-red-base.glb'))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const target = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { RIFT_CAMPS } = await import('/src/content/rift-camps.ts');
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.tick = RIFT_CAMPS.find((c) => c.id === 'order-red')!.firstReadyTick - 1;
    w.step();
    const unit = w.unit(w.jungleCamps.find((c: any) => c.id === 'order-red').unitIds[0]);
    const point = w.battlefield.reachable({ x: unit.x + 300, y: unit.y }, w.hero.radius, 'blue');
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const model = g.view.models.get(unit.id),
      renderer = g.view.renderer,
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
    model.root.visible = false;
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
    model.root.visible = true;
    renderer.render(g.view.scene, g.view.camera);
    let pixels = 0;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++;
    return {
      id: unit.id,
      rig: model.referenceAsset,
      home: unit.monster.home,
      pixels,
      screen: g.view.screenPoint(unit, 0.65),
      calendars: w.jungleCamps.length,
    };
  });
  expect(target.calendars).toBe(12);
  expect(target.rig).toBe('sru-red-base');
  expect(target.pixels).toBeGreaterThan(150);
  await expect(page.locator(`.unit-bar[data-unit="${target.id}"] .unit-name`)).toHaveText(
    'Red Brambleback'
  );
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.screen.x, target.screen.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world,
      u = w.unit(id);
    return u.hp < u.maxHp && u.monster.phase === 'engaged' && w.hero.hp < w.hero.maxHp;
  }, target.id);
  await page.keyboard.press('Control+q');
  await page.mouse.move(target.screen.x, target.screen.y);
  await page.keyboard.press('q');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).rootUntil > w.tick;
  }, target.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/red-brambleback-combat.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const fighting = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(fighting);
  const waiting = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      unit = w.unit(id);
    const before = { gold: w.player.gold, xp: w.player.xp, cs: w.player.cs };
    const others = structuredClone(w.jungleCamps.filter((c: any) => c.id !== 'order-red'));
    w.damage(w.hero, unit, 99999, 'true');
    w.step(200);
    return {
      camp: structuredClone(w.jungleCamps.find((c: any) => c.id === 'order-red')),
      othersUnchanged:
        JSON.stringify(others) ===
        JSON.stringify(w.jungleCamps.filter((c: any) => c.id !== 'order-red')),
      corpseGone: !w.unit(id),
      gold: w.player.gold - before.gold,
      xp: w.player.xp - before.xp,
      cs: w.player.cs - before.cs,
      blueBuff: w.player.blueBuff,
      redBuff: structuredClone(w.player.redBuff),
      grompMissiles: w.grompAttackVisuals.length,
    };
  }, target.id);
  expect(waiting.othersUnchanged).toBe(true);
  expect(waiting.corpseGone).toBe(true);
  expect(waiting.camp.unitIds[0]).toBeNull();
  expect(waiting.gold).toBeGreaterThanOrEqual(90);
  expect(waiting.xp).toBe(95);
  expect(waiting.cs).toBe(4);
  expect(waiting.blueBuff).toBeNull();
  expect(waiting.grompMissiles).toBe(0);
  expect(waiting.redBuff.endTick - waiting.redBuff.startTick).toBe(7200);
  await expect(page.locator('#red-buff')).toBeVisible();
  await expect(page.locator('#red-buff-time')).toHaveText('1:57');
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const victim = await page.evaluate((home) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const blue = w.unit(w.jungleCamps.find((c: any) => c.id === 'chaos-blue').unitIds[0]);
    w.damage(w.hero, blue, 99999, 'true');
    const point = w.battlefield.reachable(home, w.hero.radius, 'red');
    // Use the real opposing mid; the 5v5 checkpoint keeps its ten-player roster.
    const enemy = w.units.find(
      (u: any) => u.kind === 'champion' && u.team === 'red' && w.championState(u.id).role === 'mid'
    );
    Object.assign(enemy, point, { previous: { ...point } });
    enemy.ai = false;
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: enemy.id,
      screen: g.view.screenPoint(enemy, 0.65),
      separation: Math.hypot(enemy.x - w.hero.x, enemy.y - w.hero.y),
      visible: w.visible(enemy, 'blue'),
    };
  }, target.home);
  expect(victim.separation).toBeGreaterThan(150);
  expect(victim.visible).toBe(true);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(victim.screen.x, victim.screen.y, { button: 'right' });
  await page.waitForFunction(
    (id) => !!(window as any).__GAME__.world.unit(id).cinderBurn,
    victim.id,
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.setOrder(g.world.hero, { type: 'idle' });
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  await expect(page.locator('#red-buff')).toHaveAttribute('aria-label', /15.0 true damage/);
  await expect(page.locator('#blue-buff')).toBeVisible();
  await expect(page.locator('#red-buff')).toBeVisible();
  expect(
    await page.locator('#red-buff img').evaluate((i: HTMLImageElement) => i.naturalWidth)
  ).toBe(64);
  await expect(page.locator(`.unit-bar[data-unit="${victim.id}"] .unit-status`)).toHaveText(
    'BURNING · SLOWED'
  );
  await page.screenshot({ path: 'artifacts/crest-of-cinders.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const burningSave = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(burningSave);
  const pulse = await page.evaluate((id) => {
    const w = (window as any).__GAME__.world,
      u = w.unit(id);
    const next = u.cinderBurn.nextTick;
    w.step(next - w.tick);
    return {
      tick: w.tick,
      next,
      damage: w.events
        .filter((e: any) => e.type === 'damage' && e.unit === id && e.tick === next)
        .map((e: any) => e.value),
    };
  }, victim.id);
  expect(pulse.tick).toBe(pulse.next);
  expect(pulse.damage).toContain(5);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const respawn = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { MONSTERS } = await import('/src/content/monsters.ts');
    const camp = w.jungleCamps.find((c: any) => c.id === 'order-red'),
      saved = structuredClone(camp);
    g.setPaused(true);
    w.tick = camp.nextSpawnTick - MONSTERS.red.spawnLeadupTicks - 2;
    w.step();
    const before = camp.unitIds[0];
    w.step();
    const protectedPhase = w.unit(camp.unitIds[0]).monster.phase;
    w.step(MONSTERS.red.spawnLeadupTicks);
    const unit = w.unit(camp.unitIds[0]);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      saved,
      before,
      protectedPhase,
      id: unit.id,
      home: unit.monster.home,
      species: unit.monster.species,
      rig: g.view.models.get(unit.id).referenceAsset,
      hp: unit.hp,
      redBuff: w.player.redBuff,
    };
  });
  expect(respawn.saved).toEqual(waiting.camp);
  expect(respawn.before).toBeNull();
  expect(respawn.protectedPhase).toBe('spawning');
  expect(respawn.id).not.toBe(target.id);
  expect(respawn.home).toEqual(target.home);
  expect(respawn.species).toBe('red');
  expect(respawn.rig).toBe('sru-red-base');
  expect(respawn.hp).toBe(2300);
  expect(respawn.redBuff).toBeNull();
  await expect(page.locator('#red-buff')).toBeHidden();
  await page.screenshot({ path: 'artifacts/red-brambleback-respawn.png' });
  expect(errors).toEqual([]);
});
