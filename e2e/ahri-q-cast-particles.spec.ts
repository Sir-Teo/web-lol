import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
test('keyboard Q dispatches delayed source particles with animated Tails and restorable finite clocks', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-q-cast-')) requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.waitForFunction(() => (window as any).__GAME__.view.ahriQCasts.models !== undefined);
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
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriQCastVisuals.length) {
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
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriQCastVisuals.length))
    .toBe(1);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      view = v.ahriQCasts;
    g.setPaused(true);
    const draw = (world = w) => v.render(world, 1, v.previousElapsed),
      capture = () => ({
        roots: [...view.models.values()].map((m: any) => ({
          position: m.root.position.toArray(),
          center: m.center.toArray(),
          skin: m.material.uniforms.particleColor.value.toArray(),
          erosion: m.material.uniforms.erosionParameters.value.toArray(),
          draws: (() => {
            const draws: any[] = [];
            m.sampler.renderRoot.traverse((n: any) => {
              if (n.isMesh) draws.push({ visible: n.visible, name: n.material.name });
            });
            return draws;
          })(),
        })),
        surfaces: [...view.surfaces.models.values()].map((m: any) => ({
          profile: m.userData.profileIndex,
          position: m.position.toArray(),
          uv: m.material.uniforms.sourceUvTransform.value.toArray(),
          mips: m.material.uniforms.sourceTexture.value.mipmaps.length,
          colors: m.geometry.getAttribute('_source_vertex_bgra')?.count ?? 0,
        })),
      });
    const record = w.ahriQCastVisuals[0];
    w.step(record.castTick + 9 - w.tick);
    draw();
    const unborn = capture();
    w.step(7);
    draw();
    const saved = w.snapshot(),
      born = capture();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    draw(copy);
    const restored = capture();
    g.__qCastSaved = saved;
    w.hero.x = 250;
    w.hero.previous.x = 250;
    draw();
    const moved = capture();
    w.hero.x = 0;
    w.hero.previous.x = 0;
    w.step(40);
    draw();
    const skinOnly = capture();
    return {
      unborn,
      born,
      restored,
      moved,
      skinOnly,
      unchanged: copy.snapshot() === saved,
      birth: record.birth,
      castTick: record.castTick,
    };
  });
  expect(result.unborn.roots).toHaveLength(0);
  expect(result.born.roots).toHaveLength(1);
  expect(result.born.surfaces).toHaveLength(2);
  expect(result.birth.tick - result.castTick).toBe(10);
  expect(result.restored).toEqual(result.born);
  expect(result.unchanged).toBe(true);
  expect(result.born.roots[0].draws.filter((d: any) => d.visible)).toEqual([
    { visible: true, name: 'Ahri Q attached Tails' },
  ]);
  expect(result.born.surfaces.map((s: any) => s.mips).sort()).toEqual([7, 8]);
  expect(result.born.surfaces.find((s: any) => s.profile === 1).colors).toBe(603);
  expect(result.moved.roots[0].position[0]).toBe(2.5);
  expect(result.skinOnly.roots).toHaveLength(1);
  expect(result.skinOnly.surfaces).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('ahri-q-cast-tails.png') });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const copy = g.world.constructor.fromSnapshot(g.__qCastSaved, g.world.battlefield);
    g.view.render(copy, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: info.outputPath('ahri-q-cast-all-three.png') });
  const drained = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(240);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      roots: g.view.ahriQCasts.models.size,
      surfaces: g.view.ahriQCasts.surfaces.models.size,
    };
  });
  expect(drained).toEqual({ roots: 0, surfaces: 0 });
  expect(new Set(requests).size).toBe(5);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('evidence.json'),
    JSON.stringify({ result, drained, requests, errors }, null, 2)
  );
});
test('ordinary roster never loads the Ahri Q cast pack', async ({ page }) => {
  test.setTimeout(120000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-q-cast-')) requests.push(r.url());
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

test('real hidden enemy births stay suppressed after reveal and visible births follow Flash then finish after death', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.waitForFunction(() => (window as any).__GAME__.view.ahriQCasts.models !== undefined);
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
    const enemy = w.spawn('champion', 'red', { x: 4000, y: 0 }, 'ahri');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: { x: 4700, y: 0 } });
    w.step(18);
    v.render(w, 1, v.previousElapsed);
    const hidden = {
      audience: w.ahriQCastVisuals[0].birth.audience,
      roots: v.ahriQCasts.models.size,
    };
    w.hero.x = 4000;
    w.hero.previous.x = 4000;
    w.step();
    v.render(w, 1, v.previousElapsed);
    const revealed = v.ahriQCasts.models.size;
    w.hero.x = 0;
    w.hero.previous.x = 0;
    w.enqueue({ type: 'cast', ability: 'q', point: { x: 700, y: 0 } });
    w.step(18);
    v.render(w, 1, v.previousElapsed);
    const visible = v.ahriQCasts.models.size;
    w.enqueue({ type: 'cast', ability: 'd', point: { x: 300, y: 0 } });
    w.step();
    v.render(w, 1, v.previousElapsed);
    const flashed = {
      accepted: w.events.some(
        (e: any) => e.type === 'cast' && e.unit === w.hero.id && e.text === 'd'
      ),
      x: w.hero.x,
      root: [...v.ahriQCasts.models.values()].map((m: any) => m.root.position.x),
    };
    const observer = w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y }, 'lux');
    observer.ai = false;
    w.damage(enemy, w.hero, 1e6, 'true');
    w.step();
    v.render(w, 1, v.previousElapsed);
    const dead = v.ahriQCasts.models.size;
    const before = w.snapshot();
    w.winner = 'blue';
    const terminal = w.snapshot();
    v.ahriQCasts.update(w, 1, v.camera, 4);
    const drained = v.ahriQCasts.models.size,
      unchanged = w.snapshot() === terminal;
    return {
      hidden,
      revealed,
      visible,
      flashed,
      dead,
      drained,
      unchanged,
      deathRecorded: JSON.parse(before).units.find((u: any) => u.id === w.hero.id).hp === 0,
    };
  });
  expect(result.hidden).toEqual({ audience: ['red'], roots: 0 });
  expect(result.revealed).toBe(0);
  expect(result.visible).toBe(1);
  expect(result.flashed.accepted).toBe(true);
  expect(result.flashed.x).toBe(300);
  expect(result.flashed.root).toEqual([3]);
  expect(result.dead).toBe(1);
  expect(result.drained).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.deathRecorded).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('visibility-flash-death.json'), JSON.stringify(result, null, 2));
});
