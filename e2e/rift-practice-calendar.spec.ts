import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('ordinary practice reaches the first camp deadline on its uninterrupted live clock', async ({
  page,
}) => {
  test.setTimeout(200000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const sources = await page.evaluate(async () => {
    const { RIFT_CAMPS } = await import('/src/content/rift-camps.ts');
    return RIFT_CAMPS.map((camp: any) => ({
      id: camp.id,
      firstReadyTick: camp.firstReadyTick,
      initialMemberCount: camp.initialMemberCount,
    }));
  });
  const firstReadyTick = Math.min(...sources.map((camp) => camp.firstReadyTick));
  const before = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      mode: w.matchMode,
      battlefield: w.battlefield.id,
      tick: w.tick,
      monsters: w.units.filter((u: any) => u.kind === 'monster').length,
      camps: structuredClone(w.jungleCamps),
    };
  });
  expect(before.mode).toBe('practice');
  expect(before.battlefield).toBe('rift');
  expect(before.tick).toBeLessThan(firstReadyTick);
  expect(before.monsters).toBe(0);
  expect(before.camps.map((camp: any) => camp.nextSpawnTick)).toEqual(
    sources.map((camp) => camp.firstReadyTick)
  );
  const started = Date.now();
  await page.waitForFunction(
    (deadline) => (window as any).__GAME__.world.tick >= deadline + 20,
    firstReadyTick,
    { timeout: 170000 }
  );
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      mode: w.matchMode,
      tick: w.tick,
      camps: w.jungleCamps.map((camp: any) => ({
        id: camp.id,
        nextSpawnTick: camp.nextSpawnTick,
        monsters: camp.unitIds
          .filter((id: any) => id !== null)
          .map((id: number) => {
            const u = w.unit(id);
            return { species: u.monster.species, phase: u.monster.phase, hp: u.hp, maxHp: u.maxHp };
          }),
      })),
    };
  });
  expect(after.mode).toBe('practice');
  for (const source of sources.filter((camp) => camp.firstReadyTick === firstReadyTick)) {
    const camp = after.camps.find((camp: any) => camp.id === source.id);
    expect(camp.nextSpawnTick).toBeNull();
    expect(camp.monsters).toHaveLength(source.initialMemberCount);
    for (const monster of camp.monsters) {
      expect(monster.phase).toBe('idle');
      expect(monster.hp).toBe(monster.maxHp);
    }
  }
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/rift-practice-natural-calendar.json',
    JSON.stringify(
      {
        before,
        after,
        elapsedMilliseconds: Date.now() - started,
        clockMutation: false,
        exactSaveReload: true,
      },
      null,
      2
    ) + '\n'
  );
});
