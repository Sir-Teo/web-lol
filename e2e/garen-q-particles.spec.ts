import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  });
}
async function poses(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.garenDecisiveStrike.models.entries()].map(([key, m]: any) => ({
      key,
      position: m.position.toArray(),
      rotation: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
      scroll: m.material.uniforms.sourceUvOffset.value.toArray(),
      vertices: m.geometry.getAttribute('position').count,
      bone: m.userData.bone,
    }));
  });
}
test('source Q trail follows frame 8 and its explicit bone, preserves real contact and restores exactly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const hit = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.learnSpell('q');
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    const a = w.player.garenQVisuals[0].attacks[0];
    w.setOrder(w.hero, { type: 'idle' });
    w.step(a.releaseTick + 4 - w.tick);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      impact: a.impact,
      expected: a.releaseTick,
      stop: a.stopTick,
      glError: g.view.renderer.getContext().getError(),
    };
  });
  expect(hit.impact).toMatchObject({ tick: hit.expected, point: { x: 100, y: 0 } });
  expect(hit.stop).toBeNull();
  expect(hit.glError).toBe(0);
  const before = await poses(page);
  expect(before).toHaveLength(2);
  expect(
    before.every((m: any) => m.vertices === 1500 && m.bone === 'C_Buffbone_Glb_Center_Loc')
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-q-trail.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await poses(page)).toEqual(before);
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    let disposed = 0,
      geometryDisposed = 0;
    for (const m of g.view.garenDecisiveStrike.models.values()) {
      m.material.addEventListener('dispose', () => disposed++);
      m.geometry.addEventListener('dispose', () => geometryDisposed++);
    }
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      disposed,
      geometryDisposed,
      count: g.view.garenDecisiveStrike.models.size,
      impact: w.player.garenQVisuals[0].attacks[0].impact,
    };
  });
  expect(retired).toMatchObject({ disposed: 2, geometryDisposed: 0, count: 0, impact: hit.impact });
  expect(errors).toEqual([]);
});

test('Q target loss before frame 8 cannot emit a future trail or manufacture a contact', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.learnSpell('q');
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.damage(w.hero, target, 1e6, 'true');
    w.step(25);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      history: w.player.garenQVisuals[0].attacks[0],
      count: g.view.garenDecisiveStrike.models.size,
    };
  });
  expect(result.count).toBe(0);
  expect(result.history).toMatchObject({ endReason: 'target-lost', impact: null });
});

test('enemy Q trail obeys actual unit fog, resumes its original phase and disposes on pose interruption', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 150, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('q', enemy.id);
    w.setOrder(enemy, { type: 'attack', target: w.hero.id });
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step();
    const a = w.championState(enemy.id).garenQVisuals[0].attacks[0];
    const born = Math.ceil(a.startTick + (a.releaseTick - a.startTick) * 0.8 - 1e-5) + 1;
    w.step(born + 1 - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const original = [...g.view.garenDecisiveStrike.models.values()] as any[];
    let disposed = 0;
    original.forEach((m) => m.material.addEventListener('dispose', () => disposed++));
    const phase = original[0].material.uniforms.lookupUv.value.x;
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    const visible = w.visible(enemy);
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.garenDecisiveStrike.models.size;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const current = [...g.view.garenDecisiveStrike.models.values()] as any[];
    const restoredPhase = current[0].material.uniforms.lookupUv.value.x;
    w.setOrder(enemy, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      original: original.length,
      visible,
      hidden,
      disposed,
      phase,
      restoredPhase,
      count: current.length,
      after: g.view.garenDecisiveStrike.models.size,
      stop: a.endReason,
    };
  });
  expect(result).toMatchObject({
    original: 2,
    visible: false,
    hidden: 0,
    disposed: 2,
    count: 2,
    after: 0,
    stop: 'order',
  });
  expect(result.restoredPhase - result.phase).toBeCloseTo(1 / 15);
});
