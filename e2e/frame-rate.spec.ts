import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('HUD measures slow presentation in wall time without extending simulation catch-up', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    (window as any).__GAME__.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      renderer = g.view.renderer,
      originalNow = Object.getOwnPropertyDescriptor(performance, 'now'),
      originalLoop = renderer.setAnimationLoop;
    let now = performance.now(),
      callback: ((time: number) => void) | null = null;
    renderer.setAnimationLoop = (next: typeof callback) => {
      callback = next;
    };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    const labels: string[] = [],
      advances: number[] = [];
    const paint = () => {
      const before = g.world.tick;
      now += 250;
      if (!callback) throw new Error('Expected an active presentation callback');
      callback(now);
      advances.push(g.world.tick - before);
      labels.push(document.querySelector('#fps')!.textContent!);
    };
    try {
      g.setPaused(false);
      for (let i = 0; i < 5; i++) paint();
      const active = labels.at(-1);
      g.setPaused(true);
      paint();
      const pausedTick = g.world.tick;
      now += 60000;
      g.repaint();
      paint();
      const paused = document.querySelector('#fps')!.textContent;
      if (g.world.tick !== pausedTick) throw new Error('Paused repaint advanced the match');
      g.setPaused(false);
      for (let i = 0; i < 3; i++) paint();
      return { active, paused, resumed: labels.at(-1), advances, labels };
    } finally {
      g.setPaused(true);
      renderer.setAnimationLoop = originalLoop;
      if (originalNow) Object.defineProperty(performance, 'now', originalNow);
      else delete (performance as any).now;
    }
  });
  expect(result.active).toBe('4 FPS');
  expect(result.paused).toBe('4 FPS');
  expect(result.resumed).toBe('4 FPS');
  expect(result.advances.every((ticks) => ticks >= 0 && ticks <= 6)).toBe(true);
  expect(result.advances.slice(5, 7)).toEqual([0, 0]);
  await writeFile(info.outputPath('frame-rate.json'), JSON.stringify(result, null, 2));
});
