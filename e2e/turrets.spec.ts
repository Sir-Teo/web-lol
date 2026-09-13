import { expect, test } from '@playwright/test';

test('reference towers preserve authored transforms, visible parts, and per-unit rigs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const towers = w.units.filter((u: any) => u.kind === 'turret');
    const rigs: any[] = [];
    const records = towers.map((u: any) => {
      const m = v.models.get(u.id),
        skeletons = new Set();
      m.root.traverse((o: any) => {
        if (o.isSkinnedMesh) skeletons.add(o.skeleton);
      });
      rigs.push([...skeletons][0]);
      const before = [...m.root.matrix.elements];
      u.facing += 1.3;
      u.releaseTick = w.tick + 10;
      u.nextAttackTick = w.tick + 72;
      v.render(w, 1, v.previousElapsed + 0.05);
      const matrix = m.root.matrix.elements,
        source = u.structureTransform;
      // Check all matrix coefficients, including the reflection and tiny authored scales.
      const expected = source.map((n: number, i: number) => {
        if (i === 12) return n * 0.01 - 74.25;
        if (i === 13) return n * 0.01;
        if (i === 14) return 74.25 - n * 0.01;
        return [2, 6, 10].includes(i) ? -n : n;
      });
      return {
        team: u.team,
        asset: m.referenceAsset,
        rigs: skeletons.size,
        visible: m.submeshes
          .filter((o: any) => o.visible)
          .map((o: any) => o.userData.submesh)
          .sort(),
        matrixError: Math.max(...matrix.map((n: number, i: number) => Math.abs(n - expected[i]))),
        fixedFacing: matrix.every((n: number, i: number) => n === before[i]),
        bar: m.barHeight,
      };
    });
    return { records, independentRigs: new Set(rigs).size };
  });
  expect(result.records).toHaveLength(22);
  expect(result.independentRigs).toBe(22);
  for (const record of result.records) {
    expect(record.asset).toBe(`${record.team}-turret`);
    expect(record.rigs).toBe(1);
    expect(record.visible).toEqual(
      record.team === 'blue' ? ['Base'] : ['Base', 'Cloth1', 'Cloth2']
    );
    expect(record.matrixError).toBeLessThan(1e-10);
    expect(record.fixedFacing).toBe(true);
    expect(record.bar).toBeGreaterThan(4.5);
    expect(record.bar).toBeLessThan(7);
  }
  expect(errors).toEqual([]);
});

for (const team of ['blue', 'red'])
  test(`${team} tower destruction retains source rubble and releases its rig on removal`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const towerId = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      const tower = w.units.find(
        (u: any) => u.structure?.role === 'outer-turret' && u.team === team
      );
      w.units = [w.hero, tower];
      w.reveal = { point: { x: tower.x, y: tower.y }, endTick: Infinity };
      v.center = { x: tower.x, y: tower.y };
      v.locked = false;
      v.zoom = 0.7;
      w.tick += 8;
      v.render(w, 1, 10);
      g.hud.update(60);
      return tower.id;
    }, team);
    await page.screenshot({ path: `artifacts/browser-${team}-tower-intact.png` });
    const result = await page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view,
        tower = w.unit(id);
      w.damage(w.hero, tower, 10000, 'true');
      w.step(301);
      v.render(w, 1, 15);
      g.hud.update(60);
      const model = v.models.get(id);
      return {
        retained: !!w.unit(id),
        visible: model.root.visible,
        destroyed: model.destroyed,
        parts: model.submeshes
          .filter((o: any) => o.visible)
          .map((o: any) => o.userData.submesh)
          .sort(),
        poseTime: model.actions[model.actionName].time,
        barHidden: v.healthBars.get(id).hidden,
        textures: v.renderer.info.memory.textures,
      };
    }, towerId);
    expect(result.retained).toBe(true);
    expect(result.visible).toBe(true);
    expect(result.destroyed).toBe(true);
    expect(result.parts).toEqual(team === 'blue' ? ['Rubble'] : ['Rubble', 'RubbleBase']);
    expect(result.poseTime).toBe(0);
    expect(result.barHidden).toBe(true);
    await page.screenshot({ path: `artifacts/browser-${team}-tower-rubble.png` });
    const cleaned = await page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      w.units = w.units.filter((u: any) => u.id !== id);
      v.render(w, 1, 16);
      return { removed: !v.models.has(id), textures: v.renderer.info.memory.textures };
    }, towerId);
    expect(cleaned.removed).toBe(true);
    expect(cleaned.textures).toBeLessThan(result.textures);
  });
