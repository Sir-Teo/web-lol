import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function boot(page: Page, kind: string) {
  await page.goto(`/?scene=fixture&encounter=gromp&companion=${kind}`);
  await ready(page);
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    for (let i = 0; i < 35; i++) {
      const u = w.spawnMonster({ x: 2500, y: 2500 });
      w.damage(w.hero, u, 999999, 'true');
    }
    w.step(240);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const u = w.units.find((u: any) => u.kind === 'monster' && w.alive(u));
    return { id: u.id, point: g.view.screenPoint(u, 0.6), heroId: w.hero.id };
  });
}
async function saveReload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
function errors(page: Page) {
  const list: string[] = [];
  page.on('pageerror', (e) => list.push(e.message));
  page.on('requestfailed', (r) => list.push(r.url()));
  return list;
}

test('Moss absorbs a real Gromp missile and restores its partial shield/recovery checkpoint', async ({
  page,
}) => {
  test.setTimeout(120000);
  const faults = errors(page),
    target = await boot(page, 'mosstomper');
  const cap = await page.evaluate(() =>
    (window as any).__GAME__.world.shieldAmount((window as any).__GAME__.world.hero)
  );
  expect(cap).toBe(200);
  await expect(page.locator('#companion-status')).toContainText('Shield 200');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((cap) => {
    const g = (window as any).__GAME__,
      w = g.world;
    if (w.shieldAmount(w.hero) >= cap || w.shieldAmount(w.hero) <= 0) return false;
    g.setPaused(true);
    return true;
  }, cap);
  const partial = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    w.setOrder(w.hero, { type: 'idle' });
    u.stunUntil = w.tick + 10000;
    // Drain already released missiles before isolating the recovery deadline.
    // Pet follow-up strikes also count as combat; wait for their six-second activity to finish.
    w.step(480);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      shield: w.shieldAmount(w.hero),
      hp: w.hero.hp,
      maxHp: w.hero.maxHp,
      recharge: w.companions[0].passive.rechargeTick,
      tick: w.tick,
    };
  }, target.id);
  expect(partial.hp).toBe(partial.maxHp);
  expect(partial.shield).toBeGreaterThan(0);
  expect(partial.shield).toBeLessThan(cap);
  await page.screenshot({ path: 'artifacts/companion-passive-moss-partial.png' });
  await saveReload(page);
  const refreshed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      until = w.companions[0].passive.rechargeTick - w.tick;
    w.step(until - 1);
    const before = w.shieldAmount(w.hero);
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { before, after: w.shieldAmount(w.hero), passive: w.companions[0].passive };
  });
  expect(refreshed.before).toBe(partial.shield);
  expect(refreshed.after).toBe(cap);
  expect(refreshed.passive.rechargeTick).toBeNull();
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('Tab');
  await expect(
    page
      .locator(`.scoreboard-row[data-champion="${target.heroId}"] .scoreboard-summoners img`)
      .last()
  ).toHaveAttribute('alt', 'Primal Smite');
  await page.keyboard.up('Tab');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/companion-passive-moss-ready.png' });
  await saveReload(page);
  expect(faults).toEqual([]);
  writeFileSync(
    'artifacts/companion-passive-moss.json',
    JSON.stringify({ cap, partial, refreshed }, null, 2) + '\n'
  );
});

test('Gustwalker follows real brush entry/exit and a Smite kill with saved speed decay', async ({
  page,
}) => {
  test.setTimeout(120000);
  const faults = errors(page),
    target = await boot(page, 'gustwalker');
  const brush = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.unit(w.units.find((u: any) => u.kind === 'monster').id).stunUntil = w.tick + 10000;
    return g.view.screenPoint({ x: -820, y: -50 }, 0);
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(brush.x, brush.y, { button: 'right' });
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    if (!w.battlefield.inBrush(w.hero) || w.companions[0].passive.lastBrushTick !== w.tick)
      return false;
    g.setPaused(true);
    w.setOrder(w.hero, { type: 'idle' });
    return true;
  });
  const inside = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { speed: w.movementSpeed(w.hero), base: w.hero.speed };
  });
  expect(inside.speed).toBeCloseTo(inside.base * 1.3);
  await expect(page.locator('#companion-status')).toContainText('Move speed +30%');
  await page.screenshot({ path: 'artifacts/companion-passive-gust-brush.png' });
  await saveReload(page);
  const exit = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint({ x: 0, y: -300 }, 0);
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(exit.x, exit.y, { button: 'right' });
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = w.companions[0].passive;
    if (w.battlefield.inBrush(w.hero) || p.lastBrushTick === null || p.lastBrushTick >= w.tick)
      return false;
    g.setPaused(true);
    w.setOrder(w.hero, { type: 'idle' });
    return true;
  });
  await saveReload(page);
  const expired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(90);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return w.movementSpeed(w.hero) === w.hero.speed;
  });
  expect(expired).toBe(true);
  const walk = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint({ x: 0, y: -300 }, 0);
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(walk.x, walk.y, { button: 'right' });
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    if (Math.hypot(w.hero.x, w.hero.y + 300) > 25) return false;
    g.setPaused(true);
    return true;
  });
  const smite = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    u.hp = 1400;
    g.view.render(w, 1, g.view.previousElapsed);
    return g.view.screenPoint(u, 0.6);
  }, target.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.move(smite.x, smite.y);
  await page.keyboard.press('f');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (g.world.companions[0].passive.killTick === null) return false;
    g.setPaused(true);
    return true;
  });
  const burst = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { speed: w.movementSpeed(w.hero), base: w.hero.speed, passive: w.companions[0].passive };
  });
  expect(burst.speed / burst.base).toBeGreaterThan(1.3);
  expect(burst.speed / burst.base).toBeLessThanOrEqual(1.45);
  await page.screenshot({ path: 'artifacts/companion-passive-gust-kill.png' });
  await saveReload(page);
  expect(faults).toEqual([]);
  writeFileSync(
    'artifacts/companion-passive-gust.json',
    JSON.stringify({ inside, expired, burst }, null, 2) + '\n'
  );
});

test('Scorchclaw consumes real attack Ember, saves its burn and excludes Smite/periodic re-triggers', async ({
  page,
}) => {
  test.setTimeout(120000);
  const faults = errors(page);
  await boot(page, 'scorchclaw');
  const target = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.units.find((u: any) => u.kind === 'monster').stunUntil = w.tick + 10000;
    const u = w.spawn('champion', 'red', { x: 250, y: -200 }, 'lux');
    u.hp = u.maxHp = 2000;
    u.ai = false;
    u.stunUntil = w.tick + 10000;
    g.view.render(w, 1, g.view.previousElapsed);
    return { id: u.id, point: g.view.screenPoint(u, 0.6) };
  });
  await expect(page.locator('#companion-status')).toContainText('Ember 100/100');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    if (!w.unit(id).scorchclawBurns.length) return false;
    g.setPaused(true);
    w.setOrder(w.hero, { type: 'idle' });
    return true;
  }, target.id);
  const burning = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      burn: w.unit(id).scorchclawBurns[0],
      passive: w.companions[0].passive,
      slows: w.unit(id).slows,
    };
  }, target.id);
  expect(burning.burn.damagePerTick).toBe(25);
  expect(burning.slows.some((s: any) => s.kind === 'scorchclaw')).toBe(true);
  expect(burning.passive.stacks).toBeLessThan(100);
  await page.screenshot({ path: 'artifacts/companion-passive-scorch-burn.png' });
  await saveReload(page);
  const smite = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.spawnMonster({ x: 2500, y: 2500 });
    w.damage(w.hero, u, 999999, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return g.view.screenPoint(w.unit(id), 0.6);
  }, target.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.move(smite.x, smite.y);
  await page.keyboard.press('f');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (g.world.player.smite.charges !== 0) return false;
    g.setPaused(true);
    return true;
  });
  const retained = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(60);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      stacks: w.companions[0].passive.stacks,
      burn: w.unit(id).scorchclawBurns[0],
      pulse: w.events.some((e: any) => e.type === 'damage' && e.unit === id && e.value === 25),
    };
  }, target.id);
  expect(retained.stacks).toBe(100);
  expect(retained.burn.startTick).toBe(burning.burn.startTick);
  expect(retained.pulse).toBe(true);
  await page.screenshot({ path: 'artifacts/companion-passive-scorch-ready.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('[data-ability="f"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('5% max health true damage');
  const bounds = await page.locator('#ability-tooltip').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: 'artifacts/companion-passive-scorch-tooltip.png' });
  await page.mouse.move(400, 300);
  await saveReload(page);
  expect(faults).toEqual([]);
  writeFileSync(
    'artifacts/companion-passive-scorch.json',
    JSON.stringify({ burning, retained }, null, 2) + '\n'
  );
});
