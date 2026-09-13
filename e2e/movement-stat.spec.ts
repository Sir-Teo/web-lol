import { expect, test } from '@playwright/test';

test('independent slows update movement and overhead status through stronger-effect expiry', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const ashe = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y });
    const lux = w.spawn('champion', 'red', { x: w.hero.x + 600, y: w.hero.y }, 'lux');
    w.applySlow(lux, w.hero, 'lucent', 120, 0.7);
    w.applySlow(ashe, w.hero, 'frost', 30, 0.5);
  });
  await expect(page.locator('#ms')).toHaveText('163');
  await expect(page.getByText('SLOWED', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.world.step(30));
  await expect(page.locator('#ms')).toHaveText('228');
  await expect(page.getByText('SLOWED', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.world.step(90));
  await expect(page.locator('#ms')).toHaveText('325');
  await expect(page.getByText('SLOWED', { exact: true })).toHaveCount(0);
});

test('movement-speed readout follows an attack slow, Heal haste and exact expirations', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.hero.x = w.hero.y = 0;
    const attacker = w.spawn('champion', 'red', { x: 400, y: 0 });
    attacker.ai = false;
    w.setOrder(attacker, { type: 'attack', target: w.hero.id });
    for (let i = 0; i < 100 && !w.hero.slowUntil; i++) w.step();
    w.setOrder(attacker, { type: 'idle' });
    g.hud.update(60);
  });
  await expect(page.locator('#ms')).toHaveText('260');
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: w.hero });
    w.step();
  });
  await expect(page.locator('#ms')).toHaveText('338');
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.hero.summonerHealSpeedUntil - w.tick - 1);
  });
  await expect(page.locator('#ms')).toHaveText('338');
  await page.evaluate(() => (window as any).__GAME__.world.step());
  await expect(page.locator('#ms')).toHaveText('260');
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.hero.slowUntil - w.tick);
  });
  await expect(page.locator('#ms')).toHaveText('325');
});

test('movement-speed readout rounds the decaying enhanced slow without changing the stored stat', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.hero.slowUntil = w.tick + 120;
    w.hero.slowMultiplier = 0.8;
    w.hero.criticalSlow = {
      startTick: w.tick,
      endTick: w.tick + 60,
      startMultiplier: 0.6,
      endMultiplier: 0.8,
    };
  });
  await expect(page.locator('#ms')).toHaveText('195');
  await page.evaluate(() => (window as any).__GAME__.world.step(30));
  await expect(page.locator('#ms')).toHaveText('228');
  await page.evaluate(() => (window as any).__GAME__.world.step(30));
  await expect(page.locator('#ms')).toHaveText('260');
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.speed)).toBe(325);
});
