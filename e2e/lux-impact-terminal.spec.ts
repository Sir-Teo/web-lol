import { expect, test } from '@playwright/test';

for (const critical of [false, true])
  test(`${critical ? 'critical' : 'normal'} lethal Nexus impact plays after victory without advancing the match`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate((critical) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', w.hero, 'lux');
      const target = w.spawn('nexus', 'red', { x: lux.x + 300, y: lux.y });
      const gate = w.spawn('inhibitor', 'red', { x: lux.x + 600, y: lux.y });
      w.damage(lux, gate, 1e6, 'true');
      target.hp = 1;
      w.setOrder(lux, { type: 'attack', target: target.id });
      for (let i = 0; i < 120 && !w.projectiles.length; i++) w.step();
      if (!w.projectiles.length) throw new Error('Attack never released');
      w.projectiles[0].critical = critical;
      w.setOrder(lux, { type: 'idle' });
      for (let i = 0; i < 120 && !w.winner; i++) w.step();
      if (!w.winner) throw new Error('Nexus did not die');
      const effect = w.luxImpactVisuals[0];
      if (!effect) throw new Error('Lethal impact missing');
      const saved = w.snapshot();
      const start = v.previousElapsed;
      const sample = (age: number) => {
        v.render(w, 1, start + age);
        const cloud = v.luxImpacts.clouds.get(effect.id);
        return cloud
          ? {
              rings: cloud.rings
                .filter((r: any) => r.mesh.visible)
                .map((r: any) => [...r.mesh.matrix.elements]),
              count: cloud.sparks.mesh.count,
              sparks: Array.from(
                cloud.sparks.mesh.instanceMatrix.array.slice(0, cloud.sparks.mesh.count * 16)
              ),
            }
          : null;
      };
      const before = sample(0),
        born = sample(0.05),
        repeated = sample(0.05),
        expired = sample(1);
      const retired = v.luxImpacts.clouds.size;
      const replayed = sample(0.05);
      w.step(120);
      return {
        winner: w.winner,
        before,
        born,
        repeated,
        expired,
        retired,
        replayed,
        unchanged: saved === w.snapshot(),
      };
    }, critical);
    expect(result.winner).toBe('blue');
    expect(result.before?.rings).toHaveLength(0);
    expect(result.before?.count).toBe(0);
    expect(result.born?.rings).toHaveLength(critical ? 4 : 2);
    expect(result.born?.count).toBe(5);
    expect(result.repeated).toEqual(result.born);
    expect(result.expired).toBeNull();
    expect(result.retired).toBe(0);
    expect(result.replayed).toEqual(result.born);
    expect(result.unchanged).toBe(true);
  });
