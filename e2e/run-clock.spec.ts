import { expect, test } from '@playwright/test';
test('late run rendering and browser reload preserve exact animation phase and bone pose', async ({
  page,
}) => {
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture');
  await ready();
  const initial = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x + 1000, y: w.hero.y } });
    w.step(25);
    return w.snapshot();
  });
  const pose = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed + 10);
      const m = g.view.models.get(w.hero.id),
        bone = m.root.getObjectByName('C_BUFFBONE_GLB_CHEST_LOC');
      m.root.updateMatrixWorld(true);
      return {
        clip: m.actionName,
        time: m.actions.run.time,
        weight: m.actions.run.getEffectiveWeight(),
        matrix: bone.matrixWorld.toArray(),
      };
    });
  const before = await pose();
  expect(before.clip).toBe('run');
  expect(before.weight).toBe(1);
  expect(await pose()).toEqual(before);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(initial);
  expect(await pose()).toEqual(before);
});
