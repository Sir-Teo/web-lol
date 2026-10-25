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
    w.gainExperience(1e6, ahri.id);
    if (w.learnSpell('r', ahri.id) !== null) throw Error('R did not learn');
    const targets = [-120, 0, 120].map((y) => {
      const t = w.spawn('dummy', 'red', { x: ahri.x + 550, y: ahri.y + y });
      t.hp = t.maxHp = 10000;
      t.magicResist = 0;
      return t.id;
    });
    g.view.zoom = 0.6;
    g.view.recenter(ahri);
    const origin = { x: ahri.x, y: ahri.y };
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: ahri.x + 900, y: ahri.y } });
    w.step();
    return { sourceId: ahri.id, targetIds: targets, origin };
  });
}

test('Spirit Rush renders its source dash clip and three provisional essence bolts with paid activation and free recasts', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await prepare(page);
  await page.evaluate(() => (window as any).__GAME__.world.step(7));
  const start = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return {
      rush: w.ahriRushes[0],
      clip: v.models.get(sourceId).actionName,
      spell: w.abilitySpec('r', sourceId).name,
      markers: [...v.spiritBoltModels.values()].map((m: any) => m.name),
      saved,
      future: copy.snapshot(),
    };
  }, ids);
  expect(start.clip).toBe('spell4');
  expect(start.spell).toBe('Spirit Rush');
  expect(start.rush.remainingCasts).toBe(2);
  expect(start.markers).toEqual(Array(3).fill('Ahri R development essence bolt'));
  await page.screenshot({ path: info.outputPath('ahri-r-dash.png') });
  const arrived = await page.evaluate(({ sourceId, origin }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(17);
    v.render(w, 1, v.previousElapsed);
    const source = w.unit(sourceId),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(283);
    return {
      distance: Math.hypot(source.x - origin.x, source.y - origin.y),
      burst: w.ahriRushes[0].bursts[0],
      saved,
      future: copy.snapshot(),
      x: source.x,
      y: source.y,
    };
  }, ids);
  expect(arrived.distance).toBeCloseTo(500, 8);
  expect(arrived.burst.stopReason).toBe('arrived');
  expect(arrived.burst.bolts.every((p: any) => p.stopReason === 'hit')).toBe(true);
  expect(arrived.future).toBe(start.future);
  await page.screenshot({ path: info.outputPath('ahri-r-arrived.png') });
  const recast = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(35);
    const source = w.unit(sourceId),
      mana = source.mana,
      cd = w.championState(sourceId).cooldowns.r;
    w.enqueue({
      type: 'cast',
      unit: sourceId,
      ability: 'r',
      point: { x: source.x, y: source.y + 500 },
    });
    w.step();
    return {
      rush: w.ahriRushes[0],
      manaBefore: mana,
      manaAfter: source.mana,
      cooldownBefore: cd,
      cooldownAfter: w.championState(sourceId).cooldowns.r,
    };
  }, ids);
  expect(recast.rush.remainingCasts).toBe(1);
  expect(recast.rush.bursts).toHaveLength(2);
  expect(recast.manaAfter).toBeGreaterThanOrEqual(recast.manaBefore);
  expect(recast.cooldownAfter).toBe(recast.cooldownBefore);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-r.json'),
    JSON.stringify({ start, arrived, recast, errors }, null, 2)
  );
});

for (const [phase, age] of [
  ['dash', 5],
  ['recovery', 30],
  ['recast', 70],
] as const) {
  test(`Spirit Rush ${phase} survives the actual Save match and reload path`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const ids = await prepare(page);
    const expected = await page.evaluate(
      ({ sourceId, age, phase }) => {
        const g = (window as any).__GAME__,
          w = g.world;
        if (phase === 'recast') {
          w.step(59);
          const source = w.unit(sourceId);
          w.enqueue({
            type: 'cast',
            unit: sourceId,
            ability: 'r',
            point: { x: source.x, y: source.y + 500 },
          });
          w.step();
        }
        w.step(age - (phase === 'recast' ? 61 : 1));
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(300);
        return { saved, future: copy.snapshot(), rush: w.ahriRushes[0] };
      },
      { ...ids, age, phase }
    );
    expect(expected.rush.bursts.length).toBe(phase === 'recast' ? 2 : 1);
    expect(expected.rush.bursts.at(-1)!.stopTick === null).toBe(phase !== 'recovery');
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
      info.outputPath(`ahri-r-${phase}-reload.json`),
      JSON.stringify({ phase, age, expected, result }, null, 2)
    );
  });
}
