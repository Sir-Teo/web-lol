import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('real combat releases a visible source Baron missile before damage and restores its flight', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&encounter=baron');
  await ready();
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron');
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.projectiles.some((p: any) => p.source === b.id)) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return { bossId: b.id, hp: w.hero.hp, point: g.view.screenPoint(b, 0.65) };
  });
  await page.mouse.click(before.point.x, before.point.y, { button: 'right' });
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => (window as any).__GAME__.world.projectiles.some((p: any) => p.source === id),
          before.bossId
        ),
      { timeout: 20000 }
    )
    .toBe(true);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(8);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.baronFlights.loaded))
    .toBe(true);
  const flight = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const p = w.projectiles.find((p: any) => p.source === id);
    if (!p) throw Error('Expected an in-flight Baron missile');
    g.view.render(w, 1, g.view.previousElapsed);
    const marker = g.view.projectileModels.get(p.id),
      cloud = g.view.baronFlights.clouds.get(p.id);
    if (!cloud) throw Error('Expected the source missile cloud');
    const source = cloud.batch.root.children.map((mesh: any) => {
      const count = mesh.instanceMatrix ? mesh.count : mesh.geometry.drawRange.count;
      const vertices = Array.from({ length: count }, (_, i) => {
        const position = mesh.instanceMatrix
          ? Array.from(mesh.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15))
          : Array.from(mesh.geometry.getAttribute('position').array.slice(i * 3, i * 3 + 3));
        const fields = ['sourceTint', 'sourceUvTurn', 'sourceUvShift'].map((name) => {
          const a = mesh.geometry.getAttribute(name);
          return Array.from(a.array.slice(i * a.itemSize, (i + 1) * a.itemSize));
        });
        return { position, fields };
      });
      return {
        name: mesh.name,
        visible: mesh.visible,
        vertices: mesh.instanceMatrix
          ? vertices.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
          : vertices,
      };
    });
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      tick: w.tick,
      hp: w.hero.hp,
      projectile: structuredClone(p),
      history: structuredClone(w.baronAttackVisuals.find((v: any) => v.id === p.id)),
      source,
      marker: marker?.name,
      markerVisible: marker?.visible,
      saved,
      future: copy.snapshot(),
    };
  }, before.bossId);
  expect(flight.hp).toBe(before.hp);
  expect(flight.projectile.speed).toBe(1300);
  expect(flight.history).toMatchObject({
    id: flight.projectile.id,
    sourceId: before.bossId,
    stopTick: null,
    impact: null,
  });
  expect(flight.history.frames.at(-1)).toMatchObject({
    tick: flight.tick,
    x: flight.projectile.x,
    y: flight.projectile.y,
  });
  expect(flight.marker).toBeUndefined();
  expect(flight.source).toHaveLength(9);
  expect(flight.source.some((row: any) => row.visible && row.vertices.length)).toBe(true);
  await page.screenshot({ path: info.outputPath('baron-source-flight.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(flight.saved);
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.baronFlights.loaded))
    .toBe(true);
  const restoredSource = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    const cloud = g.view.baronFlights.clouds.get(id);
    return cloud.batch.root.children.map((mesh: any) => {
      const count = mesh.instanceMatrix ? mesh.count : mesh.geometry.drawRange.count;
      const vertices = Array.from({ length: count }, (_, i) => {
        const position = mesh.instanceMatrix
          ? Array.from(mesh.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15))
          : Array.from(mesh.geometry.getAttribute('position').array.slice(i * 3, i * 3 + 3));
        const fields = ['sourceTint', 'sourceUvTurn', 'sourceUvShift'].map((name) => {
          const a = mesh.geometry.getAttribute(name);
          return Array.from(a.array.slice(i * a.itemSize, (i + 1) * a.itemSize));
        });
        return { position, fields };
      });
      return {
        name: mesh.name,
        visible: mesh.visible,
        vertices: mesh.instanceMatrix
          ? vertices.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
          : vertices,
      };
    });
  }, flight.projectile.id);
  expect(restoredSource).toEqual(flight.source);

  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return {
      saved: w.snapshot(),
      contacts: w.baronAttackVisuals
        .filter((v: any) => v.impact !== null)
        .map((v: any) => ({
          id: v.id,
          stopReason: v.stopReason,
          startTick: v.impact.startTick,
          poseTick: v.impact.frames.at(-1).tick,
          targetId: v.targetId,
        })),
      tick: w.tick,
    };
  });
  expect(future.saved).toBe(flight.future);
  expect(future.contacts.length).toBeGreaterThan(0);
  expect(
    future.contacts.every((v: any) => v.stopReason === 'hit' && v.poseTick === future.tick)
  ).toBe(true);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(future.saved);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-projectile.json'),
    JSON.stringify({ before, flight, restoredSource, future, errors }, null, 2)
  );
});
