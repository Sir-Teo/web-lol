import { expect, test } from '@playwright/test';

test('post-release wisps survive late saves and finish their distinct lifetimes', async ({
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
    w.step(106);
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      return [...v.luxBeams.models.values()].flatMap((group: any) =>
        group.children
          .filter((m: any) => m.visible)
          .map((m: any) => ({
            name: m.name,
            drive: m.material.uniforms.erosionDrive.value,
            offset: m.material.uniforms.offset.value.toArray(),
            tint: m.material.uniforms.tint.value.toArray(),
          }))
      );
    };
    const late = sample(w),
      repeat = sample(w),
      restored = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    return { late, repeat, restored };
  });
  expect(result.late.map((x) => x.name)).toEqual([
    'Beam_Post_Prettiness',
    'Beam_Post_Prettiness1',
    'Beam_Post_Prettiness2',
  ]);
  expect(result.late.map((x) => x.drive)).toEqual([0.75 / 1.2999999523162842, 0.75, 0.75]);
  expect(result.repeat).toEqual(result.late);
  expect(result.restored).toEqual(result.late);
  await page.screenshot({ path: 'artifacts/lux-post-wisps.png' });
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(21);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.luxBeams.models.values()].flatMap((group: any) =>
      group.children.filter((m: any) => m.visible).map((m: any) => m.name)
    );
  });
  expect(tail).toEqual(['Beam_Post_Prettiness']);
  const wispsEnd = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(12);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      records: g.world.luxBeams.length,
      models: g.view.luxBeams.models.size,
      scorches: g.view.luxScorches.models.size,
    };
  });
  // Wisps finish at 1.3s; the shared history still owns the source 1.5s scorches.
  expect(wispsEnd).toEqual({ records: 1, models: 0, scorches: 2 });
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(12);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      records: g.world.luxBeams.length,
      models: g.view.luxBeams.models.size,
      scorches: g.view.luxScorches.models.size,
    };
  });
  expect(end).toEqual({ records: 0, models: 0, scorches: 0 });
});
