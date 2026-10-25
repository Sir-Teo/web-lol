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
    const ahri = w.units.find((u: any) => u.champion === 'ahri');
    w.units = [w.hero, ahri];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    w.setOrder(ahri, { type: 'idle' });
    if (w.learnSpell('e', ahri.id) !== null) throw Error('E did not learn');
    const target = w.spawn('champion', 'red', { x: ahri.x + 600, y: ahri.y }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 10000;
    target.magicResist = 0;
    g.view.zoom = 0.6;
    g.view.recenter(ahri);
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: { x: ahri.x + 900, y: ahri.y } });
    w.step();
    return { sourceId: ahri.id, targetId: target.id };
  });
}

test('Charm renders its source body clip, provisional pink missile and forced-walk status', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await prepare(page);
  const start = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    v.render(w, 1, v.previousElapsed);
    return {
      clip: v.models.get(sourceId).actionName,
      spell: w.abilitySpec('e', sourceId).name,
      windup: w.championState(sourceId).pendingCast,
    };
  }, ids);
  expect(start.spell).toBe('Charm');
  expect(start.clip).toBe('spell3_north');
  expect(start.windup.releaseTick - start.windup.startTick).toBe(15);
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(20);
    v.render(w, 1, v.previousElapsed);
    return {
      missile: w.projectiles.find((p: any) => p.type === 'charm'),
      markers: [...v.projectileModels.values()].map((m: any) => m.name),
    };
  });
  expect(flight.markers).toContain('Ahri provisional Charm');
  expect(flight.missile.speed).toBe(1550);
  await page.screenshot({ path: info.outputPath('ahri-e-flight.png') });
  const controlled = await page.evaluate(({ sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    while (!w.unit(targetId).charm) w.step();
    const startX = w.unit(targetId).x;
    w.step(10);
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return {
      charm: w.unit(targetId).charm,
      startX,
      x: w.unit(targetId).x,
      sourceX: w.unit(sourceId).x,
      slow: w.slowFactor(w.unit(targetId)),
      saved,
      future: copy.snapshot(),
      exactSave: copy.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  }, ids);
  expect(controlled.charm.sourceId).toBe(ids.sourceId);
  expect(controlled.x).toBeLessThan(controlled.startX);
  expect(controlled.slow).toBeCloseTo(0.35, 6);
  expect(controlled.exactSave).toBe(true);
  await expect(page.getByText('CHARMED', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('ahri-e-controlled.png') });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-e.json'),
    JSON.stringify({ start, flight, controlled, errors }, null, 2)
  );
});

for (const [phase, age] of [
  ['windup', 5],
  ['flight', 22],
  ['control', 45],
] as const) {
  test(`Charm ${phase} survives the actual Save match and reload path`, async ({ page }, info) => {
    test.setTimeout(120000);
    const ids = await prepare(page);
    const expected = await page.evaluate(
      ({ sourceId, targetId, age }) => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.step(age - 1);
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(300);
        return {
          saved,
          future: copy.snapshot(),
          pending: w.championState(sourceId).pendingCast?.ability ?? null,
          flight: w.projectiles.some((p: any) => p.type === 'charm'),
          charm: w.unit(targetId).charm,
        };
      },
      { ...ids, age }
    );
    expect(expected.pending).toBe(phase === 'windup' ? 'e' : null);
    expect(expected.flight).toBe(phase === 'flight');
    expect(expected.charm !== null).toBe(phase === 'control');
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world,
        saved = w.snapshot();
      w.step(300);
      return { saved, future: w.snapshot(), paused: g.hud.paused };
    });
    expect(result.saved).toBe(expected.saved);
    expect(result.future).toBe(expected.future);
    expect(result.paused).toBe(true);
    writeFileSync(
      info.outputPath(`ahri-e-${phase}-reload.json`),
      JSON.stringify({ phase, age, expected, result }, null, 2)
    );
  });
}
