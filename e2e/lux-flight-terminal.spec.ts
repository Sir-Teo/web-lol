import { expect, test } from '@playwright/test';

for (const ending of ['projectile', 'direct'] as const)
  test(`Lux flight tails finish after ${ending} victory and release their resources`, async ({
    page,
  }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate(async (ending) => {
      const { luxAttackHoopParticles } = await import('/src/render/lux-attack-hoops.ts');
      const { luxCrescentParticles } = await import('/src/render/lux-crescent-particles.ts');
      const { luxTrailParticles } = await import('/src/render/lux-trail-particles.ts');
      const { luxTrailRibbon } = await import('/src/render/lux-trail-ribbon.ts');
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', w.hero, 'lux');
      const target = w.spawn('nexus', 'red', { x: lux.x + 500, y: lux.y });
      const gate = w.spawn('inhibitor', 'red', { x: lux.x + 650, y: lux.y });
      w.damage(lux, gate, 1e6, 'true');
      target.hp = 1;
      w.setOrder(lux, { type: 'attack', target: target.id });
      for (let i = 0; i < 120 && !w.projectiles.length; i++) w.step();
      if (!w.projectiles.length) throw new Error('Attack never released');
      w.setOrder(lux, { type: 'idle' });
      if (ending === 'direct') {
        w.step(8);
        w.damage(lux, target, 1e6, 'true');
      } else for (let i = 0; i < 120 && !w.winner; i++) w.step();
      if (!w.winner) throw new Error('No victory');
      const effect = w.luxAttackVisuals[0];
      const saved = w.snapshot(),
        start = v.previousElapsed;
      const sample = (age: number) => {
        v.render(w, 1, start + age);
        const hoop = v.luxAttackHoops.clouds.get(effect.id)?.mesh;
        const crescent = v.luxAttackCrescents.clouds.get(effect.id)?.mesh;
        const ribbon = v.luxAttackTrails.ribbons.get(effect.id)?.geometry;
        const instances = (mesh: any) =>
          mesh
            ? {
                count: mesh.count,
                values: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
              }
            : null;
        return {
          hoop: instances(hoop),
          crescent: instances(crescent),
          ribbon: ribbon
            ? {
                count: ribbon.drawRange.count,
                values: Array.from(
                  ribbon.getAttribute('particleTint').array.slice(0, ribbon.drawRange.count * 4)
                ),
              }
            : null,
        };
      };
      const stopped = { ...effect, stopTick: effect.stopTick ?? w.tick };
      const expected = {
        hoop: luxAttackHoopParticles(stopped, w.tick + 6).length,
        crescent: luxCrescentParticles(stopped, w.tick + 6).length,
        ribbon: luxTrailRibbon(luxTrailParticles(stopped, w.tick + 6), () => true).length,
      };
      const initial = sample(0),
        later = sample(0.1),
        repeated = sample(0.1),
        expired = sample(1);
      const replay = sample(0.1);
      w.step(120);
      return {
        expected,
        initial,
        later,
        repeated,
        expired,
        replay,
        stopTick: effect.stopTick,
        tick: w.tick,
        unchanged: saved === w.snapshot(),
      };
    }, ending);
    expect(result.stopTick).toBe(ending === 'direct' ? null : result.tick);
    for (const layer of ['hoop', 'crescent', 'ribbon'] as const) {
      expect(result.initial[layer]?.count).toBeGreaterThan(0);
      expect(result.later[layer]?.count).toBe(result.expected[layer]);
      expect(result.later[layer]).not.toEqual(result.initial[layer]);
      expect(result.expired[layer]).toBeNull();
    }
    expect(result.repeated).toEqual(result.later);
    expect(result.replay).toEqual(result.later);
    expect(result.unchanged).toBe(true);
  });
