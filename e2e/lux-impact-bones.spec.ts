import { expect, test } from '@playwright/test';
for (const critical of [false, true])
  test(`${critical ? 'critical' : 'normal'} Lux rings and sparks use historical bone positions`, async ({
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
    const expected = await page.evaluate(async (critical) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { luxHitBone } = await import('/src/render/lux-hit-bone.ts');
      const { luxImpactSparks } = await import('/src/render/lux-impact-sparks.ts');
      const g = (window as any).__GAME__,
        w = g.world,
        target = w.hero;
      g.setPaused(true);
      w.units = [target];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      target.hp = target.maxHp = 5000;
      const lux = w.spawn('champion', 'red', { x: target.x + 300, y: target.y }, 'lux');
      w.setOrder(lux, { type: 'attack', target: target.id });
      for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
      if (critical) w.projectiles[0].critical = true;
      w.setOrder(lux, { type: 'idle' });
      while (w.projectiles.length) w.step();
      const bones: number[][] = [];
      w.setOrder(target, { type: 'move', point: { x: target.x + 1000, y: target.y } });
      for (let i = 0; i < 3; i++) {
        w.step();
        g.view.render(w, 1, 0);
        const model = g.view.models.get(target.id),
          p = new THREE.Vector3();
        model.root.updateMatrixWorld(true);
        luxHitBone(model.root, critical)!.getWorldPosition(p);
        bones.push(p.toArray());
      }
      const e = w.luxImpactVisuals[0],
        birth = bones[0],
        current = bones[2];
      // All three sampled steps lie in the authored constant 0.5 binding interval.
      const anchor = birth.map((v, i) => v + 0.5 * (current[i] - v));
      const particles = luxImpactSparks(e.id, 2 / 60).map((p) => {
        const velocity = p.velocity.map((v, i) => v + 0.5 * (bones[2][i] - bones[1][i]) * 6000);
        return {
          position: p.position.map((v, i) => v * 0.01 + anchor[i]),
          yScale:
            p.scale[1] *
            0.01 *
            Math.max(1.2999999523162842, Math.hypot(...velocity) * 0.004000000189989805),
        };
      });
      g.view.center = { x: target.x, y: target.y };
      g.view.zoom = 0.55;
      g.view.render(w, 1, 0);
      return { birth, current, particles };
    }, critical);
    const draw = () =>
      page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        g.view.center = { x: w.hero.x, y: w.hero.y };
        g.view.zoom = 0.55;
        g.view.render(w, 1, g.view.previousElapsed + 10);
        const cloud = g.view.luxImpacts.clouds.get(w.luxImpactVisuals[0].id);
        const matrices = [...cloud.sparks.mesh.instanceMatrix.array];
        return {
          rings: cloud.rings
            .filter((r: any) => r.mesh.visible)
            .map((r: any) => ({
              name: r.profile.name,
              bind: r.profile.bind,
              position: r.mesh.position.toArray(),
            })),
          sparks: Array.from({ length: cloud.sparks.mesh.count }, (_, i) => ({
            position: matrices.slice(i * 16 + 12, i * 16 + 15),
            yScale: Math.hypot(...matrices.slice(i * 16 + 4, i * 16 + 7)),
          })),
          matrices,
          snapshot: w.snapshot(),
        };
      });
    const before = await draw();
    expect(before.rings).toHaveLength(critical ? 4 : 2);
    for (const ring of before.rings)
      for (let axis = 0; axis < 3; axis++)
        expect(ring.position[axis]).toBeCloseTo(
          (ring.bind ? expected.current : expected.birth)[axis],
          7
        );
    expect(before.sparks).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      for (let axis = 0; axis < 3; axis++)
        expect(before.sparks[i].position[axis]).toBeCloseTo(
          expected.particles[i].position[axis],
          5
        );
      expect(before.sparks[i].yScale).toBeCloseTo(expected.particles[i].yScale, 5);
    }
    expect(await draw()).toEqual(before);
    await page.screenshot({
      path: `artifacts/lux-impact-${critical ? 'critical' : 'normal'}-bones.png`,
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready();
    expect(await draw()).toEqual(before);
    expect(errors).toEqual([]);
  });
