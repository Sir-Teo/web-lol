import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('a stationary held spell preview follows camera zoom and matches its real release point', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
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
    g.view.locked = false;
    g.view.zoom = 1;
    g.view.recenter(w.hero);
    g.setPaused(false);
    const original = w.enqueue.bind(w);
    w.enqueue = (command: any) => {
      if (command.type === 'cast' && command.unit === w.hero.id && command.ability === 'w')
        (window as any).__RELEASED_AIM__ = structuredClone(command);
      return original(command);
    };
  });
  if ((await page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.w)) === 0)
    await page.keyboard.press('Control+w');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.w))
    .toBeGreaterThan(0);
  const pointer = { x: 850, y: 400 };
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aim.visible))
    .toBe(true);
  const before = await page.evaluate(({ x, y }) => {
    const v = (window as any).__GAME__.view;
    return {
      point: { ...v.aimPoint },
      cursor: v.worldPoint(x, y),
      elapsed: v.previousElapsed,
      zoom: v.zoom,
    };
  }, pointer);
  await page.mouse.wheel(0, 600);
  await page.waitForFunction(
    (age) => (window as any).__GAME__.view.previousElapsed > age + 0.05,
    before.elapsed
  );
  const after = await page.evaluate(({ x, y }) => {
    const v = (window as any).__GAME__.view;
    return {
      point: { ...v.aimPoint },
      cursor: v.worldPoint(x, y),
      elapsed: v.previousElapsed,
      zoom: v.zoom,
    };
  }, pointer);
  await page.screenshot({ path: info.outputPath('held-preview-after-zoom.png') });
  await page.keyboard.up('w');
  const released = await page.evaluate(() => (window as any).__RELEASED_AIM__);
  const gap = Math.hypot(after.point.x - after.cursor.x, after.point.y - after.cursor.y);
  const shift = Math.hypot(after.cursor.x - before.cursor.x, after.cursor.y - before.cursor.y);
  writeFileSync(
    info.outputPath('aim-camera.json'),
    JSON.stringify({ pointer, before, after, released, gap, shift, errors }, null, 2) + '\n'
  );
  expect(after.zoom).toBe(1.3);
  expect(shift).toBeGreaterThan(50);
  expect(gap).toBeLessThan(0.001);
  expect(released.point).toEqual(after.point);
  expect(errors).toEqual([]);
});

test('a stationary ward preview follows pan, zoom and resize without spending a cancelled ward', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const charges = await page.evaluate(() => {
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
    g.view.locked = false;
    g.view.zoom = 1;
    g.view.recenter(w.hero);
    g.setPaused(false);
    return w.player.trinket.charges;
  });
  const pointer = { x: 850, y: 400 };
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down('4');
  const stages: any[] = [];
  async function capture(label: string) {
    const age = await page.evaluate(() => (window as any).__GAME__.view.previousElapsed);
    await page.waitForFunction(
      (age) => (window as any).__GAME__.view.previousElapsed > age + 0.05,
      age
    );
    const row = await page.evaluate(({ x, y }) => {
      const g = (window as any).__GAME__,
        v = g.view;
      return {
        mode: v.aimMode,
        point: { ...v.aimPoint },
        cursor: v.worldPoint(x, y),
        inside: document.elementFromPoint(x, y) === v.renderer.domElement,
        zoom: v.zoom,
      };
    }, pointer);
    stages.push({ label, ...row });
    expect(row.mode).toBe('ward');
    expect(row.inside).toBe(true);
    expect(Math.hypot(row.point.x - row.cursor.x, row.point.y - row.cursor.y)).toBeLessThan(0.001);
  }
  await capture('initial');
  await page.mouse.wheel(0, -600);
  await capture('zoom');
  await page.evaluate(() => (window as any).__GAME__.view.pan(1, -0.5, 0.25));
  await capture('pan');
  await page.setViewportSize({ width: 1024, height: 720 });
  await capture('resize');
  await page.screenshot({ path: info.outputPath('ward-preview-after-resize.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('4');
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      mode: g.view.aimMode,
      charges: w.player.trinket.charges,
      pending: w.pendingWards.length,
      wards: w.units.filter((u: any) => u.kind === 'ward').length,
    };
  });
  expect(after).toEqual({ mode: null, charges, pending: 0, wards: 0 });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ward-camera.json'),
    JSON.stringify({ pointer, stages, after, errors }, null, 2) + '\n'
  );
});
