import { expect, test } from '@playwright/test';

test('scoreboard and team totals use champion records and update while held open', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 });
    bot.ai = false;
    const killer = w.spawn('melee', 'red', { x: 0, y: 0 });
    w.damage(killer, w.hero, 10000, 'true');
    for (let i = 0; i < 2; i++) {
      const ally = w.spawn('champion', 'blue', { x: 0, y: 0 });
      w.damage(bot, ally, 10000, 'true');
    }
    w.damage(w.spawn('melee', 'blue', { x: 0, y: 0 }), bot, 10000, 'true');
    w.championState(bot.id).cs = 7;
    bot.name = '<b>Enemy Ashe</b>';
    g.hud.update(60);
    g.setPaused(false);
    return { human: w.hero.id, bot: bot.id };
  });
  await page.keyboard.down('Tab');
  await expect(page.locator('.scoreboard-row')).toHaveCount(4);
  await expect(page.locator(`[data-champion="${ids.human}"] .scoreboard-kda`)).toHaveText(
    '0 / 1 / 0'
  );
  const enemy = page.locator(`[data-champion="${ids.bot}"]`);
  await expect(enemy.locator('.scoreboard-kda')).toHaveText('2 / 1 / 0');
  await expect(enemy.locator('.scoreboard-cs')).toHaveText('7 CS');
  await expect(enemy.locator('strong')).toContainText('<b>Enemy Ashe</b>');
  await expect(enemy.locator('strong b')).toHaveCount(0);
  await expect(page.locator('#kills')).toHaveText('0');
  await expect(page.locator('#deaths')).toHaveText('2');
  await expect(page.locator('#personal')).toHaveText('0 / 1 / 0');
  await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.world.championState(id).cs++;
    g.hud.update(60);
  }, ids.bot);
  await expect(enemy.locator('.scoreboard-cs')).toHaveText('8 CS');
  await page.screenshot({ path: 'artifacts/scoreboard-ownership.png' });
  await page.keyboard.up('Tab');
  await expect(page.locator('.scoreboard')).toBeHidden();
});

test('ten-champion scoreboard uses each champion portrait on both teams', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const roster = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    for (const team of ['blue', 'red']) {
      for (let slot = team === 'blue' ? 1 : 0; slot < 5; slot++) {
        const champion = slot === 4 ? 'lux' : slot === 3 ? 'garen' : 'ashe';
        const unit = w.spawn(
          'champion',
          team,
          { x: w.hero.x + slot * 100, y: w.hero.y + 150 },
          champion
        );
        unit.ai = false;
        w.championState(unit.id).inventory = ['blade', 'boots', 'tome', 'rod', 'wand', 'chapter'];
        // Player-facing names must not determine champion artwork or accessible identity.
        if (team === 'red') unit.name = 'Enemy player';
      }
    }
    for (const unit of w.units) w.setOrder(unit, { type: 'idle' });
    w.step(900);
    g.setPaused(false);
    // Keep real Tab input while this static portrait/layout fixture stops painting.
    g.view.renderer.setAnimationLoop(null);
    return w.units.map((u: any) => ({
      id: u.id,
      champion: u.champion,
      team: u.team,
      name: u.name,
    }));
  });
  await page.keyboard.down('Tab');
  await expect(page.locator('.scoreboard-row')).toHaveCount(10);
  for (const member of roster) {
    const row = page.locator(`[data-champion="${member.id}"]`);
    const portrait = row.locator('.scoreboard-portrait img');
    const spells = row.locator('.scoreboard-summoners img');
    await expect(spells).toHaveCount(2);
    await expect(spells.nth(0)).toHaveAttribute('alt', 'Flash');
    await expect(spells.nth(0)).toHaveAttribute('src', 'assets/icons/SummonerFlash.png');
    await expect(spells.nth(1)).toHaveAttribute('alt', 'Heal');
    await expect(spells.nth(1)).toHaveAttribute('src', 'assets/icons/SummonerHeal.png');
    await expect
      .poll(() =>
        spells.evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0)
        )
      )
      .toBe(true);

    await expect(portrait).toHaveAttribute('src', `assets/icons/${member.champion}.png`);
    const championName = { ashe: 'Ashe', lux: 'Lux', garen: 'Garen' }[
      member.champion as 'ashe' | 'lux' | 'garen'
    ];
    await expect(portrait).toHaveAttribute('alt', championName);
    await expect(row.locator('.scoreboard-portrait')).toHaveAttribute(
      'aria-label',
      new RegExp(`^${championName}, `)
    );
    await expect(row.locator('strong')).toContainText(member.name);
    await expect
      .poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(row.locator('small')).toHaveText(
      member.id === roster[0].id ? 'You' : member.team === 'blue' ? 'Ally' : 'Opponent'
    );
  }
  await expect
    .poll(() =>
      page
        .locator('.scoreboard-item img')
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0)
        )
    )
    .toBe(true);
  const spellMarkup = await page
    .locator('.scoreboard-summoners')
    .evaluateAll((nodes) => nodes.map((node) => node.outerHTML));
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (const unit of g.world.units.filter((u: any) => u.team === 'red')) {
      const state = g.world.championState(unit.id);
      state.cooldowns.d = g.world.tick + 18000;
      state.cooldowns.f = g.world.tick + 14400;
    }
    g.hud.update(60);
  });
  expect(
    await page
      .locator('.scoreboard-summoners')
      .evaluateAll((nodes) => nodes.map((node) => node.outerHTML))
  ).toEqual(spellMarkup);
  const bounds = await page.locator('.scoreboard').boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768);
  const layout = await page.locator('.scoreboard').evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return {
      noScroll: panel.scrollHeight <= panel.clientHeight,
      rowsInside: [...panel.querySelectorAll('.scoreboard-row')].every((row) => {
        const r = row.getBoundingClientRect();
        return (
          r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right
        );
      }),
    };
  });
  expect(layout).toEqual({ noScroll: true, rowsInside: true });
  await page.screenshot({ path: 'artifacts/scoreboard-mixed-champions.png' });
  // Reopening exercises the cached row path; counter updates exercise rebuilding rows.
  await page.keyboard.up('Tab');
  await page.keyboard.down('Tab');
  const lux = roster.find((u: any) => u.champion === 'lux')!;
  await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.world.championState(id).cs = 42;
    g.hud.update(60);
  }, lux.id);
  const updated = page.locator(`[data-champion="${lux.id}"]`);
  await expect(updated.locator('.scoreboard-cs')).toHaveText('42 CS');
  await expect(updated.locator('.scoreboard-portrait img')).toHaveAttribute(
    'src',
    'assets/icons/lux.png'
  );
  await expect(updated.locator('.scoreboard-portrait img')).toHaveAttribute('alt', 'Lux');
  await page.keyboard.up('Tab');
  await expect(page.locator('.scoreboard')).toBeHidden();
  expect(errors).toEqual([]);
});

test('scoreboard retains observed enemy level and creep score through hidden gains', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -820, y: 450 });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 }, 'lux');
    enemy.ai = false;
    w.step();
    g.hud.scoreboard(true);
    return enemy.id;
  });
  const badge = page.locator(`[data-champion="${id}"] .scoreboard-level`);
  const cs = page.locator(`[data-champion="${id}"] .scoreboard-cs`);
  await expect(cs).toHaveText('? CS');
  const items = page.locator(`[data-champion="${id}"] .scoreboard-items`);
  await expect(items).toHaveAttribute('aria-label', 'Inventory unknown');
  await expect(items.locator('img')).toHaveCount(0);
  await expect(badge).toHaveText('?');
  await expect(badge).toHaveAttribute('aria-label', 'Level unknown');
  await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, { x: -800, y: -50 });
    w.gainExperience(280, id);
    w.championState(id).cs = 4;
    w.championState(id).inventory = ['tome', null, 'boots'];
    w.step();
    g.hud.update(60);
  }, id);
  await expect(badge).toHaveText('2');
  await expect(cs).toHaveText('4 CS');
  await expect(items.locator('img')).toHaveCount(2);
  await expect(items.locator('img').first()).toHaveAttribute('alt', 'Amplifying Tome');
  await expect(items.locator('.scoreboard-item').nth(1)).toHaveAttribute(
    'aria-label',
    'Empty item slot 2'
  );
  await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, { x: -820, y: 450 });
    w.gainExperience(380, id);
    w.championState(id).cs = 6;
    w.championState(id).inventory[0] = 'wand';
    w.championState(id).inventory[2] = null;
    w.step();
    g.hud.update(60);
  }, id);
  await expect(badge).toHaveText('2');
  await expect(cs).toHaveText('4 CS');
  await expect(items.locator('img')).toHaveCount(2);
  await expect(items.locator('img').first()).toHaveAttribute('alt', 'Amplifying Tome');
  await expect(items.locator('.scoreboard-item').nth(1)).toHaveAttribute(
    'aria-label',
    'Empty item slot 2'
  );
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, { x: -800, y: -50 });
    w.step();
    g.hud.update(60);
  });
  await expect(badge).toHaveText('3');
  await expect(cs).toHaveText('6 CS');
  await expect(items.locator('img')).toHaveCount(1);
  await expect(items.locator('img')).toHaveAttribute('alt', 'Blasting Wand');
  await expect
    .poll(() => items.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(badge).toHaveAttribute('aria-label', 'Level 3');
  await page.screenshot({ path: 'artifacts/scoreboard-observed-items.png' });
});
