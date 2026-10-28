import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('AI-learned E and Q keep normal vanish, source cast effects and actual saved continuation', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&npc=masteryi', { waitUntil: 'domcontentloaded' });
  await ready();
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const yi = w.units.find((u: any) => u.champion === 'masteryi');
    w.units = [w.hero, yi];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -3000;
    yi.x = -650;
    yi.y = 350;
    w.setOrder(yi, { type: 'idle' });
    const target = w.spawn('champion', 'red', { x: yi.x + 500, y: yi.y });
    target.ai = false;
    target.hp = target.maxHp = 10000;
    target.armor = 0;
    const state = w.championState(yi.id);
    state.cooldowns.d = state.cooldowns.f = Infinity;
    w.gainExperience(280, yi.id);
    yi.ai = true;
    yi.nextThink = 0;
    w.step();
    const commands = structuredClone(w.commands);
    w.step(8);
    g.view.zoom = 0.6;
    g.view.recenter(yi);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      sourceId: yi.id,
      targetId: target.id,
      commands,
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      ranks: state.spellRanks,
      alpha: structuredClone(state.alphaStrike),
      wuju: structuredClone(state.wujuStyle),
      visible: g.view.models.get(yi.id).root.visible,
      targetable: w.targetable(yi),
      castLayers: g.view.alphaCasts.models.size,
      mana: yi.mana,
      maxMana: yi.maxMana,
    };
  });
  expect(before.ranks).toEqual({ q: 1, w: 0, e: 1, r: 0 });
  expect(before.commands).toMatchObject([
    { ability: 'e', unit: before.sourceId },
    { ability: 'q', targetId: before.targetId },
  ]);
  expect(before.alpha).toMatchObject({
    rank: 1,
    primaryTargetId: before.targetId,
    reappearTick: null,
  });
  expect(before.wuju).not.toBeNull();
  expect(before.visible).toBe(false);
  expect(before.targetable).toBe(false);
  expect(before.castLayers).toBeGreaterThan(0);
  expect(before.mana).toBeLessThan(before.maxMana - 49);
  await page.screenshot({ path: info.outputPath('masteryi-bot-alpha-cast.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  const after = await page.evaluate(({ tick, sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      saved = w.snapshot();
    g.hud.closeModal();
    g.setPaused(true);
    w.step(tick + 180 - w.tick);
    g.view.recenter(w.unit(sourceId));
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(sourceId),
      bones: number[] = [];
    model.root.updateMatrixWorld(true);
    model.root.traverse((node: any) => {
      if (node.isBone) bones.push(...node.matrixWorld.elements);
    });
    const target = w.unit(targetId);
    return {
      saved,
      future: w.snapshot(),
      visible: model.root.visible,
      finiteBones: bones.every(Number.isFinite),
      boneCount: bones.length / 16,
      damage: target.maxHp - target.hp,
      ai: w.unit(sourceId).ai,
      paused: g.hud.paused,
    };
  }, before);
  expect(after.saved).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.visible).toBe(true);
  expect(after.boneCount).toBe(90);
  expect(after.finiteBones).toBe(true);
  expect(after.damage).toBeGreaterThan(100);
  expect(after.ai).toBe(true);
  expect(after.paused).toBe(true);
  await page.screenshot({ path: info.outputPath('masteryi-bot-return.png') });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('masteryi-bot.json'),
    JSON.stringify({ before, after, errors }, null, 2)
  );
});
