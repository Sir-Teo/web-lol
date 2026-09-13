import { expect, test } from '@playwright/test';

test('baked terrain transforms preserve rendered pixels and avoid recomposition', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const root = g.view.scene.getObjectByName('rift-terrain');
    const nodes: any[] = [];
    root.traverse((node: any) => nodes.push(node));
    const originals = nodes.map((node) => node.updateMatrix);
    let compositions = 0;
    nodes.forEach((node, index) => {
      node.updateMatrix = function () {
        compositions++;
        return originals[index].call(this);
      };
    });
    try {
      g.view.render(g.world, 1, g.world.time);
      const baked = g.view.renderer.domElement.toDataURL();
      const bakedCalls = compositions;
      nodes.forEach((node) => {
        node.matrixAutoUpdate = true;
        node.matrixWorldAutoUpdate = true;
      });
      g.view.render(g.world, 1, g.world.time);
      const live = g.view.renderer.domElement.toDataURL();
      return {
        identical: baked === live,
        bakedCalls,
        liveCalls: compositions - bakedCalls,
        nodes: nodes.length,
      };
    } finally {
      nodes.forEach((node, index) => {
        node.updateMatrix = originals[index];
        node.matrixAutoUpdate = false;
        node.matrixWorldAutoUpdate = false;
      });
    }
  });
  expect(result.nodes).toBeGreaterThan(100);
  expect(result.bakedCalls).toBe(0);
  expect(result.liveCalls).toBeGreaterThanOrEqual(result.nodes);
  expect(result.identical).toBe(true);
});
