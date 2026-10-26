import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-w-cast-particles.json', 'utf8'));

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
    if (w.learnSpell('w') !== null) throw Error('Cannot learn Meditate');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
}
async function installDescribe(page: Page) {
  await page.evaluate(() => {
    (window as any).__W_CAST_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.meditateCasts.models]
        .map(([key, mesh]: any) => ({
          key,
          name: mesh.name,
          data: mesh.userData,
          position: mesh.position.toArray(),
          quaternion: mesh.quaternion.toArray(),
          scale: mesh.scale.toArray(),
          color: mesh.material.uniforms.particleColor.value.toArray(),
          lookup: mesh.material.uniforms.lookupUv.value.toArray(),
          uv: mesh.material.uniforms.sourceUvTransform.value.toArray(),
          mult: mesh.material.uniforms.multiplierUvTransform.value.toArray(),
          defines: mesh.material.defines,
          vertices: mesh.geometry.getAttribute('position').count,
        }))
        .sort((a: any, b: any) => a.key.localeCompare(b.key));
  });
}
for (const cancelled of [false, true])
  test(`real W ${cancelled ? 'cancelled' : 'active'} cast restores all seven source emitter families`, async ({
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
    await page.keyboard.press('w');
    const before = await page.evaluate((cancelled) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      const record = w.player.meditateCastVisuals.at(-1);
      if (!record) throw Error('Real W was not admitted');
      if (cancelled) w.setOrder(w.hero, { type: 'move', point: { x: 150, y: 90 } });
      w.step(record.startTick + 9 - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(120);
      return {
        saved,
        future: copy.snapshot(),
        record: structuredClone(record),
        channel: structuredClone(w.player.meditate),
        particles: (window as any).__W_CAST_DESCRIBE__(),
      };
    }, cancelled);
    expect(before.channel.stopReason).toBe(cancelled ? 'order' : null);
    expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(7);
    const flame = before.particles.find((p: any) => p.name.endsWith('spirit_fire'));
    expect(flame.defines).toMatchObject({
      SOURCE_MULT: 1,
      SOURCE_LOCK_ALPHA: 1,
      SOURCE_QUAD_SECONDARY_UV: 1,
    });
    expect(flame.uv).not.toEqual(flame.mult);
    expect(
      before.particles
        .filter((p: any) => p.name.includes('spiral_'))
        .every((p: any) => p.vertices === 960)
    ).toBe(true);
    if (!cancelled) {
      const replay = await page.evaluate(async (assets) => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext(),
          textures = new Map();
        for (const mesh of g.view.meditateCasts.models.values())
          for (const name of ['sourceTexture', 'particleColorTexture', 'multiplierTexture']) {
            const texture = mesh.material.uniforms[name]?.value;
            if (texture?.name) textures.set(texture.name, texture);
          }
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
          fb = gl.createFramebuffer(),
          results = [];
        try {
          for (const asset of assets) {
            const texture: any = textures.get(asset.url);
            if (!texture) throw Error('Missing active W texture: ' + asset.url);
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
                throw Error('Incomplete W mip framebuffer');
              const bytes = new Uint8Array(rect.width * rect.height * 4);
              gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              if (gl.getError() !== gl.NO_ERROR) throw Error('W mip readback error');
              const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              if (hash !== rect.rgbaSha256) throw Error('W authored mip differs');
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
      expect(replay).toHaveLength(87);
      writeFileSync(
        info.outputPath('active-three-mip-readback.json'),
        JSON.stringify(replay, null, 2)
      );
    }
    await page.screenshot({
      path: info.outputPath(cancelled ? 'cancelled-cast.png' : 'active-cast.png'),
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before.saved);
    await installDescribe(page);
    const after = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      g.view.render(w, 1, g.view.previousElapsed);
      const particles = (window as any).__W_CAST_DESCRIBE__();
      w.step(120);
      g.view.render(w, 1, g.view.previousElapsed);
      return { particles, future: w.snapshot(), remaining: g.view.meditateCasts.models.size };
    });
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    writeFileSync(
      info.outputPath('cast-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips the cast pack; explicit retry keeps successes and the independent quad UV selects exact pixels', async ({
  page,
}, info) => {
  const requests: string[] = [];
  let fail = true;
  const failed = data.textures.find((t) => t.url.includes('masteryi-w-cast-'))!.url;
  page.on('request', (r) => {
    if (/\/masteryi-w-cast-[^/]+\.(?:png|glb)$/.test(r.url())) requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional source failure' });
    } else await route.continue();
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  const pixels = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const threeUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => /\/node_modules\/\.vite\/deps\/three\.js(?:\?|$)/.test(url));
    if (!threeUrl) throw Error('Game Three module URL is unavailable');
    const THREE = await import(threeUrl);
    const { createLeonaEclipseSurfaceMaterial } =
      await import('/src/render/leona-eclipse-surface-material.ts');
    const renderer = g.view.renderer,
      target = new THREE.WebGLRenderTarget(1, 1),
      scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    target.texture.colorSpace = THREE.NoColorSpace;
    camera.position.z = 1;
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
      mult = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]), 2, 1);
    for (const t of [white, mult]) {
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    const geometry = new THREE.PlaneGeometry(2, 2),
      mesh = new THREE.Mesh(geometry);
    scene.add(mesh);
    const previous = renderer.getRenderTarget(),
      clear = renderer.getClearColor(new THREE.Color()),
      alpha = renderer.getClearAlpha(),
      rows = [];
    try {
      for (const transformed of [false, true]) {
        const material = createLeonaEclipseSurfaceMaterial({
          kind: 'quad',
          texture: white,
          lookup: white,
          multiplier: mult,
          quadSecondaryUv: transformed ? 'transformed' : 'lookup',
        });
        material.blending = THREE.NoBlending;
        material.depthTest = false;
        material.depthWrite = false;
        material.uniforms.lookupUv.value.set(0.25, 0.5);
        mesh.material = material;
        const samples = [];
        for (const offset of [-0.25, 0.25]) {
          material.uniforms.multiplierUvTransform.value.set(1, 0, offset, 0, 1, 0, 0, 0, 1);
          renderer.setRenderTarget(target);
          renderer.setClearColor(0, 0);
          renderer.clear();
          renderer.render(scene, camera);
          const pixel = new Uint8Array(4);
          renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
          samples.push([...pixel]);
        }
        material.dispose();
        rows.push({ transformed, samples });
      }
    } finally {
      renderer.setRenderTarget(previous);
      renderer.setClearColor(clear, alpha);
      geometry.dispose();
      white.dispose();
      mult.dispose();
      target.dispose();
    }
    return rows;
  });
  expect(pixels).toEqual([
    {
      transformed: false,
      samples: [
        [255, 0, 0, 255],
        [255, 0, 0, 255],
      ],
    },
    {
      transformed: true,
      samples: [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
      ],
    },
  ]);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.waitForFunction(() => {
    const a = (window as any).__GAME__.view.meditateCasts;
    return a.attempted && !a.pending;
  });
  expect(requests).toHaveLength(9);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.view.render(g.world, 1, g.view.previousElapsed);
  });
  expect(requests).toHaveLength(9);
  await page.evaluate(async () => {
    await (window as any).__GAME__.view.meditateCasts.load();
  });
  expect(requests).toHaveLength(10);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  const active = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      yi = w.units.find((u: any) => u.champion === 'masteryi');
    yi.ai = false;
    if (w.learnSpell('w', yi.id) !== null) throw Error('Late Yi cannot learn W');
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'w', point: yi });
    w.step(10);
    g.view.render(w, 1, g.view.previousElapsed);
    return new Set(
      [...g.view.meditateCasts.models.values()].map((m: any) => m.userData.profileIndex)
    ).size;
  });
  expect(active).toBe(7);
  writeFileSync(
    info.outputPath('secondary-uv-and-retry.json'),
    JSON.stringify({ pixels, requests, active }, null, 2)
  );
});

test('unseen creation stays hidden and known finite death/victory tails drain without simulation mutation', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.learnSpell('w', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, t: any = 'blue') =>
      u.id === enemy.id && t === 'blue' ? false : visible(u, t);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step(4);
    g.view.render(w, 1, g.view.previousElapsed);
    const unseen = g.view.meditateCasts.models.size;
    w.visible = () => true;
    g.view.render(w, 1, g.view.previousElapsed);
    const later = g.view.meditateCasts.models.size;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(7);
    g.view.render(w, 1, g.view.previousElapsed);
    const known = g.view.meditateCasts.models.size;
    w.damage(enemy, w.hero, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const afterDeath = g.view.meditateCasts.models.size;
    const nexus = w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
    w.damage(enemy, nexus, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot();
    g.view.render(w, 1, g.view.previousElapsed + 2);
    return {
      unseen,
      later,
      known,
      afterDeath,
      remaining: g.view.meditateCasts.models.size,
      unchanged: w.snapshot() === saved,
    };
  });
  expect(result.unseen).toBe(0);
  expect(result.later).toBe(0);
  expect(result.known).toBeGreaterThan(0);
  expect(result.afterDeath).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  writeFileSync(info.outputPath('creation-death-terminal.json'), JSON.stringify(result, null, 2));
});
