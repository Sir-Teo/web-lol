import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function lanes(page: Page) {
  if (await page.evaluate(() => (window as any).__GAME__.world.matchMode !== 'lanes')) {
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'New match', exact: true }).click();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
    ]);
    await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
    await page.locator('#loading').waitFor({ state: 'detached' });
  }
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units)
      if (u.kind === 'champion') {
        u.ai = false;
        w.setOrder(u, { type: 'idle' });
      }
    const allies = w.units
      .filter((u: any) => u.kind === 'champion' && u.team === w.hero.team && u.id !== w.hero.id)
      .sort((a: any, b: any) => a.id - b.id);
    for (const [i, u] of allies.entries()) {
      const p = w.battlefield.reachable(
        { x: w.hero.x + (i + 1) * 500, y: w.hero.y - (i + 1) * 300 },
        u.radius,
        u.team
      );
      Object.assign(u, p, { previous: { ...p } });
    }
    w.commands = [];
    (window as any).__ALLY_STEP__ = w.step.bind(w);
    w.step = () => {};
    g.view.locked = false;
    g.view.recenter(w.hero);
    g.hud.update(60);
    g.setPaused(false);
    return {
      allies: allies.map((u: any) => ({
        id: u.id,
        champion: u.champion,
        hp: u.hp,
        maxHp: u.maxHp,
      })),
      hero: { x: w.hero.x, y: w.hero.y },
      snapshot: w.snapshot(),
    };
  });
}
async function cameraAt(page: Page, id: number) {
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const g = (window as any).__GAME__,
          u = g.world.unit(id);
        return Math.hypot(g.view.center.x - u.x, g.view.center.y - u.y);
      }, id)
    )
    .toBeLessThan(0.01);
}

test('friendly portraits match F2–F5, move only the camera and preserve native keyboard focus', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator('.ally-portraits')).toBeHidden();
  expect(
    await page
      .locator('.ally-portrait img')
      .evaluateAll((images) => images.every((i) => !i.hasAttribute('src')))
  ).toBe(true);
  const before = await lanes(page),
    cards = page.locator('.ally-portrait');
  await expect(page.getByRole('group', { name: 'Teammate cameras' })).toBeVisible();
  expect(
    await cards.evaluateAll((cards) => cards.map((c) => Number((c as HTMLElement).dataset.unitId)))
  ).toEqual(before.allies.map((u: any) => u.id));
  await expect
    .poll(() =>
      cards
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0
          )
        )
    )
    .toBe(true);
  for (const [i, ally] of before.allies.entries()) {
    await cards.nth(i).click();
    await cameraAt(page, ally.id);
    await expect(page.locator('#battlefield')).toBeFocused();
    expect(await page.evaluate(() => (window as any).__GAME__.view.locked)).toBe(false);
  }
  await cards.nth(0).focus();
  await page.keyboard.press('Enter');
  await cameraAt(page, before.allies[0].id);
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await cameraAt(page, before.allies[1].id);
  await expect(cards.nth(1)).toBeFocused();
  await cards.nth(2).click();
  await page.keyboard.down('Space');
  await expect
    .poll(() =>
      page.evaluate((p) => {
        const c = (window as any).__GAME__.view.center;
        return Math.hypot(c.x - p.x, c.y - p.y);
      }, before.hero)
    )
    .toBeLessThan(0.01);
  await page.keyboard.up('Space');
  await cards.first().hover();
  for (const key of ['w', '4']) await page.keyboard.press(key);
  expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual([]);
  await page.screenshot({ path: info.outputPath('portraits-1440.png') });
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.screenshot({ path: info.outputPath('portraits-1024.png') });
  const after = await page.evaluate(() => ({
    snapshot: (window as any).__GAME__.world.snapshot(),
    commands: (window as any).__GAME__.world.commands,
  }));
  expect(after.snapshot).toBe(before.snapshot);
  expect(after.commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('camera-portraits.json'),
    JSON.stringify(
      { allies: before.allies, snapshotExact: true, commands: after.commands, errors },
      null,
      2
    )
  );
});

test('portraits follow real allied damage, death and respawn and show held camera focus', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const before = await lanes(page),
    id = before.allies[0].id,
    card = page.locator('.ally-portrait').first();
  const damaged = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    const p = w.battlefield.reachable({ x: -500, y: 500 }, u.radius, u.team);
    Object.assign(u, p, { previous: { ...p } });
    const enemy = w.units.find((u: any) => u.kind === 'champion' && u.team !== w.hero.team);
    const hp = u.hp;
    w.damage(enemy, u, 100, 'true');
    g.hud.update(60);
    return { before: hp, hp: u.hp, maxHp: u.maxHp };
  }, id);
  expect(damaged.hp).toBeLessThan(damaged.before);
  await expect(card).toHaveAttribute(
    'aria-label',
    new RegExp(`${Math.ceil(damaged.hp)} / ${Math.ceil(damaged.maxHp)} health`)
  );
  await page.keyboard.down('F2');
  await expect(card).toHaveClass(/focused/);
  await page.keyboard.up('F2');
  await expect(card).not.toHaveClass(/focused/);
  const dead = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id),
      enemy = w.units.find((u: any) => u.kind === 'champion' && u.team !== w.hero.team);
    w.damage(enemy, u, 1e6, 'true');
    (window as any).__ALLY_STEP__(1);
    g.hud.update(60);
    return {
      deadline: u.respawnTick,
      seconds: Math.max(0, Math.ceil((u.respawnTick - w.tick) / 60)),
    };
  }, id);
  expect(dead.deadline).not.toBeNull();
  await expect(card).toHaveClass(/dead/);
  await expect(card.locator('.ally-respawn')).toHaveText(String(dead.seconds));
  await expect(card.locator('.ally-health i')).toHaveAttribute('style', /width: 0%/);
  await card.click();
  await cameraAt(page, id);
  await page.screenshot({ path: info.outputPath('dead-ally-camera.png') });
  await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    (window as any).__ALLY_STEP__(u.respawnTick - w.tick + 1);
    g.hud.update(60);
  }, id);
  await expect(card).not.toHaveClass(/dead/);
  await expect(card.locator('.ally-respawn')).toHaveText('');
  await expect(card.locator('.ally-health i')).toHaveAttribute('style', /width: 100%/);
  await page.keyboard.press('h');
  await expect(page.locator('.controls-list')).toContainText('Ally portraits');
  const guarded = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      before = { ...g.view.center };
    document.querySelector<HTMLButtonElement>('.ally-portrait')!.click();
    return { before, after: { ...g.view.center }, commands: g.world.commands };
  });
  expect(guarded.after).toEqual(guarded.before);
  expect(guarded.commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ally-lifecycle.json'),
    JSON.stringify({ damaged, dead, guarded, errors }, null, 2)
  );
});

test('private roster portraits expose only allies and revalidate camera targets instead of trusting DOM IDs', async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, '/?scene=roster-rift');
  const before = await lanes(page);
  expect(before.allies.map((u: any) => u.champion)).toEqual(
    expect.arrayContaining(['garen', 'masteryi', 'leona'])
  );
  const guarded = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    g.view.renderer.setAnimationLoop(null);
    const enemies = w.units.filter((u: any) => u.kind === 'champion' && u.team !== w.hero.team),
      ids = new Set(enemies.map((u: any) => u.id));
    const owner = w.championState,
      descriptors = enemies.map((u: any) => [u, Object.getOwnPropertyDescriptor(u, 'hp')]);
    const order = w.units.map((u: any) => u.id);
    w.championState = function (id: number) {
      if (ids.has(id)) throw Error('Enemy owner read');
      return owner.call(this, id);
    };
    for (const [u] of descriptors)
      Object.defineProperty(u, 'hp', {
        configurable: true,
        get() {
          throw Error('Enemy health read');
        },
      });
    try {
      g.hud.updateAllyCameras();
    } finally {
      w.championState = owner;
      for (const [u, d] of descriptors) Object.defineProperty(u, 'hp', d);
    }
    const cards = [...document.querySelectorAll<HTMLElement>('.ally-portrait')];
    const visible = cards
      .filter((c) => !c.hidden)
      .map((c) => ({ id: Number(c.dataset.unitId), champion: c.dataset.champion }));
    const target = visible[0].id;
    cards[0].dataset.unitId = String(enemies[0].id);
    cards[0].click();
    const camera = { ...g.view.center },
      ally = w.unit(target);
    const atAlly = Math.hypot(camera.x - ally.x, camera.y - ally.y) < 0.01;
    w.matchMode = 'practice';
    g.hud.updateAllyCameras();
    const retained = { ...g.view.center };
    cards[0].click();
    const practiceGuard =
      JSON.stringify(retained) === JSON.stringify(g.view.center) &&
      document.querySelector<HTMLElement>('.ally-portraits')!.hidden;
    w.matchMode = 'lanes';
    g.hud.updateAllyCameras();
    return {
      visible,
      enemyIds: [...ids],
      atAlly,
      practiceGuard,
      orderUnchanged: JSON.stringify(order) === JSON.stringify(w.units.map((u: any) => u.id)),
      commands: w.commands,
    };
  });
  expect(guarded.visible).toEqual(
    before.allies.map((u: any) => ({ id: u.id, champion: u.champion }))
  );
  expect(guarded.visible.every((u: any) => !guarded.enemyIds.includes(u.id))).toBe(true);
  expect(guarded.atAlly).toBe(true);
  expect(guarded.practiceGuard).toBe(true);
  expect(guarded.orderUnchanged).toBe(true);
  expect(guarded.commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('private-portrait-boundaries.json'),
    JSON.stringify({ guarded, errors }, null, 2)
  );
});
