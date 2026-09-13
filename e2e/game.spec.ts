import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await expect(page.locator('#loading')).toHaveCount(0);
}
const state = (page: Page) => page.evaluate(() => (window as any).__GAME__.snapshot());

test('boots with local assets, animated hero, and no runtime errors', async ({ page }) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await boot(page);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await expect(page.getByRole('button', { name: 'Volley', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => Object.keys((window as any).__GAME__.view.models.get(1).actions))
  ).toContain('run');
  await page.screenshot({ path: 'artifacts/browser-ready.png' });
});

test('right-click moves, stop halts, and attack targets receive damage', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  const click = await page.evaluate(() =>
    (window as any).__GAME__.view.screenPoint({ x: -850, y: 640 })
  );
  await page.mouse.click(click.x, click.y, { button: 'right' });
  await expect
    .poll(async () => (await state(page)).units[0].x)
    .toBeGreaterThan(before.units[0].x + 100);
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  const stopped = (await state(page)).units[0];
  await page.waitForTimeout(300);
  expect((await state(page)).units[0].x).toBe(stopped.x);
  const dummy = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(
      g.world.units.find((u: any) => u.kind === 'dummy'),
      0.65
    );
  });
  await page.mouse.click(dummy.x, dummy.y, { button: 'right' });
  await expect
    .poll(async () => (await state(page)).units.find((u: any) => u.kind === 'dummy').hp, {
      timeout: 8000,
    })
    .toBeLessThan(1500);
});

test('holding a skill aims, release casts, and cooldown prevents repeat', async ({ page }) => {
  await boot(page);
  const dummy = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(g.world.units.find((u: any) => u.kind === 'dummy'));
  });
  await page.mouse.move(dummy.x, dummy.y);
  await page.keyboard.down('w');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.screenshot({ path: 'artifacts/browser-volley-aim.png' });
  await page.keyboard.up('w');
  await expect(page.locator('[data-ability="w"]')).toHaveClass(/cooling/);
  await expect
    .poll(async () => (await state(page)).units.find((u: any) => u.kind === 'dummy').hp)
    .toBeLessThan(1500);
  const cd = (await state(page)).player.cooldowns.w;
  await page.keyboard.press('w');
  expect((await state(page)).player.cooldowns.w).toBe(cd);
});

test('pause freezes simulation and clears a held cast', async ({ page }) => {
  await boot(page);
  await page.keyboard.down('r');
  await page.keyboard.press('Escape');
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  await page.keyboard.up('r');
  expect((await state(page)).player.cooldowns.r).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const tick = (await state(page)).tick;
  await page.waitForTimeout(350);
  expect((await state(page)).tick).toBe(tick);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(tick);
});

test('shop purchases change stats and inventory, then reject overspending', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('p');
  await page.locator('[data-buy="blade"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  expect((await state(page)).player.inventory).toEqual(['blade']);
  expect((await state(page)).units[0].damage).toBe(69);
  await page.locator('[data-buy="pickaxe"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Not enough gold');
  await page.screenshot({ path: 'artifacts/browser-shop.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#inventory img')).toHaveCount(1);
});

test('HUD fits a laptop viewport and minimap changes camera', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  const hud = await page.locator('.champion-hud').boundingBox(),
    map = await page.locator('.minimap-shell').boundingBox();
  expect(hud!.x + hud!.width).toBeLessThan(map!.x);
  expect(hud!.y).toBeGreaterThan(768 * 0.75);
  const original = await page.evaluate(() => (window as any).__GAME__.view.center.x);
  await page.locator('#minimap').click({ position: { x: 130, y: 65 } });
  expect(await page.evaluate(() => (window as any).__GAME__.view.center.x)).not.toBe(original);
  await page.keyboard.press('Space');
  const { heroX, cameraX } = await page.evaluate(() => ({
    heroX: (window as any).__GAME__.world.hero.x,
    cameraX: (window as any).__GAME__.view.center.x,
  }));
  expect(cameraX).toBeCloseTo(heroX);
  await page.screenshot({ path: 'artifacts/browser-laptop.png' });
});

test('holding aim reuses GPU geometry and Escape cancels without spending mana', async ({
  page,
}) => {
  await boot(page);
  await page.mouse.move(900, 380);
  await page.keyboard.down('w');
  await page.waitForTimeout(150);
  const geometries = await page.evaluate(
    () => (window as any).__GAME__.view.renderer.info.memory.geometries
  );
  await page.mouse.move(1000, 440, { steps: 15 });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as any).__GAME__.view.renderer.info.memory.geometries)
  ).toBe(geometries);
  await page.keyboard.press('Escape');
  await page.keyboard.up('w');
  expect((await state(page)).player.cooldowns.w).toBe(0);
});

test('dialog keeps keyboard focus inside its controls', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Return to the Rift', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save match', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Controls & keybindings', exact: true })
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Restart practice', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Return to the Rift', exact: true })).toBeFocused();
});

test('brush visibility agrees across battlefield, picking, HUD, effects, and fog', async ({
  page,
}) => {
  await boot(page);
  const hidden = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.events = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -820, y: 450, previous: { x: -820, y: 450 } });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 });
    w.emit('damage', enemy, { unit: enemy.id, value: 123 });
    w.projectiles = [
      {
        id: w.nextId++,
        source: enemy.id,
        team: 'red',
        type: 'volley',
        x: enemy.x,
        y: enemy.y,
        previous: { x: enemy.x, y: enemy.y },
        direction: { x: 0, y: 1 },
        target: null,
        damage: 1,
        speed: 0,
        radius: 12,
        remaining: 1200,
        volleyId: null,
      },
    ];
    v.selected = enemy.id;
    w.step(8);
    v.render(w, 1, w.time);
    g.hud.update(60);
    const screen = v.screenPoint(enemy, 0.65);
    const fogX = Math.floor((enemy.x / 8200 + 0.5) * 256);
    const fogY = Math.floor((enemy.y / 8200 + 0.5) * 256);
    return {
      id: enemy.id,
      model: v.models.get(enemy.id).root.visible,
      picked: v.pick(w, screen.x, screen.y)?.id,
      projectile: [...v.projectileModels.values()].some((m: any) => m.visible),
      fogAlpha: v.fogCanvas.getContext('2d').getImageData(fogX, fogY, 1, 1).data[3],
    };
  });
  expect(hidden.model).toBe(false);
  expect(hidden.picked).not.toBe(hidden.id);
  expect(hidden.projectile).toBe(false);
  expect(hidden.fogAlpha).toBeGreaterThan(150);
  await expect(page.locator(`#target-panel`)).toBeHidden();
  await expect(page.locator(`.unit-bar[data-unit="${hidden.id}"]`)).toBeHidden();
  await expect(page.locator('.combat-text')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/browser-brush-hidden.png' });

  const revealed = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    Object.assign(w.hero, { x: -700, y: -50 });
    w.step(8);
    v.render(w, 1, w.time);
    g.hud.update(60);
    return {
      model: v.models.get(id).root.visible,
      projectile: [...v.projectileModels.values()].some((m: any) => m.visible),
    };
  }, hidden.id);
  expect(revealed.model).toBe(true);
  expect(revealed.projectile).toBe(true);
  await expect(page.locator('#target-panel')).toBeVisible();
  await expect(page.locator(`.unit-bar[data-unit="${hidden.id}"]`)).toBeVisible();
  // The earlier hidden damage is not replayed after entering the brush.
  await expect(page.locator('.combat-text')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/browser-brush-revealed.png' });
});

test('six reference minions render with independent skeletons and complete death clips', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  const gallery = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    v.center = { x: -400, y: 300 };
    v.zoom = 0.7;
    const ids: number[] = [];
    for (const [j, team] of ['blue', 'red'].entries())
      for (const [i, kind] of ['melee', 'caster', 'siege'].entries()) {
        const x = -1100 + i * 700;
        const u = w.spawn(kind, team, { x, y: -0.75 * x + (j ? 200 : -200) });
        u.ai = false;
        u.facing = 0;
        ids.push(u.id);
      }
    v.render(w, 1, 0);
    g.hud.update(60);
    return ids.map((id) => {
      const model = v.models.get(id);
      return {
        id,
        asset: model.referenceAsset,
        clips: Object.keys(model.actions).sort(),
        barHeight: model.barHeight,
        visible: model.root.visible,
      };
    });
  });
  expect(gallery.map((m) => m.asset)).toEqual([
    'blue-melee',
    'blue-caster',
    'blue-siege',
    'red-melee',
    'red-caster',
    'red-siege',
  ]);
  for (const model of gallery) {
    expect(model.clips).toEqual(['attack1', 'death', 'idle1', 'run']);
    expect(model.barHeight).toBeGreaterThan(0.4);
    expect(model.barHeight).toBeLessThan(2);
    expect(model.visible).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/browser-minion-gallery.png' });
  const death = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const dying = w.unit(id);
    const survivor = w.spawn('melee', 'blue', { x: dying.x + 150, y: dying.y });
    survivor.ai = false;
    w.damage(w.hero, dying, 10000, 'true');
    // Advance in render-sized increments so the real mixer can play the source clip.
    for (let i = 0; i < 40; i++) {
      w.step(3);
      v.render(w, 1, v.previousElapsed + 0.05);
    }
    const a = v.models.get(id),
      b = v.models.get(survivor.id);
    const result = {
      retained: !!w.unit(id),
      visible: a.root.visible,
      action: a.actionName,
      time: a.actions.death.time,
      separateMixer: a.mixer !== b.mixer,
      survivor: b.actionName,
      texturesBeforeRemoval: v.renderer.info.memory.textures,
    };
    for (let i = 0; i < 45; i++) {
      w.step(3);
      v.render(w, 1, v.previousElapsed + 0.05);
    }
    return {
      ...result,
      removed: !v.models.has(id),
      survivorStillVisible: b.root.visible,
      texturesAfterRemoval: v.renderer.info.memory.textures,
    };
  }, gallery[0].id);
  expect(death.retained).toBe(true);
  expect(death.visible).toBe(true);
  expect(death.action).toBe('death');
  expect(death.time).toBeGreaterThan(1.8);
  expect(death.separateMixer).toBe(true);
  expect(death.survivor).toBe('idle1');
  expect(death.removed).toBe(true);
  expect(death.survivorStillVisible).toBe(true);
  expect(death.texturesAfterRemoval).toBeLessThan(death.texturesBeforeRemoval);
  expect(errors).toEqual([]);
});

test('cancelling attack windup returns the animated champion to idle', async ({ page }) => {
  await boot(page);
  const states = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 400, y: w.hero.y });
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: target.id } });
    w.step(5);
    v.render(w, 1, v.previousElapsed + 0.05);
    const attack = v.models.get(w.hero.id).actionName;
    w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'idle' } });
    w.step();
    v.render(w, 1, v.previousElapsed + 0.05);
    return { attack, stopped: v.models.get(w.hero.id).actionName, hp: target.hp };
  });
  expect(states.attack).toBe('attack1');
  expect(states.stopped).toBe('idle1');
  expect(states.hp).toBe(1500);
});
