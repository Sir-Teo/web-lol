import { expect, test } from '@playwright/test';

test('Garen bot spends an armed Q on a farther minion it can last-hit', async ({ page }) => {
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
    w.battlefield.lineOfSight = () => true;
    const bot = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
    const healthy = w.spawn('melee', 'blue', { x: 90, y: 0 });
    const weak = w.spawn('siege', 'blue', { x: 160, y: 0 });
    for (const minion of [healthy, weak])
      Object.assign(minion, { speed: 0, nextAttackTick: w.tick + 10000, armor: 0 });
    weak.hp = 100;
    w.learnSpell('q', bot.id);
    w.enqueue({ type: 'cast', unit: bot.id, ability: 'q', point: { x: 0, y: 0 } });
    w.step();
    bot.ai = true;
    bot.nextThink = w.tick + 1;
    w.step();
    const chosen = bot.attackTarget;
    const release = bot.releaseTick;
    w.step(release - w.tick);
    // Reveal this controlled scene to the player's rendering team.
    w.hero.x = 0;
    w.hero.y = -400;
    w.hero.previous = { x: 0, y: -400 };
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      chosen,
      weakId: weak.id,
      weakHp: weak.hp,
      healthyHp: healthy.hp,
      healthyMax: healthy.maxHp,
      cs: w.championState(bot.id).cs,
      courageStacks: w.championState(bot.id).garenCourageStacks,
      armor: bot.armor,
      clip: g.view.models.get(bot.id).actionName,
    };
  });
  expect(result.chosen).toBe(result.weakId);
  expect(result.weakHp).toBe(0);
  expect(result.healthyHp).toBe(result.healthyMax);
  expect(result.cs).toBe(1);
  expect(result.courageStacks).toBe(0);
  expect(result.armor).toBe(38); // Unlearned W earns no stacks.
  expect(result.clip).toBe('spell1');
  await page.screenshot({ path: 'artifacts/browser-garen-q-farming.png' });
  expect(errors).toEqual([]);
});

test('Garen Q uses his sword animation and silences actual player spell input', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const attack = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    const garen = w.spawn('champion', 'red', { x: 150, y: 100 }, 'garen');
    w.learnSpell('q', garen.id);
    w.setOrder(garen, { type: 'attack', target: w.hero.id });
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: { x: garen.x, y: garen.y } });
    w.step(8);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: garen.id,
      hero: w.hero.id,
      clip: g.view.models.get(garen.id).actionName,
      speed: w.movementSpeed(garen),
      release: garen.releaseTick,
    };
  });
  expect(attack.clip).toBe('spell1');
  expect(attack.speed).toBeCloseTo(459);
  await page.screenshot({ path: 'artifacts/browser-garen-q-windup.png' });
  const hit = await page.evaluate(({ id, release }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(release - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const checkpoint = w.snapshot();
    const restored = w.constructor.fromSnapshot(checkpoint, w.battlefield);
    return {
      contactTime: w.unit(id).animationTimeline.primary.time,
      contactClip: w.unit(id).animationTimeline.primary.clip,
      damage: w.hero.maxHp - w.hero.hp,
      silence: w.hero.silenceUntil - w.tick,
      consumed: w.championState(id).garenQ.consumed,
      restored: restored.snapshot() === checkpoint,
    };
  }, attack);
  expect(hit.contactClip).toBe('spell1');
  expect(hit.contactTime).toBeCloseTo(1 / 3);
  expect(hit.damage).toBeGreaterThan(100);
  expect(hit.silence).toBe(90);
  expect(hit.consumed).toBe(true);
  expect(hit.restored).toBe(true);
  await expect(page.locator(`.unit-bar[data-unit="${attack.hero}"] .unit-status`)).toHaveText(
    'SILENCED'
  );
  await page.screenshot({ path: 'artifacts/browser-garen-q-hit.png' });
  await page.mouse.move(900, 350);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('w');
  await page.waitForFunction(() =>
    (window as any).__GAME__.world.events.some((e: any) => e.text === 'Cannot cast while silenced')
  );
  const cooldown = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return g.world.player.cooldowns.w;
  });
  expect(cooldown).toBe(0);
  expect(errors).toEqual([]);
});
