import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const crossing = JSON.parse(
  readFileSync('docs/reference/team-detour-cases.json', 'utf8')
).cases.find((row: any) => row.champion === 'garen');
async function ready(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}
test('a Rift team job takes a remembered-turret detour with actual movement and exact UI save/reload continuation', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  const before = await page.evaluate(async (row) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { segmentDistance } = await import('/src/simulation/math.ts');
    const { BOT_TEAM_POLICY } = await import('/src/content/bot-team-policy.ts');
    const { STRUCTURE_RESPAWN_TICKS } = await import('/src/content/rules.ts');
    g.hud.closeModal();
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const unit of w.units)
      if (unit.kind === 'champion') {
        unit.ai = false;
        w.setOrder(unit, { type: 'idle' });
      }
    const actor = w.units.find(
      (u: any) =>
        u.kind === 'champion' && u.team === 'blue' && w.championState(u.id).role === 'jungle'
    );
    const start = w.battlefield.reachable(row.start, actor.radius, actor.team);
    Object.assign(actor, start, { previous: { ...start } });
    const point = w.battlefield.reachable(row.goal, actor.radius, actor.team);
    const anchor = w.units.find((u: any) => u.team === 'red' && u.kind === 'nexus');
    // This retained crossing follows the nearby bot inhibitor turret's destruction.
    const destroyed = w.units.find(
      (u: any) =>
        u.kind === 'turret' &&
        u.team === 'red' &&
        Math.abs(u.x - 5186) < 1 &&
        Math.abs(u.y + 5659) < 1
    );
    destroyed.hp = 0;
    destroyed.deadAt = w.tick;
    destroyed.respawnTick = w.tick + STRUCTURE_RESPAWN_TICKS['nexus-turret'];
    destroyed.structureKnowledge = { blue: w.tick, red: w.tick };
    actor.ai = true;
    actor.nextThink = w.tick;
    const humanOrder = structuredClone(w.hero.order);
    w.teamPlans.blue.nextThinkTick = w.tick + 60;
    w.teamPlans.blue.assignments = [
      {
        unitId: actor.id,
        kind: 'advance',
        targetId: anchor.id,
        point,
        issuedTick: w.tick,
        observedTick: w.tick,
        expiresTick: w.tick + 180,
        score: 90,
      },
    ];
    const hazards = w.knownTeamTowers('blue').map((t: any) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      radius: t.range + actor.radius + BOT_TEAM_POLICY.towerMargin,
    }));
    const ordinary = w.battlefield.findPath(actor, point, actor.radius, actor.team);
    const crosses = (path: any[]) => {
      const route = [start, ...path];
      return hazards.some((h: any) =>
        route.some((b: any, i: number) => i > 0 && segmentDistance(h, route[i - 1], b) < h.radius)
      );
    };
    const ordinaryUnsafe = crosses(ordinary);
    w.step();
    const path = structuredClone(actor.path);
    const route = [actor, ...path];
    const safe = route.every(
      (b: any, i: number) =>
        i === 0 ||
        (hazards.every((h: any) => segmentDistance(h, route[i - 1], b) >= h.radius) &&
          w.battlefield.lineWalkable(route[i - 1], b, actor.radius, actor.team))
    );
    // Isolate traversal of the accepted route from later tactical replanning.
    actor.nextThink = w.tick + 240;
    g.view.zoom = 0.7;
    g.view.recenter(actor);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      saved,
      future: copy.snapshot(),
      actor: actor.id,
      start,
      point,
      ordinaryUnsafe,
      safe,
      path,
      humanOrder,
      afterHumanOrder: w.hero.order,
      role: w.championState(actor.id).role,
      lane: actor.lane,
      tick: w.tick,
      hazards,
      stagedDestroyedTurret: destroyed.id,
    };
  }, crossing);
  expect(before.ordinaryUnsafe).toBe(true);
  expect(before.safe).toBe(true);
  expect(before.path.length).toBeGreaterThan(1);
  expect(before.afterHumanOrder).toEqual(before.humanOrder);
  expect(before.role).toBe('jungle');
  expect(before.lane).toBeNull();
  await page.screenshot({ path: info.outputPath('accepted-detour.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const after = await page.evaluate(({ actor, tick, hazards }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      unit = w.unit(actor);
    const restored = w.snapshot();
    g.hud.closeModal();
    g.setPaused(true);
    let safe = true;
    for (let i = 0; i < 180; i++) {
      w.step();
      safe &&= hazards.every((h: any) => Math.hypot(unit.x - h.x, unit.y - h.y) >= h.radius);
    }
    g.view.recenter(unit);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      restored,
      future: w.snapshot(),
      safe,
      elapsedTicks: w.tick - tick,
      position: { x: unit.x, y: unit.y },
      role: w.championState(actor).role,
      lane: unit.lane,
      humanAi: w.hero.ai,
    };
  }, before);
  expect(after.restored).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.safe).toBe(true);
  expect(after.elapsedTicks).toBe(180);
  expect(after.position).not.toEqual(before.start);
  expect(after.humanAi).toBe(false);
  expect(after.role).toBe('jungle');
  expect(after.lane).toBeNull();
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('continued-detour.png') });
  const { saved, future, ...initial } = before;
  const { restored, future: continued, ...result } = after;
  writeFileSync(
    info.outputPath('detour.json'),
    JSON.stringify(
      {
        baselineGeometry: crossing,
        initial,
        result,
        exactSaveReload: true,
        exact180TickFuture: true,
        errors,
      },
      null,
      2
    ) + '\n'
  );
});
