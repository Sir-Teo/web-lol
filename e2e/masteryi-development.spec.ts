import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Master Yi NPC source rig, melee contact, attacks and saved poses run on the development map', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/?scene=fixture&npc=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const masteryi = g.world.units.find((unit: any) => unit.champion === 'masteryi');
    g.view.zoom = 0.6;
    g.view.recenter(masteryi);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: info.outputPath('masteryi-idle.png') });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world,
      v = g.view;
    const masteryi = w.units.find((u: any) => u.champion === 'masteryi');
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const unit of w.units) unit.ai = false;
    const state = w.championState(masteryi.id);
    const target = w.spawn('dummy', 'red', { x: masteryi.x + 150, y: masteryi.y });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    v.zoom = 0.6;
    v.recenter(masteryi);
    const path = '/src/render/models.ts';
    const { disposeModel } = await import(path);
    const pose = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const model = v.models.get(masteryi.id);
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
      const model = v.models.get(masteryi.id);
      v.scene.remove(model.root);
      disposeModel(model);
      v.models.delete(masteryi.id);
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
    w.setOrder(masteryi, { type: 'move', point: { x: masteryi.x + 150, y: masteryi.y } });
    w.step(6);
    checkpoint('run');
    w.setOrder(masteryi, { type: 'idle' });
    w.step(6);
    target.x = masteryi.x + 150;
    target.y = masteryi.y;
    target.previous = { x: target.x, y: target.y };
    w.setOrder(masteryi, { type: 'attack', target: target.id });
    w.step(4);
    checkpoint('attack');
    w.step(masteryi.releaseTick - w.tick);
    pose(w);
    const projectileCount = w.projectiles.filter((p: any) => p.source === masteryi.id).length;
    const flight = checkpoint('recovery');
    w.setOrder(masteryi, { type: 'idle' });
    flight.setOrder(flight.unit(masteryi.id), { type: 'idle' });
    w.step(120);
    flight.step(120);
    const exactFuture = w.snapshot() === flight.snapshot();
    state.inventory = Array(6).fill('agility');
    w.random.state = 1;
    w.setOrder(masteryi, { type: 'attack', target: target.id });
    w.step();
    checkpoint('crit');
    w.setOrder(masteryi, { type: 'idle' });
    w.step();
    state.inventory = [];
    const spellRanks = { ...state.spellRanks };
    const learning = ['q', 'w', 'r'].map((ability) => w.spellLearningError(ability, masteryi.id));
    w.enqueue({ type: 'recall', unit: masteryi.id });
    w.step(100);
    checkpoint('recall-in');
    w.step(240);
    checkpoint('recall-loop');
    w.damage(w.hero, masteryi, 1e6, 'true');
    w.step(10);
    checkpoint('death');
    return {
      stages,
      projectileCount,
      exactFuture,
      damage: target.maxHp - target.hp,
      spellRanks,
      learning,
      hero: w.hero.champion,
      npc: masteryi.champion,
    };
  });
  writeFileSync(info.outputPath('masteryi-rig.json'), JSON.stringify(result, null, 2));
  expect(result.hero).toBe('ashe');
  expect(result.npc).toBe('masteryi');
  expect(result.projectileCount).toBe(0);
  expect(result.exactFuture).toBe(true);
  expect(result.damage).toBeGreaterThanOrEqual(65);
  expect(result.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(result.learning.every((error: string) => /not implemented/.test(error))).toBe(true);
  for (const stage of result.stages) {
    expect(stage.samePose, stage.name).toBe(true);
    expect(stage.exactSave, stage.name).toBe(true);
    expect(stage.before.rig).toBe('masteryi-base');
    expect(stage.before.clipCount).toBe(47);
    expect(stage.before.bones.length).toBe(90 * 16);
    const hidden = stage.before.meshes.filter((mesh: any) => mesh.defaultHidden);
    expect(hidden).toHaveLength(0);
    expect(hidden.every((mesh: any) => !mesh.visible)).toBe(true);
  }
  expect(result.stages.map((stage: any) => stage.before.clip)).toEqual([
    'entry_56f6d84b',
    'run',
    'entry_d5c55cfd',
    'entry_d5c55cfd',
    'entry_e1798980',
    'recall_in',
    'recall_loop',
    'death',
  ]);
  await page.screenshot({ path: info.outputPath('masteryi-death.png') });
  expect(requests.filter((url) => url.endsWith('/masteryi-base.glb'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('ordinary development entry does not fetch Master Yi or expand champion choice', async ({
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
  expect(identities).not.toContain('masteryi');
  expect(requests.filter((url) => url.includes('masteryi-base'))).toEqual([]);
});

for (const [phase, age] of [
  ['pending', 5],
  ['recovery', 25],
] as const) {
  test(`saving and reloading the NPC fixture preserves Master Yi during ${phase}`, async ({
    page,
  }, info) => {
    await page.goto('/?scene=fixture&npc=masteryi');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const expected = await page.evaluate((age) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      for (const unit of w.units) unit.ai = false;
      const masteryi = w.units.find((unit: any) => unit.champion === 'masteryi');
      const target = w.spawn('dummy', 'red', { x: masteryi.x + 150, y: masteryi.y });
      target.hp = target.maxHp = 1e6;
      w.setOrder(masteryi, { type: 'attack', target: target.id });
      w.step(age);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(300);
      return { saved, future: copy.snapshot(), id: masteryi.id };
    }, age);
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
    expect(restored.identity).toBe('masteryi');
    expect(restored.paused).toBe(true);
    expect(restored.saved).toBe(expected.saved);
    expect(restored.future).toBe(expected.future);
    writeFileSync(
      info.outputPath(`masteryi-${phase}-reload.json`),
      JSON.stringify({ phase, expected, restored }, null, 2) + '\n'
    );
  });
}

async function loaded(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function ready(page: Page, url = '/?scene=fixture&npc=masteryi') {
  await page.goto(url);
  await loaded(page);
}
async function save(page: Page) {
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
}

test('Master Yi NPC saves and restart preserve the ordinary practice checkpoint', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await ready(page, '/?scene=fixture');
  const ordinary = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 7777;
    g.world.step(17);
    return g.world.snapshot();
  });
  await save(page);
  await ready(page);
  const privateSaved = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 8888;
    g.world.step(5);
    return g.world.snapshot();
  });
  await save(page);
  await ready(page, '/?scene=fixture');
  const normalRestored = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(normalRestored).toBe(ordinary);
  await ready(page);
  const privateRestored = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(privateRestored).toBe(privateSaved);
  if (!(await page.getByRole('button', { name: 'Restart practice', exact: true }).isVisible()))
    await page.locator('#pause-button').click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart practice', exact: true }).click(),
  ]);
  await loaded(page);
  const restarted = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world,
      npc = w.units.find((u: any) => u.champion === 'masteryi');
    return {
      hero: w.hero.champion,
      gold: w.player.gold,
      npc: npc.champion,
      ranks: w.championState(npc.id).spellRanks,
      skillPoints: w.championState(npc.id).skillPoints,
      ai: npc.ai,
    };
  });
  expect(restarted).toEqual({
    hero: 'ashe',
    gold: 500,
    npc: 'masteryi',
    ranks: { q: 0, w: 0, e: 0, r: 0 },
    skillPoints: 1,
    ai: false,
  });
  writeFileSync(
    info.outputPath('masteryi-save-isolation.json'),
    JSON.stringify(
      { ordinary, privateSaved, normalRestored, privateRestored, restarted },
      null,
      2
    ) + '\n'
  );
});

test('Master Yi NPC file controls reject missing NPCs and foreign players before exact own-file loading', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await ready(page);
  const files = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const plain = new w.constructor(false, w.battlefield),
      lux = new w.constructor(false, w.battlefield, 'lux');
    lux.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi').ai = false;
    return { own: w.snapshot(), plain: plain.snapshot(), lux: lux.snapshot() };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  for (const [name, contents, message] of [
    ['plain', files.plain, 'requires a Master Yi NPC'],
    ['lux', files.lux, 'Ashe match files only'],
  ]) {
    await page.locator('input[type=file]').setInputFiles({
      name: name + '.json',
      mimeType: 'application/json',
      buffer: Buffer.from(contents),
    });
    await expect(page.locator('.file-status')).toContainText(message);
    await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeHidden();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(files.own);
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'own.json',
    mimeType: 'application/json',
    buffer: Buffer.from(files.own),
  });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match', exact: true }).click(),
  ]);
  await loaded(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(files.own);
  writeFileSync(
    info.outputPath('masteryi-imports.json'),
    JSON.stringify(
      {
        missingNpcRejected: true,
        foreignPlayerRejected: true,
        currentStatePreserved: true,
        ownLoadExact: true,
      },
      null,
      2
    ) + '\n'
  );
});
