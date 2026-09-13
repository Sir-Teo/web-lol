import { expect, test } from '@playwright/test';

test('Hawkshot travels visibly, preserves its paused pose and reveals the destination only on approach', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    const target = w.spawn('dummy', 'red', { x: 2800, y: 0 });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: target });
    w.step(75); // Windup plus the first second of flight.
    const p = w.projectiles.find((p: any) => p.type === 'hawkshot');
    v.recenter(p);
    v.render(w, 1, 0);
    const model = v.projectileModels.get(p.id);
    const pose = () => {
      const bones: number[][] = [];
      model.traverse((child: any) => {
        if (child.isBone) bones.push(child.quaternion.toArray());
      });
      return bones;
    };
    const before = pose();
    v.render(w, 1, 0.25);
    const after = pose();
    return {
      id: p.id,
      target: target.id,
      x: p.x,
      visible: model.visible,
      bones: before.length,
      targetVisible: w.visible(target),
      areas: w.visionAreas.filter((a: any) => a.kind === 'scout').length,
      before,
      after,
    };
  });
  expect(result.x).toBeCloseTo(1400);
  expect(result.visible).toBe(true);
  expect(result.bones).toBe(5);
  expect(result.targetVisible).toBe(false);
  expect(result.areas).toBe(0);
  expect(result.after).toEqual(result.before);
  await expect(page.locator('[data-ability="e"] .ability-charges')).toHaveText('1');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-flight.png' });
  const arrival = await page.evaluate(({ id, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(60);
    v.recenter(w.unit(target));
    v.render(w, 1, 0);
    return {
      projectile: v.projectileModels.has(id),
      visible: w.visible(w.unit(target)),
      modelVisible: v.models.get(target).root.visible,
      lifetime: w.visionAreas.find((a: any) => a.kind === 'scout').endTick - w.tick,
    };
  }, result);
  expect(arrival).toEqual({ projectile: false, visible: true, modelVisible: true, lifetime: 300 });
  await expect(page.locator('[data-ability="e"] .cooldown-text')).toHaveText('3');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-destination.png' });
  const expired = await page.evaluate((target) => {
    const g = (window as any).__GAME__;
    g.world.step(300);
    g.view.render(g.world, 1, 0);
    return {
      visible: g.world.visible(g.world.unit(target)),
      model: g.view.models.get(target).root.visible,
    };
  }, result.target);
  expect(expired).toEqual({ visible: false, model: false });
});

test('Hawkshot displays charges, cast delay, recharge and practice reset', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.nextWaveTick = Infinity;
  });
  const button = page.locator('[data-ability="e"]');
  await expect(button.locator('.ability-charges')).toHaveText('2');
  await expect(button.locator('.ability-recharge')).toBeHidden();
  // Real keyboard input is disabled while paused, so run briefly for each cast.
  await page.mouse.move(700, 400);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('e');
  await expect(button.locator('.ability-charges')).toHaveText('1');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await expect(button.locator('.cooldown-text')).toHaveText('5');
  await expect(button.locator('.ability-recharge')).toBeVisible();
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.player.cooldowns.e - w.tick);
  });
  await expect(button).not.toHaveClass(/cooling/);
  await expect(button.locator('.cooldown-text')).toHaveText('');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-one-charge.png' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('e');
  await expect(button.locator('.ability-charges')).toHaveText('0');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await expect(button.locator('.cooldown-text')).toHaveText('85');
  await expect(button).toHaveClass(/cooling/);
  await expect(button).toHaveAccessibleName('Hawkshot, 0 of 2 charges, next charge in 85 seconds');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-empty.png' });
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.player.eRechargeTick - w.tick);
  });
  await expect(button.locator('.ability-charges')).toHaveText('1');
  await expect(button).not.toHaveClass(/cooling/);
  await expect(button).toHaveAccessibleName('Hawkshot, 1 of 2 charges, next charge in 90 seconds');
  await page.getByRole('button', { name: /Practice tools/ }).click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  await expect(button.locator('.ability-charges')).toHaveText('2');
  await expect(button.locator('.ability-recharge')).toBeHidden();
  await expect(button).not.toHaveClass(/cooling/);
});
