import { expect, test } from '@playwright/test';

test('Hawkshot reveal without damage grants Ashe an assist shown on the HUD', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 1600, y: 0 });
    const killer = w.spawn('champion', 'blue', { x: 0, y: 0 });
    target.ai = killer.ai = false;
    const before = w.visible(target);
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 2000, y: 0 } });
    w.step(120);
    const revealed = w.visible(target),
      record = w.championState(target.id);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.damage(killer, target, 10000, 'true');
    restored.damage(restored.unit(killer.id)!, restored.unit(target.id)!, 10000, 'true');
    g.hud.update(60);
    return {
      before,
      revealed,
      contributions: record.revealContributors.length,
      assists: w.player.assists,
      restoredAssists: restored.player.assists,
    };
  });
  expect(result.before).toBe(false);
  expect(result.revealed).toBe(true);
  expect(result.contributions).toBe(1);
  expect(result.assists).toBe(1);
  expect(result.restoredAssists).toBe(1);
  await expect(page.locator('#personal')).toHaveText('0 / 0 / 1');
});
