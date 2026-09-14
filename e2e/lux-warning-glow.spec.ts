import { expect, test } from '@playwright/test';

test('Final Spark warning glow uses the first multiplier atlas row during charge', async ({
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
    w.step(45);
    v.render(w, 1, v.previousElapsed);
    const group = [...v.luxBeams.models.values()][0] as any;
    const mesh = group.children.find((m: any) => m.name === 'warning_beam_glow');
    return {
      visible: mesh.visible,
      pass: mesh.renderOrder,
      base: mesh.material.uniforms.baseCell.value.toArray(),
      mult: mesh.material.uniforms.multCell.value.toArray(),
      tint: mesh.material.uniforms.tint.value.toArray(),
    };
  });
  expect(result.visible).toBe(true);
  expect(result.pass).toBe(-1);
  expect(result.base).toEqual([1, 1]);
  expect(result.mult).toEqual([1, 0.5]);
  expect(result.tint[3]).toBeGreaterThan(0.4);
  await page.screenshot({ path: 'artifacts/lux-warning-glow.png' });
});
