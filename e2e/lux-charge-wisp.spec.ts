import { expect, test } from '@playwright/test';

test('charge wisps retain their birth UV phase across seeks and saved reconstruction', async ({
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
    const cast = () =>
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const group = [...v.luxBeams.models.values()][0] as any;
      const mesh = group.children.find((m: any) => m.name === 'CHARGE_BEAM_PRETTINESS');
      return {
        visible: mesh.visible,
        offset: mesh.material.uniforms.offset.value.toArray(),
        tint: mesh.material.uniforms.tint.value.toArray(),
      };
    };
    cast();
    w.step(45);
    const first = sample(w),
      repeat = sample(w),
      restored = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const age = (w.tick - w.championState(lux.id).pendingCast.startTick) / 60;
    w.step(65);
    w.championState(lux.id).cooldowns.r = 0;
    lux.mana = lux.maxMana;
    cast();
    w.step(45);
    const next = sample(w);
    return { first, repeat, restored, next, age };
  });
  expect(result.first.visible).toBe(true);
  expect(result.repeat).toEqual(result.first);
  expect(result.restored).toEqual(result.first);
  const birth = result.first.offset[0] + 2 * result.age * result.age;
  expect(birth).toBeGreaterThanOrEqual(-1);
  expect(birth).toBeLessThanOrEqual(1);
  expect(result.first.offset[1]).toBe(0);
  expect(result.next.visible).toBe(true);
  expect(result.next.offset).not.toEqual(result.first.offset);
  await page.screenshot({ path: 'artifacts/lux-charge-wisp.png' });
});
