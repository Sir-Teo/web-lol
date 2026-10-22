import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function equip(page: Page, fixture = false) {
  await page.goto(fixture ? '/?scene=fixture' : '/');
  await ready(page);
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.keyboard.press('p');
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  await page.locator('.close-button').click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function saveReload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function contribution(page: Page, which: 'scanner' | 'radar' | 'echo', id: number) {
  return page.evaluate(
    ({ which, id }) => {
      const g = (window as any).__GAME__,
        v = g.view;
      v.render(g.world, 1, v.previousElapsed);
      g.hud.update(60);
      const root =
        which === 'echo'
          ? v.oracleLens.echoes.get(id).root
          : which === 'scanner'
            ? v.oracleLens.scans.get(id).rig.root
            : v.oracleLens.scans.get(id).radar;
      const gl = v.renderer.getContext(),
        width = gl.drawingBufferWidth,
        height = gl.drawingBufferHeight;
      const read = () => {
        v.renderer.render(v.scene, v.camera);
        const a = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, a);
        return a;
      };
      const a = read();
      root.visible = false;
      const b = read();
      root.visible = true;
      read();
      let count = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
      return count;
    },
    { which, id }
  );
}

test('real Rift shop and key input detect a hidden ward, restore an active scan, and clear it with three attacks', async ({
  page,
}) => {
  test.setTimeout(150000);
  const faults: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('requestfailed', (r) => faults.push(r.url()));
  page.on('request', (r) => {
    if (r.url().includes('/oracle-lens-') && r.url().endsWith('.glb')) requests.push(r.url());
  });
  await equip(page);
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.nextWaveTick = 1e9;
    for (const u of w.units) u.ai = false;
    const hero = w.battlefield.reachable({ x: 0, y: -1000 }, w.hero.radius, 'blue');
    const point = w.battlefield.reachable({ x: hero.x + 350, y: hero.y }, 5, 'red');
    const origin = w.battlefield.reachable({ x: point.x + 300, y: point.y }, 65, 'red');
    const owner = w.spawn('champion', 'red', origin);
    owner.ai = false;
    w.enqueue({ type: 'ward', unit: owner.id, point });
    w.step(141);
    const home = w.battlefield.spawns.red;
    Object.assign(owner, home, { previous: { ...home } });
    Object.assign(w.hero, hero, { previous: { ...hero } });
    const ward = w.units.find((u: any) => u.kind === 'ward');
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: ward.id,
      hidden: !w.visible(ward),
      hero: w.hero.id,
      gold: w.player.gold,
      cs: w.player.cs,
    };
  });
  expect(setup.hidden).toBe(true);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('4');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.player.trinket.scan) return false;
    g.setPaused(true);
    return true;
  });
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  const active = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(120);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      visible: w.visible(w.unit(id)),
      stock: w.player.trinket.charges,
      scan: w.player.trinket.scan,
    };
  }, setup.id);
  expect(active.visible).toBe(true);
  expect(active.stock).toBe(0);
  await expect(page.locator(`.unit-bar[data-unit="${setup.id}"] .unit-status`)).toHaveText(
    'DISABLED'
  );
  const scanner = await contribution(page, 'scanner', setup.hero),
    radar = await contribution(page, 'radar', setup.hero);
  expect(scanner).toBeGreaterThan(5);
  expect(radar).toBeGreaterThan(10);
  await page.screenshot({ path: 'artifacts/oracle-rift-active.png' });
  await saveReload(page);
  expect(await contribution(page, 'scanner', setup.hero)).toBeGreaterThan(5);
  const point = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(g.world.unit(id), 0.65);
  }, setup.id);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__,
      u = g.world.unit(id);
    if (u && u.hp > 0) return false;
    g.setPaused(true);
    return true;
  }, setup.id);
  expect(
    await page.evaluate(() => ({
      gold: (window as any).__GAME__.world.player.gold,
      cs: (window as any).__GAME__.world.player.cs,
    }))
  ).toEqual({ gold: setup.gold + 10, cs: setup.cs });
  await page.screenshot({ path: 'artifacts/oracle-rift-cleared.png' });
  expect(requests.filter((u) => u.endsWith('/oracle-lens-base.glb')).length).toBeGreaterThanOrEqual(
    2
  );
  expect(faults).toEqual([]);
  writeFileSync(
    'artifacts/oracle-rift-runtime.json',
    JSON.stringify({ setup, active, scanner, radar, requests }, null, 2) + '\n'
  );
});

test('failed and delayed preparation preserves resources, serializes clicks and rechecks fountain access', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  let requests = 0;
  await page.route('**/oracle-lens-base.glb', async (route) => {
    requests++;
    await route.fulfill({ status: 503, body: 'temporary failure' });
  });
  await page.keyboard.press('p');
  const before = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(requests).toBe(0);
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText(
    'Oracle Lens could not be prepared. Try again.'
  );
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before);
  await page.unroute('**/oracle-lens-base.glb');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/oracle-lens-base.glb', async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Preparing trinket…');
  // Native clicks can still reach an aria-disabled control. Force this repeated
  // pointer click to exercise the handler's lock rather than Playwright's guard.
  await page.locator('[data-trinket="oracle"]').click({ force: true });
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.hero.x += 900;
  });
  release();
  await expect(page.locator('.shop-message')).toHaveText(
    'Return to your fountain to swap trinkets'
  );
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.trinket.kind)).toBe(
    'ward'
  );
  expect(requests).toBe(2);
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    Object.assign(w.hero, w.battlefield.spawns.blue);
  });
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  expect(requests).toBe(2);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 600, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    for (const kind of ['ward', 'oracle'])
      await expect(page.locator(`[data-trinket="${kind}"]`)).toBeInViewport({ ratio: 1 });
    expect(await page.locator('.game-dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true
    );
    await page.screenshot({ path: `artifacts/oracle-shop-${viewport.width}.png` });
  }
});

test('brush silhouettes remain sampled, saved and untargetable without leaking health or ordinary sight', async ({
  page,
}) => {
  test.setTimeout(120000);
  const faults: string[] = [];
  page.on('pageerror', (e) => faults.push(e.message));
  await equip(page, true);
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.nextWaveTick = 1e9;
    for (const u of w.units) u.ai = false;
    Object.assign(w.hero, { x: -420, y: -50, previous: { x: -420, y: -50 } });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 }, 'lux');
    enemy.ai = false;
    g.view.recenter(w.hero);
    return enemy.id;
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.locator('#trinket').click();
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__;
    if (!g.world.player.trinket.scan?.echoes.some((e: any) => e.targetId === id)) return false;
    g.setPaused(true);
    return true;
  }, id);
  const sample = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(120);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const enemy = w.unit(id),
      screen = g.view.screenPoint(enemy, 0.8);
    return {
      visible: w.visible(enemy),
      picked: g.view.pick(w, screen.x, screen.y)?.id ?? null,
      echo: w.player.trinket.scan.echoes.find((e: any) => e.targetId === id),
      ordinaryModelVisible: g.view.models.get(id).root.visible,
    };
  }, id);
  expect(sample.visible).toBe(false);
  expect(sample.ordinaryModelVisible).toBe(false);
  expect(sample.picked).not.toBe(id);
  await expect(page.locator(`.unit-bar[data-unit="${id}"]`)).toBeHidden();
  const pixels = await contribution(page, 'echo', id);
  expect(pixels).toBeGreaterThan(10);
  await page.screenshot({ path: 'artifacts/oracle-brush-echo.png' });
  await page.evaluate((id) => {
    const w = (window as any).__GAME__.world;
    Object.assign(w.unit(id), { x: -860, y: -80, previous: { x: -860, y: -80 } });
    w.step();
  }, id);
  await saveReload(page);
  expect(await contribution(page, 'echo', id)).toBeGreaterThan(10);
  expect(
    await page.evaluate(
      (id) =>
        (window as any).__GAME__.world.player.trinket.scan.echoes.find(
          (e: any) => e.targetId === id
        ).point,
      id
    )
  ).toEqual(sample.echo.point);
  await page.screenshot({ path: 'artifacts/oracle-brush-restored.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(w.player.trinket.scan.endTick - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  expect(await page.evaluate(() => (window as any).__GAME__.view.oracleLens.echoes.size)).toBe(0);
  expect(faults).toEqual([]);
  writeFileSync(
    'artifacts/oracle-brush-runtime.json',
    JSON.stringify({ sample, pixels }, null, 2) + '\n'
  );
});
