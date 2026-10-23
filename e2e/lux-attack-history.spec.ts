import { expect, test } from '@playwright/test';

test('browser checkpoints retain Lux homing history in flight and after impact', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  const save = async () => {
    const button = page.getByRole('button', { name: 'Save match', exact: true });
    if (!(await button.isVisible())) await page.keyboard.press('Escape');
    await button.click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  };
  await page.goto('/?scene=fixture');
  await ready();
  const start = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
    w.setOrder(lux, { type: 'idle' });
    if (w.luxAttackVisuals.length !== 1) throw new Error('Expected a real released Lux attack');
    const snapshot = w.snapshot();
    w.step(20);
    const continued = w.snapshot();
    Object.assign(w, w.constructor.fromSnapshot(snapshot, w.battlefield));
    return { snapshot, continued };
  });
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(4);
    g.view.center = { x: w.hero.x + 200, y: w.hero.y };
    g.view.zoom = 0.55;
    g.view.render(w, 1, 0);
    const id = w.luxAttackVisuals[0].id;
    return {
      placeholder: g.view.projectileModels.has(id),
      crescents: g.view.luxAttackCrescents.clouds.get(id).mesh.count,
    };
  });
  expect(flight.placeholder).toBe(false);
  expect(flight.crescents).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/lux-basic-gameplay-flight.png' });
  await page.evaluate((snapshot) => {
    const w = (window as any).__GAME__.world;
    Object.assign(w, w.constructor.fromSnapshot(snapshot, w.battlefield));
  }, start.snapshot);
  await save();
  await page.reload();
  await ready();
  const impact = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const before = w.snapshot();
    w.step(20);
    return {
      before,
      after: w.snapshot(),
      stop: w.luxAttackVisuals[0]?.stopTick,
      projectiles: w.projectiles.length,
      impacts: structuredClone(w.luxImpactVisuals),
    };
  });
  expect(impact.before).toBe(start.snapshot);
  expect(impact.after).toBe(start.continued);
  expect(impact.projectiles).toBe(0);
  expect(impact.stop).toBeGreaterThan(0);
  expect(impact.impacts).toHaveLength(1);
  expect(impact.impacts[0].startTick).toBe(impact.stop);
  expect(impact.impacts[0].critical).toBe(false);
  expect(impact.impacts[0].frames.length).toBeGreaterThan(1);
  const matrices = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.view.render(g.world, 1, 0);
      return {
        impacts: [...g.view.luxImpacts.clouds.values()].map((c: any) => ({
          rings: c.rings.map((r: any) => ({
            visible: r.mesh.visible,
            position: r.mesh.position.toArray(),
            quaternion: r.mesh.quaternion.toArray(),
            scale: r.mesh.scale.toArray(),
            color: r.mesh.material.uniforms.particleColor.value.toArray(),
          })),
          count: c.sparks.mesh.count,
          matrices: [...c.sparks.mesh.instanceMatrix.array],
          tint: [...c.sparks.mesh.geometry.attributes.particleTint.array],
        })),
        hoops: [...g.view.luxAttackHoops.clouds.values()].map((cloud: any) => ({
          count: cloud.mesh.count,
          matrices: [...cloud.mesh.instanceMatrix.array].slice(0, cloud.mesh.count * 16),
        })),
        crescents: [...g.view.luxAttackCrescents.clouds.values()].map((cloud: any) => ({
          count: cloud.mesh.count,
          matrices: [...cloud.mesh.instanceMatrix.array].slice(0, cloud.mesh.count * 16),
        })),
        ribbons: [...g.view.luxAttackTrails.ribbons.values()].map((r: any) => ({
          count: r.geometry.drawRange.count,
          attributes: Object.fromEntries(
            Object.entries(r.geometry.attributes).map(([name, value]: [string, any]) => [
              name,
              [...value.array].slice(0, r.geometry.drawRange.count * value.itemSize),
            ])
          ),
        })),
      };
    });
  const tail = await matrices();
  expect(tail.impacts).toHaveLength(1);
  expect(tail.impacts[0].rings.filter((r: any) => r.visible)).toHaveLength(2);
  expect(tail.impacts[0].count).toBeGreaterThan(0);
  expect(tail.hoops[0].count).toBeGreaterThan(0);
  expect(tail.ribbons[0].count).toBeGreaterThan(0);
  expect(tail.crescents[0].count).toBeGreaterThan(0);
  const fog = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const effect = w.luxAttackVisuals[0],
      originalTeam = effect.team;
    const visible = w.pointVisible;
    effect.team = 'red';
    w.pointVisible = () => false;
    g.view.luxAttackHoops.update(w, 1, g.view.camera);
    g.view.luxAttackTrails.update(w, 1);
    g.view.luxAttackCrescents.update(w, 1);
    const crescentHidden = g.view.luxAttackCrescents.clouds.get(effect.id).mesh.count;
    const ribbonHidden = g.view.luxAttackTrails.ribbons.get(effect.id).geometry.drawRange.count;
    const hidden = g.view.luxAttackHoops.clouds.get(effect.id).mesh.count;
    w.pointVisible = () => true;
    g.view.luxAttackHoops.update(w, 1, g.view.camera);
    g.view.luxAttackTrails.update(w, 1);
    g.view.luxAttackCrescents.update(w, 1);
    const crescentRevealed = g.view.luxAttackCrescents.clouds.get(effect.id).mesh.count;
    const ribbonRevealed = g.view.luxAttackTrails.ribbons.get(effect.id).geometry.drawRange.count;
    const revealed = g.view.luxAttackHoops.clouds.get(effect.id).mesh.count;
    effect.team = originalTeam;
    w.pointVisible = visible;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.center = { x: effect.frames.at(-1).x - 130, y: effect.frames.at(-1).y };
    g.view.zoom = 0.55;
    g.view.render(w, 1, 0);
    return { hidden, revealed, ribbonHidden, ribbonRevealed, crescentHidden, crescentRevealed };
  });
  expect(fog.hidden).toBe(0);
  expect(fog.crescentHidden).toBe(0);
  expect(fog.crescentRevealed).toBe(tail.crescents[0].count);
  expect(fog.ribbonHidden).toBe(0);
  expect(fog.ribbonRevealed).toBe(tail.ribbons[0].count);
  expect(fog.revealed).toBe(tail.hoops[0].count);
  await page.screenshot({ path: 'artifacts/lux-basic-gameplay.png' });
  await save();
  await page.reload();
  await ready();
  expect(await matrices()).toEqual(tail);
  const end = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const before = w.snapshot();
    w.step(37);
    return { before, count: w.luxAttackVisuals.length };
  });
  expect(end.before).toBe(impact.after);
  expect(end.count).toBe(0);
  expect(await matrices()).toEqual({ hoops: [], ribbons: [], crescents: [], impacts: [] });
  expect(errors).toEqual([]);
});

test('a winning melee hit preserves an unrelated Lux missile tail and a restorable frozen checkpoint', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', { x: w.hero.x + 80, y: w.hero.y }, 'lux');
    const target = w.spawn('dummy', 'red', { x: lux.x + 300, y: lux.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(lux, { type: 'attack', target: target.id });
    for (let i = 0; i < 60 && !w.luxAttackVisuals.length; i++) w.step();
    if (!w.luxAttackVisuals.length) throw new Error('Expected a real released Lux attack');
    w.setOrder(lux, { type: 'idle' });
    w.step(3);
    const previous = structuredClone(w.luxAttackVisuals[0].frames.at(-1));
    const finisher = w.spawn('melee', 'blue', { x: w.hero.x - 200, y: w.hero.y });
    const nexus = w.spawn('nexus', 'red', { x: w.hero.x - 150, y: w.hero.y });
    nexus.hp = 1;
    w.setOrder(finisher, { type: 'attack', target: nexus.id });
    finisher.releaseTick = w.tick + 1;
    finisher.attackTarget = nexus.id;
    const hp = target.hp;
    w.step();
    const saved = w.snapshot();
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    restored.step(60);
    g.view.center = { x: lux.x + 150, y: lux.y };
    g.view.zoom = 0.55;
    g.view.render(w, 1, g.view.previousElapsed);
    const effect = w.luxAttackVisuals[0];
    return {
      winner: w.winner,
      tick: w.tick,
      stop: effect.stopTick,
      frame: effect.frames.at(-1),
      previous,
      projectiles: w.projectiles.length,
      targetUnharmed: target.hp === hp,
      exact: restored.snapshot() === saved,
      tail: g.view.luxAttackCrescents.clouds.get(effect.id)?.mesh.count ?? 0,
    };
  });
  expect(result.winner).toBe('blue');
  expect(result.stop).toBe(result.tick);
  expect(result.frame).toEqual({ ...result.previous, tick: result.tick });
  expect(result.projectiles).toBe(0);
  expect(result.targetUnharmed).toBe(true);
  expect(result.exact).toBe(true);
  expect(result.tail).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
