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
const rosterBaron = process.argv.slice(5).includes('--roster-baron');
const followPlayer = process.argv.slice(5).includes('--follow-player');
const systemChromium = process.argv.slice(5).includes('--system-chromium');
const headed = process.argv.slice(5).includes('--headed');
const requestedCount = (name) => {
  const args = process.argv.slice(5).filter((arg) => arg.startsWith(`--${name}=`));
  if (args.length > 1) throw new Error(`Duplicate --${name} option`);
  if (!args.length) return null;
  const value = Number(args[0].slice(name.length + 3));
  if (!Number.isSafeInteger(value) || value < 1 || value > 100000)
    throw new Error(`--${name} must be an integer from 1 to 100000`);
  return value;
};
const requestedSamples = requestedCount('samples');
const requestedWarmup = requestedCount('warmup');
const saveKey = rosterBaron
  ? 'development-roster-baron'
  : developmentLeona
    ? 'development-leona-rift'
    : 'rift';
const targetUrl = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (developmentLeona) targetUrl.searchParams.set('scene', 'leona-rift');
if (rosterBaron) {
  if (developmentLeona || followPlayer)
    throw new Error('Use --roster-baron by itself to center the camera on Baron.');
  targetUrl.searchParams.set('scene', 'roster-rift');
  targetUrl.searchParams.set('objectives', 'baron');
}
if ((developmentLeona || rosterBaron || followPlayer) && !snapshot)
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
  if (saved.units.some((u) => u.champion === 'leona') && !(developmentLeona || rosterBaron))
    throw new Error('Leona checkpoints require the explicit --development-leona context.');
  if (
    rosterBaron &&
    !saved.units.some(
      (u) => u.id === saved.riftBaron?.unitId && u.monster?.species === 'baron' && u.hp > 0
    )
  )
    throw new Error('Baron benchmark requires a checkpoint with a living Rift Baron.');
}
for (const extension of ['.json', '.png', '.cpuprofile'])
  if (existsSync(output + extension))
    throw new Error('Benchmark output already exists; use a fresh output stem.');
await mkdir(dirname(output), { recursive: true });
let canonicalSnapshot = null;

const browser = await chromium.launch({
  headless: !headed,
  ...(systemChromium
    ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] }
    : { channel: 'chrome' }),
});
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
  const ready = async () => {
    await page.waitForFunction(() => window.__GAME__?.ready, null, { timeout: 120_000 });
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  if (rosterBaron) {
    // Load the checkpoint before initializing the map, rigs and WebGL context.
    const bootstrap = new URL('/__baron_benchmark_storage__', targetUrl).href;
    await page.route(bootstrap, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Benchmark setup</title>',
      })
    );
    await page.goto(bootstrap);
    await page.evaluate(
      async ({ snapshot, saveKey }) => {
        const { writeMatch } = await import('/src/storage/match-store.ts');
        await writeMatch(saveKey, snapshot);
      },
      { snapshot, saveKey }
    );
    canonicalSnapshot = snapshot;
  }
  await page.goto(targetUrl.href);
  await ready();
  if (snapshot) {
    if (!rosterBaron) {
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
      await ready();
    }
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
    async ({
      matchMode,
      gpuTiming,
      followPlayer,
      rosterBaron,
      requestedSamples,
      requestedWarmup,
    }) => {
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
      const focus = rosterBaron
        ? w.unit(w.riftBaron.unitId)
        : matchMode
          ? followPlayer
            ? w.hero
            : champions
                .filter((u) => u.team === 'blue' && w.alive(u))
                .sort((a, b) => threatCount(b) - threatCount(a) || a.id - b.id)[0]
          : null;
      if (matchMode && (!focus || !w.alive(focus)))
        throw new Error('Checkpoint has no living selected camera subject');
      const pit = rosterBaron ? { x: focus.x, y: focus.y } : null;
      v.center = matchMode ? { x: focus.x, y: focus.y } : { x: 0, y: 0 };
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
      const sampleCount = requestedSamples ?? (matchMode ? 1800 : 180);
      const warmupCount = requestedWarmup ?? (matchMode ? 120 : 45);
      const { GpuTimer } = gpuTiming ? await import('/tools/qa/gpu-timer.mjs') : {};
      const { anchorInsideViewport } = await import('/tools/qa/viewport-visibility.mjs');
      const gpu = gpuTiming ? new GpuTimer(v.renderer.getContext()) : null;
      g.setPaused(false);
      const nextFrame = () =>
        new Promise((resolve) =>
          requestAnimationFrame((timestamp) => resolve({ timestamp, delivered: performance.now() }))
        );
      let lastFrame;
      for (let i = 0; i < warmupCount; i++) lastFrame = await nextFrame();
      const callbackIntervals = [];
      const pitFrames = [];
      const pitCallbackIntervals = [];
      let busyPitRender = false;
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
          if (pit || focus) this.center = pit ?? { x: focus.x, y: focus.y };
          return render.apply(this, args);
        } finally {
          if (queried) gpu.end();
          renderCalls.push(performance.now() - t);
          drawCalls.push(this.renderer.info.render.calls);
          triangles.push(this.renderer.info.render.triangles);
          activity.maxProjectiles = Math.max(activity.maxProjectiles, w.projectiles.length);
          activity.maxSingularities = Math.max(activity.maxSingularities, w.singularities.length);
          activity.maxLuxBeams = Math.max(activity.maxLuxBeams, w.luxBeams.length);
          let visibleChampions = 0;
          let pitBlue = false;
          let pitRed = false;
          for (const u of champions) {
            if (
              !w.alive(u) ||
              !w.visible(u) ||
              !anchorInsideViewport(this.screenPoint(u, 1.55), this.width, this.height)
            )
              continue;
            visibleChampions++;
            if (pit && Math.hypot(u.x - pit.x, u.y - pit.y) <= 1500) {
              pitBlue ||= u.team === 'blue';
              pitRed ||= u.team === 'red';
            }
          }
          activity.maxVisibleChampions = Math.max(activity.maxVisibleChampions, visibleChampions);
          busyPitRender =
            rosterBaron &&
            pitBlue &&
            pitRed &&
            w.targetable(focus) &&
            focus.hp < focus.maxHp &&
            w.visible(focus);
        }
      };
      try {
        let previous = lastFrame;
        for (let i = 0; i < sampleCount; i++) {
          const now = await nextFrame();
          const interval = now.timestamp - previous.timestamp;
          const callbackInterval = now.delivered - previous.delivered;
          frames.push(interval);
          callbackIntervals.push(callbackInterval);
          if (busyPitRender) {
            pitFrames.push(interval);
            pitCallbackIntervals.push(callbackInterval);
          }
          busyPitRender = false;
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
        fixture: rosterBaron
          ? 'Canonical ten-champion Rift checkpoint restored through browser storage; camera centered on the Baron pit'
          : matchMode
            ? `Canonical ten-champion checkpoint restored through browser storage; camera follows ${followPlayer ? 'the owned player' : 'the living blue champion with most nearby visible enemies at start'}, retaining that subject through death/respawn`
            : `Full Rift, live simulation beginning at 90 seconds after opening/closing shop, ${warmupCount} warmup frames, ${sampleCount} samples`,
        startingTick,
        endingTick: w.tick,
        graphicsContext,
        audioContextState,
        cameraPolicy: rosterBaron
          ? 'baron-pit'
          : !matchMode
            ? 'practice-origin'
            : followPlayer
              ? 'owned-player'
              : 'visible-opponent-density',
        warmupCount,
        sampleCount,
        cameraSubject: focus && !rosterBaron ? { id: focus.id, champion: focus.champion } : null,
        championRoster: champions.map((u) => ({
          id: u.id,
          team: u.team,
          champion: u.champion,
          ai: u.ai,
        })),
        activity,
        busyPit: rosterBaron
          ? {
              definition:
                'Rendered sample with a living, visible, damaged Baron and a living, team-visible champion from each side within 1500 units of the pit and inside the viewport',
              sampleCount: pitFrames.length,
              frames: pitFrames.length ? summarize(pitFrames) : null,
              callbackDeliveryIntervals: pitFrames.length ? summarize(pitCallbackIntervals) : null,
            }
          : null,
        visibleChampionMetric:
          'Living team-visible champion anchors at elevation 1.55 inside the CSS viewport; not model bounds, occlusion or HUD coverage',
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
    {
      matchMode: !!snapshot,
      gpuTiming,
      headed,
      followPlayer,
      rosterBaron,
      requestedSamples,
      requestedWarmup,
    }
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
    rosterBaron,
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
    systemChromium,
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
