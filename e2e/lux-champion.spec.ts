import { expect, test } from '@playwright/test';

test('Lux renders her rig, queued binding cast and source recall sequence in the match', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const enemies = [300, 600, 900].map((x) => w.spawn('champion', 'red', { x, y: 0 }));
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
    w.step(8);
    g.view.render(w, 1, performance.now() / 1000);
    const model = g.view.models.get(lux.id);
    const casting = {
      asset: model.referenceAsset,
      action: model.actionName,
      time: model.actions.spell1.time,
    };
    w.step(48);
    g.view.render(w, 1, performance.now() / 1000);
    const hit = enemies.map((u: any) => u.rootUntil > w.tick);
    w.enqueue({ type: 'recall', unit: lux.id });
    w.step();
    g.view.render(w, 1, performance.now() / 1000);
    const recallStart = model.actionName;
    w.step(360);
    g.view.render(w, 1, performance.now() / 1000);
    return { casting, hit, recallStart, recallLater: model.actionName };
  });
  expect(result.casting.asset).toBe('lux-base');
  expect(result.casting.action).toBe('spell1');
  expect(result.casting.time).toBeGreaterThan(0);
  expect(result.hit).toEqual([true, true, false]);
  expect(result.recallStart).toBe('idle3');
  expect(result.recallLater).toBe('entry_b4dcde19');
  await page.screenshot({ path: 'artifacts/lux-match-recall.png' });
  expect(errors).toEqual([]);
});
