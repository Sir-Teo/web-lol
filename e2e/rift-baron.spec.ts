import { expect, test } from '@playwright/test';

test('playtest Baron enters the pit, can be secured with F and restores its respawn', async ({
  page,
}) => {
  test.setTimeout(420_000);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=roster-rift&objectives=baron');
  await ready();
  expect(requests.some((path) => path.endsWith('/sru-baron-base.glb'))).toBe(true);
  expect(requests.some((path) => path.includes('/assets/audio/baron-basic/'))).toBe(false);
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const scoreboard = page.getByRole('region', { name: 'Baron Nashor' });
  await page.keyboard.down('Tab');
  await expect(scoreboard).toHaveText(/^Baron Nashor in (20:00|19:\d\d)$/);
  await page.keyboard.up('Tab');
  await button('Pause game').click();
  await button('New match').click();
  await page.getByRole('group', { name: 'F spell' }).getByRole('button', { name: 'Smite' }).click();
  await Promise.all([page.waitForEvent('load'), button('Start 5v5 match').click()]);
  await ready();
  await button('Return to the Rift').click();

  const boss = await page.evaluate(async () => {
    const { world: w, setPaused, hud } = (window as any).__GAME__;
    const { RIFT_BARON } = await import('/src/content/baron.ts');
    setPaused(true);
    for (const unit of w.units) unit.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.tick = RIFT_BARON.firstReadyTick - 1;
    w.step();
    const baron = w.unit(w.riftBaron.unitId);
    hud.scoreboard(true);
    return {
      id: baron.id,
      visible: w.visible(baron),
      beforeScouting: hud.root.querySelector('[aria-label="Baron Nashor"]').textContent,
    };
  });
  expect(boss.visible).toBe(false);
  expect(boss.beforeScouting).toBe('Scout the top river pit for Baron Nashor.');

  const point = await page.evaluate((id) => {
    const { world: w, view, hud } = (window as any).__GAME__;
    const baron = w.unit(id);
    const approach = w.battlefield.reachable({ x: baron.x + 450, y: baron.y }, w.hero.radius);
    Object.assign(w.hero, approach, { previous: { ...approach } });
    w.damage(w.hero, baron, baron.maxHp - 100, 'true');
    view.recenter(w.hero);
    view.render(w, 1, view.previousElapsed);
    hud.scoreboard(true);
    return { ...view.screenPoint(baron, 0.65), rig: view.models.get(id).referenceAsset };
  }, boss.id);
  expect(point.rig).toBe('sru-baron-base');
  await expect(scoreboard).toHaveText('Baron Nashor in sight');
  await page.keyboard.press('Escape');
  await button('Return to the Rift').click();
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press('f');
  await expect(page.locator('#toast')).toHaveText('Your team slew Baron Nashor. +150 gold');
  await page.keyboard.down('Tab');
  await expect(scoreboard).toHaveText(/^Baron Nashor respawns in (6:00|5:\d\d)$/);
  await page.keyboard.up('Tab');
  await page.keyboard.press('Escape');
  await button('Save match').click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const snapshot = () => page.evaluate(() => (window as any).__GAME__.world.snapshot());
  const saved = await snapshot();
  await page.reload();
  await ready();
  expect(await snapshot()).toBe(saved);
  expect(errors).toEqual([]);
});
