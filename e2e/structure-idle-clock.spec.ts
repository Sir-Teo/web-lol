import { expect, test } from '@playwright/test';

test('all six structure rigs preserve idle phase through late renders, pause and browser reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/');
  await ready();
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    w.step(143);
    return ['blue', 'red'].flatMap((team) =>
      ['turret', 'inhibitor', 'nexus'].map(
        (kind) => w.units.find((u: any) => u.team === team && u.kind === kind).id
      )
    );
  });
  const draw = () =>
    page.evaluate(async (ids) => {
      const { structureAnimationProfile } = await import('/src/content/structure-animation.ts');
      const g = (window as any).__GAME__,
        w = g.world,
        elapsed = g.view.previousElapsed + 10;
      g.view.locked = false;
      const poses = [0, 0.5, 1].map((alpha) => {
        return ids.map((id) => {
          const u = w.unit(id);
          // Offscreen poses may sleep; observe each rig before reading bones.
          g.view.center = { x: u.x, y: u.y };
          g.view.render(w, alpha, elapsed);
          const model = g.view.models.get(id),
            action = model.actions.idle1;
          model.root.updateMatrixWorld(true);
          const bones: number[] = [];
          model.root.traverse((o: any) => {
            if (o.isBone) bones.push(...o.matrixWorld.toArray());
          });
          const duration = action.getClip().duration;
          return {
            rig: model.referenceAsset,
            profile: structureAnimationProfile(u),
            loadedProfile: {
              destroyedClip: model.destroyedClip,
              animateDestruction: model.animateDestruction ?? false,
              deadIdleClip: model.deadIdleClip ?? null,
              durations: model.clipDurations,
            },
            time: action.time,
            weight: action.getEffectiveWeight(),
            bones,
            expected:
              duration > 0
                ? Math.max(0, (w.tick - 1 + alpha - w.knownStructureIdleStartTick(u)) / 60) %
                  duration
                : 0,
          };
        });
      });
      return { poses, snapshot: w.snapshot() };
    }, ids);
  const before = await draw();
  for (const phase of before.poses) {
    expect(phase).toHaveLength(6);
    for (const pose of phase) {
      expect(pose.loadedProfile).toEqual(pose.profile);
      expect(pose.time).toBeCloseTo(pose.expected, 12);
      expect(pose.weight).toBe(1);
      expect(pose.bones.length).toBeGreaterThan(16);
    }
  }
  expect(await draw()).toEqual(before);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await draw()).toEqual(before);
  expect(errors).toEqual([]);
});
