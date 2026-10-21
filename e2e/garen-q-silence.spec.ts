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
    return [...g.view.garenDecisiveStrike.models.values()]
      .filter((m: any) => m.userData.silence)
      .map((m: any) => ({
        source: m.userData.sourceId,
        target: m.userData.targetId,
        start: m.userData.startTick,
        end: m.userData.endTick,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        uvScale: m.material.uniforms.sourceUvScale.value.toArray(),
        uvOffset: m.material.uniforms.sourceUvOffset.value.toArray(),
        depth: m.material.depthTest,
        attachment: m.userData.attachment,
      }));
  });
}
test('the source silence icon follows its living recipient, restores the original phase and ends at Q expiry despite longer generic silence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const first = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.learnSpell('q');
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.step(w.hero.releaseTick - w.tick + 10);
    w.setOrder(w.hero, { type: 'idle' });
    w.applySilence(target, 300);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      end: w.player.garenQVisuals[0].attacks[0].silenceEndTick,
      global: target.silenceUntil,
      ground: g.view.ground(target),
    };
  });
  const before = await poses(page);
  expect(before).toHaveLength(1);
  expect(first.global).toBeGreaterThan(first.end);
  expect(before[0].position).toEqual([1.1, first.ground + 1.55 + 0.55, 0]);
  expect(before[0]).toMatchObject({
    uvScale: [0.5, 0.5],
    uvOffset: [0, 0],
    depth: false,
    attachment: 'local-health-bar-plus-source-offset',
  });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.camera.zoom = 2.5;
    g.view.camera.updateProjectionMatrix();
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-q-silence.png' });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await poses(page)).toEqual(before);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.unit(w.player.garenQVisuals[0].attacks[0].targetId);
    Object.assign(target, { x: 200, y: 80, previous: { x: 200, y: 80 }, facing: 2 });
  });
  const moved = (await poses(page))[0];
  expect(moved.position[0] - before[0].position[0]).toBeCloseTo(1);
  expect(moved.position[2] - before[0].position[2]).toBeCloseTo(0.8);
  expect(moved.rotation).toEqual(before[0].rotation);
  const camera = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const mesh = [...g.view.garenDecisiveStrike.models.values()].find(
      (m: any) => m.userData.silence
    ) as any;
    const old = mesh.quaternion.clone();
    g.view.camera.rotateY(0.4);
    g.view.garenDecisiveStrike.update(g.world, 1, g.view.camera, g.view.models);
    return mesh.quaternion.angleTo(old);
  });
  expect(camera).toBeCloseTo(0.4);
  const expired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const mesh = [...g.view.garenDecisiveStrike.models.values()].find(
      (m: any) => m.userData.silence
    ) as any;
    let material = 0,
      geometry = 0;
    mesh.material.addEventListener('dispose', () => material++);
    mesh.geometry.addEventListener('dispose', () => geometry++);
    w.step(mesh.userData.endTick - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      material,
      geometry,
      shared: w.unit(mesh.userData.targetId).silenceUntil > w.tick,
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(expired).toEqual({ material: 1, geometry: 0, shared: true, error: 0 });
  expect(await poses(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('enemy Q silence is visible on a friendly victim with a hidden/dead caster and disappears on victim death without respawn replay', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'garen');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    w.setOrder(enemy, { type: 'attack', target: w.hero.id });
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step();
    w.step(enemy.releaseTick - w.tick + 8);
    const icon = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.silence
      ) as any[];
    Object.assign(enemy, { x: 3000, y: 0, previous: { x: 3000, y: 0 } });
    w.setOrder(enemy, { type: 'idle' });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hiddenCaster = !w.visible(enemy),
      before = icon().length;
    w.damage(w.hero, enemy, 1e6, 'true');
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const afterCaster = icon().length;
    w.damage(enemy, w.hero, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const afterVictim = icon().length;
    w.step(1000);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      hiddenCaster,
      before,
      afterCaster,
      afterVictim,
      respawned: w.hero.deadAt === null,
      afterRespawn: icon().length,
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(result).toEqual({
    hiddenCaster: true,
    before: 1,
    afterCaster: 1,
    afterVictim: 0,
    respawned: true,
    afterRespawn: 0,
    error: 0,
  });
});

test('two real Q sources coalesce one recipient icon through actual fog, hand off original clocks and stop at match end', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      ally = w.spawn('champion', 'blue', { x: 0, y: 80 }, 'garen'),
      target = w.spawn('champion', 'red', { x: 100, y: 0 }, 'garen');
    ally.ai = target.ai = false;
    w.learnSpell('q');
    w.learnSpell('q', ally.id);
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.step(w.hero.releaseTick - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    w.step(20);
    w.setOrder(ally, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: ally.id, ability: 'q', point: ally });
    w.step();
    w.step(ally.releaseTick - w.tick + 8);
    w.setOrder(ally, { type: 'idle' });
    const icons = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.silence
      ) as any[];
    g.view.render(w, 1, g.view.previousElapsed);
    const initial = icons().length,
      first = icons()[0],
      owner = first.userData.sourceId,
      phase = first.material.uniforms.lookupUv.value.x;
    let disposed = 0;
    first.material.addEventListener('dispose', () => disposed++);
    for (const u of [w.hero, ally])
      Object.assign(u, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = icons().length;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = icons().length,
      revealedPhase = icons()[0].material.uniforms.lookupUv.value.x;
    const end = w.player.garenQVisuals[0].attacks[0].silenceEndTick;
    w.step(end - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const handoff = icons().map((m) => ({ source: m.userData.sourceId, end: m.userData.endTick }));
    w.damage(w.hero, w.spawn('nexus', 'red', { x: 500, y: 0 }), 1e6, 'true');
    const saved = w.snapshot();
    g.view.render(w, 1, g.view.previousElapsed);
    const terminal = icons().length;
    w.step(200);
    return {
      initial,
      owner,
      hero: w.hero.id,
      ally: ally.id,
      hidden,
      disposed,
      revealed,
      phase,
      revealedPhase,
      handoff,
      terminal,
      unchanged: w.snapshot() === saved,
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(result.initial).toBe(1);
  expect(result.owner).toBe(result.hero);
  expect(result.hidden).toBe(0);
  expect(result.disposed).toBe(1);
  expect(result.revealed).toBe(1);
  expect(result.revealedPhase - result.phase).toBeCloseTo(2 / 600);
  expect(result.handoff).toHaveLength(1);
  expect(result.handoff[0].source).toBe(result.ally);
  expect(result.terminal).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.error).toBe(0);
});
