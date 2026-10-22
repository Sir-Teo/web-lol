import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function start(page: Page, mode: 'practice' | 'lanes' = 'lanes') {
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await page
    .getByRole('group', { name: 'F spell', exact: true })
    .getByRole('button', { name: 'Smite', exact: true })
    .click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .getByRole('button', {
        name: mode === 'practice' ? 'Start practice' : 'Start lane match',
        exact: true,
      })
      .click(),
  ]);
  await ready(page);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.press('p');
  await expect(page.locator('.shop-catalog')).toBeVisible();
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units) u.ai = false;
  });
}
async function saveReload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const before = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function sample(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      p = w.companions[0];
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const root = v.ownedCompanions.entries.get(w.hero.id).root,
      gl = v.renderer.getContext(),
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const read = () => {
      v.renderer.render(v.scene, v.camera);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const shown = read();
    root.visible = false;
    const hidden = read();
    root.visible = true;
    read();
    let count = 0;
    const forms: string[] = [];
    for (let i = 0; i < shown.length; i += 4)
      if (
        shown[i] !== hidden[i] ||
        shown[i + 1] !== hidden[i + 1] ||
        shown[i + 2] !== hidden[i + 2]
      )
        count++;
    root.traverse((o: any) => {
      if (o.isMesh && o.visible) forms.push(o.material.userData.sourceSubmesh);
    });
    return {
      count,
      forms,
      kind: p.kind,
      acquisition: p.acquisition,
      fed: p.fed,
      battlefield: w.battlefield.id,
    };
  });
}

for (const mode of ['practice', 'lanes'] as const)
  for (const [kind, skin] of [
    ['gustwalker', 0],
    ['scorchclaw', 1],
    ['mosstomper', 2],
  ] as const)
    test(`${kind} buys in Rift ${mode}, earns both upgrades, consumes its item and restores ownership`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      const faults: string[] = [],
        rigs: string[] = [];
      page.on('pageerror', (e) => faults.push(e.message));
      page.on('requestfailed', (r) => faults.push(r.url()));
      page.on('request', (r) => {
        if (/models\/sru-jungle-companions-skin\d-base.glb/.test(r.url())) rigs.push(r.url());
      });
      await start(page, mode);
      expect(rigs).toEqual([]);
      await expect(page.locator('[data-buy="boots"]')).toHaveAttribute(
        'title',
        'Buy a jungle companion first'
      );
      await page.locator(`[data-buy="${kind}"]`).click();
      await expect(page.locator('.shop-message')).toHaveText('Item purchased');
      await expect(page.locator(`.shop-owned [data-item="${kind}"]`)).toBeDisabled();
      const paid = await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.step(180);
        return { gold: w.player.gold, items: w.player.inventory, p: w.companions[0] };
      });
      expect(paid.gold).toBe(50);
      expect(paid.items).toEqual([kind]);
      expect(paid.p.acquisition).toEqual({ kind: 'purchase', consumedTick: null });
      const baby = await sample(page);
      expect(baby.battlefield).toBe('rift');
      expect(baby.forms).toEqual(['Baby']);
      expect(baby.count).toBeGreaterThan(10);
      await page.locator('.close-button').click();
      await page.evaluate(() => (window as any).__GAME__.setPaused(true));
      await saveReload(page);
      const camp = await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.tick = Math.max(5399, w.companions[0].nextTreatTick - 1);
        w.step(12);
        const c = w.jungleCamps.find((c: any) => c.id === 'order-gromp'),
          u = w.unit(c.unitIds[0]);
        let point;
        for (let x = -300; x <= 300 && !point; x += 50)
          for (let y = -300; y <= 300 && !point; y += 50) {
            const p = { x: u.x + x, y: u.y + y },
              d = Math.hypot(x, y);
            if (
              d > 180 &&
              d < 300 &&
              w.battlefield.lineWalkable(p, p, w.hero.radius, 'blue') &&
              w.battlefield.lineOfSight(p, u)
            )
              point = p;
          }
        if (!point) throw new Error('No Gromp approach');
        Object.assign(w.hero, point, { previous: { ...point } });
        u.hp = 600;
        u.stunUntil = w.tick + 10000;
        w.step();
        g.view.recenter(w.hero);
        g.view.render(w, 1, g.view.previousElapsed);
        g.hud.update(60);
        return { id: u.id, point: g.view.screenPoint(u, 0.6), charges: w.player.smite.charges };
      });
      await page.evaluate(() => (window as any).__GAME__.setPaused(false));
      await page.mouse.move(camp.point.x, camp.point.y);
      await page.keyboard.press('f');
      await page.waitForFunction((id) => {
        const g = (window as any).__GAME__;
        if (g.world.unit(id).hp !== 0) return false;
        g.setPaused(true);
        return true;
      }, camp.id);
      const clear = await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        g.view.render(w, 1, g.view.previousElapsed);
        g.hud.update(60);
        return {
          fed: w.companions[0].fed,
          charges: w.player.smite.charges,
          camp: w.jungleCamps.find((c: any) => c.id === 'order-gromp'),
        };
      });
      expect(clear.fed).toBe(2);
      expect(clear.charges).toBe(camp.charges - 1);
      expect(clear.camp.unitIds[0]).toBeNull();
      await page.screenshot({ path: `artifacts/companion-item-${kind}-${mode}-rift.png` });
      await saveReload(page);
      await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        while (w.companions[0].fed < 15) {
          const u = w.spawnMonster({ x: 2500, y: 2500 });
          w.damage(w.hero, u, 999999, 'true');
        }
        w.step();
        g.hud.update(60);
      });
      await expect(page.locator('[data-ability="f"] img')).toHaveAttribute(
        'src',
        'assets/icons/S5_SummonerSmitePlayerGanker.png'
      );
      expect(await page.evaluate(() => (window as any).__GAME__.world.player.inventory)).toEqual([
        kind,
      ]);
      await saveReload(page);
      await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        while (w.companions[0].fed < 35) {
          const u = w.spawnMonster({ x: 2500, y: 2500 });
          w.damage(w.hero, u, 999999, 'true');
        }
        w.step(360);
        g.view.render(w, 1, g.view.previousElapsed);
        g.hud.update(60);
      });
      expect(await page.evaluate(() => (window as any).__GAME__.world.player.inventory)).toEqual(
        []
      );
      const adult = await sample(page);
      expect(adult.forms).toEqual(['Adult']);
      expect(adult.count).toBeGreaterThan(10);
      expect(adult.acquisition.consumedTick).toBeGreaterThan(0);
      await page.screenshot({ path: `artifacts/companion-item-${kind}-${mode}-grown.png` });
      await saveReload(page);
      await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world,
          home = w.battlefield.spawns.blue;
        Object.assign(w.hero, home, { previous: { ...home } });
        w.step();
        g.view.recenter(w.hero);
      });
      await page.evaluate(() => (window as any).__GAME__.setPaused(false));
      await page.keyboard.press('p');
      await page.evaluate(() => (window as any).__GAME__.setPaused(true));
      await expect(page.locator(`[data-buy="${kind}"]`)).toHaveAttribute(
        'title',
        'You already own a jungle companion'
      );
      await expect(page.locator('[data-buy="blade"]')).toHaveAttribute(
        'title',
        'Your jungle companion occupies the starter item group'
      );
      await expect(page.locator('[data-buy="boots"]')).toBeEnabled();
      await page.locator('[data-buy="boots"]').click();
      await expect(page.locator('.shop-message')).toHaveText('Item purchased');
      await page.locator('.close-button').click();
      await page.evaluate(() => (window as any).__GAME__.setPaused(true));
      await page.keyboard.press('Escape');
      await Promise.all([
        page.waitForEvent('load'),
        page
          .getByRole('button', {
            name: mode === 'practice' ? 'Restart practice' : 'Restart lane match',
            exact: true,
          })
          .click(),
      ]);
      await ready(page);
      expect(
        await page.evaluate(() => ({
          items: (window as any).__GAME__.world.player.inventory,
          companions: (window as any).__GAME__.world.companions,
        }))
      ).toEqual({ items: [], companions: [] });
      await expect(page.locator('#companion-status')).toHaveCount(0);
      expect(rigs.every((url) => url.endsWith(`skin${skin}-base.glb`))).toBe(true);
      expect(faults).toEqual([]);
      writeFileSync(
        `artifacts/companion-item-${kind}-${mode}.json`,
        JSON.stringify({ paid, baby, clear, adult, rigs }, null, 2) + '\n'
      );
    });

test('failed companion asset preparation spends nothing and retry creates one purchased companion', async ({
  page,
}) => {
  test.setTimeout(120000);
  await start(page);
  let attempts = 0;
  await page.route('**/sru-jungle-companions-skin0-base.glb', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: 'temporary failure' });
    else await route.continue();
  });
  const before = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.locator('[data-buy="gustwalker"]').click();
  await expect(page.locator('.shop-message')).toHaveText(
    'Companion could not be prepared. Try again.'
  );
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before);
  await page.locator('[data-buy="gustwalker"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  expect(attempts).toBe(2);
  expect(
    await page.evaluate(() => ({
      gold: (window as any).__GAME__.world.player.gold,
      count: (window as any).__GAME__.world.companions.length,
    }))
  ).toEqual({ gold: 50, count: 1 });
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 600, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator('[data-buy="mosstomper"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.shop-owned [data-item="gustwalker"]')).toBeInViewport();
    expect(
      await page.locator('.game-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true);
    await page.screenshot({ path: `artifacts/companion-item-shop-${viewport.width}.png` });
  }
});

test('pending companion preparation serializes clicks and revalidates the purchase after resources change', async ({
  page,
}) => {
  test.setTimeout(120000);
  await start(page);
  let release!: () => void,
    seen!: () => void,
    requests = 0;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    blocked = new Promise<void>((resolve) => {
      seen = resolve;
    });
  await page.route('**/sru-jungle-companions-skin2-base.glb', async (route) => {
    requests++;
    seen();
    await gate;
    await route.continue();
  });
  const button = page.locator('[data-buy="mosstomper"]');
  await button.click();
  await blocked;
  await expect(button).toBeDisabled();
  await button.dispatchEvent('click');
  expect(await page.evaluate(() => (window as any).__GAME__.world.companions.length)).toBe(0);
  await page.evaluate(() => ((window as any).__GAME__.world.player.gold = 449));
  release();
  await expect(page.locator('.shop-message')).toHaveText('Not enough gold');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.inventory)).toEqual([]);
  await page.evaluate(() => ((window as any).__GAME__.world.player.gold = 500));
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  expect(requests).toBe(1);
  expect(await page.evaluate(() => (window as any).__GAME__.world.companions.length)).toBe(1);
});
