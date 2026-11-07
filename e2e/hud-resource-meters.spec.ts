import { test, expect } from '@playwright/test';

for (const champion of ['ashe', 'garen'] as const)
  test(`${champion} HUD exposes current resources without mutating the match`, async ({ page }) => {
    await page.route('**/resource-meter-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><script type="module" src="/@vite/client"></script><link rel="stylesheet" href="/src/style.css"><main></main><canvas tabindex="0"></canvas>',
      })
    );
    await page.goto('/resource-meter-probe');
    await page.evaluate(async (champion) => {
      const [{ Hud }, { World }, { PRACTICE_FIXTURE }] = await Promise.all([
        import('/src/ui/hud.ts'),
        import('/src/simulation/world.ts'),
        import('/src/content/practice-fixture.ts'),
      ]);
      const world = new World(false, PRACTICE_FIXTURE, champion);
      world.hero.hp = 123.25;
      world.hero.maxHp = 700.5;
      world.hero.mana = champion === 'garen' ? 0 : 87.75;
      world.hero.maxMana = champion === 'garen' ? 0 : 300.5;
      const view: any = {
        renderer: { domElement: document.querySelector('canvas') },
        locked: true,
      };
      const before = world.snapshot();
      const hud: any = new Hud(document.querySelector('main')!, world, view, {} as any);
      hud.drawMinimap = () => {};
      (window as any).__RESOURCE_METERS__ = { world, hud, before };
    }, champion);
    const health = page.getByRole('meter', { name: 'Health', exact: true });
    await expect(health).toHaveAttribute('aria-valuemin', '0');
    await expect(health).toHaveAttribute('aria-valuemax', '701');
    await expect(health).toHaveAttribute('aria-valuenow', '124');
    const mana = page.getByRole('meter', { name: 'Mana', exact: true });
    if (champion === 'garen') await expect(mana).toHaveCount(0);
    else {
      await expect(mana).toHaveAttribute('aria-valuemax', '300');
      await expect(mana).toHaveAttribute('aria-valuenow', '87');
    }
    expect(
      await page.evaluate(() => {
        const p = (window as any).__RESOURCE_METERS__;
        return p.before === p.world.snapshot();
      })
    ).toBe(true);
    await page.evaluate(() => {
      const p = (window as any).__RESOURCE_METERS__;
      p.world.hero.hp = 0;
      p.world.hero.maxHp = 800.25;
      p.world.hero.mana = 22.5;
      p.world.hero.maxMana = p.world.hero.champion === 'garen' ? 0 : 350.75;
      p.before = p.world.snapshot();
      p.hud.update(null);
    });
    await expect(health).toHaveAttribute('aria-valuemax', '801');
    await expect(health).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#health-text')).toHaveText('0 / 801');
    if (champion === 'ashe') {
      await expect(mana).toHaveAttribute('aria-valuemax', '350');
      await expect(mana).toHaveAttribute('aria-valuenow', '22');
      await expect(page.locator('#mana-text')).toHaveText('22 / 350');
    }
    expect(
      await page.evaluate(() => {
        const p = (window as any).__RESOURCE_METERS__;
        return p.before === p.world.snapshot();
      })
    ).toBe(true);
  });
