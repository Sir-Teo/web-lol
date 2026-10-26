import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-r-cast-particles.json', 'utf8'));

let errors: string[] = [];
test.beforeEach(({ page }) => {
  test.setTimeout(120000);
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function prepare(page: Page) {
  await page.goto('/?scene=fixture&champion=masteryi');
  await ready(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    w.gainExperience(1e6);
    if (w.learnSpell('r') !== null) throw Error('Cannot learn Highlander');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
}
async function installDescribe(page: Page) {
  await page.evaluate(() => {
    (window as any).__R_CAST_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.highlanderCasts.models]
        .map(([key, mesh]: any) => ({
          key,
          name: mesh.name,
          data: mesh.userData,
          position: mesh.position.toArray(),
          quaternion: mesh.quaternion.toArray(),
          scale: mesh.scale.toArray(),
          color: mesh.material.uniforms.particleColor.value.toArray(),
          lookup: mesh.material.uniforms.lookupUv.value.toArray(),
          uv: mesh.material.uniforms.sourceUvTransform?.value.toArray() ?? null,
          mult: mesh.material.uniforms.multiplierUvTransform?.value.toArray() ?? null,
          defines: mesh.material.defines,
          vertices: mesh.geometry.getAttribute('position').count,
        }))
        .sort((a: any, b: any) => a.key.localeCompare(b.key));
  });
}
for (const pausedByW of [false, true])
  test(`real R ${pausedByW ? 'during Meditate' : 'while moving'} restores all eight families and exact native mip pixels`, async ({
    page,
  }, info) => {
    await prepare(page);
    await installDescribe(page);
    await page.evaluate(() => {
      window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), {
        once: true,
      });
      (window as any).__GAME__.setPaused(false);
    });
    await page.keyboard.press('r');
    const before = await page.evaluate((pausedByW) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      const record = w.player.highlanderCastVisuals.at(-1);
      if (!record) throw Error('Real R was not admitted');
      if (pausedByW) {
        w.learnSpell('w');
        w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
        w.step();
      } else w.setOrder(w.hero, { type: 'move', point: { x: 150, y: 90 } });
      const early = w.snapshot();
      (window as any).__R_CAST_EARLY__ = early;
      w.step(record.startTick + 9 - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(120);
      const meshes = [...g.view.highlanderCasts.models.values()].filter(
        (mesh: any) => mesh.userData.sourceMesh
      );
      const cone = meshes.filter((mesh: any) => mesh.userData.profileIndex !== 1);
      return {
        saved,
        future: copy.snapshot(),
        record: structuredClone(record),
        paused: w.player.highlander.pausedTicks,
        particles: (window as any).__R_CAST_DESCRIBE__(),
        geometryCount: new Set(meshes.map((mesh: any) => mesh.geometry)).size,
        coneShared: cone.every((mesh: any) => mesh.geometry === cone[0].geometry),
      };
    }, pausedByW);
    expect(before.paused > 0).toBe(pausedByW);
    expect(before.particles).toHaveLength(23);
    expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(8);
    expect(before.geometryCount).toBe(2);
    expect(before.coneShared).toBe(true);
    if (!pausedByW) {
      const replay = await page.evaluate(async (assets) => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext(),
          textures = new Map();
        for (const mesh of g.view.highlanderCasts.models.values())
          for (const name of ['sourceTexture', 'particleColorTexture', 'normalTexture']) {
            const texture = mesh.material.uniforms[name]?.value;
            if (texture?.name) textures.set(texture.name, texture);
          }
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
          fb = gl.createFramebuffer(),
          results = [];
        try {
          for (const asset of assets) {
            const texture: any = textures.get(asset.url);
            if (!texture) throw Error('Missing active R texture: ' + asset.url);
            renderer.initTexture(texture);
            const native = renderer.properties.get(texture).__webglTexture;
            for (const rect of asset.rectangles) {
              gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                native,
                rect.level
              );
              if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                throw Error('Incomplete R mip framebuffer');
              const bytes = new Uint8Array(rect.width * rect.height * 4);
              gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              if (gl.getError() !== gl.NO_ERROR) throw Error('R mip readback error');
              const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              if (hash !== rect.rgbaSha256) throw Error('R authored mip differs');
              results.push({ url: asset.url, level: rect.level, rgbaSha256: hash });
            }
          }
        } finally {
          gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
          gl.deleteFramebuffer(fb);
          renderer.resetState();
        }
        return results;
      }, data.textures);
      expect(replay).toHaveLength(86);
      writeFileSync(
        info.outputPath('active-three-mip-readback.json'),
        JSON.stringify(replay, null, 2)
      );
      const coverage = await page.evaluate(async () => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer;
        const threeUrl = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((url) => /\/node_modules\/\.vite\/deps\/three\.js(?:\?|$)/.test(url));
        if (!threeUrl) throw Error('Three module URL missing');
        const THREE = await import(threeUrl),
          target = new THREE.WebGLRenderTarget(64, 64),
          scene = new THREE.Scene(),
          camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 1000);
        target.texture.colorSpace = THREE.NoColorSpace;
        const previous = renderer.getRenderTarget(),
          color = renderer.getClearColor(new THREE.Color()),
          alpha = renderer.getClearAlpha(),
          rows = new Map();
        const w = g.world.constructor.fromSnapshot(
            (window as any).__R_CAST_EARLY__,
            g.world.battlefield
          ),
          start = w.player.highlanderCastVisuals.at(-1).startTick;
        try {
          for (; w.tick < start + 27; w.step()) {
            g.view.highlanderCasts.update(w, 1, g.view.camera);
            for (const mesh of g.view.highlanderCasts.models.values()) {
              const index = mesh.userData.profileIndex;
              if (
                index === 6 ||
                rows.has(index) ||
                mesh.material.uniforms.particleColor.value.w <= 0
              )
                continue;
              mesh.updateMatrixWorld(true);
              const bounds = new THREE.Box3().setFromObject(mesh),
                center = bounds.getCenter(new THREE.Vector3()),
                size = bounds.getSize(new THREE.Vector3()),
                radius = Math.max(size.length() / 2, 0.001);
              const clone = mesh.clone();
              clone.position.sub(center);
              scene.add(clone);
              let pixels = 0;
              try {
                camera.left = camera.bottom = -radius * 1.2;
                camera.right = camera.top = radius * 1.2;
                camera.near = radius * 0.001;
                camera.far = radius * 10;
                camera.updateProjectionMatrix();
                for (const sign of [1, -1]) {
                  camera.position.set(radius * sign, radius * 0.7 * sign, radius * 2 * sign);
                  camera.lookAt(0, 0, 0);
                  renderer.setRenderTarget(target);
                  renderer.setClearColor(0, 0);
                  renderer.clear();
                  renderer.render(scene, camera);
                  const bytes = new Uint8Array(64 * 64 * 4);
                  renderer.readRenderTargetPixels(target, 0, 0, 64, 64, bytes);
                  let count = 0;
                  for (let i = 0; i < bytes.length; i += 4)
                    if (bytes[i] + bytes[i + 1] + bytes[i + 2] > 0) count++;
                  pixels = Math.max(pixels, count);
                }
              } finally {
                scene.remove(clone);
              }
              if (pixels)
                rows.set(index, {
                  profile: index,
                  name: mesh.name,
                  tick: w.tick - start,
                  pixels,
                  vertices: mesh.geometry.getAttribute('position').count,
                });
            }
          }
        } finally {
          renderer.setRenderTarget(previous);
          renderer.setClearColor(color, alpha);
          target.dispose();
          g.view.render(g.world, 1, g.view.previousElapsed);
        }
        return [...rows.values()].sort((a: any, b: any) => a.profile - b.profile);
      });
      expect(coverage.map((r: any) => r.profile)).toEqual([0, 1, 2, 3, 4, 5, 7]);
      writeFileSync(
        info.outputPath('ordinary-family-pixel-coverage.json'),
        JSON.stringify(coverage, null, 2)
      );
    }
    await page.screenshot({ path: info.outputPath(pausedByW ? 'r-during-w.png' : 'r-moving.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready(page);
    await installDescribe(page);
    const after = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        particles = (window as any).__R_CAST_DESCRIBE__();
      w.step(120);
      g.view.render(w, 1, g.view.previousElapsed);
      return {
        saved,
        particles,
        future: w.snapshot(),
        remaining: g.view.highlanderCasts.models.size,
      };
    });
    expect(after.saved).toBe(before.saved);
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    writeFileSync(
      info.outputPath('r-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips Highlander cast assets and explicit retry requests only the failed texture', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures.find((t: any) => t.url.includes('masteryi-r-cast-')).url;
  let fail = true;
  page.on('request', (r) => {
    if (/\/masteryi-r-cast-[^/]+\.(?:png|glb)$/.test(r.url())) requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional reappearance texture failure' });
    } else await route.continue();
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    let rejected = false;
    try {
      await g.view.highlanderCasts.load();
    } catch {
      rejected = true;
    }
    const before = performance.getEntriesByType('resource').length;
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.highlanderCasts.load();
    return { rejected, before, loaded: true };
  });
  expect(result.rejected).toBe(true);
  expect(requests).toHaveLength(9);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  for (const t of [
    ...data.textures.filter((t: any) => t.url.includes('masteryi-r-cast-')),
    ...data.meshes,
  ].filter((t: any) => t.url !== failed))
    expect(requests.filter((url) => url.endsWith('/' + t.url))).toHaveLength(1);
  writeFileSync(info.outputPath('retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('R admitted during Q stays hidden and restores its independent finite clock', async ({
  page,
}, info) => {
  await prepare(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.learnSpell('q');
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    window.addEventListener('keyup', () => g.setPaused(true), { once: true });
    g.setPaused(false);
  });
  await page.keyboard.press('r');
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step();
    const r = w.player.highlanderCastVisuals.at(-1);
    if (!r) throw Error('R during Q rejected');
    w.step(r.startTick + 9 - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(100);
    return {
      saved,
      future: copy.snapshot(),
      record: structuredClone(r),
      particles: g.view.highlanderCasts.models.size,
    };
  });
  expect(before.record.audience).toContain('blue');
  expect(before.record.frames.every((f: any) => f.audience.length === 0)).toBe(true);
  expect(before.particles).toBe(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready(page);
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const saved = w.snapshot();
    w.step(100);
    g.view.render(w, 1, g.view.previousElapsed);
    return { saved, future: w.snapshot(), particles: g.view.highlanderCasts.models.size };
  });
  expect(after.saved).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.particles).toBe(0);
  writeFileSync(
    info.outputPath('r-during-q-save.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});
test('hidden R birth stays hidden, later Q suppresses bound tails, and death/victory drain finite particles', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, team = 'blue') =>
      u.id === enemy.id && team === 'blue' ? false : visible(u, team);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'r', point: enemy });
    w.step(3);
    const hiddenAudience = [...w.championState(enemy.id).highlanderCastVisuals[0].audience];
    w.visible = visible;
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hiddenParticles = g.view.highlanderCasts.models.size;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step(10);
    g.view.render(w, 1, g.view.previousElapsed);
    const knownParticles = g.view.highlanderCasts.models.size;
    w.learnSpell('q');
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hiddenProfiles = [...g.view.highlanderCasts.models.values()].map(
      (m: any) => m.userData.profileIndex
    );
    w.damage(target, w.hero, 1e6, 'true');
    const detachedTick = w.player.highlanderCastVisuals[0].detachedTick;
    const ally = w.spawn('dummy', 'blue', { x: 1000, y: 1100 }),
      nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(ally, nexus, 1e6, 'true');
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    if (copy.snapshot() !== saved) throw Error('Terminal R snapshot differs');
    g.view.highlanderCasts.update(w, 1, g.view.camera, 0);
    const terminalStart = g.view.highlanderCasts.models.size;
    g.view.highlanderCasts.update(w, 1, g.view.camera, 1);
    return {
      hiddenAudience,
      hiddenParticles,
      knownParticles,
      hiddenProfiles,
      detachedTick,
      terminalStart,
      remaining: g.view.highlanderCasts.models.size,
      unchanged: saved === w.snapshot(),
      winner: w.winner,
    };
  });
  expect(result.hiddenAudience).toEqual(['red']);
  expect(result.hiddenParticles).toBe(0);
  expect(result.knownParticles).toBe(23);
  expect(result.hiddenProfiles).not.toContain(1);
  expect(result.hiddenProfiles).not.toContain(3);
  expect(result.hiddenProfiles).toContain(6);
  expect(result.detachedTick).not.toBeNull();
  expect(result.terminalStart).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(info.outputPath('r-fog-q-death-terminal.json'), JSON.stringify(result, null, 2));
});
