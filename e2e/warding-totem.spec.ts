import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function saveReload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function pixels(page: Page, id: number) {
  return page.evaluate((id) => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const root = v.models.get(id).root,
      gl = v.renderer.getContext();
    const width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const sample = () => {
      v.renderer.render(v.scene, v.camera);
      const p = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return p;
    };
    const a = sample();
    root.visible = false;
    const b = sample();
    root.visible = true;
    sample();
    let count = 0;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
    return count;
  }, id);
}

test('real Rift ward input previews sight, cancels safely and resumes a saved in-flight source ward', async ({
  page,
}) => {
  test.setTimeout(150000);
  const faults: string[] = [],
    rigs: string[] = [];
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('requestfailed', (r) => faults.push(r.url()));
  page.on('request', (r) => {
    if (r.url().endsWith('/sightward-base.glb')) rigs.push(r.url());
  });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('#trinket .trinket-charges')).toHaveText('1');
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const point = w.battlefield.reachable({ x: w.hero.x + 350, y: w.hero.y + 150 }, 5, 'blue');
    return { point, screen: g.view.screenPoint(point, 0.05) };
  });
  await page.mouse.move(aim.screen.x, aim.screen.y);
  await page.keyboard.down('4');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.screenshot({ path: 'artifacts/ward-rift-guide.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.up('4');
  await expect(page.locator('#trinket .trinket-charges')).toHaveText('1');
  await page.locator('#trinket').click();
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.keyboard.press('Escape');
  await page.mouse.move(aim.screen.x, aim.screen.y);
  await page.keyboard.down('4');
  await page.keyboard.up('4');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.pendingWards.length) return false;
    g.setPaused(true);
    return true;
  });
  expect(
    await page.evaluate(
      () => (window as any).__GAME__.world.units.filter((u: any) => u.kind === 'ward').length
    )
  ).toBe(0);
  await saveReload(page);
  const placed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(60);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const u = w.units.find((u: any) => u.kind === 'ward');
    return {
      id: u.id,
      point: { x: u.x, y: u.y },
      ward: u.ward,
      model: g.view.models.get(u.id).referenceAsset,
      action: g.view.models.get(u.id).actionName,
      mode: w.matchMode,
      charges: w.player.trinket.charges,
    };
  });
  expect(placed.mode).toBe('practice');
  expect(placed.model).toBe('sightward-base');
  expect(placed.charges).toBe(0);
  expect(Math.hypot(placed.point.x - aim.point.x, placed.point.y - aim.point.y)).toBeLessThan(30);
  const contribution = await pixels(page, placed.id);
  expect(contribution).toBeGreaterThan(20);
  await expect(page.locator('.unit-bar.blue.ward:not([hidden])')).toHaveCount(1);
  await page.screenshot({ path: 'artifacts/ward-rift-placed.png' });
  await saveReload(page);
  expect(await pixels(page, placed.id)).toBeGreaterThan(20);
  await page.setViewportSize({ width: 600, height: 700 });
  const bounds = await page.locator('#trinket').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(600);
  await page.screenshot({ path: 'artifacts/ward-rift-small-hud.png' });
  expect(faults).toEqual([]);
  expect(rigs.length).toBeGreaterThanOrEqual(3);
  writeFileSync(
    'artifacts/ward-rift-input.json',
    JSON.stringify({ placed, contribution, rigs, bounds }, null, 2) + '\n'
  );
});

test('enemy ward ignores real Volley and takes three visible basic hits through an exact fighting reload', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await ready(page);
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units) u.ai = false;
    Object.assign(w.hero, { x: 0, y: -1000, previous: { x: 0, y: -1000 } });
    const owner = w.spawn('champion', 'red', { x: 800, y: -1000 });
    owner.ai = false;
    owner.hp = owner.maxHp = 10000;
    w.enqueue({ type: 'ward', unit: owner.id, point: { x: 350, y: -1000 } });
    w.step(21);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const ward = w.units.find((u: any) => u.kind === 'ward');
    return { id: ward.id, point: g.view.screenPoint(ward, 0.65), ownerId: owner.id };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.move(setup.point.x, setup.point.y);
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    if (!w.projectiles.some((p: any) => p.type === 'volley')) return false;
    g.setPaused(true);
    return true;
  }, setup.id);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(35);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  expect(await page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.id)).toBe(3);
  // Keep the ward visible for the first input after the controlled projectile probe.
  await page.evaluate((id) => {
    const w = (window as any).__GAME__.world;
    w.unit(id).ward.revealUntil = w.tick + 120;
  }, setup.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(setup.point.x, setup.point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__;
    if (g.world.unit(id).hp !== 2) return false;
    g.setPaused(true);
    return true;
  }, setup.id);
  await page.screenshot({ path: 'artifacts/ward-enemy-first-hit.png' });
  await saveReload(page);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__,
      u = g.world.unit(id);
    if (!u || u.hp !== 0) return false;
    g.setPaused(true);
    return true;
  }, setup.id);
  const killed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { gold: w.player.gold, cs: w.player.cs, kills: w.player.kills, heroHp: w.hero.hp };
  });
  expect(killed.gold).toBe(510);
  expect(killed.cs).toBe(0);
  expect(killed.kills).toBe(0);
  await page.screenshot({ path: 'artifacts/ward-enemy-cleared.png' });
  expect(errors).toEqual([]);
});

test('ward sight outlives its owner position and ends exactly after a corpse-free saved expiry', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await ready(page);
  const checkpoint = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units) u.ai = false;
    const point = w.battlefield.reachable({ x: -1800, y: -1300 }, 35, 'blue');
    Object.assign(w.hero, point, { previous: { ...point } });
    w.enqueue({ type: 'ward', unit: w.hero.id, point });
    w.step(21 + 120);
    const ward = w.units.find((u: any) => u.kind === 'ward');
    const away = w.battlefield.reachable({ x: point.x - 2200, y: point.y }, 35, 'blue');
    Object.assign(w.hero, away, { previous: { ...away } });
    g.view.locked = false;
    g.view.center = { ...point };
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: ward.id,
      point,
      visible: w.pointVisible(point, 'blue'),
      expiry: ward.ward.expireTick,
    };
  });
  expect(checkpoint.visible).toBe(true);
  await page.screenshot({ path: 'artifacts/ward-rift-sight.png' });
  expect(await pixels(page, checkpoint.id)).toBeGreaterThan(20);
  await saveReload(page);
  const expired = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id),
      point = { x: u.x, y: u.y };
    w.tick = u.ward.expireTick - 2;
    w.step();
    const before = w.pointVisible(point, 'blue');
    w.step();
    const after = w.pointVisible(point, 'blue');
    w.step(60);
    g.view.locked = false;
    g.view.center = { ...point };
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { before, after, corpseGone: !w.unit(id) };
  }, checkpoint.id);
  expect(expired).toEqual({ before: true, after: false, corpseGone: true });
  await page.screenshot({ path: 'artifacts/ward-rift-expired.png' });
  await saveReload(page);
});

test('practice cooldown reset refills wards without duplicating a committed saved placement', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/?scene=fixture');
  await ready(page);
  const target = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const point = w.battlefield.reachable({ x: w.hero.x + 300, y: w.hero.y }, 5, 'blue');
    return g.view.screenPoint(point, 0.05);
  });
  await page.mouse.move(target.x, target.y);
  await page.keyboard.down('4');
  await page.keyboard.up('4');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.pendingWards.length) return false;
    g.setPaused(true);
    return true;
  });
  await page.locator('#practice-button').click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  await expect(page.locator('#trinket .trinket-charges')).toHaveText('2');
  expect(await page.evaluate(() => (window as any).__GAME__.world.pendingWards.length)).toBe(1);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await saveReload(page);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      wards: w.units.filter((u: any) => u.kind === 'ward').length,
      pending: w.pendingWards.length,
      charges: w.player.trinket.charges,
    };
  });
  expect(restored).toEqual({ wards: 1, pending: 0, charges: 2 });
  await page.screenshot({ path: 'artifacts/ward-practice-reset.png' });
});
