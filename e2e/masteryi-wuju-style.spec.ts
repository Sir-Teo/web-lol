import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Wuju Style and a pending Double Strike restore together through real private Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&npc=masteryi');
  await ready();
  const expected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const u of w.units) u.ai = false;
    const yi = w.units.find((u: any) => u.champion === 'masteryi');
    if (w.learnSpell('e', yi.id) !== null) throw new Error('Cannot learn own Wuju Style');
    const target = w.spawn('dummy', 'red', { x: yi.x + 150, y: yi.y });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    const primary = () => {
      w.setOrder(yi, { type: 'attack', target: target.id });
      w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
      w.step(yi.releaseTick - w.tick);
      w.setOrder(yi, { type: 'idle' });
    };
    for (let n = 0; n < 3; n++) primary();
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'e', point: yi });
    w.step();
    primary();
    w.step(3);
    const state = w.championState(yi.id);
    g.view.zoom = 0.6;
    g.view.recenter(yi);
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(yi.id);
    model.root.updateMatrixWorld(true);
    const bones: number[] = [];
    model.root.traverse((o: any) => {
      if (o.isBone) bones.push(...o.matrixWorld.toArray());
    });
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    const hp = target.hp;
    copy.step(state.doubleStrike.strike.releaseTick - w.tick);
    const childDamage = hp - copy.unit(target.id).hp;
    const future = w.constructor.fromSnapshot(saved, w.battlefield);
    future.step(300);
    return {
      saved,
      future: future.snapshot(),
      id: yi.id,
      bones,
      clip: model.actionName,
      childDamage,
      buff: structuredClone(state.wujuStyle),
      ranks: state.spellRanks,
      primaryDamage: target.maxHp - target.hp,
      projectileCount: w.projectiles.length,
    };
  });
  expect(expected.buff.rank).toBe(1);
  expect(expected.ranks).toEqual({ q: 0, w: 0, e: 1, r: 0 });
  expect(expected.primaryDamage).toBe(280);
  expect(expected.childDamage).toBe(52.5);
  expect(expected.projectileCount).toBe(0);
  expect(expected.clip).toBe('entry_85dac0b3');
  expect(expected.bones).toHaveLength(90 * 16);
  expect(expected.bones.every(Number.isFinite)).toBe(true);
  await page.screenshot({ path: info.outputPath('wuju-secondary-pending.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  const actual = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      yi = w.unit(id);
    g.view.zoom = 0.6;
    g.view.recenter(yi);
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(id);
    model.root.updateMatrixWorld(true);
    const bones: number[] = [];
    model.root.traverse((o: any) => {
      if (o.isBone) bones.push(...o.matrixWorld.toArray());
    });
    const saved = w.snapshot(),
      buff = structuredClone(w.championState(id).wujuStyle);
    w.step(300);
    return { saved, future: w.snapshot(), bones, buff, paused: g.hud.paused };
  }, expected.id);
  expect(actual.saved).toBe(expected.saved);
  expect(actual.future).toBe(expected.future);
  expect(actual.bones).toEqual(expected.bones);
  expect(actual.buff).toEqual(expected.buff);
  expect(actual.paused).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('wuju-reload.json'),
    JSON.stringify({ expected, actual, errors }, null, 2) + '\n'
  );
});
