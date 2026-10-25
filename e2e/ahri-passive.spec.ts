import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function prepare(page: Page, soul = true) {
  await page.goto('/?scene=fixture&npc=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate((soul) => {
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
    w.learnSpell('r', ahri.id);
    for (let n = 0; n < 8; n++) {
      const minion = w.spawn('melee', 'red', { x: ahri.x + 300, y: ahri.y });
      minion.ai = false;
      minion.goldBounty = minion.experienceBounty = 0;
      w.damage(ahri, minion, 1e6, 'true');
    }
    ahri.hp = ahri.maxHp - 500;
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: ahri.x + 900, y: ahri.y } });
    w.step();
    let victimId = null;
    if (soul) {
      const victim = w.spawn('champion', 'red', { x: ahri.x + 600, y: ahri.y }, 'lux');
      victim.ai = false;
      victimId = victim.id;
      w.damage(ahri, victim, 1e6, 'true');
    }
    g.view.zoom = 0.6;
    g.view.recenter(ahri);
    return { sourceId: ahri.id, victimId };
  }, soul);
}

test('Essence counter, healing return and champion R restoration run through the real renderer', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await prepare(page);
  const flight = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(4);
    v.render(w, 1, v.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return {
      tick: w.tick,
      counter: w.ahriCounters.find((c: any) => c.sourceId === sourceId),
      essence: w.ahriEssences[0],
      rush: w.ahriRushes[0],
      markers: [...v.essenceModels.values()].map((m: any) => m.name),
      saved,
      future: copy.snapshot(),
    };
  }, ids);
  expect(flight.counter.stacks).toBe(8);
  expect(flight.essence.kind).toBe('champion');
  expect(flight.essence.stopTick).toBeNull();
  expect(flight.essence.position.x).toBeLessThan(flight.essence.origin.x);
  expect(flight.rush.remainingCasts).toBe(2);
  expect(flight.markers).toEqual(['Ahri champion development Essence']);
  await expect(page.getByText('ESSENCE 8/9', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('ahri-passive-flight.png') });
  const consumed = await page.evaluate(
    ({ sourceId, horizon }) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      const e = w.ahriEssences[0];
      while (e.stopTick === null) w.step();
      v.render(w, 1, v.previousElapsed);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(horizon - w.tick);
      return {
        tick: w.tick,
        essence: e,
        rush: w.ahriRushes[0],
        counter: w.ahriCounters.find((c: any) => c.sourceId === sourceId),
        markers: v.essenceModels.size,
        saved,
        future: copy.snapshot(),
      };
    },
    { ...ids, horizon: flight.tick + 300 }
  );
  expect(consumed.essence.stopReason).toBe('consumed');
  expect(consumed.essence.healed).toBe(165);
  expect(consumed.rush.remainingCasts).toBe(3);
  expect(consumed.rush.resets).toHaveLength(1);
  expect(consumed.counter.stacks).toBe(8);
  expect(consumed.markers).toBe(0);
  expect(consumed.future).toBe(flight.future);
  await page.screenshot({ path: info.outputPath('ahri-passive-consumed.png') });
  const ninth = await page.evaluate((sourceId) => {
    const g = (window as any).__GAME__,
      w = g.world,
      source = w.unit(sourceId),
      minion = w.spawn('melee', 'red', { x: source.x, y: source.y });
    minion.ai = false;
    minion.goldBounty = minion.experienceBounty = 0;
    w.damage(source, minion, 1e6, 'true');
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      counter: w.ahriCounters.find((c: any) => c.sourceId === sourceId),
      essence: w.ahriEssences.find((e: any) => e.kind === 'minion'),
      rush: w.ahriRushes[0],
    };
  }, ids.sourceId);
  expect(ninth.counter.stacks).toBe(0);
  expect(ninth.essence.stopReason).toBe('consumed');
  expect(ninth.essence.healed).toBe(95);
  expect(ninth.rush.resets).toHaveLength(1);
  expect(ninth.rush.remainingCasts).toBe(3);
  await expect(page.getByText('ESSENCE 8/9', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-passive.json'),
    JSON.stringify({ flight, consumed, ninth, errors }, null, 2)
  );
});

for (const [phase, age] of [
  ['counter', 1],
  ['flight', 5],
  ['reset', 25],
] as const) {
  test(`Essence Theft ${phase} survives the actual Save match and reload path`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const ids = await prepare(page, phase !== 'counter');
    const expected = await page.evaluate(
      ({ sourceId, age }) => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.step(age - 1);
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(300);
        return {
          saved,
          future: copy.snapshot(),
          counter: w.ahriCounters.find((c: any) => c.sourceId === sourceId),
          essences: w.ahriEssences,
          rush: w.ahriRushes[0],
        };
      },
      { ...ids, age }
    );
    expect(expected.counter.stacks).toBe(8);
    expect(expected.rush.remainingCasts).toBe(phase === 'reset' ? 3 : 2);
    expect(expected.rush.resets.length).toBe(phase === 'reset' ? 1 : 0);
    if (phase === 'counter') expect(expected.essences).toEqual([]);
    else expect(expected.essences[0].stopReason).toBe(phase === 'reset' ? 'consumed' : null);
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
      info.outputPath(`ahri-passive-${phase}-reload.json`),
      JSON.stringify({ phase, age, expected, result }, null, 2)
    );
  });
}
