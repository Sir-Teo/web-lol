/** Isolated Vite integration: exercise the real config without mutating the game. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const run =
  process.argv[2] ??
  new Date()
    .toISOString()
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
assert(/^[a-z0-9-]+$/.test(run), 'Use a simple unique run name');
const root = resolve(`.cache/ruleset-closure-watch-project-${run}`);
assert(!existsSync(root), 'Keep old live-watch evidence; use a fresh project directory');
const put = (file, value) => {
  const target = resolve(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
};
put('index.html', `<script type="module" src="/src/simulation/world.ts"></script>`);
put('map.html', '<p>Isolated watch fixture</p>');
put(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
    },
    include: ['src'],
  })
);
for (const file of [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tools/ruleset-fingerprint.ts',
]) {
  mkdirSync(dirname(resolve(root, file)), { recursive: true });
  copyFileSync(file, resolve(root, file));
}
for (const file of [
  'public/assets/maps/rift-layout.json',
  'public/assets/maps/rift-nav.json',
  'public/assets/maps/rift-nav.bin',
  'src/content/lux-e-burst.json',
  'src/content/lux-e-field.json',
  'src/content/gromp-death.json',
  'src/content/gromp-attack.json',
])
  put(file, '{}');
put(
  'src/simulation/world.ts',
  `import { mobilePose } from '../render/mobile-pose';
window.ruleset = __SIMULATION_HASH__; window.pose = mobilePose;`
);
put(
  'src/render/mobile-pose.ts',
  `import data from '../content/mobile-clip-durations.json';
export const mobilePose = data.duration;`
);
put('src/content/mobile-clip-durations.json', '{"duration":100}');
symlinkSync(resolve('node_modules'), resolve(root, 'node_modules'), 'dir');
const reservation = createServer();
await new Promise((yes, no) => {
  reservation.once('error', no);
  reservation.listen(0, '127.0.0.1', yes);
});
const port = reservation.address().port;
await new Promise((yes, no) => reservation.close((error) => (error ? no(error) : yes())));
const child = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);
let serverOutput = '';
child.stdout.on('data', (chunk) => {
  serverOutput += chunk;
});
child.stderr.on('data', (chunk) => {
  serverOutput += chunk;
});
const exited = once(child, 'exit');
let browser;
const stages = [];
const browserErrors = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  const base = `http://127.0.0.1:${port}/`;
  async function observe(name, pose) {
    const expected = rulesetFingerprint(root);
    const deadline = Date.now() + 30000;
    let state, error;
    while (Date.now() < deadline) {
      assert.equal(child.exitCode, null, serverOutput);
      try {
        await page.goto(base, { timeout: 5000 });
        await page.waitForFunction(() => typeof window.ruleset === 'string', null, {
          timeout: 2000,
        });
        state = await page.evaluate(() => ({ ruleset: window.ruleset, pose: window.pose }));
        if (state.ruleset === expected && state.pose === pose) break;
      } catch (caught) {
        error = caught.message;
      }
      await new Promise((yes) => setTimeout(yes, 100));
    }
    assert.deepEqual(
      state,
      { ruleset: expected, pose },
      `${name}: ${error ?? ''}\n${browserErrors.join('\n')}\n${serverOutput}`
    );
    stages.push({ name, ...state });
  }
  await observe('initial', 100);
  put('src/content/mobile-clip-durations.json', '{"duration":200}');
  await observe('imported JSON changes identity', 200);
  put(
    'src/render/mobile-pose.ts',
    `import data from '../content/mobile-clip-durations.json';
export const mobilePose = data.duration + 1;`
  );
  await observe('pose helper changes identity', 201);
  put('src/render/new-duration.json', '{"duration":300}');
  put(
    'src/render/mobile-pose.ts',
    `import data from './new-duration.json';
export const mobilePose = data.duration;`
  );
  await observe('new transitive JSON discovered after restart', 300);
  put('src/render/new-duration.json', '{"duration":400}');
  await observe('new dependency remains watched', 400);
  assert.equal(new Set(stages.map((stage) => stage.ruleset)).size, 5);
  put('src/render/unused.ts', 'export const color = 1;');
  await observe('unimported renderer preserves identity', 400);
  assert.equal(stages.at(-1).ruleset, stages.at(-2).ruleset);
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(
    `artifacts/ruleset-closure-watch-${run}.json`,
    JSON.stringify(
      {
        result: 'passed',
        config: 'vite.config.ts',
        isolatedProject: root,
        stages,
        productionRuleset: rulesetFingerprint(),
      },
      null,
      2
    ) + '\n'
  );
  console.log(JSON.stringify({ result: 'passed', stages: stages.length, distinctIdentities: 5 }));
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await exited;
  writeFileSync(`.cache/ruleset-closure-watch-server-${run}.log`, serverOutput);
  writeFileSync(
    `.cache/ruleset-closure-watch-browser-${run}.json`,
    JSON.stringify({ stages, browserErrors }, null, 2)
  );
}
