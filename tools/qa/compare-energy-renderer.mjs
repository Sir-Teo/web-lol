/** Compare current drawing and visible skeletons with a frozen pre-optimization view. */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const baselineFile = process.argv[2],
  output = process.argv[3];
if (!baselineFile || !output)
  throw new Error(
    'Usage: node tools/qa/compare-energy-renderer.mjs BASELINE_VIEW.ts FRESH_OUTPUT.json'
  );
const frozen = await readFile(baselineFile, 'utf8');
const baselineSingularitiesFile = process.argv[4];
const frozenSingularities = baselineSingularitiesFile
  ? await readFile(baselineSingularitiesFile, 'utf8')
  : null;
const baselineModelsFile = process.argv[5];
const frozenModels = baselineModelsFile ? await readFile(baselineModelsFile, 'utf8') : null;
const sharedAssets = process.argv.includes('--shared-assets');
const sourcePath = resolve('src/render/view.ts');
const server = await createServer({
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
  plugins: [
    {
      name: 'frozen-energy-reference',
      enforce: 'pre',
      load(id) {
        if (id === sourcePath + '?energy-reference') {
          let reference = frozen;
          if (frozenSingularities)
            reference = reference.replace(
              "'./lux-singularities'",
              "'./lux-singularities?energy-reference'"
            );
          if (frozenModels)
            reference = reference.replace("'./models'", "'./models?energy-reference'");
          return reference;
        }
        if (frozenModels && id === resolve('src/render/models.ts') + '?energy-reference')
          return sharedAssets
            ? `export * from '/src/render/models.ts';
            import { makeModel as actualMakeModel } from '/src/render/models.ts';
            export function makeModel(unit) {
              const model = actualMakeModel(unit);
              model.root.traverse(node => {
                if (node.isSkinnedMesh && node.userData.animationSeparateCullBounds)
                  node.frustumCulled = false;
              });
              return model;
            }`
            : frozenModels;
        if (
          frozenSingularities &&
          id === resolve('src/render/lux-singularities.ts') + '?energy-reference'
        )
          return frozenSingularities;
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5198/?scene=fixture&npc=leona');
  await page.waitForFunction(() => window.__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(
    async ({ includeLuxPhases, referenceModels, sharedAssets }) => {
      const g = window.__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      v.renderer.setAnimationLoop(null);
      if (referenceModels && !sharedAssets) {
        const { loadReferenceModels } = await import('/src/render/models.ts?energy-reference');
        await loadReferenceModels(false, true);
      }
      const { GameView } = await import('/src/render/view.ts?energy-reference');
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      document.body.append(host);
      const ref = new GameView(host, w.battlefield);
      v.center = { ...w.hero };
      ref.center = { ...w.hero };
      v.locked = ref.locked = false;
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      for (const u of w.units) {
        u.ai = false;
        w.setOrder(u, { type: 'idle' });
      }
      const target = w.spawn('champion', 'red', { x: w.hero.x + 180, y: w.hero.y }, 'lux');
      target.ai = false;
      const garen = w.spawn('champion', 'blue', { x: w.hero.x - 120, y: w.hero.y + 80 }, 'garen');
      garen.ai = false;
      const sight = w.visible.bind(w);
      const pointSight = w.pointVisible.bind(w);
      let hidden = false;
      let hiddenEffects = false;
      w.visible = (u, ...args) => (u.id === target.id ? !hidden : sight(u, ...args));
      w.pointVisible = (point, ...args) => !hiddenEffects && pointSight(point, ...args);
      const hash = async (pixels) =>
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)))
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('');
      const capture = async (view, alpha) => {
        view.render(w, alpha, 20 + w.tick / 60);
        const gl = view.renderer.getContext(),
          pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels
        );
        const bones = [];
        for (const [id, m] of view.models) {
          if (!m.root.visible) continue;
          const matrices = [];
          m.root.traverse((o) => {
            if (o.isBone) matrices.push(...o.matrixWorld.elements);
          });
          bones.push([id, m.actionName, ...m.root.matrixWorld.elements, ...matrices]);
        }
        return { hash: await hash(pixels), bones, pixels };
      };
      // Both views begin the comparison on the same fog refresh boundary.
      v.lastFogTick = ref.lastFogTick = -100;
      const samples = [];
      for (const phase of [
        'idle',
        'run',
        'blend',
        'hidden',
        'hidden-seek',
        'reveal',
        'attack',
        ...(includeLuxPhases
          ? ['field', 'hidden-field', 'reveal-field', 'burst', 'hidden-burst', 'reveal-burst']
          : []),
        'death',
        'death-tail',
        'respawn',
      ]) {
        if (phase === 'run')
          w.setOrder(garen, { type: 'move', point: { x: garen.x + 400, y: garen.y } });
        if (phase === 'blend') w.setOrder(garen, { type: 'idle' });
        if (phase === 'hidden') hidden = true;
        if (phase === 'reveal') hidden = false;
        if (phase === 'attack') w.setOrder(target, { type: 'attack', target: w.hero.id });
        if (phase === 'field')
          w.enqueue({ type: 'cast', unit: target.id, ability: 'e', point: w.hero });
        if (phase === 'burst')
          w.enqueue({ type: 'cast', unit: target.id, ability: 'e', point: w.hero });
        hiddenEffects = phase === 'hidden-field' || phase === 'hidden-burst';
        if (phase === 'death') w.damage(w.hero, target, 1e6, 'true');
        const steps =
          phase === 'hidden-seek'
            ? 100
            : phase === 'death-tail'
              ? 120
              : phase === 'respawn'
                ? 2700
                : phase === 'attack'
                  ? 20
                  : phase === 'field'
                    ? 75
                    : 1;
        w.step(steps);
        const before = w.snapshot();
        for (const alpha of [0, 0.25, 0.75, 1]) {
          const a = await capture(ref, alpha),
            b = await capture(v, alpha);
          let pixelDiff = 0;
          for (let i = 0; i < a.pixels.length; i++) if (a.pixels[i] !== b.pixels[i]) pixelDiff++;
          const sample = {
            phase,
            tick: w.tick,
            alpha,
            pixelsEqual: a.hash === b.hash,
            pixelDiff,
            bonesEqual: JSON.stringify(a.bones) === JSON.stringify(b.bones),
            visibleModels: a.bones.length,
            referenceHash: a.hash,
            currentHash: b.hash,
          };
          samples.push(sample);
        }
        if (w.snapshot() !== before) throw new Error('Presentation mutated world');
      }
      return { samples };
    },
    { includeLuxPhases: !!frozenSingularities, referenceModels: !!frozenModels, sharedAssets }
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        baselineFile,
        baselineSHA256: createHash('sha256').update(frozen).digest('hex'),
        baselineSingularitiesFile: baselineSingularitiesFile ?? null,
        baselineModelsFile: baselineModelsFile ?? null,
        modelAssetControl: sharedAssets
          ? 'Shared untouched GLTF assets; baseline adapter disables newly added rig culling'
          : 'Independent asset caches',
        baselineModelsSHA256: frozenModels
          ? createHash('sha256').update(frozenModels).digest('hex')
          : null,
        baselineSingularitiesSHA256: frozenSingularities
          ? createHash('sha256').update(frozenSingularities).digest('hex')
          : null,
        currentSHA256: createHash('sha256')
          .update(await readFile(sourcePath))
          .digest('hex'),
        ...result,
        errors,
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  );
  console.log(
    JSON.stringify(
      {
        samples: result.samples.length,
        failures: result.samples.filter((x) => !x.pixelsEqual || !x.bonesEqual),
        errors,
      },
      null,
      2
    )
  );
  if (errors.length || result.samples.some((x) => !x.pixelsEqual || !x.bonesEqual))
    process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await server.close();
}
