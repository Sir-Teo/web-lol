import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('profile viewport counting excludes depth-visible projected anchors outside the screen', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const path = '/tools/qa/viewport-visibility.mjs';
    const { anchorInsideViewport } = await import(path);
    const projections = [
      [v.width / 2, v.height / 2],
      [-40, v.height / 2],
      [v.width + 40, v.height / 2],
      [v.width / 2, -40],
      [v.width / 2, v.height + 40],
    ].map(([x, y]) => {
      const point = v.worldPoint(x, y);
      if (!point) throw Error('Expected a ground projection');
      return v.screenPoint(point);
    });
    return {
      depthOnly: projections.filter((p: any) => p.visible).length,
      insideViewport: projections.filter((p: any) => anchorInsideViewport(p, v.width, v.height))
        .length,
      projections,
    };
  });
  expect(result.depthOnly).toBe(5);
  expect(result.insideViewport).toBe(1);
  await writeFile(info.outputPath('viewport-counting.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: info.outputPath('viewport-profile.png') });
});
