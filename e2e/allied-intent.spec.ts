import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}

test('allied plans update live, prioritize recall and retreat, and preserve enemy privacy through Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units)
      if (u.kind === 'champion') {
        u.nextThink = 1e9;
        w.setOrder(u, { type: 'idle' });
      }
    const allies = w.units.filter(
      (u: any) => u.kind === 'champion' && u.team === 'blue' && u.id !== w.hero.id
    );
    const enemies = w.units.filter((u: any) => u.kind === 'champion' && u.team === 'red');
    const ownBase = w.units.find((u: any) => u.team === 'blue' && u.kind === 'nexus');
    const enemyBase = w.units.find((u: any) => u.team === 'red' && u.kind === 'nexus');
    const ownTower = w.units.find(
      (u: any) => u.team === 'blue' && u.structure?.role === 'outer-turret'
    );
    const enemyTower = w.units.find(
      (u: any) => u.team === 'red' && u.structure?.role === 'outer-turret'
    );
    const kinds = ['defend', 'push', 'gank', 'advance'];
    w.teamPlans.blue.assignments = allies.map((u: any, i: number) => {
      const target = i === 0 ? ownBase : i === 2 ? enemies[0] : enemyTower;
      return {
        unitId: u.id,
        kind: kinds[i],
        targetId: target.id,
        point: { x: target.x, y: target.y },
        issuedTick: w.tick,
        observedTick: w.tick,
        expiresTick: w.tick + 180,
        score: 90,
      };
    });
    w.teamPlans.red.assignments = enemies.slice(0, 4).map((u: any, i: number) => {
      const target = i === 0 ? enemyBase : i === 2 ? w.hero : ownTower;
      return {
        unitId: u.id,
        kind: kinds[i],
        targetId: target.id,
        point: { x: target.x, y: target.y },
        issuedTick: w.tick,
        observedTick: w.tick,
        expiresTick: w.tick + 180,
        score: 90,
      };
    });
    w.teamPlans.blue.nextThinkTick = w.tick + 60;
    w.teamPlans.red.nextThinkTick = w.tick + 60;
    const visible = w.battlefield.reachable(
      { x: w.hero.x + 350, y: w.hero.y },
      enemies[0].radius,
      'red'
    );
    Object.assign(enemies[0], visible, { previous: { ...visible } });
    g.hud.scoreboard(true);
    g.hud.update(60);
    return {
      allies: allies.map((u: any) => u.id),
      human: w.hero.id,
      visibleEnemy: enemies[0].id,
      enemyVisible: w.visible(enemies[0], 'blue'),
    };
  });
  expect(ids.enemyVisible).toBe(true);
  const labels = ['Defending', 'Pushing', 'Ganking', 'Advancing'];
  for (const [index, id] of ids.allies.entries())
    await expect(page.locator(`[data-champion="${id}"] .scoreboard-intent`)).toHaveText(
      labels[index]
    );
  await expect(page.locator('.scoreboard-row.enemy .scoreboard-intent')).toHaveCount(0);
  await expect(page.locator(`[data-champion="${ids.human}"] .scoreboard-intent`)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('allied-plans-1440.png') });
  await page.evaluate(({ allies }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.enqueue({ type: 'recall', unit: allies[0] });
    w.step();
    w.unit(allies[1]).aiRetreating = true;
    w.teamPlans.blue.assignments = w.teamPlans.blue.assignments.filter(
      (a: any) => a.unitId !== allies[2]
    );
    g.hud.update(60);
  }, ids);
  await expect(page.locator(`[data-champion="${ids.allies[0]}"] .scoreboard-intent`)).toHaveText(
    'Recalling'
  );
  await expect(page.locator(`[data-champion="${ids.allies[1]}"] .scoreboard-intent`)).toHaveText(
    'Retreating'
  );
  await expect(page.locator(`[data-champion="${ids.allies[2]}"] .scoreboard-intent`)).toHaveCount(
    0
  );
  await page.evaluate(() => (window as any).__GAME__.hud.scoreboard(false));
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.hud.scoreboard(true);
    g.hud.update(60);
  });
  await expect(page.locator(`[data-champion="${ids.allies[0]}"] .scoreboard-intent`)).toHaveText(
    'Recalling'
  );
  await expect(page.locator(`[data-champion="${ids.allies[1]}"] .scoreboard-intent`)).toHaveText(
    'Retreating'
  );
  await expect(page.locator('.scoreboard-row.enemy .scoreboard-intent')).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 720 });
  const layout = await page.locator('.scoreboard').evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: { x: box.x, y: box.y, width: box.width, height: box.height },
      inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
      horizontalOverflow: panel.scrollWidth > panel.clientWidth,
    };
  });
  expect(layout.inside).toBe(true);
  expect(layout.horizontalOverflow).toBe(false);
  await page.locator(`[data-champion="${ids.allies[3]}"]`).scrollIntoViewIfNeeded();
  await expect(page.locator(`[data-champion="${ids.allies[3]}"] .scoreboard-intent`)).toHaveText(
    'Advancing'
  );
  await page.screenshot({ path: info.outputPath('allied-plans-1024.png') });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('allied-intent.json'),
    JSON.stringify(
      {
        ids,
        labels,
        realRecall: true,
        recallRetreatOverride: true,
        removedJobClears: true,
        exactSaveReload: true,
        enemyPlansHidden: true,
        layout,
        errors,
      },
      null,
      2
    ) + '\n'
  );
});
