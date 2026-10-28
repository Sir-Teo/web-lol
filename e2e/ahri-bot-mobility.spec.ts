import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Ahri bot renders Fox-Fire hits and restores an actual retreat dash through Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture&npc=ahri', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const fire = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const bot = w.units.find((u: any) => u.champion === 'ahri');
    w.units = [w.hero, bot];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -3000;
    bot.x = bot.y = 0;
    w.setOrder(bot, { type: 'idle' });
    bot.ai = true;
    bot.nextThink = 0;
    w.gainExperience(2400, bot.id);
    const state = w.championState(bot.id);
    state.cooldowns.d = state.cooldowns.f = state.cooldowns.e = state.cooldowns.q = Infinity;
    const enemy = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    enemy.ai = false;
    enemy.hp = enemy.maxHp = 10000;
    w.step();
    const commands = structuredClone(w.commands);
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      sourceId: bot.id,
      targetId: enemy.id,
      commands,
      ranks: state.spellRanks,
      clip: g.view.models.get(bot.id).actionName,
      models: [...g.view.foxFireModels.values()].map((model: any) => ({
        name: model.name,
        visible: model.visible,
      })),
      speed: w.movementSpeed(bot),
      baseSpeed: bot.speed,
    };
  });
  expect(fire.commands).toMatchObject([{ ability: 'w', unit: fire.sourceId }]);
  expect(fire.ranks).toEqual({ q: 3, w: 1, e: 1, r: 1 });
  expect(fire.clip).toBe('spell2');
  expect(fire.models).toHaveLength(3);
  expect(fire.models.every((model) => model.visible && model.name.includes('orbit'))).toBe(true);
  expect(fire.speed).toBeGreaterThan(fire.baseSpeed);
  await page.screenshot({ path: info.outputPath('ahri-bot-fox-fire.png') });
  const escape = await page.evaluate(({ sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      bot = w.unit(sourceId),
      enemy = w.unit(targetId),
      hits = new Set<number>();
    for (let i = 0; i < 100; i++) {
      w.step();
      for (const cast of w.ahriFoxFires)
        for (const shot of cast.fires)
          if (shot.stopReason === 'hit' && shot.targetId === targetId) hits.add(shot.index);
    }
    w.setOrder(bot, { type: 'idle' });
    bot.x = bot.y = 0;
    bot.hp = bot.maxHp * 0.2;
    bot.nextThink = 0;
    enemy.x = 400;
    enemy.y = 0;
    w.step();
    const commands = structuredClone(w.commands);
    w.step();
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      hits: [...hits],
      commands,
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      rush: structuredClone(w.ahriRushes[0]),
      clip: g.view.models.get(sourceId).actionName,
      bolts: [...g.view.spiritBoltModels.values()].map((model: any) => model.name),
    };
  }, fire);
  expect(escape.hits.sort()).toEqual([0, 1, 2]);
  expect(escape.commands).toMatchObject([{ ability: 'r', unit: fire.sourceId }]);
  expect(escape.rush.remainingCasts).toBe(2);
  expect(escape.rush.bursts[0].stopTick).toBeNull();
  expect(escape.clip).toBe('spell4');
  expect(escape.bolts.length).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('ahri-bot-spirit-escape.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(
    ({ sourceId, tick }) => {
      const g = (window as any).__GAME__,
        w = g.world,
        saved = w.snapshot();
      g.hud.closeModal();
      g.setPaused(true);
      w.step(tick + 180 - w.tick);
      const bot = w.unit(sourceId);
      g.view.recenter(bot);
      g.view.render(w, 1, g.view.previousElapsed);
      const bones: number[] = [];
      g.view.models.get(sourceId).root.traverse((node: any) => {
        if (node.isBone) bones.push(...node.matrixWorld.elements);
      });
      return {
        saved,
        future: w.snapshot(),
        ai: bot.ai,
        position: { x: bot.x, y: bot.y },
        paused: g.hud.paused,
        boneCount: bones.length / 16,
        finiteBones: bones.every(Number.isFinite),
      };
    },
    { sourceId: fire.sourceId, tick: escape.tick }
  );
  expect(restored.saved).toBe(escape.saved);
  expect(restored.future).toBe(escape.future);
  expect(restored.ai).toBe(true);
  expect(restored.paused).toBe(true);
  expect(restored.boneCount).toBe(211);
  expect(restored.finiteBones).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-bot-mobility.json'),
    JSON.stringify({ fire, escape, restored, errors }, null, 2)
  );
});
