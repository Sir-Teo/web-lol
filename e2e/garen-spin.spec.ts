import { expect, test } from '@playwright/test';

test('Judgment draws source layers, hides enemy particles, restores tails and disposes stopped draws', async ({
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
  const source = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step(480);
    w.events = [];
    w.learnSpell('e');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
    w.step(75);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const draws = [...g.view.garenSpin.models.values()] as any[];
    return {
      names: [...new Set(draws.map((m) => m.name))],
      meshVertices: draws
        .filter((m) => m.name.endsWith('_mesh'))
        .map((m) => m.geometry.getAttribute('position').count),
      loaded: draws.every(
        (m) => m.material.uniforms.sourceTexture.value.image.width > 0 && m.material.forceSinglePass
      ),
      finite: draws.every((m) =>
        [...m.position, ...m.quaternion, ...m.scale].every(Number.isFinite)
      ),
      count: draws.length,
      glows: draws
        .filter((m) => m.name.endsWith('ground_glow'))
        .map((m) => ({
          name: m.name,
          scale: m.scale.toArray(),
          pass: m.renderOrder,
          lookup: m.material.uniforms.lookupUv.value.toArray(),
          lookupWidth: m.material.uniforms.particleColorTexture.value.image.width,
          color: m.material.uniforms.particleColor.value.toArray(),
        })),
    };
  });
  expect(source.names.sort()).toEqual(
    ['Outer_mesh', 'inner_mesh', 'edge', 'Top_Down_base', 'ground_glow', 'ground_glow']
      .map((n, i) => `Garen Judgment ${i} ${n}`)
      .sort()
  );
  expect(source.count).toBeGreaterThan(5);
  expect(source.meshVertices.every((n) => n === 3672)).toBe(true);
  expect(source.loaded && source.finite).toBe(true);
  expect(source.glows.length).toBeGreaterThanOrEqual(2);
  for (const glow of source.glows) {
    expect(glow.lookupWidth).toBe(64);
    expect(glow.lookup[0]).toBeGreaterThan(0);
    expect(glow.lookup[0]).toBeLessThan(1);
    expect(glow.lookup[1]).toBe(1);
    expect(glow.pass).toBe(-100);
    expect(glow.color).toEqual([1, 1, 1, 1]);
    expect(glow.scale).toEqual(Array(3).fill(glow.name.includes(' 4 ') ? 0.01 : 1.5));
  }
  await page.screenshot({ path: 'artifacts/browser-garen-judgment-source.png' });
  const visibility = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 4000, y: 0 }, 'garen');
    w.learnSpell('e', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'e', point: enemy });
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = [...g.view.garenSpin.models.keys()].some((k: any) =>
      k.startsWith(`${enemy.id}:`)
    );
    Object.assign(enemy, { x: 200, y: 0, previous: { x: 200, y: 0 } });
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = [...g.view.garenSpin.models.keys()].some((k: any) =>
      k.startsWith(`${enemy.id}:`)
    );
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const tail = [...g.view.garenSpin.models.keys()].filter((k: any) =>
      k.startsWith(`${w.hero.id}:`)
    ).length;
    return { hidden, revealed, tail, stopTick: w.player.garenEVisual.stopTick };
  });
  expect(visibility.hidden).toBe(false);
  expect(visibility.revealed).toBe(true);
  expect(visibility.tail).toBeGreaterThan(0);
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
    const tailDraws = [...g.view.garenSpin.models.entries()].filter(([k]: any) =>
      k.startsWith(`${w.hero.id}:`)
    ) as any[];
    let disposed = 0;
    for (const [, mesh] of tailDraws) mesh.material.addEventListener('dispose', () => disposed++);
    const snapshot = w.snapshot();
    w.step(60);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      snapshot,
      before: tailDraws.length,
      disposed,
      after: [...g.view.garenSpin.models.keys()].filter((k: any) => k.startsWith(`${w.hero.id}:`))
        .length,
      visual: w.player.garenEVisual,
    };
  });
  expect(restored.snapshot).toBe(saved);
  expect(restored.before).toBe(visibility.tail);
  expect(restored.disposed).toBe(restored.before);
  expect(restored.after).toBe(0);
  expect(restored.visual).toBeNull();
  expect(errors).toEqual([]);
});
