import { expect, test } from '@playwright/test';

test('Demacian Justice uses its source cast pose, fixed target and target-only sight across restore', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
    w.step(480); // Finish the welcome overlay before the controlled capture.
    w.battlefield.lineOfSight = () => true;
    const garen = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    const target = w.spawn('champion', 'red', { x: 350, y: 0 }, 'lux');
    const neighbor = w.spawn('champion', 'red', { x: 350, y: 150 });
    target.maxHp = 2000;
    target.hp = 1000;
    w.gainExperience(1e6, garen.id);
    w.learnSpell('r', garen.id);
    w.events.length = 0; // Keep the level-up toast from obscuring the cast pose.
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'r', point: target, targetId: target.id });
    w.step(12);
    const state = w.championState(garen.id);
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    w.battlefield.lineOfSight = () => false;
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    const sight = {
      target: w.visible(target, 'blue'),
      neighbor: w.visible(neighbor, 'blue'),
      terrain: w.pointVisible(target, 'blue'),
      targetRendered: g.view.models.get(target.id).root.visible,
      neighborRendered: g.view.models.get(neighbor.id).root.visible,
    };
    const remaining = state.pendingCast.releaseTick - w.tick;
    w.step(remaining);
    restored.step(remaining);
    const continuationEqual = restored.snapshot() === w.snapshot();
    // Restore ordinary sight to inspect the actual source cast and both opponents.
    w.battlefield.lineOfSight = () => true;
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const model = g.view.models.get(garen.id);
    const hp = target.hp;
    const pose = garen.animationTimeline.primary;
    return {
      sight,
      continuationEqual,
      hp,
      neighborUnhurt: neighbor.hp === neighbor.maxHp,
      rig: model.referenceAsset,
      clip: model.actionName,
      time: pose.time,
      missiles: w.projectiles.filter((p: any) => p.source === garen.id).length,
      garenId: garen.id,
      targetId: target.id,
      neighborId: neighbor.id,
    };
  });
  expect(result.sight).toEqual({
    target: true,
    neighbor: false,
    terrain: false,
    targetRendered: true,
    neighborRendered: false,
  });
  expect(result.continuationEqual).toBe(true);
  expect(result.hp).toBeGreaterThan(600);
  expect(result.hp).toBeLessThan(650);
  expect(result.neighborUnhurt).toBe(true);
  expect(result.rig).toBe('garen-base');
  expect(result.clip).toBe('spell4_base');
  expect(result.time).toBeCloseTo(18.5 / 30);
  expect(result.missiles).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-garen-r-contact.png' });
  const expired = await page.evaluate(({ targetId, neighborId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.battlefield.lineOfSight = () => false;
    w.step(33);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      target: w.visible(w.unit(targetId), 'blue'),
      neighbor: w.visible(w.unit(neighborId), 'blue'),
      targetRendered: g.view.models.get(targetId).root.visible,
    };
  }, result);
  expect(expired).toEqual({ target: false, neighbor: false, targetRendered: false });
  expect(errors).toEqual([]);
});
