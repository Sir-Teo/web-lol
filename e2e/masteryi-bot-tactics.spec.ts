import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.setTimeout(300000);
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function prepare(page: Page, mode: 'meditate' | 'combo' | 'chase') {
  await page.goto('/?scene=fixture&npc=masteryi', { waitUntil: 'domcontentloaded' });
  await ready(page);
  return page.evaluate((mode) => {
    const combat = mode !== 'meditate';
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const bot = w.units.find((u: any) => u.champion === 'masteryi');
    w.units = [w.hero, bot];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -3000;
    bot.x = -650;
    bot.y = 350;
    w.setOrder(bot, { type: 'idle' });
    const state = w.championState(bot.id);
    state.cooldowns.d = state.cooldowns.f = Infinity;
    w.gainExperience(combat ? 2400 : 660, bot.id);
    bot.ai = true;
    bot.nextThink = 0;
    let target;
    if (combat) {
      target = w.spawn('champion', 'red', { x: bot.x + (mode === 'chase' ? 800 : 500), y: bot.y });
      target.ai = false;
      target.hp = target.maxHp = 10000;
    } else bot.hp = bot.maxHp * 0.4;
    w.step();
    const commands = structuredClone(w.commands);
    w.step(combat ? 8 : 61);
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    let threatId: number | undefined;
    if (!combat) {
      const threat = copy.spawn('champion', 'red', { x: bot.x + 500, y: bot.y });
      threat.ai = false;
      threat.hp = threat.maxHp = 10000;
      threatId = threat.id;
    }
    copy.step(180);
    return {
      sourceId: bot.id,
      targetId: target?.id,
      threatId,
      commands,
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      clip: g.view.models.get(bot.id).actionName,
      visible: g.view.models.get(bot.id).root.visible,
      meditate: structuredClone(state.meditate),
      highlander: structuredClone(state.highlander),
      wuju: structuredClone(state.wujuStyle),
      alpha: structuredClone(state.alphaStrike),
      rLayers: g.view.highlanderCasts.models.size,
      rRoot: structuredClone(state.highlanderCastVisuals.at(-1)),
    };
  }, mode);
}

for (const mode of ['meditate', 'combo', 'chase'] as const)
  test(
    mode === 'meditate'
      ? 'bot Meditate restores its loop and reacts to an arriving visible threat through normal interruption'
      : mode === 'combo'
        ? 'bot Highlander, Wuju and Alpha retain hidden R births and saved source clocks'
        : 'bot Highlander chase renders visible source casts and restores its following Alpha pause',
    async ({ page }, info) => {
      const combat = mode !== 'meditate';
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const before = await prepare(page, mode);
      if (combat) {
        expect(before.highlander).toMatchObject({ rank: 1 });
        if (mode === 'combo') {
          expect(before.commands).toMatchObject([
            { ability: 'r' },
            { ability: 'e' },
            { ability: 'q', targetId: before.targetId },
          ]);
          expect(before.highlander.pausedTicks).toBeGreaterThan(0);
          expect(before.rLayers).toBe(0);
          expect(before.rRoot.frames.every((frame: any) => frame.audience.length === 0)).toBe(true);
          expect(before.visible).toBe(false);
        } else {
          expect(before.commands).toMatchObject([{ ability: 'r' }]);
          expect(before.highlander.pausedTicks).toBe(0);
          expect(before.rLayers).toBeGreaterThan(0);
          expect(before.visible).toBe(true);
        }
      } else {
        expect(before.commands).toMatchObject([{ ability: 'w' }]);
        expect(before.meditate).toMatchObject({ rank: 1, stopTick: null });
        expect(before.clip).toBe('spell2_loop');
        expect(before.visible).toBe(true);
      }
      await page.screenshot({
        path: info.outputPath(
          combat ? 'masteryi-bot-highlander.png' : 'masteryi-bot-meditate-loop.png'
        ),
      });
      await page.locator('#pause-button').click();
      await page.getByRole('button', { name: 'Save match', exact: true }).click();
      await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      const after = await page.evaluate(
        ({ combat, before }) => {
          const g = (window as any).__GAME__,
            w = g.world,
            saved = w.snapshot(),
            bot = w.unit(before.sourceId);
          g.hud.closeModal();
          g.setPaused(true);
          let threatId;
          if (!combat) {
            const threat = w.spawn('champion', 'red', { x: bot.x + 500, y: bot.y });
            threat.ai = false;
            threat.hp = threat.maxHp = 10000;
            threatId = threat.id;
          }
          let interruption: null | string = null;
          while (w.tick < before.tick + 180) {
            w.step();
            interruption ??= w.championState(bot.id).meditate?.stopReason ?? null;
          }
          g.view.zoom = 0.6;
          g.view.recenter(bot);
          g.view.render(w, 1, g.view.previousElapsed);
          const bones: number[] = [];
          const model = g.view.models.get(bot.id);
          model.root.updateMatrixWorld(true);
          model.root.traverse((node: any) => {
            if (node.isBone) bones.push(...node.matrixWorld.elements);
          });
          return {
            saved,
            future: w.snapshot(),
            interruption,
            threatId,
            visible: model.root.visible,
            finiteBones: bones.every(Number.isFinite),
            boneCount: bones.length / 16,
            highlander: w.championState(bot.id).highlander,
            ai: bot.ai,
            paused: g.hud.paused,
          };
        },
        { combat, before }
      );
      expect(after.saved).toBe(before.saved);
      expect(after.future).toBe(before.future);
      expect(after.ai).toBe(true);
      expect(after.paused).toBe(true);
      expect(after.visible).toBe(true);
      expect(after.boneCount).toBe(90);
      expect(after.finiteBones).toBe(true);
      if (combat) {
        expect(after.highlander).not.toBeNull();
        expect(after.highlander.pausedTicks).toBeGreaterThan(0);
      } else {
        expect(after.interruption).toBe('order');
        expect(after.threatId).toBe(before.threatId);
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath('masteryi-bot-restored.png') });
      writeFileSync(
        info.outputPath('masteryi-bot-tactics.json'),
        JSON.stringify({ combat, before, after, errors }, null, 2)
      );
    }
  );
