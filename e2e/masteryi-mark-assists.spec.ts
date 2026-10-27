import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('a real pending Q mark saves and reloads its later assist and Highlander callback', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const actors = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    w.gainExperience(1e6);
    w.learnSpell('q');
    w.learnSpell('r');
    const victim = w.spawn('champion', 'red', { x: 400, y: 0 }, 'masteryi');
    const ally = w.spawn('champion', 'blue', { x: -300, y: 100 }, 'masteryi');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { victimId: victim.id, allyId: ally.id, point: g.view.screenPoint(victim, 0.775) };
  });
  await page.mouse.move(actors.point.x, actors.point.y);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('q');
  await page.evaluate(() => {
    window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), {
      once: true,
    });
  });
  await page.keyboard.up('q');
  const before = await page.evaluate(({ victimId, allyId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step();
    if (!w.player.alphaStrike) throw new Error('Real Q input was not accepted');
    w.step(14);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.damage(copy.unit(allyId), copy.unit(victimId), 1e6, 'true');
    copy.step(300);
    const victim = w.unit(victimId),
      state = w.championState(victimId);
    return {
      saved,
      future: copy.snapshot(),
      q: structuredClone(w.player.alphaStrike),
      marks: structuredClone(state.alphaMarkContributors),
      damage: state.damageContributors,
      fullHealth: victim.hp === victim.maxHp,
      sourceId: w.hero.id,
      r: structuredClone(w.player.highlander),
      selectionVisible: g.view.selection.visible,
    };
  }, actors);
  expect(before.q.marks.map((m: any) => m.result)).toEqual(['pending']);
  expect(before.marks).toEqual([
    { sourceId: before.sourceId, lastMarkTick: before.q.marks[0].tick },
  ]);
  expect(before.damage).toEqual([]);
  expect(before.fullHealth).toBe(true);
  expect(before.selectionVisible).toBe(false);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const after = await page.evaluate(({ victimId, allyId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const saved = w.snapshot(),
      marks = structuredClone(w.championState(victimId).alphaMarkContributors);
    w.damage(w.unit(allyId), w.unit(victimId), 1e6, 'true');
    const score = {
      kills: w.player.kills,
      assists: w.player.assists,
      allyKills: w.championState(allyId).kills,
      extensionCount: w.player.highlander.extensionCount,
      endTick: w.player.highlander.endTick,
    };
    w.step(300);
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { saved, future: w.snapshot(), marks, score, paused: g.hud.paused };
  }, actors);
  expect(after.paused).toBe(true);
  expect(after.saved).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.marks).toEqual(before.marks);
  expect(after.score).toEqual({
    kills: 0,
    assists: 1,
    allyKills: 1,
    extensionCount: 1,
    endTick: before.r.endTick + 420,
  });
  await expect(page.locator('#personal')).toHaveText('0 / 0 / 1');
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('masteryi-mark-assist.png') });
  writeFileSync(
    info.outputPath('mark-assist-reload.json'),
    JSON.stringify({ actors, before, after, errors }, null, 2)
  );
});
