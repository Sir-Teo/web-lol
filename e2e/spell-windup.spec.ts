import { expect, test } from '@playwright/test';

for (const ability of ['w', 'e', 'r']) {
  test(`${ability} windup seeks the source pose, freezes and restores before releasing once`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate(async (ability) => {
      const { World } = await import('/src/simulation/world.ts');
      const { disposeModel } = await import('/src/render/models.ts');
      const g = (window as any).__GAME__,
        v = g.view;
      let w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = 1e9;
      w.enqueue({
        type: 'cast',
        unit: w.hero.id,
        ability,
        point: { x: w.hero.x + 1200, y: w.hero.y },
      });
      w.step(10);
      v.zoom = 0.6;
      v.recenter(w.hero);
      v.resize();
      const clipName = ability === 'w' ? 'spell2' : ability === 'e' ? 'spell3' : 'spell4';
      const pose = () => {
        const model = v.models.get(w.hero.id);
        let bones: number[] = [];
        model.root.traverse((o: any) => {
          if (o.isSkinnedMesh && !bones.length)
            bones = o.skeleton.bones.flatMap((b: any) => [
              ...b.position.toArray(),
              ...b.quaternion.toArray(),
            ]);
        });
        return { clip: model.actionName, time: model.actions[clipName].time, bones };
      };
      v.render(w, 1, v.previousElapsed + 0.1);
      const initial = pose(),
        arrowsBefore = w.projectiles.length;
      v.render(w, 1, v.previousElapsed + 10);
      const paused = pose();
      const saved = w.snapshot(),
        old = v.models.get(w.hero.id);
      v.scene.remove(old.root);
      disposeModel(old);
      v.models.delete(w.hero.id);
      w = World.fromSnapshot(saved, w.battlefield);
      v.render(w, 1, v.previousElapsed + 0.1);
      const restored = pose();
      w.step(5);
      const beforeRelease = w.projectiles.length;
      w.step();
      v.render(w, 1, v.previousElapsed + 0.1);
      const release = {
        count: w.projectiles.length,
        remaining: w.projectiles[ability === 'w' ? 3 : 0].remaining,
        pending: w.player.pendingCast,
        clip: pose().clip,
      };
      w.step();
      return {
        initial,
        paused,
        restored,
        arrowsBefore,
        beforeRelease,
        release,
        after: w.projectiles.length,
      };
    }, ability);
    expect(result.initial.clip).toBe(
      ability === 'w' ? 'spell2' : ability === 'e' ? 'spell3' : 'spell4'
    );
    expect(result.initial.time).toBeCloseTo(0.15);
    expect(result.initial.bones.length).toBeGreaterThan(100);
    expect(result.paused).toEqual(result.initial);
    expect(result.restored).toEqual(result.initial);
    expect(result.arrowsBefore).toBe(0);
    expect(result.beforeRelease).toBe(0);
    const count = ability === 'w' ? 7 : 1;
    expect(result.release.count).toBe(count);
    expect(result.release.pending).toBeNull();
    expect(result.release.clip).toBe('idle1');
    expect(result.release.remaining).toBeCloseTo(
      ability === 'w' ? 1175 : ability === 'e' ? 1200 - 1400 / 60 : 25000 - (1500 / 60 + 100 / 3600)
    );
    expect(result.after).toBe(count);
    await page.screenshot({
      path: `artifacts/browser-${ability === 'w' ? 'volley' : ability === 'e' ? 'hawkshot' : 'ultimate'}-windup.png`,
    });
  });
}
