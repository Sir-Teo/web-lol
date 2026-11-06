import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('keyboard Q loads the verified projectile pack and draws both saved phases with identical restored packets', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-q-projectile-')) requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.waitForFunction(() => (window as any).__GAME__.view.ahriQProjectiles.ready);
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.learnSpell('q');
    g.view.zoom = 0.6;
    g.view.recenter({ x: 450, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriQProjectileVisuals.length) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    const point = g.view.screenPoint({ x: 650, y: 0 });
    g.setPaused(false);
    return point;
  });
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('q');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriQProjectileVisuals.length))
    .toBe(1);
  const outward = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const r = w.ahriQProjectileVisuals[0],
      seen = new Set<number>();
    const digest = (attr: any, count: number) => {
      const bytes = new Uint8Array(
        attr.array.buffer,
        attr.array.byteOffset,
        count * attr.itemSize * 4
      );
      let hash = 2166136261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return (hash >>> 0).toString(16);
    };
    const capture = () => ({
      surfaces: [...v.ahriQProjectiles.surfaces.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          return {
            key,
            profile: m.userData.profileIndex,
            position: m.position.toArray(),
            scale: m.scale.toArray(),
            uv: m.material.uniforms.sourceUvTransform.value.toArray(),
            mips: m.material.uniforms.sourceTexture.value.mipmaps.length,
            colors: m.geometry.getAttribute('_source_vertex_bgra')?.count ?? 0,
            normals: !!m.geometry.getAttribute('normal'),
          };
        }),
      ribbons: [...v.ahriQProjectiles.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          return {
            key,
            profile: m.userData.profileIndex,
            count: m.geometry.drawRange.count,
            smoothing: m.userData.sourceSmoothing,
            position: digest(m.geometry.getAttribute('position'), m.geometry.drawRange.count),
            erosion: digest(m.geometry.getAttribute('sourceErosion'), m.geometry.drawRange.count),
            mult: digest(m.geometry.getAttribute('sourceMultUv'), m.geometry.drawRange.count),
          };
        }),
    });
    const draws = [];
    for (const offset of [1, 4, 14, 24]) {
      w.step(r.launchTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(capture());
    }
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    g.__qProjectileCapture = capture;
    g.__qProjectileSeen = seen;
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      launchTick: r.launchTick,
      frames: r.frames.length,
      placeholder: [...v.projectileModels.values()].some(
        (m: any) => m.name === 'Ahri Q development orb'
      ),
    };
  });
  expect(outward.unchanged).toBe(true);
  expect(outward.restored).toEqual(outward.before);
  expect(outward.before.ribbons.length).toBe(5);
  expect(outward.before.surfaces.length).toBeGreaterThan(0);
  expect(outward.placeholder).toBe(false);
  const indicator = outward.before.surfaces.find((m: any) => m.profile === 9)!;
  const sphere = outward.before.surfaces.find((m: any) => m.profile === 14);
  expect(indicator.colors).toBe(150);
  expect(indicator.normals).toBe(false);
  if (sphere) expect(sphere.colors).toBe(0);
  await page.screenshot({ path: info.outputPath('ahri-q-outward.png') });
  const returning = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      r = w.ahriQProjectileVisuals[0],
      draws = [];
    while (!r.turn) w.step();
    for (const offset of [1, 8, 12, 20, 28]) {
      w.step(r.turn.tick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(g.__qProjectileCapture());
    }
    const saved = w.snapshot(),
      before = g.__qProjectileCapture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = g.__qProjectileCapture();
    v.render(w, 1, v.previousElapsed);
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      turnTick: r.turn.tick,
      turnPoint: r.turn.point,
      seen: [...g.__qProjectileSeen].sort((a: any, b: any) => a - b),
    };
  });
  expect(returning.unchanged).toBe(true);
  expect(returning.restored).toEqual(returning.before);
  expect(returning.before.ribbons).toHaveLength(5);
  expect(returning.seen).toEqual(Array.from({ length: 36 }, (_, i) => i));
  await page.screenshot({ path: info.outputPath('ahri-q-return.png') });
  expect(new Set(requests).size).toBe(17);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('evidence.json'),
    JSON.stringify({ outward, returning, requests, errors }, null, 2)
  );
});

test('a genuine hidden enemy missile enters sight without replaying unseen trail births', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriQProjectiles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    Object.assign(w.hero, { x: 0, y: 1000, previous: { x: 0, y: 1000 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    const enemy = w.spawn('champion', 'red', { x: -2000, y: 1000 }, 'ahri');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: { x: -1000, y: 1000 } });
    w.step(17);
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriQProjectileVisuals[0];
    const hidden = {
      audience: r.birthAudience,
      surfaces: v.ahriQProjectiles.surfaces.models.size,
      ribbons: v.ahriQProjectiles.models.size,
    };
    let entered = false;
    while (w.ahriOrbs.length && w.tick < r.launchTick + 45) {
      const orb = w.ahriOrbs[0];
      if (w.pointVisible(orb.position, 'blue')) {
        entered = true;
        break;
      }
      w.step();
    }
    v.render(w, 1, v.previousElapsed);
    const visible = {
      entered,
      tick: w.tick,
      surfaces: v.ahriQProjectiles.surfaces.models.size,
      audience: r.birthAudience,
      unseenFrames: r.frames.filter((f: any) => !f.audience.includes('blue')).length,
      seenFrames: r.frames.filter((f: any) => f.audience.includes('blue')).length,
    };
    return { hidden, visible };
  });
  expect(result.hidden).toEqual({ audience: ['red'], surfaces: 0, ribbons: 0 });
  expect(result.visible.entered).toBe(true);
  expect(result.visible.surfaces).toBeGreaterThan(0);
  expect(result.visible.audience).toEqual(['red']);
  expect(result.visible.unseenFrames).toBeGreaterThan(0);
  expect(result.visible.seenFrames).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('hidden-entry.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('real return Flash and death remain finite and victory drains without World mutation', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriQProjectiles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    w.learnSpell('q');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: { x: 900, y: 0 } });
    w.step(90);
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriQProjectileVisuals[0],
      saved = w.snapshot();
    const before = {
      turn: !!r.turn,
      draws: v.ahriQProjectiles.surfaces.models.size + v.ahriQProjectiles.models.size,
    };
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: w.summonerSlot('flash'),
      point: { x: -300, y: 0 },
    });
    w.step();
    v.render(w, 1, v.previousElapsed);
    const flashed = { x: w.hero.x, target: r.frames.at(-1).sourcePoint };
    const enemy = w.spawn('champion', 'red', { x: 3000, y: 0 }, 'lux');
    enemy.ai = false;
    w.damage(enemy, w.hero, 1e6, 'true');
    while (!r.end && w.tick < r.launchTick + 300) w.step();
    v.render(w, 1, v.previousElapsed);
    const dead = { hp: w.hero.hp, reason: r.end?.reason, point: r.end?.point };
    w.step(360);
    v.render(w, 1, v.previousElapsed);
    const drained = {
      surfaces: v.ahriQProjectiles.surfaces.models.size,
      ribbons: v.ahriQProjectiles.models.size,
    };
    const terminal = w.constructor.fromSnapshot(saved, w.battlefield);
    const nexus = terminal.spawn('nexus', 'red', { x: 1500, y: 1500 });
    terminal.damage(terminal.hero, nexus, 1e6, 'true');
    const snapshot = terminal.snapshot();
    v.render(terminal, 1, v.previousElapsed);
    v.ahriQProjectiles.update(terminal, 1, v.camera, 7);
    return {
      before,
      flashed,
      dead,
      drained,
      victory: terminal.winner,
      terminalReason: terminal.ahriQProjectileVisuals[0].end?.reason,
      terminalDrained: {
        surfaces: v.ahriQProjectiles.surfaces.models.size,
        ribbons: v.ahriQProjectiles.models.size,
      },
      unchanged: terminal.snapshot() === snapshot,
    };
  });
  expect(result.before.turn).toBe(true);
  expect(result.before.draws).toBeGreaterThan(0);
  expect(result.flashed).toEqual({ x: -300, target: { x: -300, y: 0 } });
  expect(result.dead.hp).toBe(0);
  expect(result.dead.reason).toBe('caught');
  expect(result.dead.point).toEqual({ x: -300, y: 0 });
  expect(result.drained).toEqual({ surfaces: 0, ribbons: 0 });
  expect(result.victory).toBe('blue');
  expect(result.terminalReason).toBe('match-end');
  expect(result.terminalDrained).toEqual({ surfaces: 0, ribbons: 0 });
  expect(result.unchanged).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('flash-death-victory.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('ordinary rosters make no projectile pack requests', async ({ page }) => {
  test.setTimeout(120000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-q-projectile-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(60);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  expect(requests).toEqual([]);
});
