import { expect, test } from '@playwright/test';

test('base Ashe uses the pinned source rig and complete atomic animation set', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    v.recenter(g.world.hero);
    v.zoom = 0.6;
    v.resize();
    v.render(g.world, 1, 0);
    const model = v.models.get(g.world.hero.id);
    let mesh: any;
    model.root.traverse((o: any) => {
      if (o.isSkinnedMesh) mesh = o;
    });
    const manifest = await (await fetch('/assets/models/ashe-base.json')).json();
    return {
      asset: model.referenceAsset,
      clips: Object.keys(model.actions).sort(),
      manifestClips: manifest.clips.map((c: any) => c.name).sort(),
      bones: mesh.skeleton.bones.length,
      triangles: mesh.geometry.index.count / 3,
      skinScale: manifest.skinScale,
      unitScale: manifest.unitScale,
      attackDuration: model.actions.attack1.getClip().duration,
      runDuration: model.actions.run.getClip().duration,
    };
  });
  expect(result.asset).toBe('ashe-base');
  expect(result.clips).toEqual(result.manifestClips);
  expect(result.clips).toHaveLength(25);
  expect(result.clips).toEqual(
    expect.arrayContaining(['run', 'run2', 'run3', 'crit', 'spell4', 'spell1_in', 'channel_wndup'])
  );
  expect(result.bones).toBe(85);
  expect(result.triangles).toBe(7406);
  expect(result.skinScale).toBeCloseTo(1.1);
  expect(result.unitScale).toBeCloseTo(0.011);
  expect(result.attackDuration).toBeCloseTo(2.1);
  expect(result.runDuration).toBeCloseTo(7.166667);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/browser-ashe-base.png' });
});
