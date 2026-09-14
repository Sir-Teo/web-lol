/** Scoped static-map camera benchmark; not a full-match or physical presentation gate. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] ?? 'http://127.0.0.1:5198';
const output = process.argv[3] ?? 'artifacts/map-residency-benchmark.json';
const browser = await chromium.launch({ channel: 'chrome' });
const runs = [];
try {
  // Reverse the order on the second pair to expose simple warm-cache/order effects.
  for (const budgetMiB of [256, null, null, 256]) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(new URL('/map.html', base).href);
      await page.waitForFunction(() => window.__MAP__?.ready);
      const result = await page.evaluate(async (budgetMiB) => {
        const map = window.__MAP__,
          renderer = map.renderer;
        renderer.setAnimationLoop(null);
        const residency = map.map.children[0].userData.textureResidency;
        residency.budgetBytes = budgetMiB === null ? Infinity : budgetMiB * 1024 * 1024;
        const gl = renderer.getContext(),
          debug = gl.getExtension('WEBGL_debug_renderer_info');
        const hardware = debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
        const { GpuTimer } = await import('/tools/qa/gpu-timer.mjs');
        const gpu = new GpuTimer(gl);
        const originalUpload = gl.compressedTexImage2D.bind(gl);
        const originalSubUpload = gl.compressedTexSubImage2D.bind(gl);
        let uploadCalls = 0,
          uploadBytes = 0;
        gl.compressedTexImage2D = (...args) => {
          uploadCalls++;
          const data = args[6];
          if (ArrayBuffer.isView(data)) uploadBytes += data.byteLength;
          return originalUpload(...args);
        };
        gl.compressedTexSubImage2D = (...args) => {
          uploadCalls++;
          const data = args[7];
          if (ArrayBuffer.isView(data)) uploadBytes += data.byteLength;
          return originalSubUpload(...args);
        };
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const draw = () => {
          residency.beginFrame();
          renderer.render(map.scene, map.camera);
          residency.endFrame();
        };
        const samples = [];
        try {
          map.viewpoint('overview');
          for (let i = 0; i < 30; i++) {
            await nextFrame();
            draw();
          }
          const initialEvictions = residency.evictions;
          let previous = await nextFrame();
          const views = ['blue', 'red', 'mid', 'river', 'blue', 'red', 'mid', 'river'];
          for (const [visit, view] of views.entries()) {
            for (let frame = 0; frame < 30; frame++) {
              const timestamp = await nextFrame();
              if (!frame) map.viewpoint(view);
              const callsBefore = uploadCalls,
                bytesBefore = uploadBytes;
              const query = gpu.begin(),
                start = performance.now();
              draw();
              const cpuMS = performance.now() - start;
              if (query) gpu.end();
              samples.push({
                visit,
                view,
                frame,
                cpuMS,
                intervalMS: timestamp - previous,
                uploads: uploadCalls - callsBefore,
                uploadBytes: uploadBytes - bytesBefore,
                residentBytes: residency.residentBytes,
                visibleBytes: residency.currentFrameBytes,
              });
              previous = timestamp;
            }
          }
          for (let i = 0; i < 120 && gpu.pending.length; i++) {
            await nextFrame();
            gpu.poll();
          }
          return {
            budgetMiB,
            hardware,
            encoding: map.map.children[0].userData.textureEncoding,
            samples,
            evictions: residency.evictions - initialEvictions,
            gpu: {
              supported: !!gpu.ext,
              samplesMS: gpu.samples,
              discarded: gpu.discarded,
              skipped: gpu.skipped,
              unresolved: gpu.pending.length,
            },
          };
        } finally {
          gpu.clear();
          gl.compressedTexImage2D = originalUpload;
          gl.compressedTexSubImage2D = originalSubUpload;
        }
      }, budgetMiB);
      if (errors.length) throw new Error(errors.join('\n'));
      if (result.encoding !== 'original-dxt') throw new Error('Benchmark currently requires S3TC');
      if (budgetMiB !== null && (!result.evictions || !result.samples.some((s) => s.uploads)))
        throw new Error('Bounded run did not exercise measured texture re-uploads');
      if (budgetMiB === null && result.samples.some((s) => s.uploads))
        throw new Error('Unbounded warm map unexpectedly uploaded textures');
      runs.push(result);
      console.log(
        JSON.stringify({
          budgetMiB,
          evictions: result.evictions,
          uploads: result.samples.reduce((sum, s) => sum + s.uploads, 0),
        })
      );
    } finally {
      await context.close();
    }
  }
  const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return {
      count: sorted.length,
      median: percentile(0.5),
      p95: percentile(0.95),
      max: sorted.at(-1),
    };
  };
  for (const run of runs) {
    run.summary = {
      transitionCPU: stats(run.samples.filter((s) => s.frame === 0).map((s) => s.cpuMS)),
      steadyCPU: stats(run.samples.filter((s) => s.frame > 0).map((s) => s.cpuMS)),
      frameIntervals: stats(run.samples.map((s) => s.intervalMS)),
      intervalsOver25MS: run.samples.filter((s) => s.intervalMS > 25).length,
      gpuMS: stats(run.gpu.samplesMS),
      uploadBytes: run.samples.reduce((sum, s) => sum + s.uploadBytes, 0),
    };
  }
  const report = {
    capturedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    scriptSHA256: createHash('sha256')
      .update(await readFile(new URL(import.meta.url)))
      .digest('hex'),
    browser: browser.version(),
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0].model,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    runs,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      runs.map(({ budgetMiB, summary }) => ({ budgetMiB, summary })),
      null,
      2
    )
  );
} finally {
  await browser.close();
}
