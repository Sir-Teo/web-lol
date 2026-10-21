import { expect, test } from '@playwright/test';

test('a real shielded attack creates one rotating Courage reaction that survives recast, death and save/reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const contact = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'ashe');
    enemy.nextThink = Infinity;
    enemy.damage = 10;
    w.setOrder(enemy, { type: 'attack', target: w.hero.id });
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    let steps = 0;
    while (!w.player.garenWDeflects.length && steps++ < 100) w.step();
    const contact = {
      steps,
      hp: w.hero.hp,
      maxHp: w.hero.maxHp,
      shield: w.shieldAmount(w.hero),
      reactions: [...w.player.garenWDeflects],
    };
    w.setOrder(enemy, { type: 'idle' });
    w.step(2);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    const mesh = [...g.view.garenCourage.models.values()].find(
      (m: any) => m.name === 'Garen W deflect 0 shield'
    ) as any;
    const first = mesh.quaternion.toArray();
    w.step(5);
    g.view.render(w, 1, g.view.previousElapsed);
    const rotated = mesh.quaternion.toArray();
    w.player.cooldowns.w = 0;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(2);
    g.view.render(w, 1, g.view.previousElapsed);
    const survivedRecast = [...g.view.garenCourage.models.values()].includes(mesh);
    // True damage must not manufacture an additional damage-reduction reaction.
    w.damage(enemy, w.hero, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      ...contact,
      first,
      rotated,
      survivedRecast,
      bone: mesh.userData.attachment,
      color: mesh.material.uniforms.particleColor.value.toArray(),
      history: w.player.garenWDeflects,
    };
  });
  expect(contact.steps).toBeLessThan(45);
  expect(contact.hp).toBe(contact.maxHp);
  expect(contact.shield).toBeGreaterThan(0);
  expect(contact.reactions).toHaveLength(1);
  expect(contact.history).toEqual(contact.reactions);
  expect(contact.first).not.toEqual(contact.rotated);
  expect(contact.survivedRecast).toBe(true);
  expect(contact.bone.toLowerCase()).toBe('c_buffbone_glb_center_loc');
  expect(contact.color[3]).toBeCloseTo(0.8);
  await page.screenshot({ path: 'artifacts/browser-garen-courage-deflect.png' });
  const poses = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return [...g.view.garenCourage.models.entries()]
      .filter(([, m]: any) => m.name.includes('deflect'))
      .map(([key, m]: any) => ({
        key,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
      }));
  });
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
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    const snapshot = w.snapshot();
    let disposed = 0,
      geometryDisposed = 0;
    const poses = [...g.view.garenCourage.models.entries()]
      .filter(([, m]: any) => m.name.includes('deflect'))
      .map(([key, m]: any) => {
        m.material.addEventListener('dispose', () => disposed++);
        m.geometry.addEventListener('dispose', () => geometryDisposed++);
        return {
          key,
          position: m.position.toArray(),
          rotation: m.quaternion.toArray(),
          scale: m.scale.toArray(),
          color: m.material.uniforms.particleColor.value.toArray(),
          lookup: m.material.uniforms.lookupUv.value.toArray(),
        };
      });
    w.step(60);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      snapshot,
      poses,
      disposed,
      geometryDisposed,
      history: w.player.garenWDeflects,
      remaining: [...g.view.garenCourage.models.values()].filter((m: any) =>
        m.name.includes('deflect')
      ).length,
    };
  });
  expect(restored.snapshot).toBe(saved);
  expect(restored.poses).toEqual(poses);
  expect(restored.disposed).toBe(1);
  expect(restored.geometryDisposed).toBe(0);
  expect(restored.history).toEqual([]);
  expect(restored.remaining).toBe(0);
  expect(errors).toEqual([]);
});

test('enemy Courage reactions obey caster fog, preserve independent hit clocks and finish after defense expiry', async ({
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
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('w', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step(2);
    const state = w.championState(enemy.id),
      expiry = state.garenW.defenseUntil;
    w.step(expiry - 2 - w.tick);
    w.damage(w.hero, enemy, 10, 'physical');
    w.damage(w.hero, enemy, 10, 'magic');
    w.step();
    w.damage(w.hero, enemy, 10, 'magic');
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const draws = () =>
        [...g.view.garenCourage.models.values()].filter((m: any) =>
          m.name.includes('deflect')
        ) as any[],
      before = draws();
    let disposed = 0;
    before.forEach((m) => m.material.addEventListener('dispose', () => disposed++));
    const ticks = state.garenWDeflects.map((r: any) => r.tick);
    w.damage(w.hero, enemy, 10, 'physical');
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = draws().length;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = draws().length;
    w.step(60);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      before: before.length,
      hidden,
      revealed,
      disposed,
      ticks,
      expiry,
      after: draws().length,
      history: state.garenWDeflects,
    };
  });
  expect(result.before).toBe(2);
  expect(result.ticks).toEqual([result.expiry - 2, result.expiry - 1]);
  expect(result.hidden).toBe(0);
  expect(result.disposed).toBe(2);
  expect(result.revealed).toBe(2);
  expect(result.after).toBe(0);
  expect(result.history).toEqual([]);
});

test('Courage reactions end on terminal presentation time while their accepted simulation history stays frozen', async ({
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
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(2);
    w.damage(w.hero, w.hero, 10, 'physical');
    w.step(2);
    const nexus = w.spawn('nexus', 'red', { x: 3000, y: 0 });
    w.damage(w.hero, nexus, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const draws = () =>
        [...g.view.garenCourage.models.values()].filter((m: any) => m.name.includes('deflect'))
          .length,
      before = draws(),
      snapshot = w.snapshot();
    g.view.render(w, 1, g.view.previousElapsed + 2);
    return {
      before,
      after: draws(),
      unchanged: snapshot === w.snapshot(),
      history: w.player.garenWDeflects.length,
    };
  });
  expect(result.before).toBe(1);
  expect(result.after).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.history).toBe(1);
});
