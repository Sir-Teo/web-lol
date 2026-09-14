import { expect, test } from '@playwright/test';

test('Final Spark dark flash appears only in its authored post-release interval', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(64);
    const sample = () => {
      v.render(w, 1, v.previousElapsed);
      const group = [...v.luxBeams.models.values()][0] as any;
      const mesh = group.children.find((m: any) => m.name === 'Beam_DARK_FLASH1');
      return {
        visible: mesh.visible,
        pass: mesh.renderOrder,
        tint: mesh.material.uniforms.tint.value.toArray(),
        depth: mesh.material.depthTest,
      };
    };
    const before = sample();
    w.step(2);
    const during = sample(),
      repeated = sample();
    return { before, during, repeated };
  });
  expect(result.before.visible).toBe(false);
  expect(result.during.visible).toBe(true);
  expect(result.during.pass).toBe(15);
  expect(result.during.depth).toBe(false);
  expect(result.during.tint).toEqual([0.0800030529499054, 0, 0.10000763088464737, 1]);
  expect(result.repeated).toEqual(result.during);
  await page.screenshot({ path: 'artifacts/lux-r-dark-flash.png' });
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step();
    g.view.render(g.world, 1, g.view.previousElapsed);
    const group = [...g.view.luxBeams.models.values()][0] as any;
    return group.children.find((m: any) => m.name === 'Beam_DARK_FLASH1').visible;
  });
  expect(after).toBe(false);
});
