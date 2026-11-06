/** Render the real authored transports in an isolated source-space preview. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const run =
  process.argv[2] ??
  new Date()
    .toISOString()
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
assert(process.argv.length <= 3 && /^[a-z0-9-]+$/.test(run), 'Invalid preview run name');
const prefix = `artifacts/baron-preview-${run}`;
for (const role of ['missile', 'hit'])
  for (const tick of [6, 20, 40, 80])
    assert(!fs.existsSync(`${prefix}-${role}-${tick}.png`), 'Preview screenshot already exists');
assert(!fs.existsSync(prefix + '.json'), 'Preview report already exists');
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync(prefix + '.claim', JSON.stringify({ run, pid: process.pid }) + '\n', {
  flag: 'wx',
});

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  plugins: [
    {
      name: 'baron-preview',
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== '/__baron-preview') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(
            '<!doctype html><link rel="icon" href="data:,"><style>html,body{margin:0;background:#131925}canvas{display:block}</style><title>Baron source particle preview</title>'
          );
        });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } }),
    errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/assets/effects/baron-attack/'))
      requests.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  await page.goto(server.resolvedUrls.local[0] + '__baron-preview');
  const setup = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { loadBaronParticleResources } = await import('/src/render/baron-particle-resources.ts');
    const { BaronParticleBatch } = await import('/src/render/baron-particle-batch.ts');
    const { BaronAttackSystem } = await import('/src/render/baron-attack-system.ts');
    const { sourceFlightBasis } = await import('/src/render/source-flight-basis.ts');
    const resources = await loadBaronParticleResources(),
      renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(900, 650);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x131925);
    document.body.append(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-6.9, 6.9, 5, -5, 0.1, 100);
    camera.position.set(10, 7, 12);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const grid = new THREE.GridHelper(14, 14, 0x354359, 0x253044);
    scene.add(grid);
    const previews = {};
    for (const role of ['missile', 'hit']) {
      const system = new BaronAttackSystem(resources.program, role, 12345, {
        capacity: 512,
        birthFactors: () => ({ birthScale: 1, emitOffset: 1 }),
      });
      const batch = new BaronParticleBatch(resources, role);
      scene.add(batch.root);
      previews[role] = {
        system,
        batch,
        orientation:
          role === 'missile'
            ? Array.from(sourceFlightBasis([6, 0, 0]))
            : [1, 0, 0, 0, 1, 0, 0, 0, 1],
      };
    }
    window.baronPreview = { resources, renderer, scene, camera, previews };
    return { textures: resources.textures.size, drawingMeshes: resources.meshes.size };
  });
  const observations = [];
  for (const role of ['missile', 'hit'])
    for (const tick of [6, 20, 40, 80]) {
      const reading = await page.evaluate(
        ({ role, tick }) => {
          const { renderer, scene, camera, previews } = window.baronPreview;
          for (const [name, p] of Object.entries(previews)) p.batch.root.visible = name === role;
          const { system, batch, orientation } = previews[role];
          while (system.checkpoint().steps < tick) {
            const step = system.checkpoint().steps + 1;
            system.step({
              dt: 1 / 60,
              origin: role === 'missile' ? [-300 + step * 6, 150, 0] : [0, 100, 0],
              moved: role === 'missile' ? [6, 0, 0] : [0, 0, 0],
              orientation,
              stopped: step >= 60,
            });
          }
          const packets = system.packets();
          batch.update(packets, camera);
          renderer.render(scene, camera);
          return {
            role,
            tick,
            particles: packets.length,
            visible: batch.root.children.filter((m) => m.visible).map((m) => m.name),
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
          };
        },
        { role, tick }
      );
      observations.push(reading);
      await page.screenshot({ path: `${prefix}-${role}-${tick}.png` });
    }
  const cleanup = await page.evaluate(() => {
    const { resources, renderer, previews } = window.baronPreview;
    for (const p of Object.values(previews)) p.batch.dispose();
    resources.dispose();
    renderer.dispose();
    return { textures: resources.textures.size, meshes: resources.meshes.size };
  });
  assert.deepEqual(errors, []);
  assert.equal(setup.textures, 25);
  assert.equal(setup.drawingMeshes, 1);
  assert.deepEqual(cleanup, { textures: 0, meshes: 0 });
  assert(requests.every((r) => r.status === 200));
  assert.equal(requests.filter((r) => r.path.endsWith('.glb')).length, 1);
  assert(
    !requests.some((r) => r.path.endsWith('80975d7a4f06e4d6.glb')),
    'Emission sphere was fetched for drawing'
  );
  assert(observations.every((r) => r.drawCalls <= 22));
  const observed = new Set(observations.flatMap((r) => r.visible));
  assert.equal(observed.size, 21, 'Not all authored emitters were drawn');
  fs.writeFileSync(
    prefix + '.json',
    JSON.stringify(
      {
        status: 'passed',
        run,
        browserVersion: browser.version(),
        nativeExecuted: false,
        activeGameplayBinding: false,
        birthFactors: 'explicit neutral preview factors',
        setup,
        cleanup,
        requests,
        observations,
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      emitters: observed.size,
      screenshots: observations.length,
      nativeExecuted: false,
    })
  );
} finally {
  await browser?.close();
  await server.close();
}
