import { expect, test } from '@playwright/test';

for (const team of ['blue', 'red'])
  test(`${team} super minions use independent source rigs and play their full death clip`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const initial = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
      w.reveal = { point: { x: 0, y: 0 }, endTick: Infinity };
      v.locked = false;
      v.center = { x: 0, y: 0 };
      v.zoom = 0.65;
      const a = w.spawn('super', team, w.battlefield.reachable({ x: -250, y: 0 }, 65, team));
      const b = w.spawn('super', team, w.battlefield.reachable({ x: 250, y: 0 }, 65, team));
      a.ai = b.ai = false;
      a.facing = 0;
      b.facing = Math.PI;
      w.tick += 8;
      v.render(w, 1, 10);
      g.hud.update(60);
      const ma = v.models.get(a.id),
        mb = v.models.get(b.id);
      const skeletons = (model: any) => {
        const result: any[] = [];
        model.root.traverse((o: any) => {
          if (o.isSkinnedMesh) result.push(o.skeleton);
        });
        return result;
      };
      return {
        ids: [a.id, b.id],
        asset: ma.referenceAsset,
        clips: Object.keys(ma.actions).sort(),
        visible: ma.root.visible && mb.root.visible,
        independent: skeletons(ma)[0] !== skeletons(mb)[0] && ma.mixer !== mb.mixer,
        barHeight: ma.barHeight,
        deathDuration: ma.actions.death.getClip().duration,
        health: a.hp,
      };
    }, team);
    expect(initial.asset).toBe(`${team}-super`);
    expect(initial.clips).toEqual(['attack1', 'attack2', 'death', 'death2', 'idle1', 'run']);
    expect(initial.visible).toBe(true);
    expect(initial.independent).toBe(true);
    expect(initial.health).toBe(1500);
    expect(initial.barHeight).toBeGreaterThan(1);
    await page.screenshot({ path: `artifacts/browser-${team}-super-intact.png` });
    const death = await page.evaluate(
      ({ ids, duration }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          v = g.view;
        w.damage(w.hero, w.unit(ids[0]), 1e6, 'true');
        // Keep the animation timing explicit while exercising real simulation cleanup.
        for (let i = 0; i < Math.ceil((duration + 0.05) / 0.05); i++) {
          w.step(3);
          v.render(w, 1, v.previousElapsed + 0.05);
        }
        const a = v.models.get(ids[0]),
          b = v.models.get(ids[1]);
        return {
          retained: !!a,
          visible: a?.root.visible,
          action: a?.actionName,
          time: a?.actions.death.time,
          survivorAction: b.actionName,
          barHidden: v.healthBars.get(ids[0])?.hidden,
        };
      },
      { ids: initial.ids, duration: initial.deathDuration }
    );
    expect(death.retained).toBe(true);
    expect(death.visible).toBe(true);
    expect(death.action).toBe('death');
    expect(death.time).toBeCloseTo(initial.deathDuration, 5);
    expect(death.survivorAction).toBe('idle1');
    expect(death.barHidden).toBe(true);
    await page.screenshot({ path: `artifacts/browser-${team}-super-death.png` });
    const cleanup = await page.evaluate((ids) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      for (let i = 0; i < 100; i++) {
        w.step(3);
        v.render(w, 1, v.previousElapsed + 0.05);
      }
      return { removed: !v.models.has(ids[0]), survivor: v.models.get(ids[1]).root.visible };
    }, initial.ids);
    expect(cleanup).toEqual({ removed: true, survivor: true });
    expect(errors).toEqual([]);
  });
