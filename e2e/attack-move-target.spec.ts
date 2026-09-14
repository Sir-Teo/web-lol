import { expect, test } from '@playwright/test';

for (const shortcut of ['A-click', 'Shift-right-click'])
  for (const kind of ['champion', 'caster', 'dummy'])
    test(
      ` ${shortcut} explicitly attacks the clicked ${kind} despite a nearer enemy`.trim(),
      async ({ page }) => {
        await page.goto('/?scene=fixture');
        await page.waitForFunction(() => (window as any).__GAME__?.ready);
        await page.locator('#loading').waitFor({ state: 'detached' });
        const setup = await page.evaluate((kind) => {
          const g = (window as any).__GAME__,
            w = g.world;
          w.units = [w.hero];
          w.nextWaveTick = Infinity;
          w.pendingSpawns = [];
          w.setOrder(w.hero, { type: 'idle' });
          const near = w.spawn('melee', 'red', { x: w.hero.x + 100, y: w.hero.y - 100 });
          const target = w.spawn(kind, 'red', { x: w.hero.x + 450, y: w.hero.y });
          near.stunUntil = target.stunUntil = Infinity;
          g.view.render(w, 1, 0);
          return {
            id: target.id,
            hp: target.hp,
            nearId: near.id,
            nearHp: near.hp,
            point: g.view.screenPoint(target, 0.65),
          };
        }, kind);
        if (shortcut === 'A-click') {
          await page.keyboard.press('a');
          await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
          await page.mouse.click(setup.point.x, setup.point.y);
        } else {
          await page.keyboard.down('Shift');
          await page.mouse.click(setup.point.x, setup.point.y, { button: 'right' });
          await page.keyboard.up('Shift');
        }
        await expect
          .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order))
          .toEqual({ type: 'attack', target: setup.id });
        await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
        await expect
          .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.id))
          .toBeLessThan(setup.hp);
        expect(
          await page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.nearId)
        ).toBe(setup.nearHp);
      }
    );

test('A-click on ground or an ally keeps attack-move, and Escape cancels targeting', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const points = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const ally = w.spawn('melee', 'blue', { x: w.hero.x + 300, y: w.hero.y });
    return [
      g.view.screenPoint(ally, 0.65),
      g.view.screenPoint({ x: w.hero.x + 450, y: w.hero.y - 200 }),
    ];
  });
  for (const point of points) {
    await page.keyboard.press('a');
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
      .toBe('attackMove');
    await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
    await page.keyboard.press('s');
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.hero.order.type))
      .toBe('idle');
  }
  await page.keyboard.press('a');
  await page.keyboard.press('Escape');
  await page.mouse.click(points[0].x, points[0].y);
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.order.type)).toBe('idle');
});

test('Shift-right-click routes ground and minimap attack-move, cancels held casts and respects pause', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    // Keep accepted commands observable while real input and UI remain active.
    w.step = () => {};
    return g.view.screenPoint({ x: w.hero.x + 450, y: w.hero.y - 200 });
  });
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  expect(
    await page.evaluate(() =>
      (window as any).__GAME__.world.commands.map((c: any) => [c.type, c.order?.type])
    )
  ).toEqual([['order', 'attackMove']]);
  const mini = await page.locator('#minimap').boundingBox();
  expect(mini).toBeTruthy();
  const minimapPoint = { x: mini!.x + mini!.width * 0.8, y: mini!.y + mini!.height * 0.2 };
  await page.keyboard.down('Shift');
  await page.mouse.click(minimapPoint.x, minimapPoint.y, { button: 'right' });
  await page.keyboard.up('Shift');
  await page.mouse.click(minimapPoint.x, minimapPoint.y, { button: 'right' });
  const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(commands.map((c: any) => c.order.type)).toEqual(['attackMove', 'attackMove', 'move']);
  expect(commands[1].order.point).toEqual(commands[2].order.point);
  await page.keyboard.press('Escape');
  await page.keyboard.down('Shift');
  await page.mouse.click(minimapPoint.x, minimapPoint.y, { button: 'right' });
  await page.keyboard.up('Shift');
  expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual(commands);
  await page.getByRole('button', { name: 'Controls & keybindings' }).click();
  await expect(page.locator('.controls-list')).toContainText('Shift + right-click');
  await page.screenshot({ path: 'artifacts/attack-move-click-controls.png' });
});
