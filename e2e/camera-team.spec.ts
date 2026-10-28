import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function focus(page: Page, id: number | null) {
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.cameraFocusId))
    .toBe(id);
  if (id !== null)
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
test('held teammate cameras preserve lock and manual control, order held keys and clear on pause/blur', async ({
  page,
}, info) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  const before = await page.evaluate(() => {
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
        { x: w.hero.x + (i + 1) * 600, y: w.hero.y - (i + 1) * 500 },
        u.radius,
        u.team
      );
      Object.assign(u, p, { previous: { ...p } });
    }
    g.view.locked = false;
    g.view.recenter(w.hero);
    g.setPaused(false);
    return {
      hero: w.hero.id,
      allies: allies.map((u: any) => u.id),
      heroPosition: { x: w.hero.x, y: w.hero.y },
      heroOrder: structuredClone(w.hero.order),
    };
  });
  await page.mouse.move(720, 400);
  for (const [index, id] of [before.hero, ...before.allies].entries()) {
    const key = `F${index + 1}`;
    await page.keyboard.down(key);
    await focus(page, id);
    expect(await page.evaluate(() => (window as any).__GAME__.view.locked)).toBe(false);
    await page.keyboard.up(key);
    await focus(page, null);
    const retained = await page.evaluate(() => ({ ...(window as any).__GAME__.view.center }));
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => ({ ...(window as any).__GAME__.view.center }))).toEqual(
      retained
    );
  }
  await page.keyboard.down('F2');
  await page.keyboard.down('F3');
  await focus(page, before.allies[1]);
  await page.keyboard.up('F3');
  await focus(page, before.allies[0]);
  await page.keyboard.up('F2');
  await focus(page, null);
  await page.keyboard.down('F3');
  await page.keyboard.down('F3');
  await focus(page, before.allies[1]);
  await page.keyboard.up('F3');
  await focus(page, null);
  await page.keyboard.down('F4');
  await page.keyboard.down('Space');
  await focus(page, before.hero);
  await page.keyboard.up('Space');
  await focus(page, before.allies[2]);
  await page.keyboard.up('F4');
  await focus(page, null);
  await page.keyboard.press('y');
  expect(await page.evaluate(() => (window as any).__GAME__.view.locked)).toBe(true);
  await page.keyboard.down('F5');
  await focus(page, before.allies[3]);
  await page.screenshot({ path: info.outputPath('held-support-camera.png') });
  await page.keyboard.up('F5');
  await focus(page, null);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (window as any).__GAME__;
        return Math.hypot(g.view.center.x - g.world.hero.x, g.view.center.y - g.world.hero.y);
      })
    )
    .toBeLessThan(0.01);
  expect(await page.evaluate(() => (window as any).__GAME__.view.locked)).toBe(true);
  await page.keyboard.press('y');
  await page.keyboard.down('F2');
  await focus(page, before.allies[0]);
  await page.keyboard.press('Escape');
  await focus(page, null);
  await page.keyboard.up('F2');
  await page.keyboard.press('Escape');
  await focus(page, null);
  await page.keyboard.down('F3');
  await focus(page, before.allies[1]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await focus(page, null);
  await page.keyboard.up('F3');
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      heroPosition: { x: w.hero.x, y: w.hero.y },
      heroOrder: structuredClone(w.hero.order),
      commands: w.commands.length,
      summoners: [w.abilityCooldownTicks('d'), w.abilityCooldownTicks('f')],
      locked: g.view.locked,
      focus: g.view.cameraFocusId,
    };
  });
  expect(after.heroPosition).toEqual(before.heroPosition);
  expect(after.heroOrder).toEqual(before.heroOrder);
  expect(after.commands).toBe(0);
  expect(after.summoners).toEqual([0, 0]);
  expect(after.locked).toBe(false);
  expect(errors).toEqual([]);
  await page.keyboard.press('h');
  await expect(page.locator('.controls-list')).toContainText('F2–F5');
  await page.keyboard.press('Escape');
  writeFileSync(
    info.outputPath('camera-team.json'),
    JSON.stringify(
      {
        before,
        after,
        allFiveKeys: true,
        newestHeldKeyWins: true,
        repeatReserved: true,
        spacePriority: true,
        lockPreserved: true,
        pauseAndBlurClear: true,
        errors,
      },
      null,
      2
    ) + '\n'
  );
});

test('a held teammate camera follows actual movement and excludes enemy, typing and modifier targets', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  const before = await page.evaluate(() => {
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
    const ally = w.units
      .filter((u: any) => u.kind === 'champion' && u.team === w.hero.team && u.id !== w.hero.id)
      .sort((a: any, b: any) => a.id - b.id)[0];
    const start = w.battlefield.reachable(
      { x: w.hero.x + 800, y: w.hero.y - 800 },
      ally.radius,
      ally.team
    );
    Object.assign(ally, start, { previous: { ...start } });
    const destination = w.battlefield.reachable(
      { x: start.x + 500, y: start.y - 300 },
      ally.radius,
      ally.team
    );
    g.view.locked = false;
    g.setPaused(false);
    return { ally: ally.id, start, destination };
  });
  await page.mouse.move(720, 400);
  await page.keyboard.down('F2');
  await focus(page, before.ally);
  await page.evaluate(({ ally, destination }) => {
    const w = (window as any).__GAME__.world;
    w.setOrder(w.unit(ally), { type: 'move', point: destination });
  }, before);
  await expect
    .poll(() =>
      page.evaluate(({ ally, start }) => {
        const g = (window as any).__GAME__,
          u = g.world.unit(ally);
        return (
          Math.hypot(u.x - start.x, u.y - start.y) > 100 &&
          Math.hypot(g.view.center.x - u.x, g.view.center.y - u.y) < 10
        );
      }, before)
    )
    .toBe(true);
  const moving = await page.evaluate(({ ally }) => {
    const g = (window as any).__GAME__,
      u = g.world.unit(ally);
    return {
      position: { x: u.x, y: u.y },
      center: { ...g.view.center },
      focus: g.view.cameraFocusId,
    };
  }, before);
  await page.screenshot({ path: info.outputPath('following-moving-ally.png') });
  await page.keyboard.up('F2');
  await focus(page, null);
  const privacy = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.units.find((u: any) => u.kind === 'champion' && u.team !== w.hero.team);
    const prior = { ...g.view.center };
    g.view.cameraFocusId = enemy.id;
    g.view.render(w, 1, g.view.previousElapsed);
    const ignored = g.view.center.x === prior.x && g.view.center.y === prior.y;
    g.view.locked = true;
    g.view.render(w, 1, g.view.previousElapsed);
    const ownFallback = g.view.center.x === w.hero.x && g.view.center.y === w.hero.y;
    g.view.locked = false;
    g.view.cameraFocusId = null;
    const input = document.createElement('input');
    input.id = 'camera-typing-fixture';
    g.hud.root.append(input);
    input.focus();
    return { enemyVisible: w.visible(enemy, w.hero.team), ignored, ownFallback };
  });
  expect(privacy).toEqual({ enemyVisible: false, ignored: true, ownFallback: true });
  await page.keyboard.press('F2');
  await focus(page, null);
  await page.evaluate(() => {
    document.querySelector('#camera-typing-fixture')!.remove();
    (window as any).__GAME__.view.renderer.domElement.focus();
  });
  await page.keyboard.press('Control+F2');
  await focus(page, null);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('camera-team-movement.json'),
    JSON.stringify(
      { before, moving, privacy, actualAllyMovement: true, typingAndModifierIgnored: true, errors },
      null,
      2
    ) + '\n'
  );
});
