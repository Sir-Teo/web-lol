/** Bytewise E frames/state against a frozen shared surface renderer. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const [baseline, baselineWrapper, output] = process.argv.slice(2);
assert(
  baseline && baselineWrapper && output,
  'Usage: node tools/qa/compare-e-surfaces.mjs BASELINE_CORE.ts BASELINE_E_WRAPPER.ts FRESH_REPORT.json'
);
const frozen = await readFile(baseline, 'utf8'),
  sourcePath = resolve('src/render/leona-zenith-surfaces.ts'),
  corePath = resolve('src/render/source-particle-surfaces.ts'),
  wrapper = (await readFile(baselineWrapper, 'utf8')).replace(
    "'./source-particle-surfaces'",
    "'./source-particle-surfaces.ts?solar-reference'"
  );
const server = await createServer({
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
  plugins: [
    {
      name: 'frozen-e-surfaces',
      enforce: 'pre',
      load(id) {
        if (id === sourcePath + '?surface-reference') return wrapper;
        if (id === corePath + '?solar-reference') return frozen;
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5198/?scene=fixture&npc=leona');
  await page.waitForFunction(() => window.__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = window.__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const { LeonaZenithSurfaces } =
      await import('/src/render/leona-zenith-surfaces.ts?surface-reference');
    const ref = new LeonaZenithSurfaces(v.scene, v.particleDistortion.scene, (p) => v.ground(p));
    const u = w.units.find((u) => u.champion === 'leona');
    w.units = [w.hero, u];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: 0, previous: { x: -300, y: 0 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const unit of w.units) unit.ai = false;
    v.locked = false;
    v.zoom = 0.55;
    v.recenter(u);
    const current = v.leonaZenithSurfaces.renderer,
      samples = [];
    const visible = (renderer, value) => {
      for (const m of renderer.models.values()) m.visible = value;
    };
    const state = (renderer) =>
      [...renderer.models]
        .map(([key, m]) => ({
          key,
          data: m.userData,
          position: m.position.toArray(),
          rotation: m.quaternion.toArray(),
          scale: m.scale.toArray(),
          color: m.material.uniforms.particleColor.value.toArray(),
          uv: m.material.uniforms.sourceUvTransform?.value.toArray(),
          mult: m.material.uniforms.multiplierUvTransform?.value.toArray(),
          lookup: m.material.uniforms.lookupUv.value.toArray(),
          erosion: m.material.uniforms.erosionParameters?.value.toArray(),
          vertices: m.userData.ownedGeometry
            ? [...m.geometry.getAttribute('position').array]
            : null,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
    const read = () => {
      const gl = v.renderer.getContext(),
        bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bytes
      );
      return bytes;
    };
    const draw = (renderer) => {
      renderer.prepareDepth(v.renderer, v.camera);
      v.renderer.render(v.scene, v.camera);
      v.particleDistortion.render(v.renderer, v.camera);
      return read();
    };
    const cast = () => {
      w.championState(u.id).cooldowns.e = 0;
      u.mana = u.maxMana;
      w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
      w.step();
      return w.tick;
    };
    try {
      for (const outcome of ['hit', 'miss']) {
        if (outcome === 'miss') {
          w.step(400);
          Object.assign(target, { x: 3000, previous: { x: 3000, y: 0 } });
        }
        const start = cast(),
          ages =
            outcome === 'hit'
              ? [13, 15, 18, 20, 24, 29, 34, 38, 42, 46, 50, 54, 58, 62]
              : [13, 18, 24, 29, 38, 54, 75];
        for (const age of ages) {
          w.step(start + age - w.tick);
          const saved = w.snapshot();
          for (const alpha of [0, 0.5, 1]) {
            visible(ref, false);
            visible(current, true);
            v.render(w, alpha, 22.5);
            ref.update(w, alpha, v.camera);
            visible(current, false);
            visible(ref, true);
            const a = draw(ref),
              oldState = state(ref);
            visible(ref, false);
            visible(current, true);
            const b = draw(current),
              newState = state(current);
            let different = 0,
              ha = 2166136261,
              hb = 2166136261;
            const first = [];
            for (let i = 0; i < a.length; i++) {
              ha = Math.imul(ha ^ a[i], 16777619);
              hb = Math.imul(hb ^ b[i], 16777619);
              if (a[i] !== b[i]) {
                different++;
                if (first.length < 12) first.push({ at: i, before: a[i], after: b[i] });
              }
            }
            samples.push({
              outcome,
              age,
              alpha,
              tick: w.tick,
              pixelBytes: a.length,
              different,
              first,
              stateEqual: JSON.stringify(oldState) === JSON.stringify(newState),
              models: oldState.length,
              beforeChecksum: ha >>> 0,
              afterChecksum: hb >>> 0,
              error: v.renderer.getContext().getError(),
            });
          }
          if (w.snapshot() !== saved) throw Error('Surface comparison changed World state');
        }
      }
    } finally {
      ref.dispose();
      visible(current, true);
    }
    return { samples };
  });
  const sha = (data) => createHash('sha256').update(data).digest('hex');
  const report = {
    baseline,
    baselineSha256: sha(frozen),
    baselineWrapper,
    baselineWrapperSha256: sha(await readFile(baselineWrapper)),
    currentWrapperSha256: sha(await readFile(sourcePath)),
    currentCoreSha256: sha(await readFile('src/render/source-particle-surfaces.ts')),
    scope:
      'Frozen E wrapper/shared core before Solar orbital hooks; shared scene/assets; no native renderer comparison',
    ...result,
    errors,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(errors, []);
  assert.equal(result.samples.length, 63);
  for (const s of result.samples) {
    assert.equal(s.different, 0, JSON.stringify(s));
    assert.equal(s.stateEqual, true, JSON.stringify(s));
    assert.equal(s.error, 0);
  }
  console.log(
    JSON.stringify({
      result: 'passed',
      frames: result.samples.length,
      bytewisePixels: true,
      sourceState: true,
    })
  );
} finally {
  await browser?.close();
  await server.close();
}
