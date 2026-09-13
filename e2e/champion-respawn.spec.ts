import { expect, test } from '@playwright/test';

test('level-18 respawn countdown rounds display seconds while preserving the exact deadline', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.gainExperience(1e6);
    w.damage(w.hero, w.hero, 1e6, 'true');
  });
  await expect(page.locator('#respawn-count')).toHaveText('Respawning in 53');
  await expect(page.locator('.death-overlay')).toBeVisible();
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.tick = w.hero.respawnTick - 1;
  });
  await expect(page.locator('#respawn-count')).toHaveText('Respawning in 1');
  await page.evaluate(() => (window as any).__GAME__.world.step());
  await expect(page.locator('.death-overlay')).toBeHidden();
});

test('late-game respawn countdown includes the capped time multiplier', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.gainExperience(1e6);
    w.tick = 3600 * 60;
    w.damage(w.hero, w.hero, 1e6, 'true');
  });
  await expect(page.locator('#respawn-count')).toHaveText('Respawning in 79');
  await expect(page.locator('.death-overlay')).toBeVisible();
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.tick = w.hero.respawnTick - 1;
  });
  await expect(page.locator('#respawn-count')).toHaveText('Respawning in 1');
  await page.evaluate(() => (window as any).__GAME__.world.step());
  await expect(page.locator('.death-overlay')).toBeHidden();
});

test('both champion teams respawn at their authored Rift fountains', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.units = [w.hero];
    const champions = ['blue', 'red'].map((team) => w.spawn('champion', team, { x: 0, y: 0 }));
    for (const champion of champions) {
      const killer = w.spawn('dummy', champion.team === 'blue' ? 'red' : 'blue', { x: 100, y: 0 });
      w.damage(killer, champion, 1e6, 'true');
    }
    w.tick = champions[0].respawnTick - 1;
    w.step();
    g.view.render(w, 1, 0);
    return champions.map((champion: any) => ({
      team: champion.team,
      point: { x: champion.x, y: champion.y },
      spawn: w.battlefield.spawns[champion.team],
      previous: champion.previous,
      full: champion.hp === champion.maxHp && champion.mana === champion.maxMana,
      visible: w.visible(champion),
      barHidden: g.view.healthBars.get(champion.id).hidden,
    }));
  });
  for (const result of results) {
    expect(result.point).toEqual(result.spawn);
    expect(result.previous).toEqual(result.spawn);
    expect(result.full).toBe(true);
    expect(result.visible).toBe(result.team === 'blue');
    expect(result.barHidden).toBe(result.team === 'red');
  }
});
