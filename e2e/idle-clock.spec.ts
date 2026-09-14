import { expect, test } from '@playwright/test';
import durations from '../src/content/champion-clip-durations.json' with { type: 'json' };
test('idle pose survives skipped renders and browser reload for both source champions', async ({
  page,
}) => {
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture');
  await ready();
  const start = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.spawn('champion', 'blue', { x: w.hero.x + 150, y: w.hero.y }, 'lux');
    for (const u of w.units) w.setOrder(u, { type: 'idle' });
    w.step(100);
    return w.snapshot();
  });
  const pose = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed + 20);
      return w.units.map((u: any) => {
        const m = g.view.models.get(u.id);
        m.root.updateMatrixWorld(true);
        return {
          champion: u.champion,
          clip: m.actionName,
          time: m.actions.idle1.time,
          weight: m.actions.idle1.getEffectiveWeight(),
          matrix: m.root.getObjectByName('C_BUFFBONE_GLB_CHEST_LOC').matrixWorld.toArray(),
          durations: Object.fromEntries(
            Object.entries(m.actions).map(([name, a]: [string, any]) => [
              name,
              a.getClip().duration,
            ])
          ),
        };
      });
    });
  const first = await pose();
  expect(await pose()).toEqual(first);
  for (const p of first) {
    expect(p.clip).toBe('idle1');
    expect(p.weight).toBe(1);
    expect(p.durations).toEqual(durations[p.champion as keyof typeof durations]);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(start);
  expect(await pose()).toEqual(first);
});
