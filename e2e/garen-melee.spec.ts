import { expect, test } from '@playwright/test';
test('Garen uses his source rig for melee combat and remains a valid Lux impact target', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    const garen = w.spawn('champion', 'red', { x: 150, y: 0 }, 'garen');
    w.setOrder(garen, { type: 'attack', target: w.hero.id });
    w.step();
    const release = garen.releaseTick;
    w.step(release - w.tick);
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(garen.id);
    const attack = {
      rig: model.referenceAsset,
      clip: model.actionName,
      damage: w.hero.maxHp - w.hero.hp,
      missiles: w.projectiles.filter((p: any) => p.source === garen.id).length,
    };
    w.setOrder(garen, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.setOrder(lux, { type: 'attack', target: garen.id });
    for (let i = 0; i < 50; i++) {
      w.step();
      g.view.render(w, 1, g.view.previousElapsed);
    }
    g.hud.scoreboard(true);
    g.hud.update(60);
    return { attack, hit: garen.hp < garen.maxHp, garenId: garen.id };
  });
  expect(result.attack.rig).toBe('garen-base');
  expect(result.attack.clip).toBe('attack1');
  expect(result.attack.damage).toBeGreaterThan(0);
  expect(result.attack.missiles).toBe(0);
  expect(result.hit).toBe(true);
  expect(errors).toEqual([]);
  await expect(page.locator('img[alt="Garen"]').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/browser-garen-melee.png' });
  await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      garen = w.unit(id);
    g.hud.scoreboard(false);
    w.setOrder(garen, { type: 'move', point: { x: 450, y: 0 } });
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
  }, result.garenId);
  await page.screenshot({ path: 'artifacts/browser-garen-field.png' });
});
