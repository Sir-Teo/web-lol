import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('an instant spell replaces held and clicked ward previews without placing a ward', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    // Hold accepted input commands at this boundary; do not advance simulation.
    w.step = () => {};
    g.view.render(w, 1, g.view.previousElapsed);
    return g.view.screenPoint({ x: w.hero.x + 150, y: w.hero.y });
  });
  const rows = [];
  for (const gesture of ['held', 'clicked']) {
    if (gesture === 'held') {
      await page.mouse.move(point.x, point.y);
      await page.keyboard.down('4');
    } else {
      await page.locator('#trinket').click();
      await page.mouse.move(point.x, point.y);
    }
    await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
    expect(await page.evaluate(() => (window as any).__GAME__.view.aimMode)).toBe('ward');
    await page.keyboard.press('f');
    await page.keyboard.up('4');
    const row = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      return {
        aimMode: g.view.aimMode,
        commands: g.world.commands,
        charges: g.world.player.trinket.charges,
        tick: g.world.tick,
      };
    });
    rows.push({ gesture, ...row });
    writeFileSync(
      info.outputPath('ward-spell-transition.json'),
      JSON.stringify({ rows, errors }, null, 2) + '\n'
    );
    expect(row.aimMode).toBeNull();
    await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
    expect(row.charges).toBe(1);
    expect(row.commands.map((c: any) => [c.type, c.ability])).toEqual(
      Array.from({ length: rows.length }, () => ['cast', 'f'])
    );
  }
  // A fresh ward gesture still places exactly one command at the chosen point.
  await page.keyboard.press('4');
  const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(commands.map((c: any) => c.type)).toEqual(['cast', 'cast', 'ward']);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('ward-spell-transition.png') });
  writeFileSync(
    info.outputPath('ward-spell-transition.json'),
    JSON.stringify({ rows, commands, errors }, null, 2) + '\n'
  );
});
