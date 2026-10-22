import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('real 5v5 selection prepares two paid jungle companions, displays five positions and restores both camp routes', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/');
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.locator('.lane-description')).toContainText(
    'top, jungle, mid, bottom and support'
  );
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready();
  const initial = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const roster = w.units
      .filter((u: any) => u.kind === 'champion')
      .map((u: any) => ({
        id: u.id,
        team: u.team,
        role: w.championState(u.id).role,
        ai: u.ai,
        lane: u.lane,
      }));
    return {
      roster,
      companions: w.companions.map((p: any) => ({
        owner: p.ownerId,
        kind: p.kind,
        purchase: p.acquisition.kind,
        gold: w.championState(p.ownerId).gold,
      })),
      hero: w.hero.id,
    };
  });
  expect(initial.roster).toHaveLength(10);
  expect(initial.roster.filter((r: any) => r.ai)).toHaveLength(9);
  for (const team of ['blue', 'red'])
    expect(
      initial.roster
        .filter((r: any) => r.team === team)
        .map((r: any) => r.role)
        .sort()
    ).toEqual(['carry', 'jungle', 'mid', 'support', 'top']);
  expect(initial.companions).toHaveLength(2);
  expect(
    initial.companions.every(
      (p: any) => p.kind === 'mosstomper' && p.purchase === 'purchase' && p.gold === 50
    )
  ).toBe(true);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units)
      if (u.kind === 'champion' && w.championState(u.id).role !== 'jungle') u.ai = false;
    w.step(9000);
    const jungle = w.units
      .filter((u: any) => u.kind === 'champion' && w.championState(u.id).role === 'jungle')
      .map((u: any) => {
        const s = w.championState(u.id);
        return {
          id: u.id,
          team: u.team,
          level: s.level,
          cs: s.cs,
          deaths: s.deaths,
          memory: s.jungle,
          pet: w.companions.find((p: any) => p.ownerId === u.id).fed,
        };
      });
    g.view.recenter(w.unit(jungle.find((j: any) => j.team === 'blue').id));
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    g.hud.scoreboard(true);
    return { jungle, saved: w.snapshot() };
  });
  for (const j of result.jungle) {
    expect(j.cs).toBeGreaterThanOrEqual(4);
    expect(j.level).toBeGreaterThanOrEqual(2);
    expect(j.pet).toBeGreaterThan(0);
    expect(j.deaths).toBe(0);
  }
  await expect(page.locator('.scoreboard-title')).toHaveText('5V5 MATCH');
  for (const role of ['top', 'jungle', 'mid', 'carry', 'support'])
    await expect(page.locator(`.scoreboard-row[data-role="${role}"]`)).toHaveCount(2);
  await page.screenshot({ path: 'artifacts/match-roles-scoreboard.png' });
  await page.evaluate(() => (window as any).__GAME__.hud.scoreboard(false));
  await page.screenshot({ path: 'artifacts/role-jungle-clear.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(result.saved);
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/role-jungle-runtime.json',
    JSON.stringify({ initial, jungle: result.jungle, restoredExactly: true }, null, 2) + '\n'
  );
});
