import { expect, test } from '@playwright/test';

test('both Lux attack variants render and the second pose survives a browser checkpoint', async ({
  page,
}) => {
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture');
  await ready();
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    const seen = new Set<string>();
    let last = -1;
    for (let i = 0; i < 2000; i++) {
      w.step();
      const cycle = lux.attackCycle;
      if (!cycle || cycle.startTick === last || w.tick - cycle.startTick !== 14) continue;
      last = cycle.startTick;
      g.view.render(w, 1, 0);
      const model = g.view.models.get(lux.id);
      seen.add(model.actionName);
      if (seen.size === 2 && model.actionName === 'attack2') {
        const hand = model.root.getObjectByName('R_Hand');
        return {
          id: lux.id,
          seen: [...seen].sort(),
          clip: model.actionName,
          time: model.actions.attack2.time,
          hand: hand.matrixWorld.toArray(),
          snapshot: w.snapshot(),
        };
      }
    }
    throw new Error('Both source variants were not rendered');
  });
  expect(before.seen).toEqual(['attack1', 'attack2']);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  const after = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.render(g.world, 1, 0);
    const model = g.view.models.get(id);
    return {
      clip: model.actionName,
      time: model.actions.attack2.time,
      hand: model.root.getObjectByName('R_Hand').matrixWorld.toArray(),
      snapshot: g.world.snapshot(),
    };
  }, before.id);
  expect(after.snapshot).toBe(before.snapshot);
  expect(after.clip).toBe('attack2');
  expect(after.time).toBe(before.time);
  after.hand.forEach((v: number, i: number) =>
    expect(Math.abs(v - before.hand[i])).toBeLessThan(1e-10)
  );
});
