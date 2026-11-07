import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('keyboard W loads only joined assets and restores orbit, flight and hit drawings', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-w-')) requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriWParticles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 300, y: -225, previous: { x: 300, y: -225 }, ai: false });
    const target = w.spawn('champion', 'red', { x: 600, y: -450 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.learnSpell('w');
    v.zoom = 0.6;
    v.recenter({ x: 420, y: -315 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriWVisuals.length) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    g.setPaused(false);
    return v.screenPoint({ x: 600, y: -450 });
  });
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('w');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriWVisuals.length))
    .toBe(1);
  const orbit = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const seen = new Set<number>();
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
      surfaces: [...v.ahriWParticles.surfaces.models]
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
            unboundPalette: m.userData.unboundPalette,
            soft: !!m.material.uniforms.softDepth,
          };
        }),
      ribbons: [...v.ahriWParticles.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          const count = m.geometry.drawRange.count;
          return {
            key,
            profile: m.userData.profileIndex,
            count,
            positions: digest(m.geometry.getAttribute('position'), count),
            erosion: digest(m.geometry.getAttribute('sourceErosion'), count),
            tint: digest(m.geometry.getAttribute('sourceTint'), count),
          };
        }),
    });
    const r = w.ahriWVisuals[0],
      draws = [];
    for (const offset of [4, 11, 19]) {
      w.step(r.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(capture());
    }
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    g.__wCapture = capture;
    g.__wSeen = seen;
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      placeholder: v.foxFireModels.size,
      startTick: r.startTick,
    };
  });
  expect(orbit.unchanged).toBe(true);
  expect(orbit.restored).toEqual(orbit.before);
  expect(orbit.before.surfaces.length).toBeGreaterThan(0);
  expect(orbit.placeholder).toBe(0);
  await page.screenshot({ path: info.outputPath('ahri-w-orbit.png') });
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      r = w.ahriWVisuals[0],
      draws = [];
    for (const offset of [27, 34]) {
      w.step(r.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(g.__wCapture());
    }
    const saved = w.snapshot(),
      before = g.__wCapture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = g.__wCapture();
    v.render(w, 1, v.previousElapsed);
    return { draws, before, restored, unchanged: copy.snapshot() === saved };
  });
  expect(flight.unchanged).toBe(true);
  expect(flight.restored).toEqual(flight.before);
  expect(flight.before.ribbons.length).toBeGreaterThan(0);
  expect(flight.before.surfaces.some((m: any) => m.colors === 209 && !m.normals)).toBe(true);
  await page.screenshot({ path: info.outputPath('ahri-w-flight.png') });
  const hit = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      r = w.ahriWVisuals[0],
      draws = [];
    for (const offset of [39, 44, 49, 54, 64, 84, 104]) {
      w.step(r.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(g.__wCapture());
    }
    const saved = w.snapshot(),
      before = g.__wCapture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = g.__wCapture();
    v.render(w, 1, v.previousElapsed);
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      seen: [...g.__wSeen].sort((a: any, b: any) => a - b),
      ends: r.fires.map((f: any) => f.end?.reason),
    };
  });
  expect(hit.unchanged).toBe(true);
  expect(hit.restored).toEqual(hit.before);
  expect(hit.seen).toEqual(Array.from({ length: 23 }, (_, i) => i + 7));
  expect(hit.ends).toEqual(['hit', 'hit', 'hit']);
  expect(new Set(requests).size).toBe(25);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('evidence.json'),
    JSON.stringify({ orbit, flight, hit, requests, errors }, null, 2)
  );
});

test('a real practice-brush W birth stays hidden until its flight leaves the brush', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriWParticles.ready);
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
    Object.assign(w.hero, { x: -350, y: -50, previous: { x: -350, y: -50 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 }, 'ahri');
    enemy.ai = false;
    w.learnSpell('w', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: { x: -820, y: -50 } });
    w.step(15);
    v.zoom = 0.65;
    v.recenter({ x: -580, y: -50 });
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriWVisuals[0];
    const hidden = {
      insideBrush: w.battlefield.inBrush(enemy),
      heroOutside: !w.battlefield.inBrush(w.hero),
      blueBirths: r.fires.filter((f: any) => f.birth.audience.includes('blue')).length,
      surfaces: v.ahriWParticles.surfaces.models.size,
      ribbons: v.ahriWParticles.models.size,
    };
    let entered = false;
    while (w.tick < r.startTick + 90) {
      w.step();
      if (
        w.ahriFoxFires.some((c: any) =>
          c.fires.some((f: any) => f.phase === 'flight' && w.pointVisible(f.position, 'blue'))
        )
      ) {
        entered = true;
        break;
      }
    }
    w.step(6);
    v.render(w, 1, v.previousElapsed);
    const visible = {
      entered,
      surfaces: v.ahriWParticles.surfaces.models.size,
      ribbons: v.ahriWParticles.models.size,
      unseen: r.fires.flatMap((f: any) => f.frames).filter((f: any) => !f.audience.includes('blue'))
        .length,
      seen: r.fires.flatMap((f: any) => f.frames).filter((f: any) => f.audience.includes('blue'))
        .length,
      visiblePoints: [...v.ahriWParticles.models.values()].map(
        (m: any) => m.userData.visiblePoints
      ),
    };
    return { hidden, visible };
  });
  expect(result.hidden).toEqual({
    insideBrush: true,
    heroOutside: true,
    blueBirths: 0,
    surfaces: 0,
    ribbons: 0,
  });
  expect(result.visible.entered).toBe(true);
  expect(result.visible.surfaces).toBeGreaterThan(0);
  expect(result.visible.unseen).toBeGreaterThan(0);
  expect(result.visible.seen).toBeGreaterThan(0);
  expect(result.visible.ribbons).toBeGreaterThan(0);
  expect(result.visible.visiblePoints.every((n: number) => n >= 2)).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('hidden-entry.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('committed W survives caster Flash and death, then terminal drawings drain without ticking World', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriWParticles.ready);
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
    const target = w.spawn('champion', 'red', { x: 400, y: 1000 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: 0, y: 1000 } });
    w.step(30);
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriWVisuals[0],
      saved = w.snapshot();
    const before = {
      flight: w.ahriFoxFires[0].fires.some((f: any) => f.phase === 'flight'),
      draws: v.ahriWParticles.surfaces.models.size + v.ahriWParticles.models.size,
    };
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: w.summonerSlot('flash'),
      point: { x: -300, y: 1000 },
    });
    w.step();
    const flashed = w.hero.x;
    w.damage(target, w.hero, 1e6, 'true');
    while (r.fires.some((f: any) => !f.end) && w.tick < r.startTick + 300) w.step();
    v.render(w, 1, v.previousElapsed);
    const dead = { hp: w.hero.hp, ends: r.fires.map((f: any) => f.end?.reason) };
    w.step(300);
    v.render(w, 1, v.previousElapsed);
    const drained = {
      surfaces: v.ahriWParticles.surfaces.models.size,
      ribbons: v.ahriWParticles.models.size,
    };
    const terminal = w.constructor.fromSnapshot(saved, w.battlefield);
    const nexus = terminal.spawn('nexus', 'red', { x: 1500, y: 1500 });
    terminal.damage(terminal.hero, nexus, 1e6, 'true');
    const snapshot = terminal.snapshot();
    v.render(terminal, 1, v.previousElapsed);
    v.ahriWParticles.update(terminal, 1, v.camera, 6);
    return {
      before,
      flashed,
      dead,
      drained,
      terminal: {
        unchanged: terminal.snapshot() === snapshot,
        surfaces: v.ahriWParticles.surfaces.models.size,
        ribbons: v.ahriWParticles.models.size,
      },
    };
  });
  expect(result.before.flight).toBe(true);
  expect(result.before.draws).toBeGreaterThan(0);
  expect(result.flashed).toBe(-300);
  expect(result.dead.hp).toBe(0);
  expect(result.dead.ends).toEqual(['hit', 'hit', 'hit']);
  expect(result.drained).toEqual({ surfaces: 0, ribbons: 0 });
  expect(result.terminal).toEqual({ unchanged: true, surfaces: 0, ribbons: 0 });
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('lifecycle.json'), JSON.stringify({ result, errors }, null, 2));
});

test('a roster without Ahri does not request W resources', async ({ page }) => {
  test.setTimeout(180000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-w-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&champion=lux');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.view.ahriWParticles.ready)).toBe(false);
  expect(requests).toEqual([]);
});
