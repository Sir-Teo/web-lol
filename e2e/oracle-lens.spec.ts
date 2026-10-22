import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
async function saveReload(page: Page, holdClock = false) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  if (holdClock)
    await page.evaluate(() => {
      // Close the restored menu and hold its exact review tick in one task; a
      // separate browser round trip can otherwise advance several live frames.
      document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
      (window as any).__GAME__.setPaused(true);
    });
  else {
    await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
    await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  }
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
          : [...v.oracleLens.particles.models.values()].find(
              (m: any) =>
                m.root.userData.ownerId === id &&
                m.root.userData.profileIndex === (which === 'scanner' ? 1 : 10)
            ).root;
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

test('recast and expired child effects retain their source buffers through Ward swaps and saved tail-only restoration', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await equip(page, true);
  await page.locator('#practice-button').click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.nextWaveTick = 1e9;
    for (const u of g.world.units) u.ai = false;
  });
  async function cast() {
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await page.keyboard.press('4');
    await page.waitForFunction(() => {
      const g = (window as any).__GAME__;
      if (!g.world.player.trinket.scan) return false;
      g.setPaused(true);
      return true;
    });
  }
  await cast();
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.player.trinket.scan.startTick + 300 - w.tick);
  });
  const first = await page.evaluate(
    () => (window as any).__GAME__.world.player.trinket.scan.startTick
  );
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('4');
  await page.waitForFunction((first) => {
    const g = (window as any).__GAME__;
    if (g.world.player.trinket.scan.startTick === first) return false;
    g.setPaused(true);
    return true;
  }, first);
  await page.keyboard.press('p');
  await page.locator('[data-trinket="ward"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  await page.locator('.close-button').click();
  const recast = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const old = w.player.trinket.visuals[0];
    w.step(old.stopTick + 30 - w.tick);
    const anchor = structuredClone(old.childAnchor);
    Object.assign(w.hero, { x: -420, y: -50, previous: { x: -420, y: -50 } });
    w.step(4);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      kind: w.player.trinket.kind,
      reason: old.endReason,
      anchor,
      retained: old.childAnchor,
      count: [...g.view.oracleLens.particles.models.values()].filter((m: any) =>
        m.root.userData.effectId.endsWith(':death')
      ).length,
    };
  });
  expect(recast.kind).toBe('ward');
  expect(recast.reason).toBe('recast');
  expect(recast.retained).toEqual(recast.anchor);
  expect(recast.count).toBeGreaterThan(0);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(w.player.trinket.scan.endTick - w.tick);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
  });
  await saveReload(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = w.player.trinket.visuals[0];
    w.step(v.stopTick + 34 - w.tick);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      scan: w.player.trinket.scan,
      kind: w.player.trinket.kind,
      anchor: v.childAnchor,
      models: g.view.oracleLens.particles.models.size,
    };
  });
  expect(before.scan).toBeNull();
  expect(before.kind).toBe('ward');
  expect(before.anchor).not.toBeNull();
  expect(before.models).toBeGreaterThan(0);
  async function buffers() {
    return page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.view.recenter(g.world.hero);
      g.view.render(g.world, 1, g.view.previousElapsed);
      return JSON.stringify(
        [...g.view.oracleLens.particles.models]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, m]: any) => ({
            key,
            position: m.root.position.toArray(),
            quaternion: m.root.quaternion.toArray(),
            scale: m.root.scale.toArray(),
            particle: m.root.userData.particle,
            vertices: m.meshes.map((mesh: any) =>
              Array.from(mesh.geometry.attributes.position.array)
            ),
          }))
      );
    });
  }
  const activeBuffers = await buffers();
  await page.screenshot({ path: 'artifacts/oracle-child-active.png' });
  await saveReload(page, true);
  const restoredBuffers = await buffers();
  writeFileSync('artifacts/oracle-child-buffers-before.json', activeBuffers);
  writeFileSync('artifacts/oracle-child-buffers-after.json', restoredBuffers);
  expect(createHash('sha256').update(restoredBuffers).digest('hex')).toBe(
    createHash('sha256').update(activeBuffers).digest('hex')
  );
  await page.screenshot({ path: 'artifacts/oracle-child-restored.png' });
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    let materials = 0,
      geometries = 0;
    const models = [...g.view.oracleLens.particles.models.values()] as any[];
    for (const m of models)
      for (const mesh of m.meshes) {
        mesh.material.addEventListener('dispose', () => materials++);
        if (m.ownedGeometry) mesh.geometry.addEventListener('dispose', () => geometries++);
      }
    const end = w.player.trinket.visuals[0].stopTick + 92;
    w.step(end - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      histories: w.player.trinket.visuals.length,
      models: g.view.oracleLens.particles.models.size,
      materials,
      geometries,
      expectedMaterials: models.reduce((n, m) => n + m.meshes.length, 0),
      expectedGeometries: models.filter((m) => m.ownedGeometry).length,
    };
  });
  expect([retired.histories, retired.models]).toEqual([0, 0]);
  expect(retired.materials).toBe(retired.expectedMaterials);
  expect(retired.geometries).toBe(retired.expectedGeometries);
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/oracle-child-runtime.json',
    JSON.stringify({ recast, before, retired }, null, 2) + '\n'
  );
});

test('a real Nexus kill plays the future Oracle child from a frozen saved clock without mutating simulation', async ({
  page,
}) => {
  await equip(page, true);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.nextWaveTick = 1e9;
    for (const u of w.units) u.ai = false;
    Object.assign(w.hero, { x: -420, y: -50, previous: { x: -420, y: -50 } });
    g.view.recenter(w.hero);
    g.setPaused(false);
  });
  await page.keyboard.press('4');
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (!g.world.player.trinket.scan) return false;
    g.setPaused(true);
    return true;
  });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(60);
    const nexus = w.spawn('nexus', 'red', { x: -320, y: -50 });
    nexus.hp = 1;
    const attacker = w.spawn('melee', 'blue', { x: -320, y: -50 });
    attacker.ai = false;
    attacker.order = { type: 'attack', target: nexus.id };
    w.step(attacker.windupTicks + 3);
    const frozen = w.snapshot(),
      visual = w.player.trinket.visuals[0];
    v.render(w, 1, 0);
    v.render(w, 1, 0.55);
    const models = [...v.oracleLens.particles.models.values()] as any[];
    const children = models.filter((m) => m.root.userData.effectId.endsWith(':death'));
    const replay = () =>
      JSON.stringify(
        [...v.oracleLens.particles.models]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, m]: any) => ({
            key,
            position: m.root.position.toArray(),
            particle: m.root.userData.particle,
          }))
      );
    const first = replay(),
      gl = v.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    v.renderer.render(v.scene, v.camera);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    children.forEach((m) => (m.root.visible = false));
    v.renderer.render(v.scene, v.camera);
    const hidden = new Uint8Array(pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      hidden
    );
    let changed = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i] !== hidden[i] ||
        pixels[i + 1] !== hidden[i + 1] ||
        pixels[i + 2] !== hidden[i + 2]
      )
        changed++;
    const unchanged = w.snapshot() === frozen;
    const restored = w.constructor.fromSnapshot(frozen, w.battlefield);
    v.render(restored, 1, 0);
    v.render(restored, 1, 0.55);
    const exactReplay = first === replay();
    v.render(restored, 1, 2);
    return {
      winner: w.winner,
      reason: visual.endReason,
      stop: visual.stopTick,
      tick: w.tick,
      pendingChild: visual.childAnchor,
      children: children.length,
      changed,
      unchanged,
      exactReplay,
      retired: v.oracleLens.particles.models.size,
      savedUnchanged: restored.snapshot() === frozen,
    };
  });
  expect(result.winner).toBe('blue');
  expect(result.reason).toBe('match-end');
  expect(result.stop).toBe(result.tick);
  expect(result.pendingChild).toBeNull();
  expect(result.children).toBeGreaterThan(0);
  expect(result.changed).toBeGreaterThan(0);
  expect([result.unchanged, result.exactReplay, result.savedUnchanged]).toEqual([true, true, true]);
  expect(result.retired).toBe(0);
  writeFileSync('artifacts/oracle-terminal-runtime.json', JSON.stringify(result, null, 2) + '\n');
});
