import { expect, test } from '@playwright/test';

test('Blue Sentinel loads its normal rig, fights in its Rift camp and restores a distinct respawn calendar', async ({
  page,
}) => {
  test.setTimeout(90000);
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
  expect(requests.some((u) => u.endsWith('/sru-blue-base.glb'))).toBe(false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const target = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { RIFT_CAMPS } = await import('/src/content/rift-camps.ts');
    const definition = RIFT_CAMPS.find((c) => c.id === 'order-blue')!;
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.tick = definition.firstReadyTick - 1;
    w.step();
    const camp = w.jungleCamps.find((c: any) => c.id === 'order-blue'),
      unit = w.unit(camp.unitIds[0]);
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
      home: unit.monster.home,
      pixels,
      rig: model.referenceAsset,
      point: g.view.screenPoint(unit, 0.65),
      calendars: structuredClone(w.jungleCamps),
    };
  });
  expect(target.rig).toBe('sru-blue-base');
  expect(target.pixels).toBeGreaterThan(150);
  expect(target.calendars).toHaveLength(12);
  expect(
    target.calendars
      .filter((c: any) => c.id.endsWith('gromp'))
      .every((c: any) => c.unitIds[0] === null)
  ).toBe(true);
  await expect(page.locator(`.unit-bar[data-unit="${target.id}"] .unit-name`)).toHaveText(
    'Blue Sentinel'
  );
  expect(
    await page
      .locator(`.unit-bar[data-unit="${target.id}"] .unit-name`)
      .evaluate((node) => node.getBoundingClientRect().height)
  ).toBeLessThan(20);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world,
      u = w.unit(id);
    return u.hp < u.maxHp && u.monster.phase === 'engaged' && w.hero.hp < w.hero.maxHp;
  }, target.id);
  await page.keyboard.press('Control+q');
  await page.mouse.move(target.point.x, target.point.y);
  await page.keyboard.press('q');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).rootUntil > w.tick;
  }, target.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/blue-sentinel-combat.png' });
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
    w.damage(w.hero, unit, 99999, 'true');
    w.step(400);
    g.hud.update(60);
    return {
      camp: structuredClone(w.jungleCamps.find((c: any) => c.id === 'order-blue')),
      corpseGone: !w.unit(id),
      gold: w.player.gold - before.gold,
      xp: w.player.xp - before.xp,
      cs: w.player.cs - before.cs,
      grompMissiles: w.grompAttackVisuals.length,
      buff: structuredClone(w.player.blueBuff),
      haste: w.abilityHaste(),
    };
  }, target.id);
  expect(waiting.corpseGone).toBe(true);
  expect(waiting.camp.unitIds[0]).toBeNull();
  expect(waiting.gold).toBeGreaterThanOrEqual(90);
  expect(waiting.xp).toBe(95);
  expect(waiting.cs).toBe(4);
  expect(waiting.grompMissiles).toBe(0);
  expect(waiting.buff.endTick - waiting.buff.startTick).toBe(7200);
  expect(waiting.haste).toBe(10);
  await expect(page.locator('#blue-buff')).toBeVisible();
  await expect(page.locator('#blue-buff-time')).toHaveText('1:54');
  await expect(page.locator('#blue-buff')).toHaveAttribute('aria-label', /\+10 Ability Haste/);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.blueBuff)).toEqual(
    waiting.buff
  );
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.hud.update(60);
  });
  expect(
    await page.locator('#blue-buff img').evaluate((img: HTMLImageElement) => img.naturalWidth)
  ).toBe(64);
  await page.screenshot({ path: 'artifacts/crest-of-insight.png' });
  const respawn = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { MONSTERS } = await import('/src/content/monsters.ts');
    const camp = w.jungleCamps.find((c: any) => c.id === 'order-blue'),
      saved = structuredClone(camp);
    g.setPaused(true);
    w.tick = camp.nextSpawnTick - MONSTERS.blue.spawnLeadupTicks - 2;
    w.step();
    const before = camp.unitIds[0];
    w.step();
    const protectedPhase = w.unit(camp.unitIds[0]).monster.phase;
    w.step(MONSTERS.blue.spawnLeadupTicks);
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
      buff: w.player.blueBuff,
      haste: w.abilityHaste(),
    };
  });
  expect(respawn.saved).toEqual(waiting.camp);
  expect(respawn.before).toBeNull();
  expect(respawn.protectedPhase).toBe('spawning');
  expect(respawn.id).not.toBe(target.id);
  expect(respawn.home).toEqual(target.home);
  expect(respawn.species).toBe('blue');
  expect(respawn.hp).toBe(2300);
  expect(respawn.rig).toBe('sru-blue-base');
  expect(respawn.buff).toBeNull();
  expect(respawn.haste).toBe(0);
  await expect(page.locator('#champion-buffs')).toBeHidden();
  await page.screenshot({ path: 'artifacts/blue-sentinel-respawn.png' });
  expect(errors).toEqual([]);
});
