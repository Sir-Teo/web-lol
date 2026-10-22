import { expect, test } from '@playwright/test';

test('peaceful Scuttlers emerge, flee real Lux input and save shared river spawns and shrine rewards', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  page.on('request', (r) => requests.push(r.url()));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  const save = async () => {
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    return page.evaluate(() => (window as any).__GAME__.world.snapshot());
  };
  const reload = async (snapshot: string) => {
    await page.reload();
    await ready();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  };
  const gpu = async (id: number | null) =>
    page.evaluate((id) => {
      const g = (window as any).__GAME__,
        root = id === null ? g.view.riverShrines.meshes.get('dragon') : g.view.models.get(id).root,
        r = g.view.renderer,
        gl = r.getContext(),
        a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
        b = new Uint8Array(a.length);
      r.render(g.view.scene, g.view.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a
      );
      root.visible = false;
      r.render(g.view.scene, g.view.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b
      );
      root.visible = true;
      r.render(g.view.scene, g.view.camera);
      let pixels = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++;
      return pixels;
    }, id);
  await page.goto('/');
  await ready();
  expect(requests.some((u) => u.endsWith('/sru-crab-base.glb'))).toBe(false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await ready();
  expect(requests.some((u) => u.endsWith('/sru-crab-base.glb'))).toBe(true);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const initial = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      { SCUTTLER_POLICY: P } = await import('/src/content/scuttler-policy.ts');
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.gainExperience(280);
    w.tick = P.firstReadyTick - P.leadupTicks - 1;
    w.step();
    const u = w.unit(w.scuttlers.unitIds.dragon);
    let point;
    for (let x = -400; x <= 400 && !point; x += 50)
      for (let y = -400; y <= 400 && !point; y += 50) {
        const p = { x: u.x + x, y: u.y + y },
          d = Math.hypot(x, y);
        if (
          d > 200 &&
          d < 400 &&
          w.battlefield.lineWalkable(p, p, w.hero.radius, 'blue') &&
          w.battlefield.lineOfSight(p, u)
        )
          point = p;
      }
    if (!point) throw new Error('No visible separated river approach');
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const screen = g.view.screenPoint(u, 0.6);
    return {
      ids: { ...w.scuttlers.unitIds },
      hidden: P.hiddenTicks,
      emerge: P.untargetableEmergenceTicks,
      buriedPick: g.view.pick(w, screen.x, screen.y)?.id ?? null,
    };
  });
  expect(initial.buriedPick).not.toBe(initial.ids.dragon);
  await expect(page.locator(`.unit-bar[data-unit="${initial.ids.dragon}"]`)).toBeHidden();
  await page.keyboard.press('Escape');
  const hidden = await save();
  await reload(hidden);
  const emerging = await page.evaluate(async ({ hidden, emerge }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      { mobilePose } = await import('/src/render/mobile-pose.ts'),
      { mobileClipDurations } = await import('/src/content/mobile-clip-durations.ts');
    w.step(hidden);
    const u = w.unit(w.scuttlers.unitIds.dragon);
    const clip = mobilePose(u, undefined, w.tick, 1, mobileClipDurations(u)!).clip;
    w.step(emerge);
    const protectedTail = u.monster.spawn !== null && w.vulnerable(u);
    w.step(10);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      clip,
      protectedTail,
      rig: g.view.models.get(u.id).referenceAsset,
      screen: g.view.screenPoint(u, 0.6),
    };
  }, initial);
  expect(emerging.clip).toBe('spawn');
  expect(emerging.protectedTail).toBe(true);
  expect(emerging.rig).toBe('sru-crab-base');
  expect(await gpu(initial.ids.dragon)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.mouse.click(emerging.screen.x, emerging.screen.y, { button: 'right' });
  await page.waitForFunction(
    (id) => {
      const w = (window as any).__GAME__.world,
        u = w.unit(id);
      return u.hp < u.maxHp && u.monster.phase === 'engaged';
    },
    initial.ids.dragon,
    { timeout: 10000 }
  );
  const aim = await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(g.world.unit(id), 0.6);
  }, initial.ids.dragon);
  await page.keyboard.press('Control+q');
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('q');
  await page.waitForFunction(
    (id) => {
      const w = (window as any).__GAME__.world;
      return w.unit(id).rootUntil > w.tick;
    },
    initial.ids.dragon,
    { timeout: 10000 }
  );
  await page.keyboard.press('s');
  const peaceful = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(id);
    g.setPaused(true);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      hp: w.hero.hp,
      maxHp: w.hero.maxHp,
      release: u.releaseTick,
      cycle: u.attackCycle,
      flee: u.monster.scuttle.fleeUntil,
      tick: w.tick,
    };
  }, initial.ids.dragon);
  expect(peaceful.hp).toBe(peaceful.maxHp);
  expect(peaceful.release).toBeNull();
  expect(peaceful.cycle).toBeNull();
  expect(peaceful.flee).toBeGreaterThan(peaceful.tick);
  await page.screenshot({ path: 'artifacts/scuttler-flee.png' });
  await page.keyboard.press('Escape');
  const fleeing = await save();
  await reload(fleeing);
  const shrine = await page.evaluate(async (id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      { shrinePoint } = await import('/src/simulation/scuttler.ts');
    w.damage(w.hero, w.unit(id), 99999, 'true');
    const point = shrinePoint('dragon', w.battlefield);
    Object.assign(w.hero, point, { previous: { ...point } });
    w.setOrder(w.hero, { type: 'idle' });
    w.step();
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      cs: w.player.cs,
      initialDeaths: w.scuttlers.initialDeaths,
      pending: w.scuttlers.pending,
      other: w.scuttlers.unitIds.baron,
      speed: w.movementSpeed(w.hero),
      base: w.hero.speed,
      shrines: w.scuttlers.shrines.length,
      visible: w.pointVisible(point),
    };
  }, initial.ids.dragon);
  expect(shrine.cs).toBe(4);
  expect(shrine.initialDeaths).toBe(1);
  expect(shrine.pending).toBeNull();
  expect(shrine.other).toBe(initial.ids.baron);
  expect(shrine.shrines).toBe(1);
  expect(shrine.visible).toBe(true);
  expect(shrine.speed).toBeCloseTo(shrine.base * 1.3);
  await expect(page.locator('#ms')).toHaveText(String(Math.round(shrine.speed)));
  expect(await gpu(null)).toBeGreaterThan(50);
  const shrineSave = await save();
  await reload(shrineSave);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/scuttler-shrine.png' });
  await page.keyboard.press('Escape');
  const waiting = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, w.battlefield.spawns.blue);
    w.step(120);
    const unboosted = w.movementSpeed(w.hero) === w.hero.speed;
    w.damage(w.hero, w.unit(w.scuttlers.unitIds.baron), 99999, 'true');
    w.step(100);
    return {
      unboosted,
      ids: { ...w.scuttlers.unitIds },
      pending: { ...w.scuttlers.pending },
      oldGone: !w.units.some((u: any) => u.kind === 'monster' && u.monster.species === 'scuttler'),
      cs: w.player.cs,
    };
  });
  expect(waiting.unboosted).toBe(true);
  expect(waiting.ids).toEqual({ dragon: null, baron: null });
  expect(waiting.oldGone).toBe(true);
  expect(waiting.pending.side).not.toBe('both');
  expect(waiting.cs).toBe(8);
  const pending = await save();
  await reload(pending);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const fresh = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      { SCUTTLER_POLICY: P } = await import('/src/content/scuttler-policy.ts'),
      { shrinePoint } = await import('/src/simulation/scuttler.ts');
    g.setPaused(true);
    const side = w.scuttlers.pending.side;
    w.tick = w.scuttlers.pending.readyTick - P.leadupTicks - 1;
    w.step(P.leadupTicks + 10);
    const ids = Object.values(w.scuttlers.unitIds).filter((id) => id !== null),
      u = w.unit(ids[0]);
    const point = shrinePoint(side, w.battlefield);
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      id: u.id,
      count: ids.length,
      side,
      river: u.monster.scuttle.river,
      hp: u.hp,
      maxHp: u.maxHp,
      rig: g.view.models.get(u.id).referenceAsset,
      shrines: w.scuttlers.shrines.length,
    };
  });
  expect(fresh.count).toBe(1);
  expect(fresh.side).toBe(fresh.river);
  expect(Object.values(initial.ids)).not.toContain(fresh.id);
  expect(fresh.hp).toBe(fresh.maxHp);
  expect(fresh.rig).toBe('sru-crab-base');
  expect(fresh.shrines).toBe(0);
  await page.screenshot({ path: 'artifacts/scuttler-later-river.png' });
  expect(errors).toEqual([]);
});
