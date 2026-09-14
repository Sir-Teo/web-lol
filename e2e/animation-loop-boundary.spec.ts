import { expect, test } from '@playwright/test';
for (const rig of [
  'ashe-base',
  'lux-base',
  ...['blue', 'red'].flatMap((team) =>
    ['melee', 'caster', 'siege', 'super'].map((kind) => `${team}-${kind}`)
  ),
])
  test(`${rig} run and idle interpolate across loops and restore the same poses`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ready = async () => {
      await page.waitForFunction(() => (window as any).__GAME__?.ready);
      await page.locator('#loading').waitFor({ state: 'detached' });
    };
    await page.goto('/?scene=fixture');
    await ready();
    const id = await page.evaluate((rig) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      const [teamOrChampion, kind] = rig.split('-');
      const u =
        rig === 'ashe-base'
          ? w.hero
          : kind === 'base'
            ? w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y }, teamOrChampion)
            : w.spawn(kind, teamOrChampion, { x: w.hero.x, y: w.hero.y });
      u.ai = false;
      if (u !== w.hero) w.hero.x -= 1000;
      w.setOrder(u, { type: 'move', point: { x: u.x + 1000, y: u.y } });
      w.step(25);
      g.view.render(w, 1, 0);
      return u.id;
    }, rig);
    for (const mode of ['run', 'idle'] as const) {
      const crossing = await page.evaluate(
        ({ id, mode }) => {
          const g = (window as any).__GAME__,
            w = g.world,
            u = w.unit(id);
          g.hud.closeModal();
          g.setPaused(true);
          if (mode === 'idle') {
            w.setOrder(u, { type: 'idle' });
            w.step(10);
          }
          const model = g.view.models.get(id),
            clip = mode === 'run' ? 'run' : 'idle1';
          const duration = model.clipDurations[clip],
            clock = u[mode + 'Clock'];
          if (!clock) throw new Error(`Expected active ${mode} clock`);
          // Seed the existing segment just before its source duration, then let a
          // real simulation step produce both endpoints of the crossing interval.
          clock.previous = clock.current = duration - 1 / 120;
          w.step();
          return {
            previous: u[mode + 'Clock'].previous,
            current: u[mode + 'Clock'].current,
            duration,
          };
        },
        { id, mode }
      );
      expect(crossing.previous).toBeLessThan(crossing.duration);
      expect(crossing.current).toBeGreaterThan(crossing.duration);
      const sample = () =>
        page.evaluate(
          async ({ id, mode }) => {
            const { luxHitBone } = await import('/src/render/lux-hit-bone.ts');
            const g = (window as any).__GAME__,
              w = g.world,
              u = w.unit(id);
            const clip = mode === 'run' ? 'run' : 'idle1',
              clock = u[mode + 'Clock'];
            return [0, 0.25, 0.5, 0.75, 1].map((alpha) => {
              g.view.render(w, alpha, g.view.previousElapsed + 10);
              const model = g.view.models.get(id);
              model.root.updateMatrixWorld(true);
              return {
                time: model.actions[clip].time,
                expected:
                  (clock.previous + (clock.current - clock.previous) * alpha) %
                  model.clipDurations[clip],
                matrix: luxHitBone(model.root, true)!.matrixWorld.toArray(),
              };
            });
          },
          { id, mode }
        );
      const before = await sample();
      for (const pose of before) expect(pose.time).toBeCloseTo(pose.expected, 12);
      expect(await sample()).toEqual(before);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Save match', exact: true }).click();
      await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
      await page.reload();
      await ready();
      expect(await sample()).toEqual(before);
    }
    expect(errors).toEqual([]);
  });
