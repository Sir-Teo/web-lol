import { expect, test } from '@playwright/test';

test('enemy cast and recall render their own source animations without changing human pose', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { World } = await import('/src/simulation/world.ts');
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    let w = new World(false, g.world.battlefield);
    w.nextWaveTick = 1e9;
    const bot = w.spawn('champion', 'red', { x: w.hero.x + 250, y: w.hero.y });
    bot.ai = false;
    const render = () => v.render(w, 1, v.previousElapsed + 0.1);
    const clips = () => [v.models.get(w.hero.id).actionName, v.models.get(bot.id).actionName];
    w.enqueue({ type: 'cast', unit: bot.id, ability: 'w', point: w.hero });
    w.step(8);
    render();
    const casting = clips();
    const saved = w.snapshot();
    w = World.fromSnapshot(saved, w.battlefield);
    render();
    const restored = clips();
    const unchanged = saved === w.snapshot();
    w.step(20);
    const damage = w.hero.hp < w.hero.maxHp;
    w.enqueue({ type: 'recall', unit: bot.id });
    w.step(31);
    render();
    const recalling = clips();
    const recallTime = v.models.get(bot.id).actions.idle5.time;
    w.damage(w.hero, w.unit(bot.id)!, 1, 'true');
    render();
    return { casting, restored, unchanged, damage, recalling, recallTime, cancelled: clips() };
  });
  expect(result.casting).toEqual(['idle1', 'spell2']);
  expect(result.restored).toEqual(result.casting);
  expect(result.unchanged).toBe(true);
  expect(result.damage).toBe(true);
  expect(result.recalling).toEqual(['idle1', 'idle5']);
  expect(result.recallTime).toBeCloseTo(0.5);
  expect(result.cancelled).toEqual(['idle1', 'idle1']);
});
