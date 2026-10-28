import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page, yi = false) {
  await page.goto(yi ? '/?scene=fixture&champion=masteryi' : '/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    w.pendingSpawns = [];
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
      if (u.id !== w.hero.id)
        Object.assign(u, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
    }
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const champion = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    const minion = w.spawn('caster', 'red', { x: 400, y: 0 });
    const lone = w.spawn('caster', 'red', { x: 250, y: -350 });
    for (const u of [champion, minion, lone]) {
      u.ai = false;
      u.stunUntil = 1e9;
      w.setOrder(u, { type: 'idle' });
    }
    w.commands = [];
    (window as any).__TARGET_STEP__ = w.step.bind(w);
    w.step = () => {};
    g.view.locked = false;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.setPaused(false);
    return {
      champion: champion.id,
      minion: minion.id,
      lone: lone.id,
      overlap: g.view.screenPoint(minion, 0.65),
      lonePoint: g.view.screenPoint(lone, 0.65),
      snapshot: w.snapshot(),
    };
  });
}
async function commands(page: Page) {
  return page.evaluate(() => (window as any).__GAME__.world.commands);
}

test('held champion targeting picks through an overlapping minion and preserves attack-move', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = await ready(page);
  expect(
    await page.evaluate((p) => {
      const g = (window as any).__GAME__;
      return [g.view.pick(g.world, p.x, p.y)?.id, g.view.pick(g.world, p.x, p.y, true)?.id];
    }, s.overlap)
  ).toEqual([s.minion, s.champion]);
  await page.mouse.move(s.overlap.x, s.overlap.y);
  await page.keyboard.down('Backquote');
  await expect(page.locator('.targeting-mode')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.hovered))
    .toBe(s.champion);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(s.snapshot);
  await page.screenshot({ path: info.outputPath('champion-through-minion.png') });
  await page.mouse.click(s.overlap.x, s.overlap.y, { button: 'right' });
  await page.keyboard.up('Backquote');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await page.mouse.click(s.overlap.x, s.overlap.y, { button: 'right' });
  await page.keyboard.down('Shift');
  await page.keyboard.down('Backquote');
  await page.keyboard.up('Shift');
  await expect(page.locator('.targeting-mode')).toBeVisible();
  await page.mouse.click(s.lonePoint.x, s.lonePoint.y, { button: 'right' });
  await page.keyboard.down('Shift');
  await page.mouse.click(s.lonePoint.x, s.lonePoint.y, { button: 'right' });
  await page.keyboard.up('Shift');
  await page.keyboard.press('a');
  await page.mouse.click(s.lonePoint.x, s.lonePoint.y);
  const accepted = await commands(page);
  expect(accepted.map((c: any) => [c.order.type, c.order.target ?? null])).toEqual([
    ['attack', s.champion],
    ['attack', s.minion],
    ['move', null],
    ['attack', s.lone],
    ['attack', s.lone],
  ]);
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.screenshot({ path: info.outputPath('champions-only-1024.png') });
  await page.keyboard.up('Backquote');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('targeting.json'),
    JSON.stringify({ accepted, modeOnlySnapshotExact: true, errors }, null, 2)
  );
});

test('champion mode clears on pause and blur, reserves repeats and ignores typing/modifier shortcuts', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.locator('#battlefield').focus();
  await page.evaluate(() => {
    (window as any).__TARGET_KEYS__ = [];
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote')
        (window as any).__TARGET_KEYS__.push({ repeat: e.repeat, prevented: e.defaultPrevented });
    });
  });
  await page.keyboard.down('Backquote');
  await page.keyboard.down('Backquote');
  await expect(page.locator('.targeting-mode')).toBeVisible();
  const keys = await page.evaluate(() => (window as any).__TARGET_KEYS__);
  expect(keys).toEqual([
    { repeat: false, prevented: true },
    { repeat: true, prevented: true },
  ]);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.setPaused(false);
  });
  await page.keyboard.down('Backquote');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await page.keyboard.up('Backquote');
  await page.keyboard.down('Backquote');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(false);
  });
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await page.keyboard.up('Backquote');
  await page.evaluate(() => {
    const field = document.createElement('input');
    field.id = 'target-typing';
    document.querySelector('.hud')!.append(field);
    field.focus();
  });
  await page.keyboard.press('Backquote');
  await expect(page.locator('#target-typing')).toHaveValue('`');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await page.locator('#battlefield').focus();
  await page.keyboard.press('Control+Backquote');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await page.keyboard.down('Backquote');
  await page.keyboard.press('h');
  await expect(page.locator('.targeting-mode')).toBeHidden();
  await expect(page.locator('.controls-list')).toContainText('Champion-only right-click');
  await page.keyboard.up('Backquote');
  expect(await commands(page)).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('mode-boundaries.json'),
    JSON.stringify({ keys, noOrders: true, errors }, null, 2)
  );
});

test('real Yi Q rejects a lone minion in champion mode and strikes the champion behind an overlapping minion', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = await ready(page, true);
  await page.keyboard.press('Control+q');
  await page.evaluate(() => (window as any).__TARGET_STEP__(1));
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.q)).toBe(1);
  const unfiltered = await page.evaluate(
    async ({ point, id }) => {
      const g = (window as any).__GAME__;
      const { spellTarget } = await import('/src/input/spell-controls.ts');
      const target = g.view.pick(g.world, point.x, point.y);
      return {
        picked: target?.id,
        validWithoutMode: spellTarget(g.world, 'q', target)?.id,
        distance: Math.hypot(
          g.world.unit(id).x - g.world.hero.x,
          g.world.unit(id).y - g.world.hero.y
        ),
      };
    },
    { point: s.lonePoint, id: s.lone }
  );
  expect(unfiltered.picked).toBe(s.lone);
  expect(unfiltered.validWithoutMode).toBe(s.lone);
  expect(unfiltered.distance).toBeLessThan(600);
  await page.mouse.move(s.lonePoint.x, s.lonePoint.y);
  await page.keyboard.down('Backquote');
  await page.keyboard.press('q');
  expect(await commands(page)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.q)).toBe(0);
  await page.mouse.move(s.overlap.x, s.overlap.y);
  await page.keyboard.press('q');
  const accepted = await commands(page);
  expect(accepted).toHaveLength(1);
  expect(accepted[0]).toMatchObject({ type: 'cast', ability: 'q', targetId: s.champion });
  const primary = await page.evaluate(() => {
    (window as any).__TARGET_STEP__(1);
    return (window as any).__GAME__.world.player.alphaStrike?.primaryTargetId;
  });
  expect(primary).toBe(s.champion);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step = (window as any).__TARGET_STEP__;
  });
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const u = (window as any).__GAME__.world.unit(id);
          return u.hp < u.maxHp;
        }, s.champion),
      { timeout: 20000 }
    )
    .toBe(true);
  await page.keyboard.up('Backquote');
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('yi-real-q.json'),
    JSON.stringify({ unfiltered, accepted, primary, actualChampionDamage: true, errors }, null, 2)
  );
});
