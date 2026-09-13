import { expect, test } from '@playwright/test';

test('ability tooltips describe current mechanics and support keyboard focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const q = page.getByRole('button', { name: 'Ranger’s Focus', exact: true });
  await q.focus();
  const tip = page.getByRole('tooltip');
  await expect(q).toHaveAttribute('aria-describedby', 'ability-tooltip');
  await expect(tip).toContainText('20% attack speed');
  await expect(tip).toContainText('110% damage');
  await expect(tip).toContainText('resets your attack timer');
  await expect(tip).toContainText('NO COOLDOWN');
  await page.getByRole('button', { name: 'Heal', exact: true }).focus();
  await expect(q).not.toHaveAttribute('aria-describedby');
  await expect(tip).toContainText('one nearby allied champion');
  await expect(tip).toContainText('reduced by 50%');
  await expect(tip).toContainText('NO COST');
  await page.evaluate(() => (window as any).__GAME__.hud.update(60));
  await page.screenshot({ path: 'artifacts/heal-tooltip.png' });
  await page.getByRole('button', { name: 'Pause game' }).focus();
  await expect(tip).toBeHidden();
  expect(errors).toEqual([]);
});

test('Volley tooltip follows bonus damage and matches the released arrows', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.getByRole('button', { name: 'Volley', exact: true }).focus();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('7 frost arrows');
  await expect(tip).toContainText('60 physical damage before armor');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.player.gold = 875;
    if (g.world.buy('pickaxe')) throw new Error('Purchase failed');
    g.world.gainExperience(1e6);
    g.hud.update(60);
  });
  await expect(tip).toContainText('85 physical damage before armor');
  const damage = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.enqueue({
      type: 'cast',
      unit: g.world.hero.id,
      ability: 'w',
      point: { x: g.world.hero.x + 1000, y: g.world.hero.y },
    });
    g.world.step(16);
    return g.world.projectiles
      .filter((p: any) => p.source === g.world.hero.id && p.type === 'volley')
      .map((p: any) => p.damage);
  });
  expect(damage).toHaveLength(7);
  for (const value of damage) expect(value).toBeCloseTo(85);
  await page.screenshot({ path: 'artifacts/volley-tooltip.png' });
});

test('Heal tooltip tracks level and the recent-Heal penalty through expiry', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.getByRole('button', { name: 'Heal', exact: true }).focus();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Restore up to 80 health');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.gainExperience(1e6);
    g.world.hero.hp = 100;
    g.hud.update(60);
  });
  await expect(tip).toContainText('Restore up to 318 health');
  const amount = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.enqueue({
      type: 'cast',
      unit: g.world.hero.id,
      ability: 'f',
      point: { x: g.world.hero.x, y: g.world.hero.y },
    });
    g.world.step();
    g.hud.update(60);
    return g.world.events.filter((event: any) => event.type === 'heal').at(-1)?.value;
  });
  expect(amount).toBe(318);
  await expect(tip).toContainText('Your healing is currently reduced to 159.');
  await page.screenshot({ path: 'artifacts/heal-reduced-tooltip.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.tick = g.world.hero.summonerHealReductionUntil;
    g.hud.update(60);
  });
  await expect(tip).not.toContainText('Your healing is currently reduced');
});
