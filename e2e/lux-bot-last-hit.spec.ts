import { expect, test } from '@playwright/test';

test('Lux chooses a marked last hit and consumes Illumination on the actual attack impact', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.hero.x = -3500;
    w.hero.y = -3000;
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'red', { x: 0, y: 0 }, 'lux');
    lux.ai = false;
    const near = w.spawn('melee', 'blue', { x: 200, y: -200 });
    const marked = w.spawn('caster', 'blue', { x: 500, y: 0 });
    near.speed = marked.speed = 0;
    near.nextAttackTick = marked.nextAttackTick = w.tick + 10000;
    w.releaseLightBinding(lux, { x: 1300, y: 0 }, 0);
    w.step(30);
    if (marked.illumination.length !== 1) throw new Error('Binding did not mark the minion');
    marked.hp = 70;
    lux.ai = true;
    lux.nextThink = w.tick + 1;
    w.step();
    g.view.center = { x: 250, y: 0 };
    g.view.locked = false;
    w.reveal = { point: { x: 250, y: 0 }, endTick: Infinity };
    g.view.render(w, 1, performance.now() / 1000);
    return {
      lux: lux.id,
      near: near.id,
      nearHp: near.hp,
      marked: marked.id,
      chosen: lux.attackTarget,
    };
  });
  expect(setup.chosen).toBe(setup.marked);
  await page.screenshot({ path: 'artifacts/lux-bot-marked-last-hit.png' });
  const result = await page.evaluate(({ lux, near, marked }) => {
    const w = (window as any).__GAME__.world;
    w.step(40);
    return {
      cs: w.championState(lux).cs,
      hp: w.unit(marked).hp,
      marks: w.unit(marked).illumination,
      nearHp: w.unit(near).hp,
    };
  }, setup);
  expect(result).toEqual({ cs: 1, hp: 0, marks: [], nearHp: setup.nearHp });
});
