import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('development Leona learns and shops through normal AI ticks and reloads with her source rig', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const bot = w.units.find((u: any) => u.champion === 'leona'),
      state = w.championState(bot.id);
    w.units = [w.hero, bot];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    state.role = 'support';
    state.gold = 10000;
    bot.ai = true;
    for (let i = 0; i < 10; i++) {
      const home = w.battlefield.spawns[bot.team];
      Object.assign(bot, { ...home, previous: { ...home }, nextThink: w.tick + 1 });
      w.step();
      g.view.render(w, 1, 22.5);
    }
    const snapshot = w.snapshot(),
      modulePath = '/src/storage/match-store.ts';
    const { writeMatch } = await import(modulePath);
    await writeMatch(w.battlefield.id, snapshot);
    const copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
    for (const world of [w, copy]) world.step(180);
    return {
      id: bot.id,
      snapshot,
      identicalFuture: w.snapshot() === copy.snapshot(),
      ranks: state.spellRanks,
      inventory: state.inventory,
      stats: {
        hp: bot.maxHp,
        armor: bot.armor,
        magicResist: bot.magicResist,
        damage: bot.damage,
        speed: bot.speed,
      },
      glError: g.view.renderer.getContext().getError(),
    };
  });
  expect(prepared.ranks).toEqual({ q: 1, w: 3, e: 1, r: 1 });
  expect([...prepared.inventory].filter(Boolean).sort()).toEqual([
    'belt',
    'boots',
    'cloak',
    'vest',
  ]);
  expect(prepared.identicalFuture).toBe(true);
  expect(prepared.glError).toBe(0);
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(async (id) => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const bot = g.world.unit(id),
      state = g.world.championState(id),
      modulePath = '/src/storage/match-store.ts';
    const { readMatch } = await import(modulePath);
    return {
      saved: await readMatch(g.world.battlefield.id),
      hero: g.world.hero.champion,
      role: state.role,
      ranks: state.spellRanks,
      inventory: state.inventory,
      ai: bot.ai,
      rig: g.view.models.get(id)?.referenceAsset,
    };
  }, prepared.id);
  expect(restored.saved).toBe(prepared.snapshot);
  expect(restored.hero).toBe('ashe');
  expect(restored.role).toBe('support');
  expect(restored.ai).toBe(true);
  expect(restored.ranks).toEqual(prepared.ranks);
  expect(restored.inventory).toEqual(prepared.inventory);
  expect(restored.rig).toBe('leona-base');
  expect(errors).toEqual([]);
  await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.locked = false;
    g.view.zoom = 0.55;
    g.view.recenter(g.world.unit(id));
    g.view.render(g.world, 1, 22.5);
    if (g.view.renderer.getContext().getError() !== 0) throw Error('Restored bot render failed');
  }, prepared.id);
  await page.screenshot({ path: info.outputPath('restored-leona-bot.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ prepared, restored, errors }, null, 2) + '\n'
  );
});
