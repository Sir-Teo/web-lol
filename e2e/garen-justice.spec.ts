import { expect, test } from '@playwright/test';

test('Demacian Justice draws source cast, sword and impact layers and restores a killing release after caster death', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step(480);
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.events = [];
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.hp = 1;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
    w.step();
    g.view.recenter({ x: 125, y: 0 });
    const start = w.tick,
      names = new Set<string>();
    let finite = true,
      loaded = true,
      bone = '',
      multiplier = false;
    for (const delta of [17, 24, 29, 38]) {
      w.step(start + delta - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      for (const mesh of g.view.garenJustice.models.values()) {
        names.add(mesh.name);
        finite &&= [...mesh.position, ...mesh.quaternion, ...mesh.scale].every(Number.isFinite);
        loaded &&= mesh.material.uniforms.sourceTexture.value.image.width > 0;
        if (mesh.name.includes('cast')) bone = mesh.userData.attachment;
        if (mesh.name.includes('sword_base_fade'))
          multiplier =
            mesh.material.uniforms.multiplierTexture.value.image.width === 256 &&
            mesh.material.uniforms.multiplierUvOffset.value.y < 0;
      }
    }
    return {
      names: [...names].sort(),
      finite,
      loaded,
      bone,
      multiplier,
      targetDead: target.deadAt,
      release: w.player.garenRVisual.releaseTick,
    };
  });
  expect(state.names).toHaveLength(19);
  expect(state.names).toContain('Garen R impact 3 ground_decal');
  expect(state.names).toContain('Garen R sword 1 sword_drop');
  expect(state.names).toContain('Garen R kill 0 shockwave');
  expect(state.names).toContain('Garen R kill 1 fireLine');
  expect(state.names).toContain('Garen R kill 2 flash');
  expect(state.names.some((n) => n.includes('distort'))).toBe(false);
  expect(state.finite && state.loaded && state.multiplier).toBe(true);
  expect(state.bone.toLowerCase()).toBe('c_buffbone_glb_layout_loc');
  expect(state.targetDead).toBe(state.release);
  await page.screenshot({ path: 'artifacts/browser-garen-justice-impact.png' });
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const killer = w.spawn('champion', 'red', { x: 2000, y: 0 }, 'ashe');
    w.damage(killer, w.hero, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const draws = [...g.view.garenJustice.models.values()] as any[];
    return {
      count: draws.length,
      release: w.player.garenRVisual.releaseTick,
      poses: [...g.view.garenJustice.models.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, m]: any) => ({
          key,
          name: m.name,
          position: m.position.toArray(),
          scale: m.scale.toArray(),
        })),
    };
  });
  expect(tail.count).toBeGreaterThan(10);
  expect(tail.release).toBe(state.release);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.render(w, 1, g.view.previousElapsed);
    const draws = [...g.view.garenJustice.models.values()] as any[];
    let disposed = 0,
      geometryDisposed = 0;
    for (const m of draws) m.material.addEventListener('dispose', () => disposed++);
    const rays = draws.filter((m) => m.userData.ownedGeometry);
    for (const m of rays) m.geometry.addEventListener('dispose', () => geometryDisposed++);
    const snapshot = w.snapshot(),
      poses = [...g.view.garenJustice.models.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, m]: any) => ({
          key,
          name: m.name,
          position: m.position.toArray(),
          scale: m.scale.toArray(),
        }));
    w.step(360);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      snapshot,
      poses,
      disposed,
      geometryDisposed,
      rayCount: rays.length,
      after: g.view.garenJustice.models.size,
      visual: w.player.garenRVisual,
    };
  });
  expect(restored.snapshot).toBe(saved);
  expect(restored.poses).toEqual(tail.poses);
  expect(restored.disposed).toBe(tail.count);
  expect(restored.rayCount).toBe(3);
  expect(restored.geometryDisposed).toBe(3);
  expect(restored.after).toBe(0);
  expect(restored.visual).toBeNull();
  expect(errors).toEqual([]);
});

test('kill rays turn toward the camera with stable buffers; nonfatal, later-death and cancelled casts have no kill draws', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.gainExperience(1e6);
    w.learnSpell('r');
    const cast = (caster: any, target: any) => {
      w.enqueue({
        type: 'cast',
        unit: caster.id,
        ability: 'r',
        targetId: target.id,
        point: target,
      });
      w.step(31);
      g.view.render(w, 1, g.view.previousElapsed);
    };
    const kills = () =>
      [...g.view.garenJustice.models.values()].filter((m: any) =>
        m.name.includes(' kill ')
      ) as any[];
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.hp = target.maxHp = 10000;
    cast(w.hero, target);
    const nonfatal = kills().length;
    const nonfatalReleased = w.player.garenRVisual?.releaseTick != null;
    w.damage(w.hero, target, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const laterDeath = kills().length;
    const canceledCaster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    w.gainExperience(1e6, canceledCaster.id);
    w.learnSpell('r', canceledCaster.id);
    const victim = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    victim.hp = 1;
    w.enqueue({
      type: 'cast',
      unit: canceledCaster.id,
      ability: 'r',
      targetId: victim.id,
      point: victim,
    });
    w.step();
    w.damage(victim, canceledCaster, 1e6, 'true');
    w.step(31);
    g.view.render(w, 1, g.view.previousElapsed);
    const canceled = kills().length;
    const stopped = w.championState(canceledCaster.id).garenRVisual?.stopTick != null;
    const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    w.gainExperience(1e6, caster.id);
    w.learnSpell('r', caster.id);
    victim.hp = 1;
    cast(caster, victim);
    const rays = kills().filter((m) => m.userData.ownedGeometry);
    const geometries = rays.map((m) => m.geometry),
      buffers = rays.map((m) => m.geometry.getAttribute('position').array),
      before = buffers.map((b) => [...b]);
    g.view.locked = false;
    g.view.recenter({ x: 1500, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    const turned = rays.some((m, i) =>
      [...m.geometry.getAttribute('position').array].some(
        (v, j) => Math.abs(Number(v) - before[i][j]) > 1e-5
      )
    );
    const stable = rays.every(
      (m, i) =>
        m.geometry === geometries[i] && m.geometry.getAttribute('position').array === buffers[i]
    );
    const finite = rays.every((m) =>
      [...m.geometry.getAttribute('position').array].every(Number.isFinite)
    );
    return {
      nonfatal,
      nonfatalReleased,
      laterDeath,
      canceled,
      stopped,
      count: rays.length,
      turned,
      stable,
      finite,
    };
  });
  expect(result).toEqual({
    nonfatal: 0,
    nonfatalReleased: true,
    laterDeath: 0,
    canceled: 0,
    stopped: true,
    count: 3,
    turned: true,
    stable: true,
    finite: true,
  });
});

test('enemy R impact visibility follows the frozen release point and expired draws dispose their materials', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, maxHp: 10000, hp: 10000 });
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    const victim = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    victim.hp = 1;
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'r', targetId: victim.id, point: victim });
    w.step(39);
    g.view.render(w, 1, g.view.previousElapsed);
    const count = () =>
      [...g.view.garenJustice.models.keys()].filter((k: any) => k.startsWith(`${enemy.id}:`))
        .length;
    const before = count(),
      originalRays = [...g.view.garenJustice.models.values()].filter(
        (m: any) => m.userData.ownedGeometry
      ) as any[];
    let hiddenRaysDisposed = 0;
    for (const m of originalRays)
      m.geometry.addEventListener('dispose', () => hiddenRaysDisposed++);
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = count();
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const visible = count(),
      draws = [...g.view.garenJustice.models.values()] as any[];
    const newRays = draws.filter((m) => m.userData.ownedGeometry);
    let disposed = 0;
    for (const m of draws) m.material.addEventListener('dispose', () => disposed++);
    w.step(360);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      before,
      hidden,
      visible,
      after: count(),
      disposed,
      draws: draws.length,
      originalRays: originalRays.length,
      hiddenRaysDisposed,
      revealedRays: newRays.length,
      replaced: newRays.every((m) => !originalRays.some((old) => old.geometry === m.geometry)),
    };
  });
  expect(result.before).toBeGreaterThan(10);
  expect(result.hidden).toBe(0);
  expect(result.visible).toBeGreaterThan(0);
  expect(result.after).toBe(0);
  expect(result.disposed).toBe(result.draws);
  expect(result.originalRays).toBe(3);
  expect(result.hiddenRaysDisposed).toBe(3);
  expect(result.revealedRays).toBe(3);
  expect(result.replaced).toBe(true);
});

test('R caster flash and falling sword are visible before damage releases', async ({ page }) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const flash = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.events = [];
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.hp = target.maxHp = 2000;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
    w.step(18);
    g.view.recenter({ x: 125, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      cast: [...g.view.garenJustice.models.values()].filter((m: any) => m.name.includes('cast'))
        .length,
      hp: target.hp,
    };
  });
  expect(flash.cast).toBe(42);
  expect(flash.hp).toBe(2000);
  await page.screenshot({ path: 'artifacts/browser-garen-justice-cast.png' });
  const sword = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(7);
    g.view.render(w, 1, g.view.previousElapsed);
    const mesh = [...g.view.garenJustice.models.values()].find((m: any) =>
      m.name.includes('sword_drop')
    ) as any;
    return {
      height: mesh.position.y,
      scale: mesh.scale.toArray(),
      release: w.player.garenRVisual.releaseTick,
    };
  });
  expect(sword.height).toBeGreaterThan(8);
  expect(sword.scale).toEqual([3.5, 5, 3.5]);
  expect(sword.release).toBeNull();
  await page.screenshot({ path: 'artifacts/browser-garen-justice-sword.png' });
});

test('ordinary Ashe startup skips R assets and a later Garen NPC loads one shared resource set', async ({
  page,
}) => {
  const requests: string[] = [];
  const killTextures: string[] = [];
  const modules: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/src/render/garen-justice.ts')) modules.push(r.url());
    if (r.url().includes('/assets/models/garen-r-')) requests.push(r.url());
    if (/\/assets\/effects\/(garen_alpha_18|garen_base_q_dirt_spike_2)\.png/.test(r.url()))
      killTextures.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(killTextures).toEqual([]);
  expect(modules).toEqual([]);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    g.view.render(w, 1, g.view.previousElapsed);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'r', targetId: w.hero.id, point: w.hero });
    w.step(25);
  });
  await page.waitForFunction(() => (window as any).__GAME__.view.garenJustice.models.size > 0);
  expect(modules).toHaveLength(1);
  expect(requests).toHaveLength(4);
  expect(new Set(requests).size).toBe(4);
  expect(killTextures).toHaveLength(2);
  expect(new Set(killTextures).size).toBe(2);
});
