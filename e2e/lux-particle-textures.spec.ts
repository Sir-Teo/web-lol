import { expect, test } from '@playwright/test';
test('mark, detonation and basic impact borrow identical shared GPU texture objects', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { loadIlluminationTextures } = await import('/src/render/lux-illumination-cloud.ts');
    const { loadIlluminationTriggerTextures } =
      await import('/src/render/lux-illumination-trigger-cloud.ts');
    const [mark, trigger] = await Promise.all([
      loadIlluminationTextures('/'),
      loadIlluminationTriggerTextures('/'),
    ]);
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
      target = w.spawn('dummy', 'red', { x: 200, y: 0 });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.luxImpactVisuals.length; i++) w.step();
    w.step(7);
    v.render(w, 1, v.previousElapsed);
    const impact = v.luxImpacts.clouds.get(w.luxImpactVisuals[0].id);
    const materials = [
      ...impact.rings.map((r: any) => r.mesh.material),
      impact.sparks.mesh.material,
    ];
    const shared = materials
      .flatMap((m: any) => Object.values(m.uniforms).map((u: any) => u.value))
      .filter((value: any) => value?.isTexture && [...trigger.values()].includes(value));
    return {
      common: [...mark]
        .filter(([path]) => trigger.has(path))
        .map(([path, texture]) => ({ path, same: texture === trigger.get(path) })),
      impactShared: new Set(shared).size,
    };
  });
  expect(result.common.length).toBeGreaterThan(1);
  expect(result.common.every((v) => v.same)).toBe(true);
  expect(result.impactShared).toBeGreaterThanOrEqual(5);
});
