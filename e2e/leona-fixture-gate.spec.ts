import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('an incomplete Leona simulation save is preserved and rejected before browser model loading', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    // A separate simulation never enters the live view's model set.
    const fixture = new g.world.constructor(false, g.world.battlefield);
    const leona = fixture.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
    fixture.learnSpell('q', leona.id);
    fixture.enqueue({ type: 'cast', unit: leona.id, ability: 'q', point: { x: 0, y: 0 } });
    fixture.step();
    const snapshot = fixture.snapshot();
    if (fixture.constructor.fromSnapshot(snapshot, fixture.battlefield).snapshot() !== snapshot)
      throw new Error('Leona simulation checkpoint does not round trip');
    const modulePath = '/src/storage/match-store.ts';
    const { writeMatch } = await import(modulePath);
    await writeMatch(fixture.battlefield.id, snapshot);
    return { snapshot, key: fixture.battlefield.id, leona: leona.id };
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.locator('#toast')).toHaveText(
    'Leona simulation fixtures require presentation integration before browser loading.'
  );
  const result = await page.evaluate(async (key) => {
    const g = (window as any).__GAME__;
    const modulePath = '/src/storage/match-store.ts';
    const { readMatch } = await import(modulePath);
    return {
      saved: await readMatch(key),
      champion: g.world.hero.champion,
      identities: g.world.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => u.champion),
      pending: g.world.player.pendingCast,
    };
  }, prepared.key);
  expect(result.saved).toBe(prepared.snapshot);
  expect(result.champion).toBe('ashe');
  expect(result.identities).not.toContain('leona');
  expect(result.pending).toBeNull();
  expect(requests.filter((url) => /\/assets\/.*leona/i.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('rejected-simulation-save.png') });
  writeFileSync(
    testInfo.outputPath('evidence.json'),
    JSON.stringify({ prepared, result, errors }, null, 2) + '\n'
  );
});
