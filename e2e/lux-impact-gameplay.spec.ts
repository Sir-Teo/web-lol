import { expect, test } from '@playwright/test';
test('critical Lux impact follows saved target motion and obeys fog for every layer', async ({
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
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 100, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
    w.projectiles[0].critical = true;
    w.setOrder(lux, { type: 'idle' });
    while (w.projectiles.length) w.step();
    w.step();
    const birth = { x: target.x, y: target.y };
    target.x += 40;
    w.step();
    g.view.render(w, 1, 0);
    const effect = w.luxImpactVisuals[0],
      cloud = g.view.luxImpacts.clouds.get(effect.id);
    const rings = cloud.rings.map((r: any) => ({
      name: r.profile.name,
      visible: r.mesh.visible,
      x: r.mesh.position.x,
    }));
    const snapshot = w.snapshot();
    const before = [...cloud.sparks.mesh.instanceMatrix.array];
    Object.assign(w, w.constructor.fromSnapshot(snapshot, w.battlefield));
    g.view.render(w, 1, 0);
    const restored = [...g.view.luxImpacts.clouds.get(effect.id).sparks.mesh.instanceMatrix.array];
    const savedEffect = w.luxImpactVisuals[0];
    savedEffect.team = 'red';
    const visible = w.pointVisible;
    w.pointVisible = () => false;
    g.view.luxImpacts.update(w, 1, g.view.camera);
    const hidden = {
      rings: cloud.rings.filter((r: any) => r.mesh.visible).length,
      sparks: cloud.sparks.mesh.count,
    };
    w.pointVisible = () => true;
    g.view.luxImpacts.update(w, 1, g.view.camera);
    const shown = {
      rings: cloud.rings.filter((r: any) => r.mesh.visible).length,
      sparks: cloud.sparks.mesh.count,
    };
    savedEffect.team = 'blue';
    w.pointVisible = visible;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.center = { x: target.x, y: target.y };
    g.view.zoom = 0.55;
    g.view.render(w, 1, 0);
    return { rings, birth, targetX: target.x, before, restored, hidden, shown };
  });
  expect(result.rings.every((r: any) => r.visible)).toBe(true);
  for (const r of result.rings)
    expect(r.x).toBeCloseTo(
      (['flash', 'ring'].includes(r.name) ? result.targetX : result.birth.x) * 0.01,
      8
    );
  expect(result.restored).toEqual(result.before);
  expect(result.hidden).toEqual({ rings: 0, sparks: 0 });
  expect(result.shown).toEqual({ rings: 4, sparks: 5 });
  await page.screenshot({ path: 'artifacts/lux-critical-impact-gameplay.png' });
  expect(errors).toEqual([]);
});
