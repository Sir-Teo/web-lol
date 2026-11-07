import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const action of ['purchase', 'trinket'] as const)
  for (const destination of ['help', 'shop', 'same shop'] as const)
    test(`${action} preparation respects the initiating shop after switching to ${destination}`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/shop-async-probe', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><script type="module" src="/@vite/client"></script><link rel="stylesheet" href="/src/style.css"><div id="app"><canvas id="battlefield" tabindex="0"></canvas></div>',
        })
      );
      await page.goto('/shop-async-probe');
      await page.evaluate(async () => {
        const [{ Hud }, { World }, { PRACTICE_FIXTURE }, { swapTrinket }] = await Promise.all([
          import('/src/ui/hud.ts'),
          import('/src/simulation/world.ts'),
          import('/src/content/practice-fixture.ts'),
          import('/src/simulation/trinkets.ts'),
        ]);
        const world = new World(false, PRACTICE_FIXTURE);
        world.player.gold = 5000;
        Object.assign(world.hero, world.battlefield.spawns.blue);
        const view: any = {
          renderer: { domElement: document.querySelector('canvas') },
          locked: true,
          selected: null,
          recenter: () => {},
          setAim: () => {},
          screenPoint: () => ({ x: 0, y: 0 }),
        };
        let finish: (() => void) | null = null,
          hud: any;
        const prepare = async (action: () => string | null) => {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          return action();
        };
        hud = new Hud(document.querySelector('#app')!, world, view, {
          pause: (value: boolean) => {
            if (hud) hud.paused = value;
          },
          sound: () => {},
          buyItem: (id: string) => prepare(() => world.buy(id)),
          swapTrinket: (kind: any) => prepare(() => swapTrinket(world, kind)),
        } as any);
        hud.drawMinimap = () => {};
        (window as any).__SHOP_ASYNC__ = {
          world,
          hud,
          finish: () => {
            finish!();
            finish = null;
          },
        };
      });
      await page.locator('#shop-button').click();
      const selector = action === 'purchase' ? '[data-buy="cloak"]' : '[data-trinket="oracle"]';
      await expect(page.locator(selector)).toBeEnabled();
      await page.locator(selector).click();
      await expect(page.locator('.shop-message')).toContainText('Preparing');
      if (destination !== 'same shop') {
        await page.getByRole('button', { name: 'Close menu', exact: true }).click();
        await page.locator(destination === 'help' ? '#help-button' : '#shop-button').click();
      }
      const messageBefore = (await page.locator('.shop-message').count())
        ? await page.locator('.shop-message').innerText()
        : null;
      await page.evaluate(async () => {
        const p = (window as any).__SHOP_ASYNC__;
        p.finish();
        await new Promise((resolve) => setTimeout(resolve, 0));
        p.hud.update(null);
      });
      await page.waitForFunction(() => (window as any).__SHOP_ASYNC__.hud.buyingItem === false);
      const result = await page.evaluate(() => {
        const p = (window as any).__SHOP_ASYNC__;
        return {
          modal: p.hud.modal,
          gold: p.world.player.gold,
          inventory: p.world.player.inventory,
          trinket: p.world.player.trinket.kind,
        };
      });
      expect(result.modal).toBe(destination === 'help' ? 'help' : 'shop');
      if (action === 'purchase') expect(result.inventory).toContain('cloak');
      else expect(result.trinket).toBe('oracle');
      if (destination === 'same shop')
        await expect(page.locator('.shop-message')).toHaveText(
          action === 'purchase' ? 'Item purchased' : 'Trinket equipped'
        );
      else if (destination === 'shop') {
        await expect(page.locator('.shop-message')).toHaveText(messageBefore!);
        await expect(page.locator(selector)).not.toHaveAttribute('title', 'Preparing purchase…');
      }
      expect(errors).toEqual([]);
      writeFileSync(
        info.outputPath('async-shop-result.json'),
        JSON.stringify({ action, destination, messageBefore, result, errors }, null, 2) + '\n'
      );
    });
