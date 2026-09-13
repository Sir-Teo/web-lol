import { expect, test } from '@playwright/test';

test('F uses the hovered ally and applies health and haste to only two recipients', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.hero.hp = 10;
    const target = w.spawn('champion', 'blue', { x: w.hero.x + 450, y: w.hero.y });
    const other = w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y - 450 });
    target.hp = 200;
    other.hp = 1;
    return { id: target.id, otherId: other.id, point: g.view.screenPoint(target, 0.65) };
  });
  await page.mouse.move(setup.point.x, setup.point.y);
  await page.keyboard.press('f');
  await expect
    .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, setup.id))
    .toBe(280);
  const result = await page.evaluate(({ id, otherId }) => {
    const w = (window as any).__GAME__.world,
      ally = w.unit(id),
      other = w.unit(otherId);
    return {
      otherHp: other.hp,
      haste: ally.summonerHealSpeedUntil > w.tick,
      otherHaste: other.summonerHealSpeedUntil,
      speed: w.movementSpeed(ally),
      normal: ally.speed,
      sameExpiry: ally.summonerHealSpeedUntil === w.hero.summonerHealSpeedUntil,
    };
  }, setup);
  expect(result.otherHp).toBe(1);
  expect(result.haste).toBe(true);
  expect(result.otherHaste).toBe(0);
  expect(result.speed).toBeCloseTo(result.normal * 1.3);
  expect(result.sameExpiry).toBe(true);
});
