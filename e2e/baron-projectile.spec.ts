import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('real combat releases a visible provisional Baron missile before damage and restores its flight', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&encounter=baron');
  await ready();
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron');
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.projectiles.some((p: any) => p.source === b.id)) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return { bossId: b.id, hp: w.hero.hp, point: g.view.screenPoint(b, 0.65) };
  });
  await page.mouse.click(before.point.x, before.point.y, { button: 'right' });
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => (window as any).__GAME__.world.projectiles.some((p: any) => p.source === id),
          before.bossId
        ),
      { timeout: 20000 }
    )
    .toBe(true);
  const flight = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step(8);
    const p = w.projectiles.find((p: any) => p.source === id);
    if (!p) throw Error('Expected an in-flight Baron missile');
    g.view.render(w, 1, g.view.previousElapsed);
    const marker = g.view.projectileModels.get(p.id);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      tick: w.tick,
      hp: w.hero.hp,
      projectile: structuredClone(p),
      marker: marker?.name,
      markerVisible: marker?.visible,
      saved,
      future: copy.snapshot(),
    };
  }, before.bossId);
  expect(flight.hp).toBe(before.hp);
  expect(flight.projectile.speed).toBe(1300);
  expect(flight.marker).toBe('Baron provisional attack marker');
  expect(flight.markerVisible).toBe(true);
  await page.screenshot({ path: info.outputPath('baron-provisional-flight.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(flight.saved);
  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return w.snapshot();
  });
  expect(future).toBe(flight.future);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-projectile.json'),
    JSON.stringify({ before, flight, errors }, null, 2)
  );
});
