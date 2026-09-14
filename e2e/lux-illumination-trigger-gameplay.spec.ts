import { expect, test } from '@playwright/test';

test('consumed mark renders the saved detonation and resumes identical geometry after loading', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('champion', 'red', { x: 200, y: 0 }, 'ashe');
    target.hp = target.maxHp = 5000;
    for (const u of w.units) w.setOrder(u, { type: 'idle' });
    w.applyIllumination(lux, target);
    w.enqueue({ type: 'order', unit: lux.id, order: { type: 'attack', target: target.id } });
    for (let i = 0; i < 60 && !w.luxIlluminationVisuals.length; i++) w.step();
    w.setOrder(lux, { type: 'idle' });
    w.setOrder(target, { type: 'move', point: { x: 600, y: 0 } });
    w.step(7);
    v.center = { x: target.x, y: target.y };
    v.zoom = 0.55;
    const render = () => v.render(w, 1, v.previousElapsed);
    render();
    const id = w.luxIlluminationVisuals[0].id;
    const sample = () =>
      v.luxIlluminationTriggers.clouds
        .get(id)
        .cloud.meshes.map((m: any) => ({
          name: m.name,
          count: m.geometry.drawRange.count,
          positions: [...m.geometry.attributes.position.array],
        }));
    const first = sample(),
      saved = w.snapshot();
    Object.assign(w, w.constructor.fromSnapshot(saved, w.battlefield));
    render();
    return {
      first,
      restored: sample(),
      id,
      target: target.id,
      lux: lux.id,
      marks: w.unit(target.id).illumination.length,
      rig: v.luxIlluminationTriggers.clouds.get(id).rig,
    };
  });
  expect(result.first.map((m: any) => m.name)).toEqual([
    'innerring',
    'outerring',
    'sparks',
    'motes',
    'rays',
  ]);
  expect(result.first.every((m: any) => m.count > 0)).toBe(true);
  expect(result.restored).toEqual(result.first);
  expect(result.marks).toBe(0);
  expect(result.rig).toBe('ashe-base');
  await page.screenshot({ path: 'artifacts/browser-lux-illumination-trigger-gameplay.png' });
  const lifecycle = await page.evaluate(({ id, target, lux }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      render = () => v.render(w, 1, v.previousElapsed);
    const sources = [w.hero, w.unit(lux)].map((u: any) => ({
      u,
      x: u.x,
      y: u.y,
      previous: u.previous,
    }));
    for (const { u } of sources)
      Object.assign(u, { x: -10000, y: -10000, previous: { x: -10000, y: -10000 } });
    render();
    const hidden = v.luxIlluminationTriggers.clouds.get(id).cloud.root.visible;
    for (const { u, x, y, previous } of sources) Object.assign(u, { x, y, previous });
    render();
    const revealed = v.luxIlluminationTriggers.clouds.get(id).cloud.root.visible;
    w.damage(w.hero, w.unit(target), 1e6, 'true');
    w.step();
    render();
    const survivedDeath = v.luxIlluminationTriggers.clouds.has(id);
    const saved = w.snapshot();
    // A terminal scene must drain presentation without advancing the saved match.
    w.winner = 'blue';
    const terminalSaved = w.snapshot();
    v.luxIlluminationTriggers.update(w, 1, v.camera, 2);
    const terminal = {
      clouds: v.luxIlluminationTriggers.clouds.size,
      unchanged: w.snapshot() === terminalSaved,
    };
    w.winner = null;
    w.step(110);
    render();
    return {
      hidden,
      revealed,
      survivedDeath,
      terminal,
      events: w.luxIlluminationVisuals.length,
      clouds: v.luxIlluminationTriggers.clouds.size,
      saved: !!saved,
    };
  }, result);
  expect(lifecycle).toEqual({
    hidden: false,
    revealed: true,
    survivedDeath: true,
    terminal: { clouds: 0, unchanged: true },
    events: 0,
    clouds: 0,
    saved: true,
  });
  expect(errors).toEqual([]);
});

test('a detonation hidden at creation remains absent after gaining sight', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('dummy', 'red', { x: 3000, y: 0 });
    target.hp = target.maxHp = 5000;
    w.applyIllumination(lux, target);
    w.releaseFinalSpark(lux, { x: 0, y: 0 }, { x: 3340, y: 0 }, 100);
    const audience = w.luxIlluminationVisuals[0].audience;
    Object.assign(lux, { x: 2900, y: 0, previous: { x: 2900, y: 0 } });
    w.step(7);
    v.render(w, 1, v.previousElapsed);
    return { audience, visible: w.visible(target), clouds: v.luxIlluminationTriggers.clouds.size };
  });
  expect(result).toEqual({ audience: ['red'], visible: true, clouds: 0 });
});
