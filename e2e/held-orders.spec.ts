import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function setup(page: Page) {
  await page.goto('/?scene=fixture');
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
        Object.assign(u, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 }, stunUntil: 1e9 });
    }
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.commands = [];
    (window as any).__HELD_STEP__ = w.step.bind(w);
    w.step = () => {};
    (window as any).__HELD_LOG__ = [];
    const enqueue = w.enqueue.bind(w);
    w.enqueue = (c: any) => {
      (window as any).__HELD_LOG__.push(structuredClone(c));
      enqueue(c);
    };
    window.addEventListener('pointermove', (e) => {
      (window as any).__HELD_POINTER__ = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    });
    g.view.locked = false;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.setPaused(false);
    return [
      g.view.screenPoint({ x: 250, y: 200 }),
      g.view.screenPoint({ x: 650, y: 200 }),
      g.view.screenPoint({ x: 500, y: -300 }),
      g.view.screenPoint({ x: -350, y: 250 }),
    ];
  });
}
async function orders(page: Page) {
  return page.evaluate(() => (window as any).__HELD_LOG__.filter((c: any) => c.type === 'order'));
}
async function frames(page: Page) {
  const start = await page.evaluate(() => (window as any).__GAME__.view.previousElapsed);
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.previousElapsed), {
      timeout: 20000,
    })
    .toBeGreaterThan(start + 0.4);
}
async function count(page: Page, n: number) {
  await expect.poll(async () => (await orders(page)).length, { timeout: 20000 }).toBe(n);
}

test('held right-click follows cursor changes, deduplicates stationary orders and refreshes zoom projection', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const points = await setup(page);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down({ button: 'right' });
  await count(page, 1);
  await frames(page);
  await count(page, 1);
  await page.mouse.move(points[1].x, points[1].y);
  await count(page, 2);
  await frames(page);
  await count(page, 2);
  await page.locator('#trinket').hover();
  await frames(page);
  await count(page, 2);
  await page.mouse.move(points[2].x, points[2].y);
  await count(page, 3);
  await page.keyboard.down('Shift');
  await count(page, 4);
  expect((await orders(page))[3].order.type).toBe('attackMove');
  await page.keyboard.up('Shift');
  await count(page, 5);
  expect((await orders(page))[4].order.type).toBe('move');
  await page.mouse.move(points[3].x, points[3].y);
  await count(page, 6);
  await page.mouse.wheel(0, 600);
  await count(page, 7);
  const projected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__HELD_POINTER__;
    return g.view.worldPoint(p.x, p.y);
  });
  const issued = await orders(page);
  expect(issued[6].order.point.x).toBeCloseTo(projected.x, 7);
  expect(issued[6].order.point.y).toBeCloseTo(projected.y, 7);
  await page.mouse.up({ button: 'right' });
  await page.mouse.move(points[0].x, points[0].y);
  await frames(page);
  await count(page, 7);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('held-right-movement.png') });
  writeFileSync(
    info.outputPath('held-movement.json'),
    JSON.stringify({ issued, projected, errors }, null, 2)
  );
});

test('held targeting changes from minion to champion and retains a real uninterrupted attack', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      champion = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux'),
      minion = w.spawn('caster', 'red', { x: 400, y: 0 });
    champion.ai = minion.ai = false;
    champion.stunUntil = minion.stunUntil = 1e9;
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      champion: champion.id,
      minion: minion.id,
      hp: champion.hp,
      point: g.view.screenPoint(minion, 0.65),
    };
  });
  await page.mouse.move(state.point.x, state.point.y);
  await page.mouse.down({ button: 'right' });
  await count(page, 1);
  expect((await orders(page))[0].order).toEqual({ type: 'attack', target: state.minion });
  await page.keyboard.down('Backquote');
  await count(page, 2);
  expect((await orders(page))[1].order).toEqual({ type: 'attack', target: state.champion });
  await frames(page);
  await count(page, 2);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step = (window as any).__HELD_STEP__;
  });
  await expect
    .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, state.champion), {
      timeout: 20000,
    })
    .toBeLessThan(state.hp);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.up('Backquote');
  const accepted = await orders(page);
  expect(accepted).toHaveLength(2);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('held-real-attack.json'),
    JSON.stringify({ state, accepted, actualChampionDamage: true, errors }, null, 2)
  );
});

test('Stop, recall, targeting, pause, blur and cancellation end held movement without discarding accepted input', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const points = await setup(page);
  const rows = [];
  for (const action of [
    'stop',
    'recall',
    'spell',
    'ward',
    'attackMove',
    'pause',
    'blur',
    'cancel',
  ]) {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down({ button: 'right' });
    const before = await orders(page);
    if (action === 'stop') await page.keyboard.press('s');
    if (action === 'recall') await page.keyboard.press('b');
    if (action === 'spell') await page.keyboard.down('w');
    if (action === 'ward') await page.keyboard.down('4');
    if (action === 'attackMove') await page.keyboard.press('a');
    if (action === 'pause')
      await page.evaluate(() => {
        const g = (window as any).__GAME__;
        g.setPaused(true);
        g.setPaused(false);
      });
    if (action === 'blur')
      await page.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
        const g = (window as any).__GAME__;
        g.hud.closeModal();
        g.setPaused(false);
      });
    if (action === 'cancel')
      await page.evaluate(() => {
        const p = (window as any).__HELD_POINTER__;
        window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: p.pointerId }));
      });
    const retained = await orders(page);
    expect(retained.slice(0, before.length)).toEqual(before);
    await page.mouse.move(points[1].x, points[1].y);
    await frames(page);
    expect(await orders(page), action).toEqual(retained);
    await page.mouse.up({ button: 'right' });
    if (action === 'spell') await page.keyboard.up('w');
    if (action === 'ward') await page.keyboard.up('4');
    if (action === 'attackMove') await page.keyboard.press('Escape');
    rows.push({ action, acceptedBefore: before.length, retained: retained.length });
  }
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('held-cancellation.json'),
    JSON.stringify({ rows, errors }, null, 2)
  );
});

test('held movement belongs to its initiating pointer and cannot start or linger over HUD controls', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const points = await setup(page);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down({ button: 'right' });
  await count(page, 1);
  await page.evaluate((point) => {
    const canvas = (window as any).__GAME__.view.renderer.domElement;
    const pointerId = (window as any).__HELD_POINTER__.pointerId + 10;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId,
        clientX: point.x,
        clientY: point.y,
        buttons: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId, button: 2 }));
  }, points[2]);
  await frames(page);
  await count(page, 1);
  await page.mouse.move(points[1].x, points[1].y);
  await count(page, 2);
  await page.locator('#trinket').hover();
  await frames(page);
  await count(page, 2);
  await page.mouse.up({ button: 'right' });
  await page.mouse.move(points[2].x, points[2].y);
  await frames(page);
  await count(page, 2);
  await page.locator('#trinket').hover();
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(points[0].x, points[0].y);
  await frames(page);
  await count(page, 2);
  await page.mouse.up({ button: 'right' });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('held-pointer-boundaries.json'),
    JSON.stringify({ issued: await orders(page), errors }, null, 2)
  );
});
