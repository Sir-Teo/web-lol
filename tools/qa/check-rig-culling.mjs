/** Validate conservative all-clip bounds and compare culling pixels/shadows. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const url = process.argv[2] ?? 'http://127.0.0.1:5198',
  output = process.argv[3];
if (!output) throw Error('Usage: node tools/qa/check-rig-culling.mjs URL FRESH_OUTPUT.json');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL('?scene=fixture&npc=leona', url).href);
  await page.waitForFunction(() => window.__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = window.__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const { MONSTERS } = await import('/src/content/monsters.ts');
    const { animationCullingSphere } = await import('/src/render/animation-bounds.ts');
    const { loadReferenceModels, createTargetPoseSampler } = await import('/src/render/models.ts');
    await loadReferenceModels(Object.keys(MONSTERS), true);
    const rigs = [
      ...new Set([
        'ashe-base',
        'lux-base',
        'garen-base',
        'leona-base',
        'sightward-base',
        ...['blue', 'red'].flatMap((t) =>
          ['melee', 'caster', 'siege', 'super', 'turret', 'nexus', 'inhibitor'].map(
            (k) => `${t}-${k}`
          )
        ),
        ...Object.values(MONSTERS).map((p) => p.rig),
      ]),
    ];
    const assets = [],
      failures = [];
    for (const rig of rigs) {
      const sampler = createTargetPoseSampler(rig),
        meshes = [];
      sampler.renderRoot.traverse((m) => {
        if (m.isSkinnedMesh) meshes.push(m);
      });
      const clips = [...sampler.clips.values()];
      let tested = 0,
        poses = 0;
      const validate = () => {
        poses++;
        for (const m of meshes) {
          if (!m.userData.animationBounds) continue;
          const bound = animationCullingSphere(m);
          const point = bound.center.clone();
          for (let i = 0; i < m.geometry.attributes.position.count; i++) {
            m.getVertexPosition(i, point);
            tested++;
            if (point.distanceTo(bound.center) > bound.radius + 1e-5) {
              failures.push(`${rig}/${m.name}/${i}`);
              break;
            }
          }
        }
      };
      for (const c of clips)
        for (const f of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
          sampler.sample([{ clip: c.name, time: c.duration * f, weight: 1 }]);
          validate();
        }
      if (clips.length >= 3) {
        sampler.sample(
          clips.slice(0, 3).map((c, i) => ({
            clip: c.name,
            time: c.duration * [0.2, 0.5, 0.8][i],
            weight: [0.2, 0.3, 0.5][i],
          }))
        );
        validate();
      }
      assets.push({
        rig,
        clips: clips.length,
        meshes: meshes.length,
        bounded: meshes.filter((m) => m.userData.animationBounds && m.frustumCulled).length,
        poses,
        testedVertices: tested,
        radii: meshes.map((m) => animationCullingSphere(m)?.radius ?? null),
      });
      sampler.dispose();
    }
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    for (const [i, c] of ['lux', 'garen', 'leona'].entries())
      w.spawn('champion', 'blue', { x: (i - 1) * 350, y: 300 }, c);
    for (const [i, k] of ['melee', 'caster', 'siege', 'super'].entries())
      for (const [j, t] of ['blue', 'red'].entries())
        w.spawn(k, t, { x: (j ? 1 : -1) * (1200 + i * 600), y: i * 300 - 500 });
    w.visible = () => true;
    w.pointVisible = () => true;
    v.locked = false;
    const comparisons = [];
    for (const center of [
      { x: 0, y: 0 },
      { x: 1200, y: -900 },
      { x: -1200, y: 900 },
      { x: 2500, y: 0 },
      { x: -2500, y: 0 },
    ]) {
      v.center = center;
      v.render(w, 1, v.previousElapsed);
      const meshes = [];
      for (const m of v.models.values())
        m.root.traverse((o) => {
          if (o.isSkinnedMesh && o.userData.animationBounds) meshes.push(o);
        });
      const capture = () => {
        v.renderer.render(v.scene, v.camera);
        const gl = v.renderer.getContext(),
          p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          p
        );
        return {
          p,
          calls: v.renderer.info.render.calls,
          triangles: v.renderer.info.render.triangles,
        };
      };
      for (const m of meshes) m.frustumCulled = true;
      const a = capture();
      for (const m of meshes) m.frustumCulled = false;
      const b = capture();
      let differences = 0;
      for (let i = 0; i < a.p.length; i++) if (a.p[i] !== b.p[i]) differences++;
      comparisons.push({
        center,
        boundedMeshes: meshes.length,
        differences,
        culledCalls: a.calls,
        fullCalls: b.calls,
        culledTriangles: a.triangles,
        fullTriangles: b.triangles,
      });
      for (const m of meshes) m.frustumCulled = true;
    }
    return { assets, failures, comparisons };
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ ...result, errors }, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify(
      {
        assets: result.assets.length,
        bounded: result.assets.filter((x) => x.bounded > 0).length,
        testedVertices: result.assets.reduce((n, x) => n + x.testedVertices, 0),
        failures: result.failures,
        comparisons: result.comparisons,
        errors,
      },
      null,
      2
    )
  );
  if (errors.length || result.failures.length || result.comparisons.some((x) => x.differences))
    process.exitCode = 1;
} finally {
  await browser.close();
}
