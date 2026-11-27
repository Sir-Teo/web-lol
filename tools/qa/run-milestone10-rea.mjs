/** Run pinned rea-agents@6.10.1 static + browser + runtime reconciliation on dist/ for Milestone 10 and export an authenticated Evidence bundle. */
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REA_PKG = 'rea-agents@6.10.1';
const CHROME_PATH = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : '/usr/bin/google-chrome';
const OUT_BUNDLE = resolve('artifacts/milestone10-rea-evidence-bundle.json');
const OUT_SUMMARY = resolve('artifacts/milestone10-rea-summary.json');

async function runRea(args) {
  const { stdout } = await execFileAsync('npx', ['--yes', REA_PKG, ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096',
      REA_BROWSER_NO_SANDBOX: 'true',
    },
  });
  return stdout.trim();
}

function parseJsonLinesOrObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (!obj.rea_progress) return obj;
      } catch {}
    }
    throw new Error('Could not parse REA JSON output');
  }
}

const workDir = mkdtempSync(join(tmpdir(), 'm10-rea-'));
const distRoot = resolve('dist');
const prefix = '/nested/rift/';
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
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    const rel = pathname.slice(prefix.length) || 'index.html';
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

try {
  // 1. Audit release exposure on dist/
  const exposureRecord = parseJsonLinesOrObject(
    await runRea(['audit-release-exposure', 'dist', '--json'])
  );

  // 2. Analyze JavaScript application statically (core entry, rules, offline worker, and runtime bundles)
  const assetFiles = readdirSync(resolve(distRoot, 'assets'))
    .filter((name) => /^(game|rules|map|rift-assets)-.*\.js$/.test(name))
    .map((name) => `assets/${name}`);
  const selectedSources = [
    'index.html',
    'map.html',
    'offline-worker.js',
    'offline-pack.json',
    ...assetFiles,
  ];
  const sourcePathsFile = join(workDir, 'source-paths.json');
  writeFileSync(sourcePathsFile, JSON.stringify(selectedSources));

  const jsBundlePath = join(workDir, 'js-app-bundle.json');
  await runRea([
    'analyze-javascript-application',
    'dist',
    '--source-paths-json',
    sourcePathsFile,
    '--detail',
    'summary',
    '--evidence_output',
    jsBundlePath,
    '--json',
  ]);
  const jsBundle = JSON.parse(readFileSync(jsBundlePath, 'utf8'));
  const jsRecord = jsBundle.records[0];

  // 3. Trace key Milestone 10 application boundaries (player-settings persistence & offline-pack)
  const appRef = {
    kind: 'retained-evidence',
    evidence_id: jsRecord.evidence_id,
  };
  const traceSettingsInput = join(workDir, 'trace-settings.json');
  writeFileSync(
    traceSettingsInput,
    JSON.stringify({
      application: appRef,
      seed: { kind: 'string', value:       'rift.player-settings.v1', match: 'contains' },
      direction: 'both',
    })
  );
  const traceSettingsRecord = parseJsonLinesOrObject(
    await runRea([
      'trace-application-feature',
      traceSettingsInput,
      '--evidence-bundle',
      jsBundlePath,
      '--json',
    ])
  );

  const traceOfflineInput = join(workDir, 'trace-offline.json');
  writeFileSync(
    traceOfflineInput,
    JSON.stringify({
      application: appRef,
      seed: { kind: 'string', value: 'offline-pack.json', match: 'contains' },
      direction: 'both',
    })
  );
  const traceOfflineRecord = parseJsonLinesOrObject(
    await runRea([
      'trace-application-feature',
      traceOfflineInput,
      '--evidence-bundle',
      jsBundlePath,
      '--json',
    ])
  );

  // 4. Controlled browser scenario capture on dist/ exercising Milestone 10 Controls & Accessibility modal
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}${prefix}`;

  const scenarioInput = join(workDir, 'scenario.json');
  const scenarioBundlePath = join(workDir, 'scenario-bundle.json');
  writeFileSync(
    scenarioInput,
    JSON.stringify({
      browser: {
        mode: 'launch',
        executable_path: CHROME_PATH,
        headless: true,
      },
      start_url: { url: baseUrl },
      command_timeout_ms: 120000,
      environment: {
        viewport: { width: 1280, height: 720, device_scale_factor: 1 },
        locale: 'en-US',
        timezone: 'UTC',
        color_scheme: 'dark',
        reduced_motion: 'reduce',
        service_workers: 'block',
      },
      actions: [
        {
          step_id: 'open-pause-menu',
          action: 'click',
          locator: { kind: 'css', selector: '#pause-button' },
          timeout_ms: 90000,
        },
        {
          step_id: 'open-controls-accessibility',
          action: 'click',
          locator: { kind: 'role', role: 'button', name: 'Controls & accessibility' },
          timeout_ms: 30000,
        },
        {
          step_id: 'toggle-quick-cast-with-indicator',
          action: 'click',
          locator: { kind: 'css', selector: '[data-action="cast-mode"][data-cast-mode="quick-indicator"]' },
          timeout_ms: 15000,
        },
        {
          step_id: 'toggle-deuteranopia-palette',
          action: 'click',
          locator: { kind: 'css', selector: '[data-action="color-vision"][data-color-vision="deuteranopia"]' },
          timeout_ms: 15000,
        },
        {
          step_id: 'close-controls-modal',
          action: 'click',
          locator: { kind: 'role', role: 'button', name: 'Back to pause menu' },
          timeout_ms: 15000,
        },
      ],
    })
  );

  await runRea([
    'capture-browser-scenario',
    scenarioInput,
    '--detail',
    'summary',
    '--evidence_output',
    scenarioBundlePath,
    '--json',
  ]);
  const scenarioBundle = JSON.parse(readFileSync(scenarioBundlePath, 'utf8'));
  const scenarioRecord = scenarioBundle.records[0];

  // 5. Passive CDP inspection of the live production page + static-to-runtime reconciliation
  const cdpPort = await new Promise((resolvePort, rejectPort) => {
    const probe = createNetServer();
    probe.once('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const { port: freePort } = probe.address();
      probe.close(() => resolvePort(freePort));
    });
  });
  const chromeProfileDir = join(workDir, 'chrome-cdp-profile');
  mkdirSync(chromeProfileDir, { recursive: true });
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${chromeProfileDir}`,
      '--window-size=1280,720',
      baseUrl,
    ],
    { stdio: 'ignore' }
  );

  let inspectPageRecord;
  try {
    let pageTarget = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        if (res.ok) {
          const targets = await res.json();
          pageTarget = targets.find((t) => t.type === 'page' && String(t.url).startsWith(baseUrl));
          if (pageTarget) break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!pageTarget) {
      throw new Error(`Timed out waiting for Chrome CDP page target at ${baseUrl}`);
    }
    await new Promise((r) => setTimeout(r, 5000));

    inspectPageRecord = parseJsonLinesOrObject(
      await runRea([
        'inspect-web-page',
        `http://127.0.0.1:${cdpPort}`,
        pageTarget.id,
        '--observation-ms',
        '1500',
        '--command-timeout-ms',
        '60000',
        '--include-console-text',
        '--include-storage-keys',
        '--json',
      ])
    );
  } finally {
    chromeProc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (!chromeProc.killed) chromeProc.kill('SIGKILL');
  }

  const preMergePath = join(workDir, 'pre-reconcile-bundle.json');
  const sortByKey = (arr, key) =>
    [...arr].sort((a, b) => {
      const ka = String(a?.[key] ?? '');
      const kb = String(b?.[key] ?? '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const mergeBundles = (bundles) => {
    const byId = (arr, key) => {
      const m = new Map();
      for (const item of arr) {
        if (!item) continue;
        m.set(item[key] ?? JSON.stringify(item), item);
      }
      return sortByKey([...m.values()], key);
    };
    return {
      evidence_format: jsBundle.evidence_format,
      artifacts: byId(
        bundles.flatMap((b) => b.artifacts ?? []),
        'artifact_id'
      ),
      providers: byId(
        bundles.flatMap((b) => b.providers ?? []),
        'provider_id'
      ),
      captures: byId(
        bundles.flatMap((b) => b.captures ?? []),
        'capture_id'
      ),
      environments: byId(
        bundles.flatMap((b) => b.environments ?? []),
        'environment_id'
      ),
      scenarios: byId(
        bundles.flatMap((b) => b.scenarios ?? []),
        'scenario_id'
      ),
      unknowns: byId(
        bundles.flatMap((b) => b.unknowns ?? []),
        'unknown_id'
      ),
      records: byId(
        bundles.flatMap((b) => b.records ?? []),
        'evidence_id'
      ),
    };
  };

  const preMerge = mergeBundles([jsBundle, scenarioBundle]);
  writeFileSync(preMergePath, JSON.stringify(preMerge));

  const reconcileInput = join(workDir, 'reconcile.json');
  writeFileSync(
    reconcileInput,
    JSON.stringify({
      static_layers: [
        {
          role: 'application',
          analysis: appRef,
          runtime_mappings: [
            {
              kind: 'url-prefix',
              prefix: baseUrl,
              artifact_prefix: '',
            },
          ],
        },
      ],
      runtime_observations: [inspectPageRecord],
    })
  );

  const reconcileRecord = parseJsonLinesOrObject(
    await runRea([
      'reconcile-javascript-runtime',
      reconcileInput,
      '--evidence-bundle',
      preMergePath,
      '--json',
    ])
  );

  // 6. Export canonical authenticated Evidence bundle and validate via evidence-import
  mkdirSync(resolve('artifacts'), { recursive: true });
  await runRea(['evidence-export', preMergePath, OUT_BUNDLE, '--overwrite', '--json']);
  const importCheck = parseJsonLinesOrObject(
    await runRea(['evidence-import', OUT_BUNDLE, '--json'])
  );

  const bundleBytes = readFileSync(OUT_BUNDLE);
  const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');
  const canonical = JSON.parse(bundleBytes.toString('utf8'));

  const summary = {
    tool: 'morluto/rea',
    package: REA_PKG,
    bundleFile: 'artifacts/milestone10-rea-evidence-bundle.json',
    bundleBytes: bundleBytes.length,
    bundleSha256,
    records: canonical.records.length,
    unknowns: canonical.unknowns.length,
    importValidation: importCheck,
    evidenceIds: {
      releaseExposureAudit: exposureRecord.evidence_id,
      javascriptApplicationGraph: jsRecord.evidence_id,
      featureTracePlayerSettings: traceSettingsRecord.evidence_id,
      featureTraceOfflinePack: traceOfflineRecord.evidence_id,
      browserScenarioCapture: scenarioRecord.evidence_id,
      passiveWebPageInspection: inspectPageRecord.evidence_id,
      runtimeReconciliation: reconcileRecord.evidence_id,
    },
    highlights: {
      releaseExposure: exposureRecord.normalized_result ?? null,
      featureTracePlayerSettings: traceSettingsRecord.normalized_result?.summary ?? null,
      featureTraceOfflinePack: traceOfflineRecord.normalized_result?.summary ?? null,
      passiveWebPageInspection: {
        scriptsObserved: inspectPageRecord.normalized_result?.scripts?.length ?? null,
        consoleMessages: inspectPageRecord.normalized_result?.console_messages?.length ?? null,
        storageKeys: inspectPageRecord.normalized_result?.storage?.local_storage_keys ?? null,
      },
      runtimeReconciliation:
        reconcileRecord.normalized_result?.summary ?? reconcileRecord.normalized_result ?? null,
    },
  };
  writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  server.close();
  rmSync(workDir, { recursive: true, force: true });
}
