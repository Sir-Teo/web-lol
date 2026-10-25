import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function open(page: Page, learned = true) {
  await page.goto('/?scene=fixture&champion=leona');
  await ready(page);
  return page.evaluate((learned) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    w.battlefield.lineWalkable = () => true;
    w.battlefield.reachable = (p: any) => ({ ...p });
    w.battlefield.findPath = (_a: any, b: any) => [{ ...b }];
    if (learned) {
      w.gainExperience(2400);
      for (const key of ['q', 'w', 'e', 'r']) w.learnSpell(key);
    }
    const enemy = w.spawn('champion', 'red', { x: 600, y: 0 }, 'lux');
    enemy.ai = false;
    enemy.speed = enemy.magicResist = enemy.damage = 0;
    enemy.hp = enemy.maxHp = 100000;
    g.view.locked = false;
    g.view.zoom = 0.6;
    g.view.recenter({ x: 300, y: 0 });
    g.view.render(w, 1, 25.5);
    g.hud.update(60);
    g.setPaused(false);
    return { target: enemy.id, point: g.view.screenPoint(enemy) };
  }, learned);
}
function captureErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('development player has Leona icons, learning previews, controls and paid instant Q/W', async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await open(page, false);
  await expect(page.locator('.champion-title strong')).toHaveText('LEONA');
  await expect(page.locator('.champion-title > span')).toHaveText('THE RADIANT DAWN');
  await expect(page.locator('.champion-portrait img')).toHaveAttribute('alt', 'Leona');
  await expect(page.locator('.focus-pips')).toHaveCount(0);
  await expect(page.locator('.ability-charges')).toHaveCount(0);
  for (const [key, name] of [
    ['q', 'Shield of Daybreak'],
    ['w', 'Eclipse'],
    ['e', 'Zenith Blade'],
    ['r', 'Solar Flare'],
  ]) {
    const button = page.locator(`[data-ability="${key}"]`);
    await expect(button).toHaveAttribute('aria-label', name);
    expect(
      await button
        .locator('img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    ).toBe(true);
  }
  await page.locator('[data-ability="q"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('30 MANA');
  await expect(page.locator('#ability-tooltip')).toContainText('10 bonus magic damage');
  await expect(page.locator('#ability-tooltip')).toContainText('Another allied champion');
  await page.screenshot({ path: info.outputPath('unlearned-preview.png') });
  await page.locator('[data-learn="q"]').click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.gainExperience(280);
    g.hud.update(60);
  });
  await page.keyboard.press('Control+w');
  await page.waitForFunction(() => (window as any).__GAME__.world.player.spellRanks.w === 1);
  await page.mouse.move(900, 100);
  const mana = await page.evaluate(() => (window as any).__GAME__.world.hero.mana);
  await page.keyboard.press('q');
  await page.keyboard.press('w');
  await page.waitForFunction(() => {
    const p = (window as any).__GAME__.world.player;
    return p.leonaQ && p.leonaW;
  });
  await expect(page.locator('[data-ability="q"]')).toHaveClass(/empowered/);
  await expect(page.locator('[data-ability="w"]')).toHaveClass(/empowered/);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return {
      champion: g.world.hero.champion,
      ranks: g.world.player.spellRanks,
      mana: g.world.hero.mana,
      aim: g.view.aimMode,
      q: g.world.player.leonaQ,
      w: g.world.player.leonaW,
      gl: g.view.renderer.getContext().getError(),
    };
  });
  expect(mana - result.mana).toBeGreaterThan(88);
  expect(result.aim).toBeNull();
  expect(result.gl).toBe(0);
  await page.locator('#help-button').click();
  await expect(page.locator('.controls-list')).toContainText(
    'Activate Shield of Daybreak / Eclipse'
  );
  await expect(page.locator('.controls-list')).toContainText('Aim Zenith Blade / Solar Flare');
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('hud.json'),
    JSON.stringify({ result, manaBefore: mana, errors }, null, 2) + '\n'
  );
});

test('normal E/R keys show distinct guides, cancel safely and produce paid source combat', async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    { point, target } = await open(page);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(5);
  await page.screenshot({ path: info.outputPath('zenith-aim.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('e');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.e)).toBe(0);
  await page.keyboard.press('e');
  await page.waitForFunction(() =>
    (window as any).__GAME__.world.player.leonaEVisuals.some(
      (v: any) => v.dash?.endReason === 'arrived'
    )
  );
  const e = await page.evaluate((target) => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      distance: Math.hypot(w.hero.x - w.unit(target).x, w.hero.y - w.unit(target).y),
      cooldown: w.player.cooldowns.e,
      tick: w.tick,
      visual: w.player.leonaEVisuals.at(-1).dash.endReason,
    };
  }, target);
  expect(e.distance).toBeCloseTo(70, 4);
  expect(e.cooldown).toBeGreaterThan(e.tick);
  const rpoint = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(g.world.unit(id));
  }, target);
  await page.mouse.move(rpoint.x, rpoint.y);
  await page.keyboard.down('r');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(33);
  const guide = await page.evaluate(() => {
    const v = (window as any).__GAME__.view,
      p = v.solarCenterLine.geometry.getAttribute('position');
    return {
      inner: v.solarCenterLine.visible,
      radius: Math.hypot(p.getX(0) - p.getX(16), p.getZ(0) - p.getZ(16)) / 2,
      count: p.count,
    };
  });
  expect(guide.inner).toBe(true);
  expect(guide.count).toBe(33);
  expect(guide.radius).toBeCloseTo(1.2, 6);
  await page.screenshot({ path: info.outputPath('solar-aim.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('r');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.r)).toBe(0);
  await page.keyboard.press('r');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).stunUntil > w.tick && w.player.leonaRVisuals.some((r: any) => r.impact);
  }, target);
  const result = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    g.view.render(w, 1, 25.5);
    g.hud.update(60);
    return {
      hp: w.unit(id).hp,
      maxHp: w.unit(id).maxHp,
      sunlight: w.unit(id).sunlight,
      r: w.player.leonaRVisuals.at(-1),
      caster: w.hero.id,
      gl: g.view.renderer.getContext().getError(),
    };
  }, target);
  expect(result.maxHp - result.hp).toBeGreaterThan(190);
  expect(result.sunlight.sourceId).toBe(result.caster);
  expect(result.r.impact.contacts[0].center).toBe(true);
  expect(result.gl).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('player-solar-impact.png') });
  writeFileSync(
    info.outputPath('combat.json'),
    JSON.stringify({ e, guide, result, errors }, null, 2) + '\n'
  );
});

test('player W/R saves reload with exact futures and Restart practice retains Leona', async ({
  page,
}, info) => {
  const errors = captureErrors(page),
    { point } = await open(page);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press('w');
  await page.waitForFunction(() => (window as any).__GAME__.world.player.leonaW !== null);
  await page.keyboard.press('r');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.player.leonaR) return false;
    g.setPaused(true);
    return true;
  });
  const prepared = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(90);
    return {
      saved,
      future: copy.snapshot(),
      q: w.player.spellRanks,
      w: !!w.player.leonaW,
      r: !!w.player.leonaR,
    };
  });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready(page);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    w.battlefield.lineWalkable = () => true;
    w.battlefield.reachable = (p: any) => ({ ...p });
    w.battlefield.findPath = (_a: any, b: any) => [{ ...b }];
    const saved = w.snapshot();
    w.step(90);
    const future = w.snapshot();
    Object.assign(w, w.constructor.fromSnapshot(saved, w.battlefield));
    g.hud.closeModal();
    g.setPaused(true);
    g.view.locked = false;
    g.view.zoom = 0.6;
    g.view.recenter({ x: 300, y: 0 });
    g.view.render(w, 1, 25.5);
    g.hud.update(60);
    return {
      saved,
      future,
      champion: w.hero.champion,
      gl: g.view.renderer.getContext().getError(),
    };
  });
  expect(restored.saved).toBe(prepared.saved);
  expect(restored.future).toBe(prepared.future);
  expect(restored.champion).toBe('leona');
  expect(restored.gl).toBe(0);
  await page.screenshot({ path: info.outputPath('restored-player.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart practice', exact: true }).click(),
  ]);
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        champion: (window as any).__GAME__.world.hero.champion,
        level: (window as any).__GAME__.world.player.level,
      }))
    )
    .toEqual({ champion: 'leona', level: 1 });
  const reset = await page.evaluate(() => (window as any).__GAME__.world.player.spellRanks);
  expect(reset).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('restore.json'),
    JSON.stringify({ prepared, restored, reset, errors }, null, 2) + '\n'
  );
});
