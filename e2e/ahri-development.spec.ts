import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Ahri NPC source rig, hidden meshes, attacks and saved poses run on the development map', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/?scene=fixture&npc=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const ahri = g.world.units.find((unit: any) => unit.champion === 'ahri');
    g.view.zoom = 0.6;
    g.view.recenter(ahri);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: info.outputPath('ahri-idle.png') });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world,
      v = g.view;
    const ahri = w.units.find((u: any) => u.champion === 'ahri');
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const unit of w.units) unit.ai = false;
    const state = w.championState(ahri.id);
    const target = w.spawn('dummy', 'red', { x: ahri.x + 400, y: ahri.y });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    v.zoom = 0.6;
    v.recenter(ahri);
    const path = '/src/render/models.ts';
    const { disposeModel } = await import(path);
    const pose = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const model = v.models.get(ahri.id);
      model.root.updateMatrixWorld(true);
      const bones: number[] = [];
      const meshes: any[] = [];
      model.root.traverse((object: any) => {
        if (object.isBone) bones.push(...object.matrixWorld.toArray());
        if (object.isMesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          meshes.push({
            name: object.name,
            visible: object.visible,
            defaultHidden: materials.some((material: any) => material.userData.defaultHidden),
          });
        }
      });
      return {
        rig: model.referenceAsset,
        clip: model.actionName,
        bones,
        meshes,
        clipCount: Object.keys(model.actions).length,
      };
    };
    const stages: any[] = [];
    const checkpoint = (name: string) => {
      const before = pose(w);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      const model = v.models.get(ahri.id);
      v.scene.remove(model.root);
      disposeModel(model);
      v.models.delete(ahri.id);
      const after = pose(copy);
      stages.push({
        name,
        before,
        samePose: JSON.stringify(before) === JSON.stringify(after),
        exactSave: copy.snapshot() === saved,
      });
      pose(w);
      return copy;
    };
    checkpoint('idle');
    w.setOrder(ahri, { type: 'move', point: { x: ahri.x + 150, y: ahri.y } });
    w.step(6);
    checkpoint('run');
    w.setOrder(ahri, { type: 'idle' });
    w.step(6);
    target.x = ahri.x + 400;
    target.y = ahri.y;
    target.previous = { x: target.x, y: target.y };
    w.setOrder(ahri, { type: 'attack', target: target.id });
    w.step(4);
    checkpoint('attack');
    w.step(ahri.releaseTick - w.tick);
    pose(w);
    const projectile = w.projectiles.find((p: any) => p.source === ahri.id);
    const marker = v.projectileModels.get(projectile.id)?.name;
    const flight = checkpoint('flight');
    w.setOrder(ahri, { type: 'idle' });
    flight.setOrder(flight.unit(ahri.id), { type: 'idle' });
    w.step(120);
    flight.step(120);
    const exactFuture = w.snapshot() === flight.snapshot();
    state.inventory = Array(6).fill('agility');
    w.random.state = 1;
    w.setOrder(ahri, { type: 'attack', target: target.id });
    w.step();
    checkpoint('crit');
    w.setOrder(ahri, { type: 'idle' });
    w.step();
    state.inventory = [];
    const spellRanks = { ...state.spellRanks };
    const learning = ['w', 'e', 'r'].map((ability) => w.learnSpell(ability, ahri.id));
    w.damage(w.hero, ahri, 1e6, 'true');
    w.step(10);
    checkpoint('death');
    return {
      stages,
      marker,
      projectileSpeed: projectile.speed,
      exactFuture,
      damage: target.maxHp - target.hp,
      spellRanks,
      learning,
      hero: w.hero.champion,
      npc: ahri.champion,
    };
  });
  writeFileSync(info.outputPath('ahri-rig.json'), JSON.stringify(result, null, 2));
  expect(result.hero).toBe('ashe');
  expect(result.npc).toBe('ahri');
  expect(result.projectileSpeed).toBe(1750);
  expect(result.marker).toBe('Ahri provisional basic attack');
  expect(result.exactFuture).toBe(true);
  expect(result.damage).toBeGreaterThanOrEqual(53);
  expect(result.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(result.learning.every((error: string) => /development/.test(error))).toBe(true);
  for (const stage of result.stages) {
    expect(stage.samePose, stage.name).toBe(true);
    expect(stage.exactSave, stage.name).toBe(true);
    expect(stage.before.rig).toBe('ahri-base');
    expect(stage.before.clipCount).toBe(55);
    expect(stage.before.bones.length).toBe(211 * 16);
    const hidden = stage.before.meshes.filter((mesh: any) => mesh.defaultHidden);
    expect(hidden).toHaveLength(1);
    expect(hidden.every((mesh: any) => !mesh.visible)).toBe(true);
  }
  expect(result.stages.map((stage: any) => stage.before.clip)).toEqual([
    'idle_var2',
    'run_in',
    'attack1',
    'attack1',
    'crit',
    'death',
  ]);
  await page.screenshot({ path: info.outputPath('ahri-death.png') });
  expect(requests.filter((url) => url.endsWith('/ahri-base.glb'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('ordinary development entry does not fetch Ahri or expand champion choice', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const identities = await page.evaluate(() =>
    (window as any).__GAME__.world.units.map((unit: any) => unit.champion)
  );
  expect(identities).not.toContain('ahri');
  expect(requests.filter((url) => url.includes('ahri-base'))).toEqual([]);
});

test('saving and reloading the NPC fixture preserves Ahri and an ordinary pending attack', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&npc=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const expected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const unit of w.units) unit.ai = false;
    const ahri = w.units.find((unit: any) => unit.champion === 'ahri');
    const target = w.spawn('dummy', 'red', { x: ahri.x + 400, y: ahri.y });
    target.hp = target.maxHp = 1e6;
    w.setOrder(ahri, { type: 'attack', target: target.id });
    w.step(5);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(300);
    return { saved, future: copy.snapshot(), id: ahri.id };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const saved = w.snapshot(),
      identity = w.unit(id).champion;
    w.step(300);
    return { saved, future: w.snapshot(), identity, paused: g.hud.paused };
  }, expected.id);
  expect(restored.identity).toBe('ahri');
  expect(restored.paused).toBe(true);
  expect(restored.saved).toBe(expected.saved);
  expect(restored.future).toBe(expected.future);
});
