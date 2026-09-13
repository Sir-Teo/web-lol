import { expect, test } from '@playwright/test';

test('retaliating turret returns to firing at minions after its champion target leaves range', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world;
    for (const unit of w.units) {
      unit.ai = false;
      w.setOrder(unit, { type: 'idle' });
    }
    w.battlefield.lineOfSight = () => true;
    w.nextWaveTick = Infinity;
    w.hero.x = 200;
    w.hero.y = 0;
    const tower = w.spawn('turret', 'red', { x: 0, y: 0 });
    tower.range = 750;
    const defender = w.spawn('champion', 'red', { x: 300, y: 0 });
    const minion = w.spawn('melee', 'blue', { x: 400, y: 0 });
    minion.speed = 0;
    minion.nextAttackTick = 10000;
    minion.hp = minion.maxHp = 10000;
    w.damage(w.hero, defender, 1, 'true');
    for (let i = 0; i < 120 && !w.projectiles.some((p: any) => p.source === tower.id); i++)
      w.step();
    const shot = w.projectiles.find((p: any) => p.source === tower.id);
    if (!shot) throw new Error('Turret did not retaliate');
    const deadline = tower.nextAttackTick;
    w.hero.x = 1200;
    w.step();
    const released = tower.order.type === 'idle';
    const deadlinePreserved = tower.nextAttackTick === deadline;
    const missilePreserved = w.projectiles.some(
      (p: any) => p.id === shot.id && p.target === w.hero.id
    );
    w.step(180);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      released,
      deadlinePreserved,
      missilePreserved,
      resumedDefense: minion.hp < minion.maxHp,
    };
  });
  expect(result).toEqual({
    released: true,
    deadlinePreserved: true,
    missilePreserved: true,
    resumedDefense: true,
  });
  expect(errors).toEqual([]);
});
