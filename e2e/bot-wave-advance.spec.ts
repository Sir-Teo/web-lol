import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('a bot advances with an unseen-objective wave, restores the staged job and attacks only after arrival', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1_000_000_000;
    for (const u of w.units)
      if (u.kind === 'champion') {
        u.ai = false;
        w.setOrder(u, { type: 'idle' });
      }
    const actor = w.units.find(
      (u: any) => u.kind === 'champion' && u.team === 'blue' && w.championState(u.id).role === 'top'
    );
    actor.ai = true;
    actor.nextThink = w.tick + 1;
    w.gainExperience(5000, actor.id);
    const tower = w.units.find(
      (u: any) =>
        u.team === 'red' && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
    );
    const home = w.battlefield.spawns.blue,
      length = Math.hypot(home.x - tower.x, home.y - tower.y),
      dx = (home.x - tower.x) / length,
      dy = (home.y - tower.y) / length;
    const position = w.battlefield.reachable(
      { x: tower.x + dx * 4500, y: tower.y + dy * 4500 },
      actor.radius,
      'blue'
    );
    Object.assign(actor, position, { previous: { ...position } });
    w.setOrder(actor, { type: 'idle' });
    const wave = Array.from({ length: 6 }, (_, i) => {
      const point = w.battlefield.reachable(
        { x: tower.x + dx * (1800 + i * 40), y: tower.y + dy * (1800 + i * 40) },
        35,
        'blue'
      );
      const m = w.spawn(i < 3 ? 'melee' : 'caster', 'blue', point);
      m.lane = w.battlefield.lanes.findIndex((lane: any) => lane.name === 'mid');
      m.ai = false;
      m.damage = 0;
      w.setOrder(m, { type: 'move', point: { x: tower.x, y: tower.y } });
      return m.id;
    });
    w.teamPlans.blue.nextThinkTick = w.tick + 1;
    const initiallyHidden = !w.visible(tower, 'blue');
    w.step(20);
    g.view.recenter(actor);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      actor: actor.id,
      target: tower.id,
      wave,
      initiallyHidden,
      stillHidden: !w.visible(tower, 'blue'),
      towerHp: tower.hp,
      goal: w.teamPlans.blue.assignments.find((job: any) => job.unitId === actor.id),
    };
  });
  expect(before.initiallyHidden).toBe(true);
  expect(before.stillHidden).toBe(true);
  expect(before.goal).toMatchObject({ kind: 'advance', targetId: before.target });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(JSON.parse(saved).version).toBe(121);
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  const after = await page.evaluate(({ actor, target, towerHp }) => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const u = w.unit(actor),
      tower = w.unit(target);
    let attacked = false;
    for (let i = 0; i < 1800; i++) {
      w.step();
      if (u.attackTarget === target) attacked = true;
      if (tower.hp < towerHp) break;
    }
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      attacked,
      towerHp: tower.hp,
      heroAi: w.hero.ai,
      lane: w.battlefield.lanes[u.lane]?.name,
      role: w.championState(actor).role,
      goal: w.teamPlans.blue.assignments.find((job: any) => job.unitId === actor),
      tick: w.tick,
    };
  }, before);
  expect(after.attacked).toBe(true);
  expect(after.towerHp).toBeLessThan(before.towerHp);
  expect(after.heroAi).toBe(false);
  expect(after.lane).toBe('top');
  expect(after.role).toBe('top');
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('bot-wave-advance.png') });
  writeFileSync(
    testInfo.outputPath('bot-wave-advance.json'),
    JSON.stringify({ before, after, restoredExactly: true, errors }, null, 2) + '\n'
  );
});
