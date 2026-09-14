import { expect, test } from '@playwright/test';

test('browser checkpoints retain Lux homing history in flight and after impact', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  const save = async () => {
    const button = page.getByRole('button', { name: 'Save match', exact: true });
    if (!(await button.isVisible())) await page.keyboard.press('Escape');
    await button.click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
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
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
    w.setOrder(lux, { type: 'idle' });
    if (w.luxAttackVisuals.length !== 1) throw new Error('Expected a real released Lux attack');
    const snapshot = w.snapshot();
    w.step(20);
    const continued = w.snapshot();
    Object.assign(w, w.constructor.fromSnapshot(snapshot, w.battlefield));
    return { snapshot, continued };
  });
  await save();
  await page.reload();
  await ready();
  const impact = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const before = w.snapshot();
    w.step(20);
    return {
      before,
      after: w.snapshot(),
      stop: w.luxAttackVisuals[0]?.stopTick,
      projectiles: w.projectiles.length,
    };
  });
  expect(impact.before).toBe(start.snapshot);
  expect(impact.after).toBe(start.continued);
  expect(impact.projectiles).toBe(0);
  expect(impact.stop).toBeGreaterThan(0);
  await save();
  await page.reload();
  await ready();
  const end = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const before = w.snapshot();
    w.step(37);
    return { before, count: w.luxAttackVisuals.length };
  });
  expect(end.before).toBe(impact.after);
  expect(end.count).toBe(0);
  expect(errors).toEqual([]);
});
