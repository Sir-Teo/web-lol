import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function open(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units)
      if (u.kind === 'champion') {
        u.ai = false;
        w.setOrder(u, { type: 'idle' });
      }
    const actor = w.units.find(
      (u: any) =>
        u.kind === 'champion' && u.team === 'blue' && w.championState(u.id).role === 'jungle'
    );
    actor.ai = true;
    actor.nextThink = w.tick + 1;
    w.gainExperience(700, actor.id);
    (window as any).__TEAM_ACTOR__ = actor.id;
  });
}
async function reload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    (window as any).__GAME__.setPaused(true);
  });
}
test('a jungle bot joins a wave, restores its shared siege goal and destroys the exposed turret with normal attacks', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit((window as any).__TEAM_ACTOR__),
      t = w.units.find(
        (s: any) =>
          s.team === 'red' && s.structure?.role === 'outer-turret' && s.structure.lane === 'mid'
      );
    const home = w.battlefield.spawns.blue,
      d = Math.hypot(home.x - t.x, home.y - t.y),
      dx = (home.x - t.x) / d,
      dy = (home.y - t.y) / d;
    const p = w.battlefield.reachable({ x: t.x + dx * 1600, y: t.y + dy * 1600 }, u.radius, 'blue');
    Object.assign(u, p, { previous: { ...p } });
    w.setOrder(u, { type: 'idle' });
    t.hp = 100;
    for (let i = 0; i < 3; i++) {
      const m = w.spawn(
        'melee',
        'blue',
        w.battlefield.reachable(
          { x: t.x + dx * (350 + i * 40), y: t.y + dy * (350 + i * 40) },
          35,
          'blue'
        )
      );
      m.damage = 0;
      m.hp = m.maxHp = 5000;
    }
    w.teamPlans.blue.nextThinkTick = w.tick + 1;
    w.step(20);
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      actor: u.id,
      target: t.id,
      goal: w.teamPlans.blue.assignments.find((s: any) => s.unitId === u.id),
    };
  });
  expect(before.goal).toMatchObject({ kind: 'push', targetId: before.target });
  await reload(page);
  const after = await page.evaluate(({ actor, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(actor),
      t = w.unit(target);
    let attacked = false;
    for (let i = 0; i < 1800 && t.hp > 0; i++) {
      w.step();
      if (u.attackTarget === target) attacked = true;
    }
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { attacked, hp: t.hp, lane: u.lane, heroAi: w.hero.ai, score: w.player.cs };
  }, before);
  expect(after).toMatchObject({ attacked: true, hp: 0, lane: null, heroAi: false });
  await page.screenshot({ path: 'artifacts/bot-team-siege.png' });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/bot-team-siege.json',
    JSON.stringify({ before, after, restoredExactly: true }, null, 2) + '\n'
  );
});
test('a jungle bot contests a visible river creature and creates the real team shrine', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit((window as any).__TEAM_ACTOR__);
    w.tick = 10499;
    w.step();
    const c = w.units.find(
      (s: any) => s.kind === 'monster' && s.monster.species === 'scuttler' && w.alive(s)
    );
    const point = w.battlefield.reachable({ x: c.x + 350, y: c.y }, u.radius, 'blue');
    Object.assign(u, point, { previous: { ...point } });
    w.setOrder(u, { type: 'idle' });
    w.teamPlans.blue.nextThinkTick = w.tick + 1;
    w.step(20);
    const goal = w.teamPlans.blue.assignments.find((s: any) => s.unitId === u.id),
      id = c.id;
    for (let i = 0; i < 3600 && w.unit(id)?.hp !== 0; i++) {
      w.step();
      if (!w.unit(id)) break;
    }
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      goal,
      dead: !w.unit(id) || !w.alive(w.unit(id)),
      shrines: w.scuttlers.shrines,
      charges: w.championState(u.id).smite.charges,
      lane: u.lane,
      snapshot: w.snapshot(),
    };
  });
  expect(result.goal).toMatchObject({ kind: 'river' });
  expect(result.dead).toBe(true);
  expect(result.shrines.some((s: any) => s.team === 'blue')).toBe(true);
  expect(result.charges).toBeLessThan(2);
  expect(result.lane).toBeNull();
  await page.screenshot({ path: 'artifacts/bot-team-river.png' });
  await reload(page);
  expect(errors).toEqual([]);
  const { snapshot, ...evidence } = result;
  writeFileSync('artifacts/bot-team-river.json', JSON.stringify(evidence, null, 2) + '\n');
});
test('an endangered allied base redirects the jungle bot while the human keeps its own order', async ({
  page,
}) => {
  test.setTimeout(90000);
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit((window as any).__TEAM_ACTOR__),
      base = w.units.find((s: any) => s.team === 'blue' && s.kind === 'nexus');
    const p = w.battlefield.reachable({ x: base.x + 1500, y: base.y - 1500 }, u.radius, 'blue');
    Object.assign(u, p, { previous: { ...p } });
    w.setOrder(u, { type: 'idle' });
    base.hp = base.maxHp * 0.2;
    const enemy = w.units.find(
      (s: any) => s.kind === 'champion' && s.team === 'red' && w.championState(s.id).role === 'mid'
    );
    const e = w.battlefield.reachable({ x: base.x + 650, y: base.y }, enemy.radius, 'red');
    Object.assign(enemy, e, { previous: { ...e } });
    w.setOrder(enemy, { type: 'idle' });
    const humanOrder = JSON.stringify(w.hero.order);
    w.teamPlans.blue.nextThinkTick = w.tick + 1;
    w.step(120);
    const goal = w.teamPlans.blue.assignments.find((s: any) => s.unitId === u.id);
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      goal,
      oldDistance: Math.hypot(p.x - base.x, p.y - base.y),
      distance: Math.hypot(u.x - base.x, u.y - base.y),
      humanUnchanged: JSON.stringify(w.hero.order) === humanOrder,
      heroAi: w.hero.ai,
    };
  });
  expect(result.goal).toMatchObject({ kind: 'defend' });
  expect(result.distance).toBeLessThan(result.oldDistance);
  expect(result.humanUnchanged).toBe(true);
  expect(result.heroAi).toBe(false);
  await page.screenshot({ path: 'artifacts/bot-team-defense.png' });
  writeFileSync('artifacts/bot-team-defense.json', JSON.stringify(result, null, 2) + '\n');
});
