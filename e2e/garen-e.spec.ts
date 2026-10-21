import { expect, test } from '@playwright/test';

test('Judgment keeps its source spin while moving and shows armor reduction through a checkpoint', async ({
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
    Object.assign(w.hero, {
      x: 200,
      y: 0,
      previous: { x: 200, y: 0 },
      hp: 10000,
      maxHp: 10000,
      armor: 100,
    });
    w.battlefield.lineOfSight = () => true;
    w.step(480);
    const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
    w.learnSpell('e', garen.id);
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'e', point: garen });
    w.step();
    const start = w.tick;
    w.setOrder(garen, { type: 'move', point: { x: 0, y: 100 } });
    w.step(80);
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(garen.id);
    const moving = {
      clip: model.actionName,
      y: garen.y,
      release: garen.releaseTick,
      hp: w.hero.hp,
    };
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(75);
    restored.step(75);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const bones: number[] = [];
    model.root.traverse((o: any) => {
      if (o.isBone) bones.push(...o.matrixWorld.elements);
    });
    return {
      moving,
      garenId: garen.id,
      start,
      storedArmor: w.hero.armor,
      effectiveArmor: w.effectiveArmor(w.hero),
      equal: restored.snapshot() === w.snapshot(),
      strikes: w.championState(garen.id).garenE.completedStrikes,
      clip: model.actionName,
      finiteBones: bones.length > 0 && bones.every(Number.isFinite),
    };
  });
  expect(result.moving.clip).toBe('spell3_0');
  expect(result.moving.y).toBeGreaterThan(0);
  expect(result.moving.release).toBeNull();
  expect(result.moving.hp).toBeLessThan(10000);
  expect(result.storedArmor).toBe(100);
  expect(result.effectiveArmor).toBe(75);
  expect(result.equal).toBe(true);
  expect(result.strikes).toBe(6);
  expect(result.clip).toBe('spell3_0');
  expect(result.finiteBones).toBe(true);
  await expect(page.locator('#armor')).toHaveText('75');
  await page.screenshot({ path: 'artifacts/browser-garen-e-spin.png' });
  const finished = await page.evaluate(({ garenId, start }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(start + 180 - w.tick);
    const owner = w.championState(garenId);
    const cooldown = owner.cooldowns.e - w.tick;
    w.step(360);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      spin: owner.garenE,
      cooldown,
      armor: w.effectiveArmor(w.hero),
      clip: g.view.models.get(garenId).actionName,
    };
  }, result);
  expect(finished).toEqual({ spin: null, cooldown: 540, armor: 100, clip: 'idle1_base' });
  await expect(page.locator('#armor')).toHaveText('100');
  expect(errors).toEqual([]);
});
