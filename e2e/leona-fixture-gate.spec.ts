import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('a Leona NPC save restores source rigs and active presentation without changing its saved bytes', async ({
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
  expect(requests.filter((url) => /\/assets\/models\/leona-base\.glb/.test(url))).toEqual([]);
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    // A separate simulation never enters the live view's model set.
    const fixture = new g.world.constructor(false, g.world.battlefield);
    const leona = fixture.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
    fixture.learnSpell('q', leona.id);
    fixture.gainExperience(280, leona.id);
    fixture.learnSpell('w', leona.id);
    fixture.enqueue({ type: 'cast', unit: leona.id, ability: 'w', point: leona });
    fixture.enqueue({ type: 'cast', unit: leona.id, ability: 'q', point: { x: 0, y: 0 } });
    fixture.step();
    const victim = fixture.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    const marked = fixture.spawn('dummy', 'red', { x: 200, y: 0 });
    fixture.applySunlight(leona, victim);
    fixture.damage(fixture.hero, victim, 1, 'physical');
    fixture.applySunlight(leona, marked);
    fixture.gainExperience(380, leona.id);
    fixture.learnSpell('e', leona.id);
    fixture.enqueue({ type: 'cast', unit: leona.id, ability: 'e', point: { x: 900, y: 0 } });
    fixture.step();
    const flare = fixture.spawn('champion', 'blue', { x: -100, y: 0 }, 'leona');
    fixture.gainExperience(2400, flare.id);
    fixture.learnSpell('r', flare.id);
    fixture.enqueue({ type: 'cast', unit: flare.id, ability: 'r', point: { x: 800, y: 0 } });
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
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
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
      leonaModels: g.world.units
        .filter((u: any) => u.champion === 'leona')
        .map((u: any) => ({
          rig: g.view.models.get(u.id)?.referenceAsset,
          action: g.view.models.get(u.id)?.actionName,
          hasTimeline: u.animationTimeline !== null,
        })),
    };
  }, prepared.key);
  expect(result.saved).toBe(prepared.snapshot);
  expect(result.champion).toBe('ashe');
  expect(result.identities).toContain('leona');
  expect(result.leonaModels).toHaveLength(2);
  for (const model of result.leonaModels) {
    expect(model.rig).toBe('leona-base');
    expect(model.hasTimeline).toBe(true);
  }
  expect(result.pending).toBeNull();
  expect(
    requests.filter((url) => /\/assets\/models\/leona-base\.glb/.test(url)).length
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('restored-source-rigs.png') });
  writeFileSync(
    testInfo.outputPath('evidence.json'),
    JSON.stringify({ prepared, result, errors }, null, 2) + '\n'
  );
});
