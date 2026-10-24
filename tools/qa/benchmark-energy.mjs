/** Serial renderer CPU observation. CPU seconds exclude GPU/other browser processes. */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { cpus, platform } from 'node:os';

const url = process.argv[2] ?? 'http://127.0.0.1:5198';
const output = process.argv[3];
if (!output) throw new Error('Usage: node tools/qa/benchmark-energy.mjs URL fresh-output.json');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => {
    await page.waitForFunction(() => window.__GAME__?.ready, undefined, { timeout: 60000 });
    await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  };
  await page.goto(url);
  await ready();
  const snapshotFile = `${dirname(output)}/match.snapshot.json`;
  let snapshot;
  try {
    snapshot = await readFile(snapshotFile, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    snapshot = await page.evaluate(async () => {
      const g = window.__GAME__;
      g.setPaused(true);
      const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
      const w = createLaneMatch(g.world.battlefield);
      w.step(7200);
      if (w.winner) throw new Error('Finished energy fixture');
      return w.snapshot();
    });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(snapshotFile, snapshot, { flag: 'wx' });
  }
  await page.evaluate(async (snapshot) => {
    window.__GAME__.setPaused(true);
    const { writeMatch } = await import('/src/storage/match-store.ts');
    await writeMatch('rift', snapshot);
  }, snapshot);
  await page.reload();
  await ready();
  if (!(await page.evaluate((s) => window.__GAME__.world.snapshot() === s, snapshot)))
    throw new Error('Checkpoint was not restored exactly');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.evaluate(() => {
    const g = window.__GAME__;
    window.__energy = { renders: 0, renderMS: 0, mixers: 0, hud: 0, audio: 0, steps: 0 };
    const wrap = (obj, key, counter, timed = false) => {
      const original = obj[key];
      obj[key] = function (...args) {
        const t = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          window.__energy[counter]++;
          if (timed) window.__energy.renderMS += performance.now() - t;
        }
      };
    };
    wrap(g.view, 'render', 'renders', true);
    wrap(g.hud, 'update', 'hud');
    wrap(g.audio, 'update', 'audio');
    wrap(g.world, 'step', 'steps');
    for (const model of g.view.models.values())
      if (model.mixer) wrap(model.mixer, 'update', 'mixers');
  });
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])
    );
  const samples = [];
  for (const state of ['active', 'paused', 'hidden']) {
    await page.evaluate((state) => {
      const g = window.__GAME__;
      if (state === 'active') {
        g.hud.closeModal();
        g.setPaused(false);
      }
      if (state === 'paused') g.hud.toggleModal('pause');
      if (state === 'hidden') {
        // Synthetic visibility keeps RAF alive to test the application's guard itself.
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    }, state);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      for (const k of Object.keys(window.__energy)) window.__energy[k] = 0;
      window.__energy.startTick = window.__GAME__.world.tick;
    });
    const before = await metrics();
    if (state === 'active') {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
    }
    await page.waitForTimeout(6000);
    const after = await metrics();
    if (state === 'active') {
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(output.replace(/\.json$/, '.cpuprofile'), JSON.stringify(profile), {
        flag: 'wx',
      });
    }
    const counters = await page.evaluate(() => ({
      ...window.__energy,
      endTick: window.__GAME__.world.tick,
    }));
    samples.push({
      state,
      ...counters,
      wallSeconds: after.Timestamp - before.Timestamp,
      rendererTaskSeconds: after.TaskDuration - before.TaskDuration,
      rendererScriptSeconds: after.ScriptDuration - before.ScriptDuration,
    });
  }
  const sourceHashes = {};
  for (const file of [
    'src/main.ts',
    'src/render/view.ts',
    'src/render/lux-illumination.ts',
    'src/render/models.ts',
    'src/input/input.ts',
    'src/render/mobile-animation.ts',
    'src/render/frame-pacer.ts',
    'tools/qa/benchmark-energy.mjs',
  ])
    sourceHashes[file] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  await writeFile(
    output,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        platform: platform(),
        cpu: cpus()[0].model,
        scope:
          'One headless Chrome, full Rift, exact 120-second ten-champion checkpoint, active CPU sampling separate from idle states; synthetic hidden retains RAF to test application guard. Renderer CPU does not measure heat, GPU, or total system energy.',
        snapshotSHA256: createHash('sha256').update(snapshot).digest('hex'),
        sourceHashes,
        samples,
        errors,
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  );
  console.log(JSON.stringify({ output, samples, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
