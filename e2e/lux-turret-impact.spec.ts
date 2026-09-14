import { expect, test } from '@playwright/test';
for (const team of ['blue', 'red'])
  test(`${team} turret impacts use authored world transforms and survive destruction/reload`, async ({
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
    const setup = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const target = w.units.find(
        (u: any) =>
          u.team === team && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
      );
      w.units = [w.hero, target];
      target.ai = false;
      const lux = w.spawn(
        'champion',
        team === 'blue' ? 'red' : 'blue',
        { x: target.x - 300, y: target.y },
        'lux'
      );
      w.visionAreas.push({
        kind: 'scout',
        x: target.x,
        y: target.y,
        radius: 800,
        team: lux.team,
        endTick: w.tick + 600,
        unobstructed: true,
      });
      w.setOrder(lux, { type: 'attack', target: target.id });
      for (let i = 0; i < 120 && !w.projectiles.length; i++) w.step();
      if (!w.projectiles.length) throw new Error('Lux did not release the turret attack');
      w.setOrder(lux, { type: 'idle' });
      for (let i = 0; i < 120 && w.projectiles.length; i++) w.step();
      if (!w.luxImpactVisuals.length) throw new Error('No turret impact recorded');
      w.step();
      g.view.locked = false;
      g.view.center = { x: target.x, y: target.y };
      g.view.zoom = 0.7;
      return { target: target.id, source: lux.id };
    }, team);
    const sample = () =>
      page.evaluate(async (id) => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { luxHitBone } = await import('/src/render/lux-hit-bone.ts');
        const g = (window as any).__GAME__,
          w = g.world,
          u = w.unit(id);
        g.view.locked = false;
        g.view.center = { x: u.x, y: u.y };
        g.view.zoom = 0.7;
        g.view.render(w, 1, g.view.previousElapsed + 10);
        const model = g.view.models.get(id),
          effect = w.luxImpactVisuals[0],
          cloud = g.view.luxImpacts.clouds.get(effect.id);
        model.root.updateMatrixWorld(true);
        const bones = [false, true].map((critical) => {
          const p = new THREE.Vector3();
          luxHitBone(model.root, critical)!.getWorldPosition(p);
          const saved = cloud.attachments.point({ ...effect, critical }, w.tick);
          return { live: p.toArray(), saved: saved.toArray() };
        });
        return {
          bones,
          rig: effect.targetRig,
          transform: effect.targetTransform,
          actualTransform: u.structureTransform,
          rings: cloud.rings
            .filter((r: any) => r.mesh.visible)
            .map((r: any) => r.mesh.position.toArray()),
          sparkCount: cloud.sparks.mesh.count,
          sparks: [...cloud.sparks.mesh.instanceMatrix.array].slice(
            0,
            cloud.sparks.mesh.count * 16
          ),
          snapshot: w.snapshot(),
        };
      }, setup.target);
    const alive = await sample();
    expect(alive.rig).toBe(`${team}-turret`);
    expect(alive.transform).toEqual(alive.actualTransform);
    expect(alive.rings).toHaveLength(2);
    expect(alive.sparkCount).toBe(5);
    for (const bone of alive.bones)
      for (let axis = 0; axis < 3; axis++) expect(bone.saved[axis]).toBeCloseTo(bone.live[axis], 7);
    for (const ring of alive.rings)
      for (let axis = 0; axis < 3; axis++)
        expect(ring[axis]).toBeCloseTo(alive.bones[0].live[axis], 7);
    await page.screenshot({ path: `artifacts/lux-${team}-turret-impact.png` });
    await page.evaluate(({ target, source }) => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.damage(w.unit(source), w.unit(target), 1e6, 'true');
      w.step();
    }, setup);
    const dead = await sample();
    for (const bone of dead.bones)
      for (let axis = 0; axis < 3; axis++) expect(bone.saved[axis]).toBeCloseTo(bone.live[axis], 7);
    expect(await sample()).toEqual(dead);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready();
    expect(await sample()).toEqual(dead);
    expect(errors).toEqual([]);
  });
