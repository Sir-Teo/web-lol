import { expect, test } from '@playwright/test';

for (const density of [1, 2])
  test.describe(`opaque battlefield at device scale ${density}`, () => {
    test.use({ deviceScaleFactor: density });
    test('a real subtractive Q decal cannot reveal the page background through its quad', async ({
      page,
    }) => {
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
        const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
        w.learnSpell('q');
        w.setOrder(w.hero, { type: 'attack', target: target.id });
        w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
        w.step();
        w.step(w.hero.releaseTick - w.tick + 10);
        w.setOrder(w.hero, { type: 'idle' });
        g.view.recenter(w.hero);
        g.view.camera.zoom = 2.5;
        g.view.camera.updateProjectionMatrix();
        g.hud.root.querySelector('.welcome')?.remove();
        g.view.render(w, 1, g.view.previousElapsed);
        const decals = [...g.view.garenDecisiveStrike.models.values()].filter(
          (m: any) => m.userData.groundProfileIndex === 4
        ) as any[];
        for (const m of g.view.garenDecisiveStrike.models.values())
          m.visible = m.userData.groundProfileIndex === 4;
        const m = decals[0],
          p = m.position.clone().set(-0.85, -0.85, 0).applyMatrix4(m.matrixWorld),
          canvas = g.view.renderer.domElement.getBoundingClientRect();
        p.project(g.view.camera);
        return {
          count: decals.length,
          alpha: g.view.renderer.getContext().getContextAttributes().alpha,
          clip: {
            x: Math.round(canvas.left + ((p.x + 1) * canvas.width) / 2) - 3,
            y: Math.round(canvas.top + ((1 - p.y) * canvas.height) / 2) - 3,
            width: 6,
            height: 6,
          },
          snapshot: w.snapshot(),
        };
      });
      expect(state.count).toBe(3);
      // Exercise Chrome's page compositor, beyond offscreen particle RGBA probes.
      await page.evaluate(() => (document.body.style.background = '#ff0000'));
      const red = await page.screenshot({ clip: state.clip });
      await page.evaluate(() => (document.body.style.background = '#0000ff'));
      const blue = await page.screenshot({ clip: state.clip });
      expect(blue.equals(red), 'battlefield pixels must be independent of the page matte').toBe(
        true
      );
      expect(state.alpha).toBe(false);
      expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
        state.snapshot
      );
    });
  });

test('unavailable WebGL 2 uses the existing startup failure screen', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      return kind === 'webgl2' ? null : (original as any).call(this, kind, ...args);
    } as any;
  });
  await page.goto('/?scene=fixture');
  await expect(page.getByRole('heading', { name: 'Unable to open the Rift' })).toBeVisible();
  await expect(page.locator('#loading')).toContainText('This game requires WebGL 2.');
  expect(await page.evaluate(() => !!(window as any).__GAME__)).toBe(false);
});
