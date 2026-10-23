import { expect, test } from '@playwright/test';

test('Lux E presents Spell3, flight, an armed slow field and recast cleanup', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const cast = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.spawn('champion', 'red', { x: 600, y: 0 });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(8);
    g.view.render(w, 1, performance.now() / 1000);
    const action = g.view.models.get(lux.id).actionName;
    w.step(15);
    g.view.render(w, 1, performance.now() / 1000);
    const flight = w.singularities[0],
      model = g.view.luxSingularities.models.get(flight.id);
    return {
      action,
      inFlight: flight.arrivalTick === null,
      visible: model.visible,
      ringVisible: !!model.getObjectByName('Lucent ally 7 teamring_circle1'),
    };
  });
  expect(cast).toEqual({ action: 'spell3', inFlight: true, visible: true, ringVisible: false });
  const armed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(22);
    g.view.render(w, 1, performance.now() / 1000);
    const zone = w.singularities[0],
      model = g.view.luxSingularities.models.get(zone.id);
    const target = w.units.find((u: any) => u.team === 'red');
    return {
      ring: !!model.getObjectByName('Lucent ally 7 teamring_circle1'),
      hp: target.hp,
      maxHp: target.maxHp,
      slow: w.slowFactor(target),
      arrival: zone.arrivalTick - zone.launchTick,
    };
  });
  expect(armed.ring).toBe(true);
  expect(armed.hp).toBe(armed.maxHp);
  expect(armed.slow).toBe(0.75);
  expect(armed.arrival).toBe(29);
  await page.screenshot({ path: 'artifacts/lux-e-source-zone.png' });
  const detonation = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const zone = w.singularities[0],
      source = w.unit(zone.sourceId),
      target = w.units.find((u: any) => u.team === 'red');
    source.mana = 0;
    w.enqueue({ type: 'cast', unit: source.id, ability: 'e', point: source });
    w.step();
    g.view.render(w, 1, performance.now() / 1000);
    const hit = target.hp < target.maxHp;
    const marked = target.illumination.length === 1;
    w.step(43);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      hit,
      marked,
      zones: w.singularities.length,
      models: g.view.luxSingularities.models.size,
    };
  });
  expect(detonation).toEqual({ hit: true, marked: true, zones: 0, models: 0 });
  expect(errors).toEqual([]);
});
