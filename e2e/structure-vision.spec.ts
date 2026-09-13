import { expect, test } from '@playwright/test';

test('known enemy bases render under fog without exposing live health, picking, or hidden damage', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const hidden = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.tick = 1200;
    const nexus = w.units.find((u: any) => u.team === 'red' && u.kind === 'nexus');
    v.center = { x: nexus.x, y: nexus.y };
    v.locked = false;
    v.zoom = 0.8;
    v.selected = v.hovered = nexus.id;
    v.render(w, 1, 10);
    g.hud.update(60);
    const model = v.models.get(nexus.id),
      materials: any[] = [];
    model.root.traverse((o: any) => {
      if (o.isMesh) materials.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    const p = v.screenPoint(nexus, 1.8);
    const mini = document.querySelector('#minimap') as HTMLCanvasElement;
    const mx = Math.round((nexus.x / (w.battlefield.half * 2) + 0.5) * mini.width);
    const my = Math.round((nexus.y / (w.battlefield.half * 2) + 0.5) * mini.height);
    const miniPixel = Array.from(mini.getContext('2d')!.getImageData(mx, my, 1, 1).data);
    return {
      id: nexus.id,
      visible: model.root.visible,
      sight: w.visible(nexus),
      picked: v.pick(w, p.x, p.y)?.id,
      fogMaterials: materials.every((m) => m.userData.riftFog),
      barHidden: v.healthBars.get(nexus.id).hidden,
      miniPixel,
      structureCount: w.units.filter(
        (u: any) => u.team === 'red' && u.structure && v.models.get(u.id).root.visible
      ).length,
    };
  });
  expect(hidden.visible).toBe(true);
  expect(hidden.sight).toBe(false);
  expect(hidden.picked).not.toBe(hidden.id);
  expect(hidden.fogMaterials).toBe(true);
  expect(hidden.barHidden).toBe(true);
  expect(hidden.miniPixel[0]).toBeGreaterThan(hidden.miniPixel[1] + 40);
  expect(hidden.structureCount).toBe(15);
  await expect(page.locator('#target-panel')).toBeHidden();
  await page.screenshot({ path: 'artifacts/browser-enemy-base-fog.png' });
  const damage = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const tower = w.units.find(
      (u: any) =>
        u.team === 'red' && u.structure?.role === 'outer-turret' && u.structure.lane === 'mid'
    );
    w.events = [];
    w.damage(w.hero, tower, 100, 'physical');
    v.render(w, 1, 10.05);
    g.hud.update(60);
    return {
      id: tower.id,
      hp: tower.hp,
      damaged: tower.hp < tower.maxHp,
      leaked: w.events.some((e: any) => e.type === 'damage' && w.eventVisible(e)),
    };
  });
  expect(damage.damaged).toBe(true);
  expect(damage.leaked).toBe(false);
  await expect(page.locator('.combat-text.damage')).toHaveCount(0);
  const revealed = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      nexus = w.unit(id);
    w.reveal = { point: { x: nexus.x, y: nexus.y }, endTick: Infinity };
    w.tick += 8;
    v.render(w, 1, 10.1);
    g.hud.update(60);
    return { sight: w.visible(nexus), barHidden: v.healthBars.get(id).hidden };
  }, hidden.id);
  expect(revealed).toEqual({ sight: true, barHidden: false });
  await expect(page.locator('#target-panel')).toBeVisible();
  await page.screenshot({ path: 'artifacts/browser-enemy-base-revealed.png' });
  const regrowth = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.reveal = null;
    for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor']) {
      const u = w.units.find(
        (u: any) => u.team === 'red' && u.structure?.role === role && u.structure.lane === 'mid'
      );
      w.damage(w.hero, u, 1e6, 'true');
    }
    const inhibitor = w.units.find(
      (u: any) => u.team === 'red' && u.kind === 'inhibitor' && u.structure.lane === 'mid'
    );
    const model = v.models.get(inhibitor.id);
    v.center = { x: inhibitor.x, y: inhibitor.y };
    v.render(w, 1, v.previousElapsed + 0.05);
    const duration = model.actions[model.destroyedClip].getClip().duration;
    for (let i = 0; i < Math.ceil((duration + 0.1) / 0.05); i++)
      v.render(w, 1, v.previousElapsed + 0.05);
    w.tick = inhibitor.respawnTick - 1;
    w.step();
    v.render(w, 1, v.previousElapsed + 0.05);
    g.hud.update(60);
    return {
      id: inhibitor.id,
      alive: w.alive(inhibitor),
      sight: w.visible(inhibitor),
      destroyed: model.destroyed,
      rootVisible: model.root.visible,
      parts: model.submeshes.filter((o: any) => o.visible).map((o: any) => o.userData.submesh),
    };
  });
  expect(regrowth).toMatchObject({
    alive: true,
    sight: false,
    destroyed: true,
    rootVisible: true,
    parts: ['Destroyed'],
  });
  await page.screenshot({ path: 'artifacts/browser-hidden-inhibitor-regrowth.png' });
  const observed = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(id);
    w.reveal = { point: { x: u.x, y: u.y }, endTick: Infinity };
    w.step(8);
    v.render(w, 1, v.previousElapsed + 0.05);
    g.hud.update(60);
    const result = { destroyed: v.models.get(id).destroyed, bar: !v.healthBars.get(id).hidden };
    w.reveal = null;
    w.step(8);
    v.render(w, 1, v.previousElapsed + 0.05);
    g.hud.update(60);
    return {
      ...result,
      retainedIntact: !v.models.get(id).destroyed,
      hiddenBar: v.healthBars.get(id).hidden,
    };
  }, regrowth.id);
  expect(observed).toEqual({ destroyed: false, bar: true, retainedIntact: true, hiddenBar: true });
  await page.screenshot({ path: 'artifacts/browser-known-inhibitor-after-sight.png' });
  expect(errors).toEqual([]);
});
