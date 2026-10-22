import { expect, test } from '@playwright/test';

test('selected Smite uses real targeting, saved charges, camp rewards and restart loadouts', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  const saveReload = async () => {
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    await page.reload();
    await ready();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  };
  await page.goto('/');
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  const d = page.getByRole('group', { name: 'D spell', exact: true }),
    f = page.getByRole('group', { name: 'F spell', exact: true });
  await d.getByRole('button', { name: 'Smite', exact: true }).click();
  await f.getByRole('button', { name: 'Smite', exact: true }).click();
  await expect(d.getByRole('button', { name: 'Heal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await d.getByRole('button', { name: 'Smite', exact: true }).click();
  await f.getByRole('button', { name: 'Flash', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('.summoner-selection').scrollIntoViewIfNeeded();
  const bounds = await page.locator('.summoner-selection').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
  await page.screenshot({ path: 'artifacts/smite-loadout.png' });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await ready();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-ability="d"] img')).toHaveAttribute(
    'src',
    'assets/icons/SummonerSmite.png'
  );
  await expect(page.locator('[data-ability="f"] img')).toHaveAttribute(
    'src',
    'assets/icons/SummonerFlash.png'
  );
  await expect(page.locator('[data-ability="d"] .ability-charges')).toHaveText('1');
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units) u.ai = false;
    w.tick = 5400 - 1;
    w.step(12);
    const camp = w.jungleCamps.find((c: any) => c.id.includes('gromp')),
      u = w.unit(camp.unitIds[0]);
    let point;
    for (let x = -350; x <= 350 && !point; x += 50)
      for (let y = -350; y <= 350 && !point; y += 50) {
        const p = { x: u.x + x, y: u.y + y },
          r = Math.hypot(x, y);
        if (
          r > 180 &&
          r < 300 &&
          w.battlefield.lineWalkable(p, p, w.hero.radius, 'blue') &&
          w.battlefield.lineOfSight(p, u)
        )
          point = p;
      }
    if (!point) throw new Error('No visible Gromp approach');
    Object.assign(w.hero, point, { previous: { ...point } });
    u.stunUntil = w.tick + 5000;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: u.id,
      hero: w.hero.id,
      hp: u.hp,
      screen: g.view.screenPoint(u, 0.6),
      self: g.view.screenPoint(w.hero, 0.6),
    };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('Tab');
  await expect(
    page.locator(`.scoreboard-row[data-champion="${setup.hero}"] .scoreboard-summoners img`)
  ).toHaveCount(2);
  await expect(
    page.locator(`.scoreboard-row[data-champion="${setup.hero}"] .scoreboard-summoners img`).first()
  ).toHaveAttribute('alt', 'Smite');
  await page.keyboard.up('Tab');
  await page.mouse.move(setup.self.x, setup.self.y);
  await page.keyboard.press('d');
  await expect(page.locator('#toast')).toContainText('large or medium monster');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.smite.charges)).toBe(2);
  await page.mouse.move(setup.screen.x, setup.screen.y);
  await page.keyboard.press('d');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).hp === w.unit(id).maxHp - 600;
  }, setup.id);
  await expect(page.locator('[data-ability="d"] .ability-charges')).toHaveText('1');
  await expect(page.locator('[data-ability="d"]')).toHaveClass(/cooling/);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
  });
  await page.keyboard.press('Escape');
  await saveReload();
  const finish = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    w.step(905);
    u.hp = 600;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { screen: g.view.screenPoint(u, 0.6), cs: w.player.cs };
  }, setup.id);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.mouse.move(finish.screen.x, finish.screen.y);
  await page.keyboard.press('d');
  await page.waitForFunction((id) => (window as any).__GAME__.world.unit(id).hp === 0, setup.id);
  const clear = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      cs: w.player.cs,
      charges: w.player.smite.charges,
      deadline: w.player.smite.rechargeTick,
      tick: w.tick,
      camp: w.jungleCamps.find((c: any) => c.id.includes('gromp')),
    };
  }, setup.id);
  expect(clear.cs).toBeGreaterThan(finish.cs);
  expect(clear.charges).toBe(0);
  expect(clear.deadline).toBeGreaterThan(clear.tick);
  expect(clear.camp.unitIds[0]).toBeNull();
  expect(clear.camp.nextSpawnTick).toBeGreaterThan(clear.tick);
  await expect(page.locator('[data-ability="d"] .ability-charges')).toHaveText('0');
  await page.screenshot({ path: 'artifacts/smite-camp.png' });
  await page.keyboard.press('Escape');
  await saveReload();
  const charged = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.tick = w.player.smite.rechargeTick - 1;
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return w.player.smite.charges;
  });
  expect(charged).toBe(1);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart lane match', exact: true }).click(),
  ]);
  await ready();
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return { summoners: w.player.summoners, charges: w.player.smite.charges, tick: w.tick };
    })
  ).toEqual({ summoners: { d: 'smite', f: 'flash' }, charges: 1, tick: 0 });
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page
    .getByRole('group', { name: 'D spell', exact: true })
    .getByRole('button', { name: 'Heal', exact: true })
    .click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start practice', exact: true }).click(),
  ]);
  await ready();
  await expect(page.locator('[data-ability="d"] img')).toHaveAttribute(
    'src',
    'assets/icons/SummonerHeal.png'
  );
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.hero.hp = 10;
    g.world.hero.stunUntil = g.world.tick + 600;
  });
  await page.keyboard.press('d');
  await expect(page.locator('[data-ability="d"]')).toHaveClass(/cooling/);
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.f)).toBe(0);
  expect(errors).toEqual([]);
});
