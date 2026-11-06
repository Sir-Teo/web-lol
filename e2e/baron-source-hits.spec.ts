import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('real Baron contact lazily draws source hits and restores their centres, tint and UVs', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/assets/effects/baron-attack/'))
      requests.push(new URL(response.url()).pathname);
  });
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&encounter=baron');
  await ready();
  expect(requests).toEqual([]);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron'),
      step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.baronAttackVisuals.some((v: any) => v.impact)) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return { bossId: b.id, point: g.view.screenPoint(b, 0.65) };
  });
  await page.mouse.click(before.point.x, before.point.y, { button: 'right' });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__GAME__.world.baronAttackVisuals.some((v: any) => v.impact)
        ),
      { timeout: 20000 }
    )
    .toBe(true);
  const contact = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(8);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return g.world.baronAttackVisuals.find((v: any) => v.impact).id;
  });
  await expect
    .poll(() =>
      page.evaluate((id) => (window as any).__GAME__.view.baronHits.clouds.has(id), contact)
    )
    .toBe(true);
  const read = async () =>
    page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed);
      const cloud = g.view.baronHits.clouds.get(id),
        impact = w.baronAttackVisuals.find((v: any) => v.id === id).impact;
      const rows = cloud.batch.root.children.map((mesh: any) => {
        const fields = ['sourceTint', 'sourceUvTurn', 'sourceUvShift', 'sourceErosionDrive'];
        const particles = Array.from({ length: mesh.count }, (_, i) => ({
          centre: Array.from(mesh.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15)),
          fields: fields.map((name) => {
            const a = mesh.geometry.getAttribute(name);
            return Array.from(a.array.slice(i * a.itemSize, (i + 1) * a.itemSize));
          }),
        }));
        return {
          name: mesh.name,
          visible: mesh.visible,
          particles: particles.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        };
      });
      const matrix = cloud.attachment.matrix(impact, w.tick);
      return {
        tick: w.tick,
        saved: w.snapshot(),
        rows,
        bone: Array.from(matrix.elements),
        attached: cloud.batch.root.parent === g.view.scene,
      };
    }, contact);
  const original = await read();
  expect(original.attached).toBe(true);
  expect(original.rows).toHaveLength(12);
  expect(original.rows.some((r: any) => r.visible && r.particles.length)).toBe(true);
  await page.screenshot({ path: info.outputPath('baron-source-contact.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  await expect
    .poll(() =>
      page.evaluate((id) => (window as any).__GAME__.view.baronHits.clouds.has(id), contact)
    )
    .toBe(true);
  const restored = await read();
  expect(restored).toEqual(original);
  const retirement = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      cloud = g.view.baronHits.clouds.get(id);
    g.world.step(130);
    g.view.render(g.world, 1, g.view.previousElapsed);
    let disposed = false;
    try {
      cloud.attachment.matrix(cloud.contact, cloud.contact.startTick);
    } catch (error) {
      disposed = String(error).includes('disposed');
    }
    return {
      present: g.view.baronHits.clouds.has(id),
      parent: cloud.batch.root.parent !== null,
      children: cloud.batch.root.children.length,
      disposed,
    };
  }, contact);
  expect(retirement).toEqual({ present: false, parent: false, children: 0, disposed: true });
  expect(new Set(requests.filter((r) => r.endsWith('.png'))).size).toBe(16);
  expect(requests.some((r) => r.endsWith('.glb'))).toBe(false);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-source-contact.json'),
    JSON.stringify({ before, contact, original, restored, retirement, requests, errors }, null, 2)
  );
});
