import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('result presentation follows wall time while simulation and hidden time stay frozen', async ({
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
      w = g.world,
      v = g.view;
    w.units = [w.hero];
    w.nextWaveTick = 1_000_000_000;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', w.hero, 'lux'),
      nexus = w.spawn('nexus', 'red', { x: lux.x + 300, y: lux.y }),
      gate = w.spawn('inhibitor', 'red', { x: lux.x + 600, y: lux.y });
    w.damage(lux, gate, 1e6, 'true');
    nexus.hp = 1;
    w.setOrder(lux, { type: 'attack', target: nexus.id });
    for (let i = 0; i < 120 && !w.winner; i++) w.step();
    if (w.winner !== 'blue' || !w.luxImpactVisuals.length)
      throw new Error('Expected a lethal Lux impact');
    v.render(w, 1, v.previousElapsed);
    const snapshot = w.snapshot(),
      tick = w.tick,
      originalNow = Object.getOwnPropertyDescriptor(performance, 'now'),
      originalLoop = v.renderer.setAnimationLoop;
    let now = performance.now(),
      callback: ((time: number) => void) | null = null;
    v.renderer.setAnimationLoop = (next: typeof callback) => {
      callback = next;
    };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    const samples: { age: number; clouds: number; tick: number }[] = [];
    const paint = () => {
      now += 250;
      if (!callback) throw new Error('Expected an active result callback');
      callback(now);
      samples.push({
        age: v.previousElapsed - v.terminalAnimationStart,
        clouds: v.luxImpacts.clouds.size,
        tick: w.tick,
      });
    };
    try {
      g.repaint();
      for (let i = 0; i < 8; i++) paint();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      now += 60000;
      const hiddenAge = v.previousElapsed - v.terminalAnimationStart;
      delete (document as any).hidden;
      document.dispatchEvent(new Event('visibilitychange'));
      paint();
      return { samples, hiddenAge, tick, unchanged: w.snapshot() === snapshot };
    } finally {
      if (originalNow) Object.defineProperty(performance, 'now', originalNow);
      else delete (performance as any).now;
      delete (document as any).hidden;
      originalLoop.call(v.renderer, null);
      v.renderer.setAnimationLoop = originalLoop;
    }
  });
  for (const [i, sample] of result.samples.entries()) {
    expect(sample.age).toBeCloseTo((i + 1) * 0.25, 8);
    expect(sample.tick).toBe(result.tick);
  }
  expect(result.samples.at(-1)!.clouds).toBe(0);
  expect(result.hiddenAge).toBeCloseTo(2, 8);
  expect(result.unchanged).toBe(true);
  await writeFile(info.outputPath('terminal-wall-clock.json'), JSON.stringify(result, null, 2));
});
