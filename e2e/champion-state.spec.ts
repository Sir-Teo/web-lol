import { expect, test } from '@playwright/test';

test('checkpoint reload preserves independent champion resources and the human HUD owner', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.nextWaveTick = Infinity;
    const enemy = w.units.find((u: any) => u.kind === 'champion' && u.team === 'red');
    enemy.ai = false;
    const state = w.championState(enemy.id);
    state.cooldowns.w = w.tick + 600;
    state.eCharges = 0;
    state.eRechargeTick = w.tick + 60;
    state.qStacks = 3;
    state.qStackExpiry = w.tick + 30;
    return {
      snapshot: w.snapshot(),
      enemy: enemy.id,
      human: w.player.id,
      deadline: state.cooldowns.w,
    };
  });
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(({ enemy, human }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const snapshot = w.snapshot(),
      alias = w.championState(human) === w.player;
    w.step(60);
    g.hud.update(60);
    return {
      snapshot,
      alias,
      paused: g.hud.paused,
      enemy: w.championState(enemy),
      human: w.player,
    };
  }, saved);
  expect(result.snapshot).toBe(saved.snapshot);
  expect(result.alias).toBe(true);
  expect(result.paused).toBe(true);
  expect(result.enemy.eCharges).toBe(1);
  expect(result.enemy.qStacks).toBeLessThan(3);
  expect(result.enemy.cooldowns.w).toBe(saved.deadline);
  expect(result.human.eCharges).toBe(2);
  expect(result.human.cooldowns.w).toBe(0);
  await expect(page.locator('[data-ability="e"] .ability-charges')).toHaveText('2');
});
