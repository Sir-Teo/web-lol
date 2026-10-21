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
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    g.hud.root.querySelector('.welcome')?.remove();
  });
}
async function poses(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.garenDecisiveStrike.models.entries()]
      .filter(([, m]: any) => m.userData.profileIndex !== undefined)
      .map(([key, m]: any) => ({
        key,
        index: m.userData.profileIndex,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        scroll: m.material.uniforms.sourceUvOffset.value.toArray(),
      }));
  });
}
async function saveReload(page: Page) {
  const save = page.getByRole('button', { name: 'Save match', exact: true });
  if (!(await save.isVisible()))
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await save.click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
}
test('all eight Q cast layers restore their exact early phase and consumed sound/visual tails retire owned materials', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(7);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  const first = await poses(page);
  expect([...new Set(first.map((m: any) => m.index))].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.camera.zoom = 2.5;
    g.view.camera.updateProjectionMatrix();
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-q-cast.png' });
  await saveReload(page);
  expect(await poses(page)).toEqual(first);
  const stop = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.root.querySelector('[data-action="resume"]')?.click();
    g.setPaused(true);
    w.step(80);
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const release = w.hero.releaseTick;
    w.step(release - w.tick + 5);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      reason: w.player.garenQVisuals[0].endReason,
      stop: w.player.garenQVisuals[0].stopTick,
      tick: w.tick,
    };
  });
  expect(stop.reason).toBe('consumed');
  expect(stop.tick - stop.stop).toBe(5);
  const tail = await poses(page);
  expect(tail.length).toBeGreaterThan(0);
  expect(tail.every((m: any) => m.index === 5 || m.index === 6)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-q-cast-tail.png' });
  await saveReload(page);
  expect(await poses(page)).toEqual(tail);
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    let disposed = 0,
      geometryDisposed = 0;
    for (const m of g.view.garenDecisiveStrike.models.values()) {
      if (m.userData.profileIndex === undefined) continue;
      m.material.addEventListener('dispose', () => disposed++);
      m.geometry.addEventListener('dispose', () => geometryDisposed++);
    }
    w.step(100);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      disposed,
      geometryDisposed,
      count: g.view.garenDecisiveStrike.models.size,
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(retired).toEqual({ disposed: tail.length, geometryDisposed: 0, count: 0, error: 0 });
  expect(errors).toEqual([]);
});

test('Q activation layers follow the current root with camera-facing bubbles and independently oriented sword quads/mesh', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    w.hero.facing = 0.6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(10);
    g.view.render(w, 1, g.view.previousElapsed);
    const find = (index: number) =>
      [...g.view.garenDecisiveStrike.models.values()].find(
        (m: any) => m.userData.profileIndex === index
      ) as any;
    const first = [0, 6, 7].map((i) => ({
      position: find(i).position.clone(),
      rotation: find(i).quaternion.clone(),
    }));
    Object.assign(w.hero, { x: 100, y: 0, previous: { x: 100, y: 0 }, facing: 1.6 });
    g.view.render(w, 1, g.view.previousElapsed);
    const translated = [0, 6, 7].map((i, n) => find(i).position.x - first[n].position.x);
    const turned = [0, 6, 7].map((i, n) => find(i).quaternion.angleTo(first[n].rotation));
    const beforeCamera = [0, 6, 7].map((i) => find(i).quaternion.clone());
    g.view.camera.rotateY(0.5);
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models);
    const camera = [0, 6, 7].map((i, n) => find(i).quaternion.angleTo(beforeCamera[n]));
    return { translated, turned, camera, attachment: find(7).userData.attachment };
  });
  result.translated.forEach((v: number) => expect(v).toBeCloseTo(1));
  expect(result.turned[0]).toBeCloseTo(0);
  expect(result.turned[1]).toBeCloseTo(0);
  expect(result.turned[2]).toBeCloseTo(1);
  expect(result.camera[0]).toBeCloseTo(0.5);
  expect(result.camera[1]).toBeCloseTo(0);
  expect(result.camera[2]).toBeCloseTo(0);
  expect(result.attachment).toBe('local-caster-root');
});

test('enemy Q activation obeys actual fog, preserves prior recasts and ends finite death tails', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('q', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step(6);
    g.view.render(w, 1, g.view.previousElapsed);
    const first = [...g.view.garenDecisiveStrike.models.values()] as any[];
    const phase = first.find((m) => m.userData.profileIndex === 0).material.uniforms.lookupUv.value
      .x;
    let disposed = 0;
    first.forEach((m) => m.material.addEventListener('dispose', () => disposed++));
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.garenDecisiveStrike.models.size;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = [...g.view.garenDecisiveStrike.models.values()] as any[];
    const newPhase = revealed.find((m) => m.userData.profileIndex === 0).material.uniforms.lookupUv
      .value.x;
    w.championState(enemy.id).cooldowns.q = 0;
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step(3);
    g.view.render(w, 1, g.view.previousElapsed);
    const casts = [
      ...new Set(
        [...g.view.garenDecisiveStrike.models.values()].map((m: any) => m.userData.castTick)
      ),
    ];
    const reasons = w.championState(enemy.id).garenQVisuals.map((r: any) => r.endReason);
    w.damage(w.hero, enemy, 1e6, 'true');
    w.step(130);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      first: first.length,
      hidden,
      disposed,
      revealed: revealed.length,
      phase,
      newPhase,
      casts,
      reasons,
      count: g.view.garenDecisiveStrike.models.size,
    };
  });
  expect(result.first).toBeGreaterThan(15);
  expect(result.hidden).toBe(0);
  expect(result.disposed).toBe(result.first);
  expect(result.revealed).toBeGreaterThan(15);
  expect(result.newPhase - result.phase).toBeCloseTo(2 / 18);
  expect(result.casts).toHaveLength(2);
  expect(result.reasons).toEqual(['recast', null]);
  expect(result.count).toBe(0);
});

test('a frozen match-end clock cannot replay or retain Q cast effects beyond their bounded tails', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(8);
    w.damage(w.hero, w.spawn('nexus', 'red', { x: 500, y: 0 }), 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const before = g.view.garenDecisiveStrike.models.size;
    const saved = w.snapshot();
    w.step(200);
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models, 3);
    return {
      before,
      reason: w.player.garenQVisuals[0].endReason,
      unchanged: w.snapshot() === saved,
      count: g.view.garenDecisiveStrike.models.size,
    };
  });
  expect(result.before).toBeGreaterThan(10);
  expect(result.reason).toBe('match-end');
  expect(result.unchanged).toBe(true);
  expect(result.count).toBe(0);
});
