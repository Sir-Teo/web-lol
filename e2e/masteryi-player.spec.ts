import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const entry = '/?scene=fixture&champion=masteryi';
async function ready(page: Page, url = entry) {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function step(page: Page, n = 1) {
  await page.evaluate((n) => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(n);
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.hud.update(60);
  }, n);
}
async function setup(page: Page) {
  await ready(page);
  await expect(page.locator('.champion-title strong')).toHaveText('MASTER YI');
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    w.gainExperience(1e6);
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    g.setPaused(false);
  });
  for (const a of ['q', 'w', 'e', 'r']) {
    await page.locator(`[data-learn="${a}"]`).click();
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.world.step();
      g.hud.update(60);
    });
  }
  await step(page);
  return page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const target = w.spawn('dummy', 'red', { x: 400, y: 0 });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    return target.id;
  });
}
async function aim(page: Page, x: number, y = 0, elevation = 0.65) {
  const p = await page.evaluate(
    ({ x, y, elevation }) => (window as any).__GAME__.view.screenPoint({ x, y }, elevation),
    { x, y, elevation }
  );
  await page.mouse.move(p.x, p.y);
  if (elevation > 0) {
    const picked = await page.evaluate(
      ({ x, y }) => (window as any).__GAME__.view.pick((window as any).__GAME__.world, x, y)?.kind,
      p
    );
    expect(picked).toBe('dummy');
  }
  return p;
}
async function key(page: Page, key: string) {
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press(key);
  await step(page);
}
async function save(page: Page) {
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
}

test('human Yi owns loaded icons, descriptions, instant keys, Meditate pose and Double Strike feedback', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const id = await setup(page);
  await expect(page.locator('.champion-title')).toContainText('THE WUJU BLADESMAN');
  await expect(page.locator('.focus-pips')).toHaveCount(0);
  await expect(page.locator('#masteryi-double-strike')).toContainText('0 / 3');
  const icons = await page.locator('[data-ability] img').evaluateAll((images) =>
    images.slice(0, 4).map((i) => ({
      src: i.getAttribute('src'),
      loaded: (i as HTMLImageElement).naturalWidth > 0,
    }))
  );
  expect(icons.map((i) => i.src)).toEqual([
    'assets/icons/AlphaStrike.png',
    'assets/icons/Meditate.png',
    'assets/icons/WujuStyle.png',
    'assets/icons/Highlander.png',
  ]);
  expect(icons.every((i) => i.loaded)).toBe(true);
  await page.locator('[data-ability="q"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('physical damage');
  await expect(page.locator('#ability-tooltip')).not.toContainText('Focus');
  await aim(page, 400);
  await key(page, 'e');
  await key(page, 'r');
  await key(page, 'w');
  const channel = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      s = g.world.player;
    return {
      w: s.meditate,
      e: s.wujuStyle,
      r: s.highlander,
      mode: g.view.aimMode,
      clip: g.view.models.get(g.world.hero.id).actionName,
    };
  });
  expect(channel.w.stopTick).toBeNull();
  expect(channel.e).not.toBeNull();
  expect(channel.r).not.toBeNull();
  expect(channel.mode).toBeNull();
  expect(channel.clip).toBe('spell2_loop');
  await key(page, 's');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.meditate.stopReason)).toBe(
    'order'
  );
  // Remove the short channel's stack history; actual attacks below own the counter proof.
  await page.evaluate((id) => {
    const w = (window as any).__GAME__.world;
    w.player.doubleStrike.stacks = 0;
    w.player.doubleStrike.expiresTick = 0;
    w.unit(id).x = 150;
  }, id);
  const p = await aim(page, 150);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await step(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.order.type)).toBe('attack');
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    for (let i = 0; i < 300 && w.player.doubleStrike.stacks !== 3; i++) w.step();
    w.setOrder(w.hero, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  await expect(page.locator('#masteryi-double-strike')).toContainText('3 / 3');
  await expect(page.locator('#masteryi-double-strike')).toHaveClass(/ready/);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('masteryi-player-hud.png') });
  await page.locator('#pause-button').click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart practice', exact: true }).click(),
  ]);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restarted = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return {
      champion: g.world.hero.champion,
      ranks: g.world.player.spellRanks,
      passive: g.world.player.doubleStrike,
    };
  });
  expect(restarted.champion).toBe('masteryi');
  expect(restarted.ranks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(restarted.passive).toEqual({ stacks: 0, expiresTick: 0, strike: null });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('human-controls.json'),
    JSON.stringify({ icons, channel, restarted, errors }, null, 2)
  );
});

test('held Q selects a real unit, hides own model and honors a mouse-selected return side', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const id = await setup(page);
  await aim(page, 400);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('q');
  await expect.poll(() => page.evaluate(() => (window as any).__GAME__.view.aimMode)).toBe('q');
  await page.screenshot({ path: info.outputPath('masteryi-player-q-aim.png') });
  await page.keyboard.up('q');
  await step(page);
  const start = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      q: structuredClone(g.world.player.alphaStrike),
      visible: g.view.models.get(g.world.hero.id).root.visible,
    };
  });
  expect(start.q.primaryTargetId).toBe(id);
  expect(start.visible).toBe(false);
  const p = await aim(page, 550, 0, 0);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await step(page);
  await key(page, 'w');
  await page.evaluate((startTick) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(Math.max(0, startTick + 60 - w.tick));
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  }, start.q.startTick);
  const end = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      q: structuredClone(w.player.alphaStrike),
      x: w.hero.x,
      w: w.player.meditate,
      visible: g.view.models.get(w.hero.id).root.visible,
    };
  });
  expect(end.q.exitDirection.x).toBeGreaterThan(0);
  expect(end.q.marks.map((m: any) => m.result)).toEqual(['hit', 'hit', 'hit', 'hit']);
  expect(end.x).toBeGreaterThan(400);
  expect(end.visible).toBe(true);
  expect(end.w).toBeNull();
  await page.screenshot({ path: info.outputPath('masteryi-player-q-return.png') });
  writeFileSync(info.outputPath('human-q.json'), JSON.stringify({ start, end }, null, 2));
});

test('human active-Q save reloads exactly and stays isolated after a real NPC save', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await setup(page);
  await aim(page, 400);
  await key(page, 'e');
  await key(page, 'r');
  await key(page, 'q');
  await step(page, 31);
  const before = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    copy.step(300);
    return { saved: w.snapshot(), future: copy.snapshot() };
  });
  expect(JSON.parse(before.saved).developmentMasterYi).toBeUndefined();
  await save(page);
  await ready(page, '/?scene=fixture&npc=masteryi');
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.champion)).toBe('ashe');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(7);
  });
  await save(page);
  await ready(page);
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const saved = w.snapshot();
    const q = structuredClone(w.player.alphaStrike);
    w.step(300);
    g.view.render(w, 1, g.view.previousElapsed);
    const model = g.view.models.get(w.hero.id),
      bones: number[] = [];
    model.root.updateMatrixWorld(true);
    model.root.traverse((o: any) => {
      if (o.isBone) bones.push(...o.matrixWorld.toArray());
    });
    return {
      saved,
      future: w.snapshot(),
      q,
      champion: w.hero.champion,
      context: w.battlefield.developmentMasterYi,
      paused: g.hud.paused,
      visible: model.root.visible,
      bones,
    };
  });
  expect(after.champion).toBe('masteryi');
  expect(after.context).toBe(true);
  expect(after.paused).toBe(true);
  expect(after.q).not.toBeNull();
  expect(after.saved).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.visible).toBe(true);
  expect(after.bones).toHaveLength(90 * 16);
  expect(after.bones.every(Number.isFinite)).toBe(true);
  writeFileSync(info.outputPath('human-save.json'), JSON.stringify({ before, after }, null, 2));
});
