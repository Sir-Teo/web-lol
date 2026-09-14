import { expect, test } from '@playwright/test';

for (const ability of ['e', 'r']) {
  test(`${ability.toUpperCase()} aims and casts at minimap coordinates without changing the camera`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (ability === 'r')
      await page.evaluate(() => (window as any).__GAME__.world.gainExperience(1e6));
    await page.keyboard.press(`Control+${ability}`);
    await expect
      .poll(() =>
        page.evaluate((key) => (window as any).__GAME__.world.player.spellRanks[key], ability)
      )
      .toBe(1);
    const initial = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.nextWaveTick = Infinity;
      for (const u of w.units) u.ai = false;
      return {
        half: w.battlefield.half,
        hero: { x: w.hero.x, y: w.hero.y },
        center: { ...g.view.center },
      };
    });
    const box = (await page.locator('#minimap').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
    await page.keyboard.down(ability);
    const aim = await page.evaluate(() => (window as any).__GAME__.view.aimPoint);
    expect(aim.x).toBeCloseTo(-initial.half * 0.6, 0);
    expect(aim.y).toBeCloseTo(-initial.half * 0.5, 0);
    await page.keyboard.up(ability);
    await expect
      .poll(() =>
        page.evaluate((ability) => {
          const w = (window as any).__GAME__.world;
          return w.projectiles.some(
            (p: any) => p.type === (ability === 'e' ? 'hawkshot' : 'ultimate')
          );
        }, ability)
      )
      .toBe(true);
    const result = await page.evaluate((ability) => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      const p = g.world.projectiles.find(
        (p: any) => p.type === (ability === 'e' ? 'hawkshot' : 'ultimate')
      );
      return {
        direction: p.direction,
        endpoint: { x: p.x + p.direction.x * p.remaining, y: p.y + p.direction.y * p.remaining },
        center: g.view.center,
        aim: g.view.aimPoint,
      };
    }, ability);
    const dx = aim.x - initial.hero.x,
      dy = aim.y - initial.hero.y,
      distance = Math.hypot(dx, dy);
    expect(result.direction.x).toBeCloseTo(dx / distance);
    expect(result.direction.y).toBeCloseTo(dy / distance);
    if (ability === 'e') {
      expect(result.endpoint.x).toBeCloseTo(aim.x);
      expect(result.endpoint.y).toBeCloseTo(aim.y);
    }
    expect(result.center).toEqual(initial.center);
    expect(result.aim).toBeNull();
  });
}

test('held targeting follows transitions between battlefield, minimap and non-targetable HUD', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const box = (await page.locator('#minimap').boundingBox())!;
  await page.mouse.move(600, 400);
  await page.keyboard.down('e');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).not.toBeNull();
  await page.locator('.champion-hud').hover();
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).toBeNull();
  await page.keyboard.up('e');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.keyboard.down('w');
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).toBeNull();
  await page.keyboard.up('w');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.w)).toBe(0);
  await page.keyboard.down('e');
  await page.keyboard.press('Escape');
  await page.keyboard.up('e');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
  await page.keyboard.down('e');
  await page.mouse.move(600, 400);
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimPoint)).not.toBeNull();
  await page.keyboard.up('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.eCharges))
    .toBe(1);
});

test('right-click minimap movement cancels a held scout cast', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const map = page.locator('#minimap');
  await map.hover();
  await page.keyboard.down('e');
  await map.click({ button: 'right', position: { x: 70, y: 90 } });
  await page.keyboard.up('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
    .toBe('move');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.eCharges)).toBe(2);
});

test('scoreboard overlap blocks minimap casts while exposed minimap targeting still works', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    for (let i = 1; i < 10; i++) w.spawn('champion', i < 5 ? 'blue' : 'red', { x: 0, y: 0 });
    // Observe accepted input before execution without pausing the UI.
    w.commands = [];
    w.step = () => {};
    g.setPaused(false);
    window.addEventListener('contextmenu', (event) => {
      g.contextPrevented = event.defaultPrevented;
    });
  });
  await page.keyboard.down('Tab');
  const overlap = await page.evaluate(() => {
    const panel = document.querySelector('.scoreboard')!.getBoundingClientRect();
    const minimap = document.querySelector('#minimap')!.getBoundingClientRect();
    const left = Math.max(panel.left, minimap.left),
      right = Math.min(panel.right, minimap.right);
    const top = Math.max(panel.top, minimap.top),
      bottom = Math.min(panel.bottom, minimap.bottom);
    if (right <= left || bottom <= top)
      throw new Error('Expected real laptop scoreboard/minimap overlap');
    const x = (left + right) / 2,
      y = (top + bottom) / 2;
    if (!document.elementFromPoint(x, y)?.closest('.scoreboard'))
      throw new Error('Scoreboard must own the pointer surface');
    return { x, y, clearX: minimap.right - 10, clearY: minimap.bottom - 10 };
  });
  await page.mouse.move(overlap.x, overlap.y);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual([]);
  await page.mouse.click(overlap.x, overlap.y, { button: 'right' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.contextPrevented)).toBe(true);
  await page.mouse.move(overlap.clearX, overlap.clearY);
  await page.keyboard.press('e');
  const accepted = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(accepted).toHaveLength(1);
  expect(accepted[0].type).toBe('cast');
  expect(accepted[0].ability).toBe('e');
  await page.screenshot({ path: 'artifacts/scoreboard-minimap-overlap.png' });
  await page.keyboard.up('Tab');
});
