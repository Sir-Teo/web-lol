import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function prepare(page: Page) {
  await page.goto('/?scene=fixture&npc=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const ahri = w.units.find((unit: any) => unit.champion === 'ahri');
    w.units = [w.hero, ahri];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const unit of w.units) unit.ai = false;
    w.setOrder(ahri, { type: 'idle' });
    if (w.learnSpell('w', ahri.id) !== null) throw new Error('W did not learn');
    const target = w.spawn('dummy', 'red', { x: ahri.x + 300, y: ahri.y });
    target.hp = target.maxHp = 10000;
    target.magicResist = 0;
    g.view.zoom = 0.6;
    g.view.recenter(ahri);
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: ahri.x, y: ahri.y } });
    w.step();
    return { sourceId: ahri.id, targetId: target.id };
  });
}

test('Fox-Fire renders three orbits, committed flights and reduced repeat hits on the real development map', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ids = await prepare(page);
  const start = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return {
      cast: w.ahriFoxFires[0],
      markers: [...v.foxFireModels.values()].map((model: any) => model.name),
      clip: v.models.get(sourceId).actionName,
      spell: w.abilitySpec('w', sourceId).name,
      speed: w.movementSpeed(w.unit(sourceId)),
      future: copy.snapshot(),
    };
  }, ids);
  expect(start.spell).toBe('Fox-Fire');
  expect(start.clip).toBe('spell2');
  expect(start.markers).toEqual(Array(3).fill('Ahri W development orbit'));
  expect(start.cast.fires.map((fire: any) => fire.phase)).toEqual(['orbit', 'orbit', 'orbit']);
  expect(start.speed).toBeGreaterThan(460);
  await page.screenshot({ path: info.outputPath('ahri-w-orbits.png') });
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(25);
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(275);
    return {
      cast: w.ahriFoxFires[0],
      markers: [...v.foxFireModels.values()].map((model: any) => model.name),
      exactSave: copy.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
      future: copy.snapshot(),
    };
  });
  expect(flight.cast.fires.every((fire: any) => fire.phase === 'flight')).toBe(true);
  expect(flight.markers).toEqual(Array(3).fill('Ahri W development flight'));
  expect(flight.exactSave).toBe(true);
  expect(flight.future).toBe(start.future);
  await page.screenshot({ path: info.outputPath('ahri-w-flights.png') });
  const hits = await page.evaluate(({ sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(55);
    v.render(w, 1, v.previousElapsed);
    const target = w.unit(targetId),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(220);
    return {
      cast: w.ahriFoxFires[0],
      damage: target.maxHp - target.hp,
      markers: v.foxFireModels.size,
      speed: w.movementSpeed(w.unit(sourceId)),
      future: copy.snapshot(),
    };
  }, ids);
  expect(hits.damage).toBeCloseTo(72, 5);
  expect(hits.cast.fires.every((fire: any) => fire.stopReason === 'hit')).toBe(true);
  expect(hits.cast.fires.filter((fire: any) => fire.hit.repeat)).toHaveLength(2);
  expect(hits.markers).toBe(0);
  expect(hits.speed).toBeLessThan(start.speed);
  expect(hits.future).toBe(start.future);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(220);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      saved: w.snapshot(),
      casts: w.ahriFoxFires.length,
      markers: g.view.foxFireModels.size,
    };
  });
  expect(result.saved).toBe(start.future);
  expect(result.casts).toBe(0);
  expect(result.markers).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-w.json'),
    JSON.stringify({ start, flight, hits, result }, null, 2)
  );
});

for (const [phase, age] of [
  ['orbit', 20],
  ['flight', 30],
  ['spent', 90],
] as const) {
  test(`Fox-Fire ${phase} survives real Save and reload with its speed and 300 future ticks`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const ids = await prepare(page);
    const expected = await page.evaluate(
      ({ sourceId, targetId, phase, age }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          ahri = w.unit(sourceId);
        w.step(age);
        if (phase === 'flight') w.damage(w.unit(targetId), ahri, 1e6, 'true');
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(300);
        return {
          saved,
          future: copy.snapshot(),
          speed: w.movementSpeed(ahri),
          phases: w.ahriFoxFires[0].fires.map((fire: any) => fire.phase),
          active: w.ahriFoxFires[0].fires.filter((fire: any) => fire.phase !== 'spent').length,
        };
      },
      { ...ids, phase, age }
    );
    if (phase === 'orbit') expect(expected.phases).toEqual(['orbit', 'orbit', 'orbit']);
    if (phase === 'flight') expect(expected.phases).toContain('flight');
    if (phase === 'spent') expect(expected.phases).toEqual(['spent', 'spent', 'spent']);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate((sourceId) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        speed = w.movementSpeed(w.unit(sourceId));
      const active = g.view.foxFireModels.size,
        dead = w.unit(sourceId).deadAt !== null;
      w.step(300);
      return { saved, future: w.snapshot(), speed, active, dead, paused: g.hud.paused };
    }, ids.sourceId);
    expect(result.saved).toBe(expected.saved);
    expect(result.future).toBe(expected.future);
    expect(result.speed).toBe(expected.speed);
    expect(result.active).toBe(expected.active);
    expect(result.dead).toBe(phase === 'flight');
    expect(result.paused).toBe(true);
    writeFileSync(
      info.outputPath(`ahri-w-${phase}-reload.json`),
      JSON.stringify({ phase, age, expected, result }, null, 2)
    );
  });
}
