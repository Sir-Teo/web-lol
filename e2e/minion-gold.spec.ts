import { expect, test } from '@playwright/test';

test('late Rift waves carry scaled cannon and super bounties through last-hit payout', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.tick = 30 * 60 * 60;
    w.nextWaveTick = w.tick + 1;
    w.pendingSpawns = [];
    w.units = w.units.filter((u: any) => u.structure || u.id === w.hero.id);
    const inhibitor = w.units.find(
      (u: any) =>
        u.team === 'blue' && u.structure?.role === 'inhibitor' && u.structure.lane === 'mid'
    );
    inhibitor.hp = 0;
    inhibitor.deadAt = w.tick;
    inhibitor.respawnTick = w.tick + 18000;
    w.step(300);
    const valuable = w.units.filter((u: any) => u.kind === 'siege' || u.kind === 'super');
    const bounties = valuable.map((u: any) => ({
      kind: u.kind,
      team: u.team,
      bounty: u.goldBounty,
    }));
    const victim = valuable.find((u: any) => u.kind === 'super' && u.team === 'red');
    const before = w.player.gold;
    w.damage(w.hero, victim, 1e6, 'true');
    g.hud.update(60);
    return { bounties, awarded: w.player.gold - before, displayed: Math.floor(w.player.gold) };
  });
  expect(result.bounties).toHaveLength(6);
  expect(result.bounties.filter((u: any) => u.kind === 'super')).toEqual([
    { kind: 'super', team: 'red', bounty: 70 },
  ]);
  expect(result.bounties.every((u: any) => u.bounty === 70)).toBe(true);
  expect(result.awarded).toBeCloseTo(70, 6);
  await expect(page.locator('#gold')).toHaveText(String(result.displayed));
});
