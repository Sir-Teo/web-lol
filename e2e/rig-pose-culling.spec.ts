import { expect, test } from '@playwright/test';

test('offscreen minions and structures sleep, keep shadow/mark poses live, and reconstruct on camera return', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    v.renderer.setAnimationLoop(null);
    // Extend only the diagnostic view's pan limits so it can return to rigs
    // placed beyond the fixed directional shadow volume. Gameplay is unchanged.
    v.battlefield = { ...v.battlefield, half: 14000 };
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    const minion = w.spawn('caster', 'blue', { x: 10000, y: 10000 });
    minion.ai = false;
    const tower = w.units.find((u: any) => u.kind === 'turret' && u.team === 'blue');
    const targets = [minion, tower];
    const place = (x: number, y: number) =>
      targets.forEach((u: any, i: number) => {
        Object.assign(u, { x: x + i * 600, y, previous: { x: x + i * 600, y } });
      });
    place(10000, 10000);
    v.locked = false;
    v.center = { x: 0, y: 0 };
    const render = (alpha = 1) => v.render(w, alpha, w.time);
    render();
    const counts = [0, 0];
    targets.forEach((u: any, i: number) => {
      const mixer = v.models.get(u.id).mixer;
      const update = mixer.update;
      mixer.update = function (...args: any[]) {
        counts[i]++;
        return update.apply(this, args);
      };
    });
    let preserved = true;
    for (let i = 0; i < 20; i++) {
      w.step(6);
      const before = w.snapshot();
      render((i % 4) / 4);
      preserved &&= w.snapshot() === before;
    }
    const sleeping = [...counts];
    minion.illumination.push({ sourceId: w.hero.id, endTick: w.tick + 60 });
    render();
    const marked = counts[0] - sleeping[0];
    minion.illumination = [];
    minion.sunlight = { sourceId: w.hero.id, startTick: w.tick, endTick: w.tick + 60 };
    render();
    const sunlit = counts[0] - sleeping[0] - marked;
    minion.sunlight = null;
    // The display camera stays far away while the light can see both casters.
    place(1000, 1000);
    v.center = { x: 10000, y: 10000 };
    const beforeShadow = [...counts];
    render();
    const shadow = counts.map((n, i) => n - beforeShadow[i]);
    place(10000, 10000);
    v.center = { x: 0, y: 0 };
    w.step(180);
    render();
    const beforeReveal = [...counts];
    v.center = { x: 10300, y: 10000 };
    render(0.75);
    const reveal = counts.map((n, i) => n - beforeReveal[i]);
    const matrices = () =>
      targets.map((u: any) => {
        const values: number[] = [];
        v.models.get(u.id).root.traverse((node: any) => {
          if (node.isBone) values.push(...node.matrixWorld.elements);
        });
        return values;
      });
    const pixels = () => {
      const gl = v.renderer.getContext();
      const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data
      );
      return data;
    };
    const currentMatrices = matrices(),
      currentPixels = pixels(),
      beforeFresh = w.snapshot();
    const { makeModel, disposeModel } = await import('/src/render/models.ts');
    const originals = targets.map((u: any) => v.models.get(u.id));
    for (const u of targets) {
      v.scene.remove(v.models.get(u.id).root);
      v.models.set(u.id, makeModel(u));
    }
    // New rigs take the full absolute pose path, independently of sleeping mixers.
    render(0.75);
    const referencePixels = pixels();
    let pixelDifferences = 0;
    for (let i = 0; i < currentPixels.length; i++)
      if (currentPixels[i] !== referencePixels[i]) pixelDifferences++;
    const bonesEqual = JSON.stringify(currentMatrices) === JSON.stringify(matrices());
    preserved &&= beforeFresh === w.snapshot();
    originals.forEach(disposeModel);
    return { sleeping, marked, sunlit, shadow, reveal, pixelDifferences, bonesEqual, preserved };
  });
  expect(result.sleeping).toEqual([0, 0]);
  expect(result.marked).toBe(1);
  expect(result.sunlit).toBe(1);
  expect(result.shadow).toEqual([1, 1]);
  expect(result.reveal).toEqual([1, 1]);
  expect(result.pixelDifferences).toBe(0);
  expect(result.bonesEqual).toBe(true);
  expect(result.preserved).toBe(true);
});
