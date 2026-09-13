import { expect, test } from '@playwright/test';

for (const learned of [false, true])
  test(`practice cooldown reset preserves ${learned ? 'learned' : 'unlearned'} spell state through save and reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (learned) {
      await page.keyboard.press('Control+q');
      await expect
        .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.q))
        .toBe(1);
      await page.evaluate(() => (window as any).__GAME__.world.gainExperience(280));
      await page.keyboard.press('Control+e');
      await expect
        .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.e))
        .toBe(1);
      await page.mouse.move(1000, 440);
      await page.keyboard.press('e');
      await expect
        .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.eCharges))
        .toBe(1);
    }
    await page.getByRole('button', { name: /Practice tools/ }).click();
    await expect(page.getByRole('dialog')).not.toContainText('All four abilities are unlocked');
    const ranks = await page.evaluate(() => (window as any).__GAME__.world.player.spellRanks);
    await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
    const expected = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return {
        ranks: w.player.spellRanks,
        points: w.player.skillPoints,
        stacks: w.player.qStacks,
        stackDuration: w.player.qStackExpiry ? w.player.qStackExpiry - w.tick : 0,
        charges: w.player.eCharges,
        recharge: w.player.eRechargeTick,
      };
    });
    expect(expected).toEqual({
      ranks,
      points: learned ? 0 : 1,
      stacks: learned ? 4 : 0,
      stackDuration: learned ? 240 : 0,
      charges: learned ? 2 : 0,
      recharge: null,
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const checkpoint = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(checkpoint);
    const restored = await page.evaluate(() => {
      const p = (window as any).__GAME__.world.player;
      return { ranks: p.spellRanks, charges: p.eCharges, points: p.skillPoints };
    });
    expect(restored).toEqual({ ranks, charges: learned ? 2 : 0, points: learned ? 0 : 1 });
    expect(errors).toEqual([]);
  });
