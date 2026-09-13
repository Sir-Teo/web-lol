import { expect, test } from '@playwright/test';

test('Lux R presents charge and beam around its source cast animation, then cleans up', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const charge = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    [300, 650, 1000].forEach((x) => w.spawn('dummy', 'red', { x, y: 0 }));
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      animation: g.view.models.get(lux.id).actionName,
      visible: [...g.view.luxBeams.models.values()].some((mesh: any) => mesh.visible),
      released: w.luxBeams.length,
    };
  });
  expect(charge).toEqual({ animation: 'spell4', visible: true, released: 0 });
  const fired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(32);
    g.view.render(w, 1, performance.now() / 1000);
    const frame = () =>
      [...g.view.luxBeams.models.values()].map((group: any) =>
        group.children.map((mesh: any) => ({
          visible: mesh.visible,
          tint: mesh.material.uniforms.tint.value.toArray(),
          offset: mesh.material.uniforms.offset.value.toArray(),
          positions: Array.from(mesh.geometry.getAttribute('position').array),
        }))
      );
    const before = JSON.stringify(frame());
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    g.view.render(restored, 1, performance.now() / 1000);
    const restoredFrameMatches = before === JSON.stringify(frame());
    return {
      restoredFrameMatches,
      native: [...g.view.luxBeams.models.values()].flatMap((group: any) =>
        group.children.filter((mesh: any) => mesh.visible).map((mesh: any) => mesh.name)
      ),
      beams: w.luxBeams.length,
      models: g.view.luxBeams.models.size,
      hit: w.units.filter((u: any) => u.kind === 'dummy').map((u: any) => u.hp < u.maxHp),
    };
  });
  expect(fired).toEqual({
    restoredFrameMatches: true,
    beams: 1,
    models: 1,
    hit: [true, true, true],
    native: ['Beam_Core1', 'Beam_Core2', 'Beam_Core_FLASH', 'Beam_Core_Glow'],
  });
  await page.screenshot({ path: 'artifacts/lux-r-match.png' });
  const remaining = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(18);
    g.view.render(g.world, 1, performance.now() / 1000);
    return g.view.luxBeams.models.size;
  });
  expect(remaining).toBe(0);
  expect(errors).toEqual([]);
});
