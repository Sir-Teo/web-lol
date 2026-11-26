/** Milestone 7.5 deterministic late-match simulation + headless browser production profiling. */
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { stat } from 'node:fs/promises';
import { cpus, platform, arch, totalmem, release } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const { values } = parseArgs({
  options: {
    snapshot: { type: 'string' },
    output: { type: 'string', default: 'artifacts/milestone7-performance-profile.json' },
    ticks: { type: 'string', default: '3600' },
  },
});

const ruleset = rulesetFingerprint();
const tempDir = mkdtempSync(join(tmpdir(), 'm7-prof-'));
let simResult;
try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    define: { __SIMULATION_HASH__: JSON.stringify(ruleset) },
    ssr: { noExternal: true },
    build: {
      ssr: 'tools/qa/profile-sim-worker.ts',
      outDir: tempDir,
      emptyOutDir: true,
      minify: false,
    },
  });
  const args = [join(tempDir, 'profile-sim-worker.js'), '--ticks', values.ticks];
  if (values.snapshot && existsSync(resolve(values.snapshot))) {
    args.push('--snapshot', values.snapshot);
  }
  const stdout = execFileSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  simResult = JSON.parse(stdout.trim());
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

// Serve production dist/ cleanly on loopback
const distRoot = resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = resolve(distRoot, rel);
    if (!target.startsWith(distRoot + sep) && target !== distRoot) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(target);
    res.writeHead(200, {
      'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/`;

let browserResult;
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Read-only WebGL draw-call / resource spy installed before app boot (zero app hooks)
  await page.addInitScript(() => {
    const stats = {
      frameDraws: 0,
      frameHistory: [],
      rafTimestamps: [],
      texturesCreated: 0,
      buffersCreated: 0,
      renderer: 'unknown',
      vendor: 'unknown',
    };
    window.__M7_PROF__ = stats;
    for (const Ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Ctor) continue;
      const origDE = Ctor.prototype.drawElements;
      const origDA = Ctor.prototype.drawArrays;
      const origDEI = Ctor.prototype.drawElementsInstanced;
      const origDAI = Ctor.prototype.drawArraysInstanced;
      const origTex = Ctor.prototype.createTexture;
      const origBuf = Ctor.prototype.createBuffer;
      Ctor.prototype.drawElements = function (...a) {
        stats.frameDraws++;
        return origDE.apply(this, a);
      };
      Ctor.prototype.drawArrays = function (...a) {
        stats.frameDraws++;
        return origDA.apply(this, a);
      };
      if (origDEI) {
        Ctor.prototype.drawElementsInstanced = function (...a) {
          stats.frameDraws++;
          return origDEI.apply(this, a);
        };
      }
      if (origDAI) {
        Ctor.prototype.drawArraysInstanced = function (...a) {
          stats.frameDraws++;
          return origDAI.apply(this, a);
        };
      }
      Ctor.prototype.createTexture = function (...a) {
        stats.texturesCreated++;
        return origTex.apply(this, a);
      };
      Ctor.prototype.createBuffer = function (...a) {
        stats.buffersCreated++;
        return origBuf.apply(this, a);
      };
    }
    const origGetCtx = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      const ctx = origGetCtx.call(this, type, attrs);
      if (ctx && (type === 'webgl2' || type === 'webgl')) {
        try {
          const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
          stats.renderer = dbg
            ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
            : ctx.getParameter(ctx.RENDERER);
          stats.vendor = dbg
            ? ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
            : ctx.getParameter(ctx.VENDOR);
        } catch {}
      }
      return ctx;
    };
    function tick(ts) {
      stats.frameHistory.push(stats.frameDraws);
      stats.frameDraws = 0;
      stats.rafTimestamps.push(ts);
      if (stats.frameHistory.length > 600) stats.frameHistory.shift();
      if (stats.rafTimestamps.length > 600) stats.rafTimestamps.shift();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const bootStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
  const coldBootMs = Date.now() - bootStart;

  // Start full 10-champion 5v5 match in production build
  const matchStart = Date.now();
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
  const resumeBtn = page.getByRole('button', { name: 'Return to the Rift', exact: true });
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
  }
  const full5v5StartMs = Date.now() - matchStart;

  // Exercise first Q/W/E ability inputs on live canvas
  await page.mouse.move(960, 540);
  await page.keyboard.press('q');
  await page.waitForTimeout(150);
  await page.keyboard.press('w');
  await page.waitForTimeout(150);
  await page.keyboard.press('e');

  // Reset rolling buffers after warmup, then sample ~120 active rendered frames
  await page.evaluate(() => {
    window.__M7_PROF__.frameHistory.length = 0;
    window.__M7_PROF__.rafTimestamps.length = 0;
  });
  await page.waitForTimeout(4000);

  const metrics = await page.evaluate(() => {
    if (typeof window.gc === 'function') window.gc();
    const s = window.__M7_PROF__;
    const draws = s.frameHistory.filter((n) => n > 0).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < s.rafTimestamps.length; i++) {
      intervals.push(s.rafTimestamps[i] - s.rafTimestamps[i - 1]);
    }
    intervals.sort((a, b) => a - b);
    const pct = (arr, p) =>
      arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : null;
    const mem = performance.memory
      ? {
          usedJsHeapMiB: Number((performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2)),
          totalJsHeapMiB: Number((performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2)),
          jsHeapLimitMiB: Number((performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)),
        }
      : null;
    return {
      developmentHookPresent: Boolean(window.__GAME__),
      webglRenderer: s.renderer,
      webglVendor: s.vendor,
      sampledActiveFrames: draws.length,
      drawCallsPerFrame: {
        p50: pct(draws, 0.5),
        p95: pct(draws, 0.95),
        max: draws.at(-1) ?? null,
      },
      rafIntervalMs: {
        p50: pct(intervals, 0.5) !== null ? Number(pct(intervals, 0.5).toFixed(2)) : null,
        p95: pct(intervals, 0.95) !== null ? Number(pct(intervals, 0.95).toFixed(2)) : null,
        p99: pct(intervals, 0.99) !== null ? Number(pct(intervals, 0.99).toFixed(2)) : null,
      },
      texturesCreated: s.texturesCreated,
      buffersCreated: s.buffersCreated,
      postGcMemory: mem,
    };
  });

  browserResult = {
    browser: `Chrome/${browser.version()}`,
    viewport: '1920x1080',
    coldBootMs,
    full5v5StartMs,
    pageErrors,
    ...metrics,
    budgets: {
      drawCallsP95Limit: 250,
      postGcHeapMiBLimit: 280,
      withinDrawCallBudget:
        metrics.drawCallsPerFrame.p95 !== null && metrics.drawCallsPerFrame.p95 < 250,
      withinHeapBudget: metrics.postGcMemory !== null && metrics.postGcMemory.usedJsHeapMiB <= 280,
    },
  };
} finally {
  await browser.close();
  server.close();
}

const report = {
  milestone: 7,
  increment: '7.5',
  ruleset,
  capturedAt: new Date().toISOString(),
  environment: {
    os: `${platform()} ${release()} (${arch()})`,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    cpuCores: cpus().length,
    totalRamGiB: Number((totalmem() / 1024 ** 3).toFixed(2)),
    node: process.version,
    hardwareTier: 'linux-ci-headless-software-webgl',
    note: 'Software-rendered Linux CI VM verifies deterministic simulation budgets, draw-call ceilings, and post-GC JS heap on the production dist/ bundle. Physical integrated-GPU laptop/desktop and macOS Safari 20-minute post-warmup frame pacing remain explicit external hardware gates.',
  },
  simulation: simResult,
  browserProduction: browserResult,
  externalHardwareGates: {
    integratedGpuLaptop20MinPostWarmup: 'blocked-external',
    integratedGpuDesktop20MinPostWarmup: 'blocked-external',
    macosDesktopSafariAcceptance: 'blocked-external',
  },
};

const outPath = resolve(values.output);
mkdirSync(resolve(outPath, '..'), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
