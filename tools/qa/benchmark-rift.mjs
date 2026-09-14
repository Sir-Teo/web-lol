/** Run against the development server; this is a scoped observation, not a match gate. */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, totalmem, platform } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const snapshotPath = process.argv[3];
const snapshot = snapshotPath ? await readFile(snapshotPath, 'utf8') : null;
const profileCPU = process.argv[5] === '--profile';
const output =
  process.argv[4] ?? (snapshot ? 'artifacts/rift-match-benchmark' : 'artifacts/rift-benchmark');
if (snapshot) {
  const saved = JSON.parse(snapshot);
  if (
    saved.battlefield !== 'rift' ||
    saved.winner ||
    saved.units.filter((u) => u.kind === 'champion').length !== 10
  )
    throw new Error('Match benchmark requires an unfinished ten-champion Rift checkpoint');
}

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
  if (snapshot) {
    await page.evaluate(async (snapshot) => {
      window.__GAME__.setPaused(true);
      const { writeMatch } = await import('/src/storage/match-store.ts');
      await writeMatch('rift', snapshot);
    }, snapshot);
    await page.reload();
    await page.waitForFunction(() => window.__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (
      !(await page.evaluate((snapshot) => window.__GAME__.world.snapshot() === snapshot, snapshot))
    )
      throw new Error('Browser did not restore the exact benchmark checkpoint');
  } else {
    await page.keyboard.press('p');
    await page.getByRole('button', { name: 'Close menu' }).click();
  }
  const profiler = profileCPU ? await page.context().newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
  }
  const data = await page.evaluate(async (matchMode) => {
    const g = window.__GAME__,
      w = g.world,
      v = g.view;
    if (w.battlefield.id !== 'rift') throw new Error('Benchmark requires the full Rift');
    const frames = [],
      fog = [],
      simulationSteps = [],
      hudUpdates = [],
      renderCalls = [];
    if (g.hud.modal) g.hud.closeModal();
    g.setPaused(true);
    const start = performance.now();
    if (!matchMode) w.step(Math.max(0, 5400 - w.tick));
    const advanceMS = performance.now() - start;
    const champions = w.units.filter((u) => u.kind === 'champion');
    const threatCount = (u) =>
      w.units.filter(
        (other) =>
          other.team !== u.team &&
          w.alive(other) &&
          w.visible(other) &&
          Math.hypot(u.x - other.x, u.y - other.y) < 1600
      ).length;
    const focus = matchMode
      ? champions
          .filter((u) => u.team === 'blue' && w.alive(u))
          .sort((a, b) => threatCount(b) - threatCount(a) || a.id - b.id)[0]
      : null;
    if (matchMode && !focus) throw new Error('Checkpoint has no living blue camera subject');
    v.center = focus ? { x: focus.x, y: focus.y } : { x: 0, y: 0 };
    v.locked = false;
    v.render(w, 1, w.time);
    const startingTick = w.tick;
    const sampleCount = matchMode ? 1800 : 180;
    const warmupCount = matchMode ? 120 : 45;
    g.setPaused(false);
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => resolve(performance.now())));
    for (let i = 0; i < warmupCount; i++) await nextFrame();
    const activity = {
      maxProjectiles: 0,
      maxSingularities: 0,
      maxLuxBeams: 0,
      maxVisibleChampions: 0,
    };
    const drawCalls = [],
      triangles = [];
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
        if (focus) this.center = { x: focus.x, y: focus.y };
        return render.apply(this, args);
      } finally {
        renderCalls.push(performance.now() - t);
        drawCalls.push(this.renderer.info.render.calls);
        triangles.push(this.renderer.info.render.triangles);
        activity.maxProjectiles = Math.max(activity.maxProjectiles, w.projectiles.length);
        activity.maxSingularities = Math.max(activity.maxSingularities, w.singularities.length);
        activity.maxLuxBeams = Math.max(activity.maxLuxBeams, w.luxBeams.length);
        activity.maxVisibleChampions = Math.max(
          activity.maxVisibleChampions,
          champions.filter((u) => w.alive(u) && w.visible(u) && this.screenPoint(u, 1.55).visible)
            .length
        );
      }
    };
    try {
      let previous = performance.now();
      for (let i = 0; i < sampleCount; i++) {
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
      fixture: matchMode
        ? 'Exact ten-champion checkpoint restored through browser storage; camera follows living blue champion with most nearby visible enemies at start, then retains that subject through death/respawn'
        : 'Full Rift, live simulation beginning at 90 seconds after opening/closing shop, 45 warmup frames, 180 samples',
      startingTick,
      warmupCount,
      sampleCount,
      cameraSubject: focus ? { id: focus.id, champion: focus.champion } : null,
      championRoster: champions.map((u) => ({
        id: u.id,
        team: u.team,
        champion: u.champion,
        ai: u.ai,
      })),
      activity,
      advanceMS,
      time: w.time,
      units: w.units.length,
      frames: summarize(frames),
      fog: summarize(fog),
      simulationSteps: summarize(simulationSteps),
      hudUpdates: summarize(hudUpdates),
      renderCalls: summarize(renderCalls),
      drawCalls: summarize(drawCalls),
      renderedTriangles: summarize(triangles),
      calls: v.renderer.info.render.calls,
      triangles: v.renderer.info.render.triangles,
      fogResolution: v.fogPixels.width,
    };
  }, !!snapshot);
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    await writeFile(output + '.cpuprofile', JSON.stringify(profile));
    await profiler.detach();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir('artifacts', { recursive: true });
  const result = {
    cpuProfileEnabled: profileCPU,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    snapshotPath: snapshotPath ?? null,
    snapshotSHA256: snapshot ? createHash('sha256').update(snapshot).digest('hex') : null,
    benchmarkSHA256: createHash('sha256')
      .update(await readFile(new URL(import.meta.url)))
      .digest('hex'),
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
  await writeFile(output + '.json', JSON.stringify(result, null, 2) + '\n');
  await page.screenshot({ path: output + '.png' });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
