import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('real Crystal Arrow input stops Meditate at contact and restores the exact interrupted future', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture&npc=masteryi');
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await ready();
  const before = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const unit of w.units) {
      unit.ai = false;
      if (unit.kind === 'dummy')
        Object.assign(unit, { x: -1000, y: 1500, previous: { x: -1000, y: 1500 } });
    }
    const yi = w.units.find((unit: any) => unit.champion === 'masteryi');
    yi.team = 'red';
    Object.assign(w.hero, { x: -600, y: 0, previous: { x: -600, y: 0 } });
    Object.assign(yi, { x: -200, y: 0, previous: { x: -200, y: 0 } });
    const state = w.championState(yi.id);
    if (w.learnSpell('w', yi.id) !== null) throw Error('Cannot learn Meditate');
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'w', point: yi });
    w.step();
    if (!state.meditate || state.meditate.stopTick !== null)
      throw Error('Expected active Meditate');
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { id: yi.id, point: g.view.screenPoint(yi, 0.65), start: state.meditate.startTick };
  });
  await page.mouse.move(before.point.x, before.point.y);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    window.addEventListener('keyup', () => g.setPaused(true), { once: true });
    g.setPaused(false);
  });
  await page.keyboard.press('r');
  const result = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      yi = w.unit(id),
      owner = w.championState(id);
    g.setPaused(true);
    for (let i = 0; i < 90 && !yi.stunUntil; i++) w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
    copy.step(180);
    return {
      tick: w.tick,
      stunUntil: yi.stunUntil,
      channel: structuredClone(owner.meditate),
      snapshot,
      future: copy.snapshot(),
    };
  }, before.id);
  expect(result.stunUntil).toBeGreaterThan(result.tick);
  expect(result.channel.stopTick).toBe(result.tick);
  expect(result.channel.stopReason).toBe('control');
  await page.screenshot({ path: info.outputPath('crystal-arrow-meditate-interruption.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    result.snapshot
  );
  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return w.snapshot();
  });
  expect(future).toBe(result.future);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('crystal-arrow-control.json'),
    JSON.stringify({ before, result, errors }, null, 2)
  );
});
