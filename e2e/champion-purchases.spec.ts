import { expect, test } from '@playwright/test';

test('automatic enemy purchases survive a checkpoint and leave the human shop owner unchanged', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const bot = w.spawn('champion', 'red', w.battlefield.spawns.red);
    bot.ai = true;
    w.step();
    g.hud.update(60);
    const saved = w.snapshot();
    const restored = World.fromSnapshot(saved, w.battlefield);
    return {
      inventory: w.championState(bot.id).inventory,
      gold: w.championState(bot.id).gold,
      hp: bot.maxHp,
      humanInventory: w.player.inventory,
      humanGold: w.player.gold,
      identical: restored.snapshot() === saved,
      restoredInventory: restored.championState(bot.id).inventory,
    };
  });
  expect(result.inventory).toEqual(['blade']);
  expect(result.gold).toBe(50);
  expect(result.hp).toBe(690);
  expect(result.humanInventory).toEqual([]);
  expect(result.humanGold).toBe(500);
  expect(result.identical).toBe(true);
  expect(result.restoredInventory).toEqual(['blade']);
  await expect(page.locator('#inventory img')).toHaveCount(0);
});
