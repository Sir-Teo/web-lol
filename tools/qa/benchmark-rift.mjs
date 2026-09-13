/** Run against the development server; this is a scoped observation, not a match gate. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, totalmem, platform } from 'node:os';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Close menu' }).click();
  const data = await page.evaluate(async () => {
    const g = window.__GAME__,
      w = g.world,
      v = g.view;
    if (w.battlefield.id !== 'rift') throw new Error('Benchmark requires the full Rift');
    const frames = [],
      fog = [],
      simulationSteps = [],
      hudUpdates = [],
      renderCalls = [];
    g.setPaused(true);
    const start = performance.now();
    w.step(Math.max(0, 5400 - w.tick));
    const advanceMS = performance.now() - start;
    v.center = { x: 0, y: 0 };
    v.locked = false;
    v.render(w, 1, 90);
    g.setPaused(false);
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => resolve(performance.now())));
    for (let i = 0; i < 45; i++) await nextFrame();
    const step = w.step,
      updateFog = v.updateFog,
      updateHud = g.hud.update,
      render = v.render;
    w.step = function (...args) {
      const t = performance.now();
      const value = step.apply(this, args);
      simulationSteps.push(performance.now() - t);
      return value;
    };
    v.updateFog = function (...args) {
      const t = performance.now();
      const value = updateFog.apply(this, args);
      fog.push(performance.now() - t);
      return value;
    };
    g.hud.update = function (...args) {
      const t = performance.now();
      try {
        return updateHud.apply(this, args);
      } finally {
        hudUpdates.push(performance.now() - t);
      }
    };
    v.render = function (...args) {
      const t = performance.now();
      try {
        return render.apply(this, args);
      } finally {
        renderCalls.push(performance.now() - t);
      }
    };
    try {
      let previous = performance.now();
      for (let i = 0; i < 180; i++) {
        const now = await nextFrame();
        frames.push(now - previous);
        previous = now;
      }
    } finally {
      w.step = step;
      v.updateFog = updateFog;
      g.hud.update = updateHud;
      v.render = render;
    }
    const summarize = (values) => {
      if (!values.length) throw new Error('Missing benchmark samples');
      values.sort((a, b) => a - b);
      return {
        n: values.length,
        median: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        p99: values[Math.floor(values.length * 0.99)],
      };
    };
    g.setPaused(true);
    return {
      fixture:
        'Full Rift, live simulation beginning at 90 seconds after opening/closing shop, 45 warmup frames, 180 samples',
      advanceMS,
      time: w.time,
      units: w.units.length,
      frames: summarize(frames),
      fog: summarize(fog),
      simulationSteps: summarize(simulationSteps),
      hudUpdates: summarize(hudUpdates),
      renderCalls: summarize(renderCalls),
      calls: v.renderer.info.render.calls,
      triangles: v.renderer.info.render.triangles,
      fogResolution: v.fogPixels.width,
    };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir('artifacts', { recursive: true });
  const result = {
    browser: browser.version(),
    hardware: {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0].model,
      memoryGiB: totalmem() / 2 ** 30,
    },
    viewport: [1920, 1080],
    ...data,
  };
  await writeFile('artifacts/rift-benchmark.json', JSON.stringify(result, null, 2) + '\n');
  await page.screenshot({ path: 'artifacts/rift-benchmark.png' });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
