import { expect, test } from '@playwright/test';

test('default game uses full terrain and preserves pointer/height agreement at the fountain', async ({
  page,
}) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await expect(page.locator('#loading')).toHaveCount(0);
  const initial = await page.evaluate(() => {
    const game = (window as any).__GAME__,
      hero = game.world.hero;
    const projected = game.view.screenPoint(hero),
      picked = game.view.worldPoint(projected.x, projected.y);
    return {
      map: game.world.battlefield.id,
      hero: { x: hero.x, y: hero.y },
      picked,
      ground: game.view.models.get(hero.id).root.position.y,
    };
  });
  expect(initial.map).toBe('rift');
  expect(initial.ground).toBeGreaterThan(1.5);
  expect(
    Math.hypot(initial.hero.x - initial.picked.x, initial.hero.y - initial.picked.y)
  ).toBeLessThan(0.1);
  const destination = await page.evaluate(() => {
    const game = (window as any).__GAME__,
      hero = game.world.hero;
    const point = game.world.battlefield.reachable(
      { x: hero.x + 240, y: hero.y - 120 },
      hero.radius,
      'blue'
    );
    return { point, screen: game.view.screenPoint(point) };
  });
  await page.mouse.click(destination.screen.x, destination.screen.y, { button: 'right' });
  await expect
    .poll(async () =>
      page.evaluate((p) => {
        const hero = (window as any).__GAME__.world.hero;
        return Math.hypot(hero.x - p.x, hero.y - p.y);
      }, destination.point)
    )
    .toBeLessThan(5);
  const dummy = await page.evaluate(() => {
    const game = (window as any).__GAME__;
    return game.view.screenPoint(
      game.world.units.find((u: any) => u.kind === 'dummy'),
      0.65
    );
  });
  await page.mouse.click(dummy.x, dummy.y, { button: 'right' });
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as any).__GAME__.world.units.find((u: any) => u.kind === 'dummy').hp
        ),
      { timeout: 8000 }
    )
    .toBeLessThan(1500);
  await page.screenshot({ path: 'artifacts/browser-rift-fountain.png' });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('camera picking, model feet, and ability aim follow river elevation', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const expected = await page.evaluate(() => {
    const game = (window as any).__GAME__;
    game.setPaused(true);
    const p = game.world.battlefield.reachable({ x: 10000 - 7425, y: 7425 - 5000 }, 35, 'blue');
    Object.assign(game.world.hero, p, { previous: { ...p } });
    game.view.recenter(game.world.hero);
    game.world.tick += 8;
    game.view.render(game.world, 1, 0);
    const screen = game.view.screenPoint(p),
      picked = game.view.worldPoint(screen.x, screen.y);
    return {
      p,
      picked,
      ground: game.view.ground(p),
      feet: game.view.models.get(game.world.hero.id).root.position.y,
    };
  });
  expect(expected.ground).toBeLessThan(0);
  expect(expected.feet).toBeCloseTo(expected.ground, 5);
  expect(
    Math.hypot(expected.p.x - expected.picked.x, expected.p.y - expected.picked.y)
  ).toBeLessThan(0.1);
  await page.evaluate(() => {
    const game = (window as any).__GAME__;
    game.setPaused(false);
  });
  await page.mouse.move(1000, 400);
  await page.keyboard.down('w');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.screenshot({ path: 'artifacts/browser-rift-river-aim.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.up('w');
});

test('source brush visibility agrees with models, picking, and every fog-mask sample', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const hidden = await page.evaluate(async () => {
    const game = (window as any).__GAME__,
      world = game.world,
      view = game.view;
    game.setPaused(true);
    world.units = [world.hero];
    world.visionAreas = [];
    world.reveal = null;
    const metadata = await (await fetch('/assets/maps/rift-nav.json')).json();
    const bytes = new DataView(await (await fetch('/assets/maps/rift-nav.bin')).arrayBuffer());
    const flag = (i: number) => bytes.getUint16(metadata.sections.flags[0] + 2 * i, true);
    const point = (i: number) => ({
      x: metadata.minimum[0] + ((i % metadata.width) + 0.5) * metadata.cellSize - 7425,
      y: 7425 - metadata.minimum[2] - (Math.floor(i / metadata.width) + 0.5) * metadata.cellSize,
    });
    let brush = -1;
    for (let i = 0; i < metadata.width * metadata.height - 1; i++) {
      if (!(flag(i) & 1) || flag(i + 1) & 1 || (i + 1) % metadata.width === 0) continue;
      const a = point(i),
        b = point(i + 1);
      if (
        world.battlefield.lineWalkable(a, a, 35, 'blue') &&
        world.battlefield.lineWalkable(b, b, 35, 'blue')
      ) {
        brush = i;
        break;
      }
    }
    if (brush < 0) throw new Error('No valid source brush fixture');
    const outside = point(brush + 1);
    Object.assign(world.hero, outside, { previous: { ...outside } });
    const enemy = world.spawn('champion', 'red', point(brush));
    view.recenter(world.hero);
    world.tick += 8;
    view.render(world, 1, 0);
    const screen = view.screenPoint(enemy, 0.65);
    return {
      id: enemy.id,
      point: point(brush),
      visible: world.visible(enemy),
      rendered: view.models.get(enemy.id).root.visible,
      picked: view.pick(world, screen.x, screen.y)?.id,
    };
  });
  expect(hidden.visible).toBe(false);
  expect(hidden.rendered).toBe(false);
  expect(hidden.picked).not.toBe(hidden.id);
  const revealed = await page.evaluate(({ id, point }) => {
    const game = (window as any).__GAME__,
      world = game.world,
      view = game.view;
    const observer = world.spawn('melee', 'blue', point);
    observer.ai = false;
    world.tick += 8;
    view.render(world, 1, 0);
    const size = view.fogPixels.width,
      pixels = view.fogPixels.data,
      span = world.battlefield.half * 2;
    let mismatches = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const p = { x: ((x + 0.5) / size - 0.5) * span, y: ((y + 0.5) / size - 0.5) * span };
        if ((pixels[(y * size + x) * 4 + 3] === 0) !== world.pointVisible(p)) mismatches++;
      }
    return {
      visible: world.visible(world.unit(id)),
      rendered: view.models.get(id).root.visible,
      mismatches,
      size,
    };
  }, hidden);
  expect(revealed).toEqual({ visible: true, rendered: true, mismatches: 0, size: 256 });
});
