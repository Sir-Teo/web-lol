import { expect, test } from '@playwright/test';

test('Perseverance resumes after combat and advances the visible health bar identically after restore', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 300, y: 0, previous: { x: 300, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
    w.damage(w.hero, garen, 400, 'true');
    w.step(120);
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: garen.id,
      hp: garen.hp,
      rate: w.perseveranceRegenPerSecond(garen),
      snapshot: w.snapshot(),
    };
  });
  expect(before.hp).toBeCloseTo(293.2);
  expect(before.rate).toBe(0);
  const bar = page.locator(`.unit-bar[data-unit="${before.id}"] .unit-hp i`);
  await expect(bar).toBeVisible();
  const widthBefore = await bar.evaluate((el) => parseFloat((el as HTMLElement).style.width));
  await expect(page.locator('.combat-text')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/browser-garen-passive-interrupted.png' });
  const after = await page.evaluate(({ id, snapshot }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const restored = w.constructor.fromSnapshot(snapshot, w.battlefield);
    const garen = w.unit(id),
      owner = w.championState(id);
    w.step(owner.garenPassiveReadyTick - w.tick - 1);
    const lastBlockedRate = w.perseveranceRegenPerSecond(garen);
    const previousHp = garen.hp;
    w.step();
    const firstRecovery = garen.hp - previousHp;
    w.step(600);
    restored.step(w.tick - restored.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      hp: garen.hp,
      rate: w.perseveranceRegenPerSecond(garen),
      lastBlockedRate,
      firstRecovery,
      identical: w.snapshot() === restored.snapshot(),
    };
  }, before);
  expect(after.lastBlockedRate).toBe(0);
  expect(after.firstRecovery).toBeCloseTo(3.67 / 60);
  expect(after.rate).toBeCloseTo(2.07);
  expect(after.hp).toBeGreaterThan(before.hp + 40);
  expect(after.identical).toBe(true);
  const widthAfter = await bar.evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(widthAfter).toBeGreaterThan(widthBefore);
  await page.screenshot({ path: 'artifacts/browser-garen-passive-recovered.png' });
  expect(errors).toEqual([]);
});
