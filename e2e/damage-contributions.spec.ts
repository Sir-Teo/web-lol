import { expect, test } from '@playwright/test';

test('manual checkpoint preserves champion damage contributors without replaying combat events', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const enemy = w.units.find((u: any) => u.kind === 'champion' && u.team === 'red');
    enemy.ai = false;
    w.damage(w.hero, enemy, 1, 'true');
    return {
      enemy: enemy.id,
      contributors: w.championState(enemy.id).damageContributors,
      snapshot: w.snapshot(),
    };
  });
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    return {
      contributors: g.world.championState(id).damageContributors,
      snapshot: g.world.snapshot(),
      events: g.world.events,
      paused: g.hud.paused,
    };
  }, saved.enemy);
  expect(saved.contributors).toHaveLength(1);
  expect(restored.contributors).toEqual(saved.contributors);
  expect(restored.snapshot).toBe(saved.snapshot);
  expect(restored.events).toEqual([]);
  expect(restored.paused).toBe(true);
});
