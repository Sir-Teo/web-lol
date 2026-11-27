/**
 * macOS Desktop Safari & Physical Hardware Acceptance Runner (Milestone 11).
 *
 * Designed to close the external macOS desktop Safari + integrated-GPU 20-minute
 * post-warmup frame-pacing gate (`M7-D010`) on real macOS hardware with
 * `safaridriver --enable`. Fails closed on non-macOS hosts so Linux headless VMs
 * can never fabricate macOS Safari certification receipts.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
import { verifyCurrentPack } from './verify-current-pack.mjs';

const { values } = parseArgs({
  options: {
    output: { type: 'string', default: 'artifacts/milestone11-macos-safari-acceptance.json' },
    'warmup-seconds': { type: 'string', default: '60' },
    'sample-seconds': { type: 'string', default: '1200' },
    'driver-port': { type: 'string', default: '4444' },
    'check-prereqs': { type: 'boolean', default: false },
  },
});

export function checkMacOsSafariPrerequisites() {
  const host = {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpuModel: cpus()[0]?.model ?? 'unknown',
    cpuCores: cpus().length,
    totalRamGiB: Number((totalmem() / 1024 ** 3).toFixed(2)),
    node: process.version,
  };
  if (host.platform !== 'darwin') {
    return {
      ready: false,
      reason: `macOS Safari acceptance requires darwin host (current: ${host.platform} ${host.arch})`,
      host,
    };
  }
  const safariDriver = '/usr/bin/safaridriver';
  if (!existsSync(safariDriver)) {
    return {
      ready: false,
      reason: 'Missing /usr/bin/safaridriver on macOS host',
      host,
    };
  }
  let safariVersion = 'unknown';
  try {
    safariVersion = execFileSync(
      '/usr/bin/defaults',
      ['read', '/Applications/Safari.app/Contents/Info', 'CFBundleShortVersionString'],
      { encoding: 'utf8' }
    ).trim();
  } catch {}
  return {
    ready: true,
    safariDriver,
    safariVersion,
    host,
  };
}

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

async function wd(base, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok || payload.value?.error) {
    throw new Error(`WebDriver ${method} ${path} failed: ${JSON.stringify(payload)}`);
  }
  return payload.value;
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const prereqs = checkMacOsSafariPrerequisites();
  if (values['check-prereqs']) {
    console.log(JSON.stringify(prereqs, null, 2));
    process.exit(prereqs.ready ? 0 : 2);
  }
  if (!prereqs.ready) {
    console.error(JSON.stringify(prereqs, null, 2));
    process.exit(2);
  }

  const distRoot = resolve('dist');
  assert.ok(existsSync(resolve(distRoot, 'index.html')), 'Run npm run build before Safari audit');
  const pack = verifyCurrentPack('dist');
  const ruleset = rulesetFingerprint();
  const warmupSeconds = Number(values['warmup-seconds']);
  const sampleSeconds = Number(values['sample-seconds']);
  const driverPort = Number(values['driver-port']);
  assert.ok(warmupSeconds >= 10 && sampleSeconds >= 60, 'Invalid warmup/sample duration');

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
  const driverProc = spawn(prereqs.safariDriver, ['-p', String(driverPort)], { stdio: 'ignore' });
  const wdBase = `http://127.0.0.1:${driverPort}`;
  let sessionId = null;

  try {
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${wdBase}/status`);
        if (res.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }

    const session = await wd(wdBase, 'POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    sessionId = session.sessionId;
    await wd(wdBase, 'POST', `/session/${sessionId}/window/rect`, {
      width: 1440,
      height: 900,
    });
    await wd(wdBase, 'POST', `/session/${sessionId}/url`, { url: baseUrl });

    // Wait for production 5v5 canvas & pause button
    const readyDeadline = Date.now() + 120_000;
    let bootInfo = null;
    while (Date.now() < readyDeadline) {
      bootInfo = await wd(wdBase, 'POST', `/session/${sessionId}/execute/sync`, {
        script: `
          const canvas = document.querySelector('canvas');
          const pause = document.querySelector('#pause-button');
          return {
            ready: Boolean(canvas && pause && canvas.width > 0 && canvas.height > 0),
            userAgent: navigator.userAgent,
            devHook: Boolean(window.__WEB_LOL_TEST__),
          };
        `,
        args: [],
      });
      if (bootInfo.ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(bootInfo?.ready, 'Safari failed to boot production 5v5 canvas');
    assert.equal(bootInfo.devHook, false, 'Production build must not expose dev hook');

    // Warmup period before measuring frame pacing
    await new Promise((r) => setTimeout(r, warmupSeconds * 1000));

    // Measure RAF frame intervals across sampleSeconds
    const sample = await wd(wdBase, 'POST', `/session/${sessionId}/execute/async`, {
      script: `
        const [durationMs, done] = arguments;
        const deltas = [];
        let last = performance.now();
        const end = last + durationMs;
        function tick(now) {
          deltas.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else {
            deltas.sort((a, b) => a - b);
            const pct = (p) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * p))];
            const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            done({
              frames: deltas.length,
              meanFrameMs: Number(mean.toFixed(3)),
              p50FrameMs: Number(pct(0.5).toFixed(3)),
              p95FrameMs: Number(pct(0.95).toFixed(3)),
              p99FrameMs: Number(pct(0.99).toFixed(3)),
              maxFrameMs: Number((deltas[deltas.length - 1] ?? 0).toFixed(3)),
              fpsMean: Number((1000 / mean).toFixed(2)),
            });
          }
        }
        requestAnimationFrame(tick);
      `,
      args: [sampleSeconds * 1000],
    });

    const report = {
      result: sample.p95FrameMs <= 33.33 ? 'passed' : 'failed',
      recordedAt: new Date().toISOString(),
      ruleset,
      packId: pack.pack,
      safariVersion: prereqs.safariVersion,
      userAgent: bootInfo.userAgent,
      host: prereqs.host,
      warmupSeconds,
      sampleSeconds,
      framePacing: sample,
      budgets: {
        p95FrameBudgetMs: 33.33,
        withinFrameBudget: sample.p95FrameMs <= 33.33,
      },
    };
    mkdirSync(resolve(values.output, '..'), { recursive: true });
    writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (report.result !== 'passed') process.exitCode = 1;
  } finally {
    if (sessionId) {
      await fetch(`${wdBase}/session/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    }
    driverProc.kill('SIGTERM');
    server.close();
  }
}
