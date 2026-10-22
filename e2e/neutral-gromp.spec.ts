import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/?scene=fixture&encounter=gromp');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step(480);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const target = w.units.find((u: any) => u.kind === 'monster');
    return { id: target.id, point: g.view.screenPoint(target) };
  });
}

test('a real Gromp attack, source rig, neutral bar and retaliation survive save/reload', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  const target = await boot(page);
  await expect(page.locator('.unit-bar.neutral.monster')).toBeVisible();
  await expect(page.locator('.unit-bar.neutral .unit-name')).toHaveText('Gromp');
  const model = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      m = g.view.models.get(id);
    const hidden: string[] = [];
    m.root.traverse((o: any) => {
      if (!o.isMesh || o.visible) return;
      for (const material of Array.isArray(o.material) ? o.material : [o.material])
        hidden.push(material.userData.sourceSubmesh);
    });
    const renderer = g.view.renderer,
      gl = renderer.getContext();
    const width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const shown = new Uint8Array(width * height * 4),
      absent = new Uint8Array(shown.length);
    renderer.render(g.view.scene, g.view.camera);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, shown);
    m.root.visible = false;
    renderer.render(g.view.scene, g.view.camera);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, absent);
    m.root.visible = true;
    renderer.render(g.view.scene, g.view.camera);
    let pixels = 0;
    for (let i = 0; i < shown.length; i += 4)
      if (
        shown[i] !== absent[i] ||
        shown[i + 1] !== absent[i + 1] ||
        shown[i + 2] !== absent[i + 2]
      )
        pixels++;
    return { reference: m.referenceAsset, actions: Object.keys(m.actions), hidden, pixels };
  }, target.id);
  expect(model.reference).toBe('sru-gromp-base');
  expect(model.actions).toEqual(expect.arrayContaining(['idle1', 'run', 'attack1', 'death']));
  expect(model.hidden.sort()).toEqual(['SRU_Gromp_mini_mat', 'Toad_Spawn_Mat'].sort());
  expect(model.pixels).toBeGreaterThan(60);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world,
      u = w.unit(id);
    return u.hp < u.maxHp && u.monster.phase === 'engaged';
  }, target.id);
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world;
    return w.hero.hp < w.hero.maxHp;
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/neutral-gromp-combat.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await expect(page.locator('.unit-bar.neutral.monster')).toBeVisible();
  expect(requests.filter((url) => url.endsWith('sru-gromp-base.glb'))).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('Gromp death plays its source clip, keeps cleared continuation and restarts the encounter', async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  const target = await boot(page);
  await page.evaluate(() => {
    (window as any).__GAME__.world.hero.damage = 99999;
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(target.point.x, target.point.y, { button: 'right' });
  await page.waitForFunction((id) => (window as any).__GAME__.world.unit(id)?.hp === 0, target.id);
  const death = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const m = g.view.models.get(id);
    return {
      action: m.actionName,
      visible: m.root.visible,
      cs: w.player.cs,
      firstBlood: w.firstBloodClaimed,
    };
  }, target.id);
  expect(death).toEqual({ action: 'death', visible: true, cs: 4, firstBlood: false });
  await page.screenshot({ path: 'artifacts/neutral-gromp-death.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(400);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  requests.length = 0;
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return {
        encounter: w.encounter,
        monsters: w.units.filter((u: any) => u.kind === 'monster').length,
      };
    })
  ).toEqual({ encounter: 'gromp', monsters: 0 });
  expect(requests.some((url) => url.endsWith('sru-gromp-base.glb'))).toBe(false);
  await page.getByRole('button', { name: 'Restart practice', exact: true }).click();
  await page.waitForFunction(() =>
    (window as any).__GAME__?.world.units.some((u: any) => u.kind === 'monster' && u.hp === 2050)
  );
  expect(errors).toEqual([]);
});
