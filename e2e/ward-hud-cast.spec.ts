import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('HUD instant casting replaces ward selection through pointer, Space and Enter', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.commands = [];
    w.step = () => {};
    return g.view.screenPoint({ x: w.hero.x + 150, y: w.hero.y });
  });
  const rows = [];
  for (const method of ['pointer', 'Space', 'Enter']) {
    await page.locator('#trinket').click();
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
    const heal = page.getByRole('button', { name: 'Heal', exact: true });
    if (method === 'pointer') await heal.click();
    else {
      await heal.focus();
      await page.keyboard.press(method);
    }
    const row = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      return {
        aim: g.view.aimMode,
        commands: g.world.commands,
        charges: g.world.player.trinket.charges,
      };
    });
    rows.push({ method, ...row });
    writeFileSync(
      info.outputPath('ward-hud-cast.json'),
      JSON.stringify({ rows, errors }, null, 2) + '\n'
    );
    expect(row.aim).toBeNull();
    await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
    expect(row.charges).toBe(1);
    expect(row.commands.map((c: any) => [c.type, c.ability])).toEqual(
      Array.from({ length: rows.length }, () => ['cast', 'f'])
    );
  }
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press('4');
  const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(commands.map((c: any) => c.type)).toEqual(['cast', 'cast', 'cast', 'ward']);
  // Cancelling a fresh preview must preserve the ward command already accepted.
  await page.locator('#trinket').click();
  await page.getByRole('button', { name: 'Heal', exact: true }).click();
  const afterReplacement = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(afterReplacement.slice(0, commands.length)).toEqual(commands);
  expect(afterReplacement.map((c: any) => c.type)).toEqual([
    'cast',
    'cast',
    'cast',
    'ward',
    'cast',
  ]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ward-hud-cast.json'),
    JSON.stringify({ rows, commands, afterReplacement, errors }, null, 2) + '\n'
  );
});
