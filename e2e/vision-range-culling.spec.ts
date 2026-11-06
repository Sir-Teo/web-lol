import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('range-culling visibility matches the original query on every Rift fog sample', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const path = '/src/simulation/vision.ts';
    const { seenFrom } = await import(path);
    const sources = [
      ...w.visionSources(),
      { x: 0, y: 0, radius: 1300 },
      { x: -2000, y: 2000, radius: 1000 },
      { x: 2000, y: -2000, radius: 750, unobstructed: true },
    ];
    let originalRays = 0,
      optimizedRays = 0,
      mismatches = 0,
      visible = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const point = {
          x: ((x + 0.5) / 256 - 0.5) * w.battlefield.half * 2,
          y: ((y + 0.5) / 256 - 0.5) * w.battlefield.half * 2,
        };
        const expected = sources.some(
          (s: any) =>
            Math.hypot(s.x - point.x, s.y - point.y) <= s.radius &&
            (s.unobstructed || (++originalRays && w.battlefield.lineOfSight(s, point)))
        );
        const actual = seenFrom(point, sources, (a: any, b: any) => {
          optimizedRays++;
          return w.battlefield.lineOfSight(a, b);
        });
        if (actual !== expected) mismatches++;
        if (actual) visible++;
      }
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      samples: 65536,
      sources: sources.length,
      mismatches,
      visible,
      originalRays,
      optimizedRays,
    };
  });
  expect(result.mismatches).toBe(0);
  expect(result.visible).toBeGreaterThan(0);
  expect(result.originalRays).toBeGreaterThan(0);
  expect(result.optimizedRays).toBe(result.originalRays);
  await writeFile(info.outputPath('rift-vision-equivalence.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: info.outputPath('rift-vision.png') });
});
