import { expect, test } from '@playwright/test';

test('Q attacks render source ice arrows after buff expiry and retain shared resources', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.nextWaveTick = Infinity;
    for (const unit of w.units) unit.ai = false;
    w.player.qStacks = 4;
    w.player.qStackExpiry = w.tick + 240;
  });
  await page.keyboard.press('q');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = (window as any).__GAME__.world;
        return w.player.qUntil > w.tick;
      })
    )
    .toBe(true);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 550, y: w.hero.y });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
    w.setOrder(w.hero, { type: 'idle' });
    w.player.qUntil = w.tick;
    w.step(4);
    const p = w.projectiles[0];
    // A second independent in-flight instance exercises shared asset ownership.
    w.projectiles.push({
      ...p,
      id: 999999,
      y: p.y + 100,
      previous: { x: p.previous.x, y: p.previous.y + 100 },
    });
    g.view.render(w, 1, performance.now() / 1000);
    const first = g.view.projectileModels.get(p.id),
      second = g.view.projectileModels.get(999999);
    const meshes: any[] = [],
      others: any[] = [];
    first.traverse((o: any) => {
      if (o.isMesh) meshes.push(o);
    });
    second.traverse((o: any) => {
      if (o.isMesh) others.push(o);
    });
    let disposed = 0;
    meshes[0].geometry.addEventListener('dispose', () => disposed++);
    meshes[0].material.addEventListener('dispose', () => disposed++);
    const shared =
      meshes[0].geometry === others[0].geometry && meshes[0].material === others[0].material;
    w.projectiles = w.projectiles.filter((projectile: any) => projectile.id !== 999999);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      name: first.name,
      meshes: meshes.length,
      triangles: meshes[0].geometry.index.count / 3,
      textured: !!meshes[0].material.map,
      colors: meshes[0].geometry.getAttribute('color').itemSize,
      shared,
      disposed,
      empowered: p.empowered,
      buffExpired: w.player.qUntil <= w.tick,
    };
  });
  expect(result).toEqual({
    name: 'Ashe Q ice arrow',
    meshes: 1,
    triangles: 244,
    textured: true,
    colors: 4,
    shared: true,
    disposed: 0,
    empowered: true,
    buffExpired: true,
  });
  await page.screenshot({ path: 'artifacts/ashe-q-arrow-combat.png' });
  expect(errors).toEqual([]);
});
