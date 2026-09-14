import { expect, test } from '@playwright/test';
test('interrupted three-layer fades survive paused renders, isolated sampling and browser reload', async ({
  page,
}) => {
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture');
  await ready();
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x + 1000, y: w.hero.y } });
    w.step(3);
    w.setOrder(w.hero, { type: 'idle' });
    w.step();
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 100, y: w.hero.y });
    target.hp = target.maxHp = 5000;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step(2);
  });
  const pose = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.view.render(w, 1, g.view.previousElapsed + 10);
      const model = g.view.models.get(w.hero.id);
      model.root.updateMatrixWorld(true);
      return {
        actions: Object.entries(model.actions)
          .filter(([, a]: [string, any]) => a.isScheduled() && a.getEffectiveWeight() > 0)
          .map(([name, a]: [string, any]) => ({
            name,
            time: a.time,
            weight: a.getEffectiveWeight(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        matrix: model.root.getObjectByName('C_BUFFBONE_GLB_CHEST_LOC').matrixWorld.toArray(),
        snapshot: w.snapshot(),
      };
    });
  const before = await pose();
  expect(before.actions).toHaveLength(3);
  expect(await pose()).toEqual(before);
  const error = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { TargetPoseSampler } = await import('/src/render/target-pose-sampler.ts');
    const { animationLayers } = await import('/src/simulation/animation-timeline.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      model = g.view.models.get(w.hero.id);
    const gltf = await new GLTFLoader().loadAsync('/assets/models/ashe-base.glb');
    const sampler = new TargetPoseSampler(gltf.scene, gltf.animations);
    sampler.sample(animationLayers(w.hero.animationTimeline, w.tick, model.clipDurations));
    const position = new THREE.Vector3();
    sampler.hitPosition(true, position);
    model.root.localToWorld(position);
    const live = new THREE.Vector3();
    model.root.getObjectByName('C_BUFFBONE_GLB_CHEST_LOC').getWorldPosition(live);
    sampler.dispose();
    return position.distanceTo(live);
  });
  expect(error).toBeLessThan(1e-7);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await pose()).toEqual(before);
});
