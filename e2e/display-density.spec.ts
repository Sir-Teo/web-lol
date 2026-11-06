import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ deviceScaleFactor: 2 });
test('display-density changes resize the framebuffer without shifting input projection', async ({
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
    const describe = () => {
      const point = v.screenPoint(g.world.hero, 0.65);
      return {
        ratio: v.renderer.getPixelRatio(),
        width: v.renderer.domElement.width,
        height: v.renderer.domElement.height,
        point,
        picked: v.pick(g.world, point.x, point.y)?.id,
        cssWidth: v.width,
        cssHeight: v.height,
      };
    };
    const before = describe();
    const density = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')!;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    window.dispatchEvent(new Event('resize'));
    const lowerDensity = describe();
    Object.defineProperty(window, 'devicePixelRatio', density);
    window.dispatchEvent(new Event('resize'));
    return { before, lowerDensity, restored: describe(), heroId: g.world.hero.id };
  });
  expect(result.before.ratio).toBe(1.75);
  expect(result.lowerDensity.ratio).toBe(1);
  expect(result.lowerDensity.width).toBe(result.lowerDensity.cssWidth);
  expect(result.lowerDensity.height).toBe(result.lowerDensity.cssHeight);
  expect(result.restored.ratio).toBe(1.75);
  expect(result.restored.width).toBe(result.before.width);
  expect(result.restored.height).toBe(result.before.height);
  expect(result.lowerDensity.point).toEqual(result.before.point);
  expect(result.restored.point).toEqual(result.before.point);
  for (const state of [result.before, result.lowerDensity, result.restored])
    expect(state.picked).toBe(result.heroId);
  await writeFile(info.outputPath('display-density.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: info.outputPath('display-density.png') });
});
