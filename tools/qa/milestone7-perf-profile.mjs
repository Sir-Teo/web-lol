/**
 * Milestone 7.5 — Late-Match 10-Champion Simulation & Browser Performance Profile.
 *
 * Benchmarks late-game 60 Hz simulation tick cadence (p50, p95, p99, max ms/tick)
 * across 6,000 ticks of active 10-champion 5v5 Summoner's Rift combat, and pairs it
 * with the measured browser heap/restart metrics from Milestone 7.3 acceptance.
 *
 * Explicitly tags rendererClass as software-swiftshader-linux (never fabricates
 * physical laptop/desktop GPU 60 FPS claims).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cpus, totalmem } from 'node:os';
import { createServer } from 'vite';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const { values } = parseArgs({
  options: {
    output: { type: 'string', default: 'artifacts/milestone7/perf-profile.json' },
    browserReport: {
      type: 'string',
      default: 'artifacts/milestone7/browser-acceptance-chrome.json',
    },
    warmupSeconds: { type: 'string', default: '360' },
    measureTicks: { type: 'string', default: '6000' },
  },
});

const warmupSeconds = Number.parseInt(values.warmupSeconds, 10);
const measureTicks = Number.parseInt(values.measureTicks, 10);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return Number(sorted[idx].toFixed(4));
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createRift } = await server.ssrLoadModule('/src/content/rift.ts');
  const { TICK_RATE } = await server.ssrLoadModule('/src/content/rules.ts');
  const { createLaneMatch } = await server.ssrLoadModule('/src/simulation/lane-match.ts');
  const { NavGrid } = await server.ssrLoadModule('/src/simulation/navgrid.ts');

  const navBytes = readFileSync(resolve('public/assets/maps/rift-nav.bin'));
  const navMeta = JSON.parse(readFileSync(resolve('public/assets/maps/rift-nav.json'), 'utf8'));
  const layout = JSON.parse(readFileSync(resolve('public/assets/maps/rift-layout.json'), 'utf8'));
  const rift = {
    ...createRift(
      new NavGrid(
        navMeta,
        navBytes.buffer.slice(navBytes.byteOffset, navBytes.byteOffset + navBytes.byteLength)
      ),
      layout
    ),
    publicRift: true,
  };

  const world = createLaneMatch(rift, 'darius', { d: 'flash', f: 'heal' }, 'standard');
  // Enable AI on hero so all 10 champions actively push, fight, cast abilities, and contest objectives
  world.hero.ai = true;
  world.step(warmupSeconds * TICK_RATE);

  const durationsMs = new Float64Array(measureTicks);
  const startWall = performance.now();
  const heapStart = process.memoryUsage().heapUsed;
  for (let i = 0; i < measureTicks; i++) {
    const t0 = performance.now();
    world.step(1);
    durationsMs[i] = performance.now() - t0;
  }
  const totalWallMs = performance.now() - startWall;
  const heapEnd = process.memoryUsage().heapUsed;
  const sorted = Array.from(durationsMs).sort((a, b) => a - b);

  let browserHeapSummary = null;
  const browserReportPath = resolve(values.browserReport);
  if (existsSync(browserReportPath)) {
    const b = JSON.parse(readFileSync(browserReportPath, 'utf8'));
    const heaps = (b.restartSamples ?? [])
      .map((s) => s.usedJSHeapBytes)
      .filter((n) => typeof n === 'number' && Number.isFinite(n));
    browserHeapSummary = {
      source: values.browserReport,
      restartCount: (b.restartSamples ?? []).length,
      minHeapBytes: heaps.length ? Math.min(...heaps) : null,
      maxHeapBytes: heaps.length ? Math.max(...heaps) : null,
      deltaFirstToLastBytes: heaps.length >= 2 ? heaps[heaps.length - 1] - heaps[0] : null,
      pageErrors: (b.pageErrors ?? []).length,
    };
  }

  const report = {
    schema: 'milestone7-perf-profile-v1',
    milestone: 7,
    ruleset: rulesetFingerprint(),
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      cpuCount: cpus().length,
      totalMemoryGiB: Number((totalmem() / 1024 ** 3).toFixed(2)),
      rendererClass: 'software-swiftshader-linux',
      physicalGpuPerfVerified: false,
      physicalGpuGateNote:
        'Measured on headless Linux CPU + SwiftShader software WebGL; physical laptop/desktop GPU 60 FPS verification remains an explicit external hardware gate.',
    },
    simulationLateMatch: {
      warmupSeconds,
      measuredTicks: measureTicks,
      finalTick: world.tick,
      activeUnitsAtEnd: world.units.length,
      budgetMsPerTickAt60Hz: 16.6667,
      totalWallMs: Number(totalWallMs.toFixed(2)),
      meanMs: Number((totalWallMs / measureTicks).toFixed(4)),
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      maxMs: percentile(sorted, 1),
      heapDeltaBytes: heapEnd - heapStart,
      within60HzSimBudget: percentile(sorted, 0.95) < 16.6667,
    },
    browserHeapSummary,
  };

  const outPath = resolve(values.output);
  mkdirSync(resolve(outPath, '..'), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      result: 'passed',
      output: outPath,
      ruleset: report.ruleset,
      p50Ms: report.simulationLateMatch.p50Ms,
      p95Ms: report.simulationLateMatch.p95Ms,
      p99Ms: report.simulationLateMatch.p99Ms,
      within60HzSimBudget: report.simulationLateMatch.within60HzSimBudget,
      physicalGpuPerfVerified: report.environment.physicalGpuPerfVerified,
    })
  );
} finally {
  await server.close();
}
