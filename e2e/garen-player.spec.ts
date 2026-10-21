import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.locator('.champion-title strong')).toHaveText('GAREN');
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    w.step(480);
    w.events.length = 0;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
}

test('Garen player keyboard controls, resource-free HUD and active Judgment survive browser save/reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await expect(page.getByRole('img', { name: 'Garen', exact: true }).first()).toBeVisible();
  await expect(page.locator('.resource.mana')).toBeHidden();
  await expect(page.locator('.focus-pips')).toHaveCount(0);
  await expect(page.locator('.ability-charges')).toHaveCount(0);
  for (const name of ['Decisive Strike', 'Courage', 'Judgment', 'Demacian Justice'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  expect(
    await page
      .locator('[data-ability] img')
      .evaluateAll((images) =>
        images.every(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0
        )
      )
  ).toBe(true);
  await page.locator('[data-ability="q"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('Rank 1 preview');
  await expect(page.locator('#ability-tooltip')).toContainText('NO COST');
  await expect(page.locator('#ability-tooltip')).not.toContainText('Focus');
  const target = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 200, y: 0 }, 'lux');
    enemy.hp = enemy.maxHp = 10000;
    g.view.render(w, 1, g.view.previousElapsed);
    return { id: enemy.id, point: g.view.screenPoint(enemy, 0.425) };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('Control+q');
  await page.waitForFunction(() => (window as any).__GAME__.world.player.spellRanks.q === 1);
  await page.keyboard.press('q');
  await page.waitForFunction(() => !!(window as any).__GAME__.world.player.garenQ);
  await expect(page.locator('[data-ability="q"]')).toHaveClass(/empowered/);
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).silenceUntil > w.tick && w.player.garenQ?.consumed;
  }, target.id);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.setOrder(w.hero, { type: 'idle' });
    w.gainExperience(1e6);
    w.events = w.events.filter((e: any) => e.type !== 'level');
    g.hud.update(60);
    g.setPaused(false);
  });
  for (const key of ['w', 'e', 'r']) await page.keyboard.press(`Control+${key}`);
  await page.waitForFunction(() => {
    const p = (window as any).__GAME__.world.player;
    return p.spellRanks.w === 1 && p.spellRanks.e === 1 && p.spellRanks.r === 1;
  });
  await page.keyboard.press('w');
  await page.waitForFunction(() => !!(window as any).__GAME__.world.player.garenW);
  await page.keyboard.press('e');
  await page.waitForFunction(() => !!(window as any).__GAME__.world.player.garenE);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const start = w.player.garenE.startTick;
    w.step(Math.max(0, start + 60 - w.tick));
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { shield: w.shieldAmount(w.hero), mana: w.hero.mana, maxMana: w.hero.maxMana };
  });
  expect(before.mana).toBe(0);
  expect(before.maxMana).toBe(0);
  await expect(page.getByRole('button', { name: 'End Judgment', exact: true })).toBeVisible();
  await expect(page.locator('[data-ability="e"] .cooldown-text')).toHaveText('RECAST');
  await page.locator('[data-ability="e"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('Spin 9 times');
  await page.screenshot({ path: 'artifacts/browser-garen-player-judgment.png' });
  await page.setViewportSize({ width: 1120, height: 720 });
  await page.locator('[data-ability="e"]').hover();
  const tip = await page.locator('#ability-tooltip').boundingBox();
  expect(tip!.x).toBeGreaterThanOrEqual(12);
  expect(tip!.y).toBeGreaterThanOrEqual(12);
  expect(tip!.x + tip!.width).toBeLessThanOrEqual(1108);
  expect(tip!.y + tip!.height).toBeLessThanOrEqual(708);
  const tooltipAboveCombat = await page.evaluate(() => {
    const tooltip = document.querySelector<HTMLElement>('#ability-tooltip')!;
    const rect = tooltip.getBoundingClientRect();
    // Probe the real paint order even though ordinary combat text ignores pointer input.
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;left:${rect.left + 20}px;top:${rect.top + 20}px;width:10px;height:10px;pointer-events:auto;background:red`;
    document.querySelector('.floating-layer')!.append(probe);
    const above = tooltip.contains(document.elementFromPoint(rect.left + 25, rect.top + 25));
    probe.remove();
    return above;
  });
  expect(tooltipAboveCombat).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-player-small.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await expect(page.locator('.champion-title strong')).toHaveText('GAREN');
  await expect(page.getByRole('button', { name: 'End Judgment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world;
    return w.player.garenE === null && w.abilityCooldownTicks('e') > 0;
  });
  await expect(page.locator('[data-ability="e"]')).toHaveClass(/cooling/);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const enemy = w.units.find((u: any) => u.team === 'red' && u.kind === 'champion');
    w.damage(enemy, w.hero, 10, 'true');
    const minion = w.spawn('melee', 'red', { x: 100, y: 0 });
    w.damage(w.hero, minion, 1e6, 'true');
    g.hud.update(60);
  });
  await expect(page.locator('#garen-passive')).toContainText('PERSEVERANCE IN 8s');
  await expect(page.locator('#garen-passive')).toContainText('COURAGE 1/150');
  await expect(page.locator('#health-regen')).toHaveText('+3.3');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(480);
    g.hud.update(60);
  });
  await expect(page.locator('#garen-passive')).toContainText('PERSEVERANCE READY');
  await expect(page.locator('#health-regen')).toHaveText('+50.9');
  await page.keyboard.press('Escape');
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart practice', exact: true }).click(),
  ]);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.locator('.champion-title strong')).toHaveText('GAREN');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.spellRanks)).toEqual({
    q: 0,
    w: 0,
    e: 0,
    r: 0,
  });
  expect(errors).toEqual([]);
});

test('Garen R captures the actual mouse champion and rejects nonchampions, hidden targets, ground and minimap', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  const fixture = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.events = w.events.filter((e: any) => e.type !== 'level');
    const enemy = w.spawn('champion', 'red', { x: 300, y: 150 }, 'lux');
    enemy.maxHp = 2000;
    enemy.hp = 1000;
    const dummy = w.spawn('dummy', 'red', { x: 300, y: -150 });
    g.view.render(w, 1, g.view.previousElapsed);
    const enemyPoint = g.view.screenPoint(enemy, 0.425),
      dummyPoint = g.view.screenPoint(dummy, 0.65);
    return {
      enemyId: enemy.id,
      dummyId: dummy.id,
      enemyPoint,
      dummyPoint,
      enemyPicked: g.view.pick(w, enemyPoint.x, enemyPoint.y)?.id,
      dummyPicked: g.view.pick(w, dummyPoint.x, dummyPoint.y)?.id,
      ground: g.view.screenPoint({ x: 1000, y: -700 }, 0),
    };
  });
  expect(fixture.enemyPicked).toBe(fixture.enemyId);
  expect(fixture.dummyPicked).toBe(fixture.dummyId);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  for (const point of [fixture.dummyPoint, fixture.ground]) {
    await page.mouse.move(point.x, point.y);
    await page.keyboard.press('r');
    expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.r)).toBe(0);
  }
  const minimap = await page.locator('#minimap').boundingBox();
  await page.mouse.move(minimap!.x + 80, minimap!.y + 80);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.r)).toBe(0);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.battlefield.lineOfSight = () => false;
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.mouse.move(fixture.enemyPoint.x, fixture.enemyPoint.y);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.r)).toBe(0);
  await page.evaluate(() => ((window as any).__GAME__.world.battlefield.lineOfSight = () => true));
  await page.mouse.move(fixture.enemyPoint.x, fixture.enemyPoint.y);
  await page.keyboard.down('r');
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    const a = g.view.aimLine.geometry;
    return {
      count: a.drawRange.count,
      radius: Math.hypot(a.attributes.position.getX(0), a.attributes.position.getZ(0)),
    };
  });
  expect(aim).toEqual({ count: 33, radius: 4 });
  await page.screenshot({ path: 'artifacts/browser-garen-player-r-aim.png' });
  await page.keyboard.up('r');
  await page.waitForFunction(() => !!(window as any).__GAME__.world.player.pendingCast);
  const hit = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const cast = w.player.pendingCast;
    const target = w.unit(id);
    target.x = 800;
    w.battlefield.lineOfSight = () => false;
    const saved = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    const hp = target.hp;
    w.step(cast.releaseTick - w.tick);
    saved.step(cast.releaseTick - saved.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      id: cast.targetId,
      damage: hp - target.hp,
      same: saved.snapshot() === w.snapshot(),
      clip: g.view.models.get(w.hero.id).actionName,
    };
  }, fixture.enemyId);
  expect(hit.id).toBe(fixture.enemyId);
  expect(hit.damage).toBeGreaterThan(370);
  expect(hit.damage).toBeLessThan(380);
  expect(hit.same).toBe(true);
  expect(hit.clip).toBe('spell4_base');
  expect(errors).toEqual([]);
});
