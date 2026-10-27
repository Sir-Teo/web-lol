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
      .filter(([, m]: any) => m.userData.impactProfileIndex !== undefined)
      .map(([key, m]: any) => ({
        key,
        index: m.userData.impactProfileIndex,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        uvScale: m.material.uniforms.sourceUvScale.value.toArray(),
        uvOffset: m.material.uniforms.sourceUvOffset.value.toArray(),
        ray: m.userData.ownedGeometry
          ? Array.from(m.geometry.getAttribute('position').array)
          : null,
        packetColor: Array.from(m.geometry.getAttribute('_source_vertex_bgra')?.array ?? []),
        packetNormalized: m.geometry.getAttribute('_source_vertex_bgra')?.normalized ?? null,
        attachment: m.userData.attachment,
      }));
  });
}

test('all seven real Q contact layers reload exactly, survive later movement/death and retire owned rays/materials', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const contact = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(90);
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    target.hp = 1;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    w.step(w.hero.releaseTick - w.tick + 7);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      hp: target.hp,
      impact: w.player.garenQVisuals[0].attacks[0].impact,
      tick: w.tick,
      ground: g.view.ground(target),
    };
  });
  expect(contact.hp).toBeLessThanOrEqual(0);
  expect(contact.tick - contact.impact.tick).toBe(7);
  const first = await poses(page);
  expect([...new Set(first.map((m) => m.index))].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(first.filter((m) => m.ray)).toHaveLength(2);
  // Independently check contact-space placement and the ray's authored +Z axis.
  // Its negative-Z travel moves the origin without reversing the ray.
  const facing = contact.impact.facing,
    point = contact.impact.point;
  const flash = first.find((m) => m.index === 1)!;
  expect(flash.position[0]).toBeCloseTo(point.x * 0.01 + 0.2 * Math.sin(facing));
  expect(flash.position[1]).toBeCloseTo(contact.ground + 0.1);
  expect(flash.position[2]).toBeCloseTo(point.y * 0.01 + 0.2 * Math.cos(facing));
  const ray = first.find((m) => m.index === 3)!;
  expect(ray.packetColor).toHaveLength(24);
  expect(ray.packetNormalized).toBe(true);
  expect(ray.packetColor.some((v) => v !== 0)).toBe(true);
  expect(ray.color).toEqual([1, 1, 1, 1]);
  expect(ray.position[0]).toBeCloseTo(point.x * 0.01 - 0.84 * Math.sin(facing));
  expect(ray.position[1]).toBeCloseTo(contact.ground);
  expect(ray.position[2]).toBeCloseTo(point.y * 0.01 - 0.84 * Math.cos(facing));
  const vertices = ray.ray as number[],
    axis = [0, 1, 2].map((i) => vertices[6 + i] - vertices[3 + i]),
    length = Math.hypot(...axis);
  expect(axis[0] / length).toBeCloseTo(Math.sin(facing));
  expect(axis[1] / length).toBeCloseTo(0);
  expect(axis[2] / length).toBeCloseTo(Math.cos(facing));
  expect(first.every((m) => m.attachment === 'local-confirmed-contact-ground')).toBe(true);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.camera.zoom = 2.5;
    g.view.camera.updateProjectionMatrix();
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-q-impact.png' });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await poses(page)).toEqual(first);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    Object.assign(w.hero, { x: 1000, y: 2000, previous: { x: 1000, y: 2000 }, facing: 2.3 });
    const target = w.unit(w.player.garenQVisuals[0].attacks[0].targetId);
    Object.assign(target, { x: -2000, y: 500, previous: { x: -2000, y: 500 } });
    w.damage(target, w.hero, 1e6, 'true');
  });
  expect(await poses(page)).toEqual(first);
  const retirement = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    let materials = 0,
      rays = 0,
      shared = 0;
    const meshes = [...g.view.garenDecisiveStrike.models.values()].filter(
      (m: any) => m.userData.impactProfileIndex !== undefined
    ) as any[];
    meshes.forEach((m) => {
      m.material.addEventListener('dispose', () => materials++);
      m.geometry.addEventListener('dispose', () => (m.userData.ownedGeometry ? rays++ : shared++));
    });
    w.step(80);
    g.view.render(w, 1, g.view.previousElapsed);
    return { materials, rays, shared, error: g.view.renderer.getContext().getError() };
  });
  expect(retirement).toEqual({ materials: first.length, rays: 2, shared: 0, error: 0 });
  expect(await poses(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('enemy impact remains visible with a hidden caster and reconstructs its aging phase through actual fog', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('q', enemy.id);
    const target = w.spawn('dummy', 'blue', { x: 150, y: 0 });
    target.hp = 1;
    w.setOrder(enemy, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step();
    w.step(enemy.releaseTick - w.tick + 4);
    const meshes = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.impactProfileIndex !== undefined
      ) as any[];
    g.view.render(w, 1, g.view.previousElapsed);
    const first = meshes().length,
      phase = meshes().find((m) => m.userData.impactProfileIndex === 1).material.uniforms.lookupUv
        .value.x;
    Object.assign(enemy, { x: 3000, y: 0, previous: { x: 3000, y: 0 } });
    w.setOrder(enemy, { type: 'idle' });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const casterVisible = w.visible(enemy),
      withoutCaster = meshes().length;
    let disposed = 0,
      rayDisposed = 0;
    meshes().forEach((m) => {
      m.material.addEventListener('dispose', () => disposed++);
      if (m.userData.ownedGeometry) m.geometry.addEventListener('dispose', () => rayDisposed++);
    });
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = meshes().length;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = meshes(),
      newPhase = revealed.find((m) => m.userData.impactProfileIndex === 1)?.material.uniforms
        .lookupUv.value.x;
    return {
      first,
      phase,
      casterVisible,
      withoutCaster,
      hidden,
      disposed,
      rayDisposed,
      revealed: revealed.length,
      newPhase,
      casterStillHidden: !w.visible(enemy),
      error: g.view.renderer.getContext().getError(),
    };
  });
  expect(result.first).toBeGreaterThan(10);
  expect(result.casterVisible).toBe(false);
  expect(result.withoutCaster).toBeGreaterThan(10);
  expect(result.hidden).toBe(0);
  expect(result.disposed).toBe(result.withoutCaster);
  expect(result.rayDisposed).toBe(2);
  expect(result.revealed).toBeGreaterThan(10);
  expect(result.newPhase - result.phase).toBeCloseTo(3 / (60 * 0.8500000238418579));
  expect(result.casterStillHidden).toBe(true);
  expect(result.error).toBe(0);
});

test('target loss produces no contact layers; a real match-ending contact finishes under the frozen clock', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.damage(w.hero, target, 1e6, 'true');
    w.step(90);
    const count = () =>
      [...g.view.garenDecisiveStrike.models.values()].filter(
        (m: any) => m.userData.impactProfileIndex !== undefined
      ).length;
    g.view.render(w, 1, g.view.previousElapsed);
    const missing = count();
    const nexus = w.spawn('nexus', 'red', { x: 100, y: 0 });
    nexus.hp = 1;
    w.setOrder(w.hero, { type: 'attack', target: nexus.id });
    w.step();
    w.step(w.hero.releaseTick - w.tick);
    const saved = w.snapshot();
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models, 7 / 60);
    const end = count();
    w.step(100);
    g.view.garenDecisiveStrike.update(w, 1, g.view.camera, g.view.models, 2);
    return {
      missing,
      end,
      final: count(),
      unchanged: w.snapshot() === saved,
      winner: w.winner,
      impact: w.player.garenQVisuals[0].attacks.at(-1).impact,
    };
  });
  expect(result.missing).toBe(0);
  expect(result.winner).toBe('blue');
  expect(result.impact).not.toBeNull();
  expect(result.end).toBeGreaterThan(10);
  expect(result.final).toBe(0);
  expect(result.unchanged).toBe(true);
});
