import { expect, test } from '@playwright/test';

test('remembered destruction survives actual hidden regrowth, reload and another public destruction', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/');
  await ready();
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    w.step(37);
    for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret']) {
      const defender = w.units.find(
        (u: any) => u.team === 'red' && u.structure?.lane === 'mid' && u.structure?.role === role
      );
      w.damage(w.hero, defender, 1e6, 'true');
    }
    const target = w.units.find(
      (u: any) => u.team === 'red' && u.kind === 'inhibitor' && u.structure.lane === 'mid'
    );
    w.damage(w.hero, target, 1e6, 'true');
    const deathTick = target.deadAt;
    w.step(24);
    g.view.render(w, 1, 0);
    w.tick = target.respawnTick - 1;
    w.step();
    w.step(41);
    return {
      id: target.id,
      deathTick,
      alive: w.alive(target),
      visible: w.visible(target),
      known: w.knownStructureDestroyed(target),
    };
  });
  expect(setup.alive).toBe(true);
  expect(setup.visible).toBe(false);
  expect(setup.known).toBe(true);
  const draw = () =>
    page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 0.5, g.view.previousElapsed + 10);
      const model = g.view.models.get(id),
        action = model.actions[model.actionName];
      const bones: number[] = [];
      model.root.traverse((o: any) => {
        if (o.isBone)
          bones.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray());
      });
      const deathDuration = model.actions[model.destroyedClip].getClip().duration;
      const expected =
        ((w.tick - 0.5 - w.knownStructureDeathTick(w.unit(id))) / 60 - deathDuration) %
        action.getClip().duration;
      return {
        clock: model.destructionTick,
        clip: model.actionName,
        deadIdle: model.deadIdleClip,
        time: action.time,
        expected,
        bones,
        snapshot: w.snapshot(),
      };
    }, setup.id);
  const before = await draw();
  expect(before.clock).toBe(setup.deathTick);
  expect(before.clip).toBe(before.deadIdle);
  expect(before.time).toBeCloseTo(before.expected, 12);
  expect(before.bones.length).toBeGreaterThan(100);
  expect(await draw()).toEqual(before);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await draw()).toEqual(before);
  const repeated = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.unit(id);
    const model = g.view.models.get(id),
      wasDestroyed = model.destroyed;
    w.damage(w.hero, target, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      wasDestroyed,
      destroyed: model.destroyed,
      tick: w.tick,
      clock: model.destructionTick,
      deadAt: target.deadAt,
      clip: model.actionName,
      expectedClip: model.destroyedClip,
      time: model.actions[model.actionName].time,
    };
  }, setup.id);
  expect(repeated.wasDestroyed).toBe(true);
  expect(repeated.destroyed).toBe(true);
  expect(repeated.clock).toBe(repeated.tick);
  expect(repeated.deadAt).toBe(repeated.tick);
  expect(repeated.clip).toBe(repeated.expectedClip);
  expect(repeated.time).toBe(0);
  expect(errors).toEqual([]);
});
