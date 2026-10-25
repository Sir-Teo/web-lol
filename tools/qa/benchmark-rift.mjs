/** Run against the development server; this is a scoped observation, not a match gate. */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { arch, cpus, totalmem, platform } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const snapshotPath = process.argv[3];
const snapshot = snapshotPath ? await readFile(snapshotPath, 'utf8') : null;
const profileCPU = process.argv.slice(5).includes('--profile');
const rawBoneTracks = process.argv.slice(5).includes('--raw-bone-tracks');
const gpuTiming = process.argv.slice(5).includes('--gpu');
const developmentLeona = process.argv.slice(5).includes('--development-leona');
const followPlayer = process.argv.slice(5).includes('--follow-player');
const saveKey = developmentLeona ? 'development-leona-rift' : 'rift';
const targetUrl = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (developmentLeona) targetUrl.searchParams.set('scene', 'leona-rift');
if ((developmentLeona || followPlayer) && !snapshot)
  throw new Error('Development/player-follow measurement requires a match checkpoint.');
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
  if (saved.units.some((u) => u.champion === 'leona') && !developmentLeona)
    throw new Error('Leona checkpoints require the explicit --development-leona context.');
}
for (const extension of ['.json', '.png', '.cpuprofile'])
  if (existsSync(output + extension))
    throw new Error('Benchmark output already exists; use a fresh output stem.');
await mkdir(dirname(output), { recursive: true });
let canonicalSnapshot = null;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  let rawTrackModuleRequests = 0;
  if (rawBoneTracks)
    await page.route('**/src/render/constant-bone-tracks.ts', (route) => {
      rawTrackModuleRequests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export const removeConstantBoneTracks = (_root, clips) => clips;',
      });
    });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(targetUrl.href);
  await page.waitForFunction(() => window.__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  if (snapshot) {
    canonicalSnapshot = await page.evaluate(
      async ({ input, saveKey }) => {
        const g = window.__GAME__;
        g.setPaused(true);
        const { World } = await import('/src/simulation/world.ts');
        const { writeMatch } = await import('/src/storage/match-store.ts');
        const canonical = World.fromSnapshot(input, g.world.battlefield).snapshot();
        await writeMatch(saveKey, canonical);
        return canonical;
      },
      { input: snapshot, saveKey }
    );
    await page.reload();
    await page.waitForFunction(() => window.__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (
      !(await page.evaluate(
        (snapshot) => window.__GAME__.world.snapshot() === snapshot,
        canonicalSnapshot
      ))
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
  const data = await page.evaluate(
    async ({ matchMode, gpuTiming, followPlayer }) => {
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
        ? followPlayer
          ? w.hero
          : champions
              .filter((u) => u.team === 'blue' && w.alive(u))
              .sort((a, b) => threatCount(b) - threatCount(a) || a.id - b.id)[0]
        : null;
      if (matchMode && (!focus || !w.alive(focus)))
        throw new Error('Checkpoint has no living selected camera subject');
      v.center = focus ? { x: focus.x, y: focus.y } : { x: 0, y: 0 };
      v.locked = false;
      v.render(w, 1, w.time);
      const gl = v.renderer.getContext(),
        debug = gl.getExtension('WEBGL_debug_renderer_info');
      const graphicsContext = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      };
      const audioContextState = g.audio.context?.state ?? 'not-unlocked';
      const startingTick = w.tick;
      const sampleCount = matchMode ? 1800 : 180;
      const warmupCount = matchMode ? 120 : 45;
      const { GpuTimer } = gpuTiming ? await import('/tools/qa/gpu-timer.mjs') : {};
      const gpu = gpuTiming ? new GpuTimer(v.renderer.getContext()) : null;
      g.setPaused(false);
      const nextFrame = () =>
        new Promise((resolve) =>
          requestAnimationFrame((timestamp) => resolve({ timestamp, delivered: performance.now() }))
        );
      let lastFrame;
      for (let i = 0; i < warmupCount; i++) lastFrame = await nextFrame();
      const callbackIntervals = [];
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
        const queried = gpu?.begin();
        const t = performance.now();
        try {
          if (focus) this.center = { x: focus.x, y: focus.y };
          return render.apply(this, args);
        } finally {
          if (queried) gpu.end();
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
        let previous = lastFrame;
        for (let i = 0; i < sampleCount; i++) {
          const now = await nextFrame();
          frames.push(now.timestamp - previous.timestamp);
          callbackIntervals.push(now.delivered - previous.delivered);
          previous = now;
        }
      } finally {
        w.step = step;
        v.updateFog = updateFog;
        g.hud.update = updateHud;
        v.render = render;
      }
      g.setPaused(true);
      if (gpu) {
        for (let i = 0; i < 30 && gpu.pending.length; i++) {
          await nextFrame();
          gpu.poll();
        }
      }
      const gpuPending = gpu?.pending.length ?? 0;
      gpu?.clear();
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
      return {
        fixture: matchMode
          ? `Canonical ten-champion checkpoint restored through browser storage; camera follows ${followPlayer ? 'the owned player' : 'the living blue champion with most nearby visible enemies at start'}, retaining that subject through death/respawn`
          : 'Full Rift, live simulation beginning at 90 seconds after opening/closing shop, 45 warmup frames, 180 samples',
        startingTick,
        graphicsContext,
        audioContextState,
        cameraPolicy: !matchMode
          ? 'practice-origin'
          : followPlayer
            ? 'owned-player'
            : 'visible-opponent-density',
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
        frameClock: 'requestAnimationFrame timestamp; not physical display presentation time',
        callbackDeliveryIntervals: summarize(callbackIntervals),
        intervalsAbove25MS: frames.filter((ms) => ms > 25).length,
        fog: summarize(fog),
        simulationSteps: summarize(simulationSteps),
        hudUpdates: summarize(hudUpdates),
        renderCalls: summarize(renderCalls),
        gpu: gpu
          ? {
              supported: !!gpu.ext,
              milliseconds: gpu.samples.length ? summarize(gpu.samples) : null,
              discarded: gpu.discarded,
              skipped: gpu.skipped,
              unresolved: gpuPending,
              scope:
                'Elapsed query around application render; includes its GPU commands and submission gaps, not pure GPU utilization or compositor time',
            }
          : null,
        drawCalls: summarize(drawCalls),
        renderedTriangles: summarize(triangles),
        calls: v.renderer.info.render.calls,
        triangles: v.renderer.info.render.triangles,
        fogResolution: v.fogPixels.width,
      };
    },
    { matchMode: !!snapshot, gpuTiming, followPlayer }
  );
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    await writeFile(output + '.cpuprofile', JSON.stringify(profile));
    await profiler.detach();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  if (rawBoneTracks && !rawTrackModuleRequests)
    throw new Error('Raw-track baseline override was not loaded');
  await mkdir('artifacts', { recursive: true });
  const result = {
    result: 'measured',
    developmentLeona,
    followPlayer,
    saveKey,
    benchmarkURL: targetUrl.href,
    exactCheckpointRestored: snapshot !== null,
    canonicalSnapshotSHA256: canonicalSnapshot
      ? createHash('sha256').update(canonicalSnapshot).digest('hex')
      : null,
    cpuProfileEnabled: profileCPU,
    rawBoneTracks,
    gpuTiming,
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
