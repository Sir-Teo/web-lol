import { expect, test } from '@playwright/test';

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
