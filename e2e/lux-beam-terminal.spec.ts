import { expect, test } from '@playwright/test';

for (const phase of ['charging', 'fired'] as const)
  test(`Lux ${phase} beam retires after victory without inventing a release`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate((phase) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
      const target = w.spawn('nexus', 'red', { x: 1000, y: 500 });
      const gate = w.spawn('inhibitor', 'red', { x: 1500, y: 500 });
      w.damage(w.hero, gate, 1e6, 'true');
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
      w.step(phase === 'charging' ? 30 : 62);
      v.render(w, 1, v.previousElapsed);
      const beforeVictory = [...v.luxBeams.models.values()].some((group: any) => group.visible);
      w.damage(w.hero, target, 1e6, 'true');
      const saved = w.snapshot(),
        start = v.previousElapsed;
      const sample = (age: number) => {
        v.render(w, 1, start + age);
        return [...v.luxBeams.models.values()].flatMap((group: any) =>
          group.children
            .filter((mesh: any) => mesh.visible)
            .map((mesh: any) => ({
              name: mesh.name,
              tint: mesh.material.uniforms.tint.value.toArray(),
              offset: mesh.material.uniforms.offset.value.toArray(),
              positions: Array.from(
                mesh.geometry
                  .getAttribute('position')
                  .array.slice(0, mesh.geometry.drawRange.count * 3)
              ),
            }))
        );
      };
      const initial = sample(0),
        later = sample(0.1),
        repeated = sample(0.1),
        expired = sample(2);
      const retired = v.luxBeams.models.size;
      const replay = sample(0.1);
      w.step(120);
      return {
        beforeVictory,
        initial,
        later,
        repeated,
        expired,
        retired,
        replay,
        released: w.luxBeams.length,
        unchanged: w.snapshot() === saved,
      };
    }, phase);
    expect(result.released).toBe(phase === 'charging' ? 0 : 1);
    expect(result.beforeVictory).toBe(true);
    if (phase === 'fired') {
      expect(result.initial.length).toBeGreaterThan(0);
      expect(result.later.length).toBeGreaterThan(0);
      expect(result.later).not.toEqual(result.initial);
    } else {
      expect(result.initial).toEqual([]);
      expect(result.later).toEqual([]);
      expect(result.replay).toEqual([]);
    }
    expect(result.repeated).toEqual(result.later);
    expect(result.expired).toEqual([]);
    expect(result.retired).toBe(0);
    expect(result.replay).toEqual(result.later);
    expect(result.unchanged).toBe(true);
  });
