import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-w-damage-particles.json', 'utf8'));

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
    (window as any).__W_DAMAGE_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.meditateDamage.models]
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
for (const linger of [false, true])
  test(`real W ${linger ? 'interrupted linger' : 'active channel'} damage restores source particles and exact shared mips`, async ({
    page,
  }, info) => {
    await prepare(page);
    await installDescribe(page);
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      window.addEventListener('keyup', () => g.setPaused(true), { once: true });
      g.setPaused(false);
    });
    await page.keyboard.press('w');
    const before = await page.evaluate((linger) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      const channel = w.player.meditate;
      if (!channel) throw Error('Actual W input rejected');
      w.step(channel.startTick + 31 - w.tick);
      if (linger) {
        w.setOrder(w.hero, { type: 'move', point: { x: 180, y: 90 } });
        w.step(6);
      }
      const enemy = w.spawn('dummy', 'red', { x: 200, y: 0 });
      const rng = w.random.state;
      w.damage(enemy, w.hero, 100, linger ? 'magic' : 'physical');
      const r = w.player.meditateDamageVisuals.at(-1);
      if (!r) throw Error('Reduced W damage not admitted');
      w.step(4);
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      (window as any).__W_DAMAGE_SOURCE__ = saved;
      copy.step(80);
      return {
        saved,
        future: copy.snapshot(),
        record: structuredClone(r),
        particles: (window as any).__W_DAMAGE_DESCRIBE__(),
        rngUnchanged: w.random.state === rng,
        stopReason: w.player.meditate?.stopReason,
      };
    }, linger);
    expect(before.rngUnchanged).toBe(true);
    expect(before.stopReason).toBe(linger ? 'order' : null);
    expect(before.particles.map((p: any) => p.data.profileIndex).sort()).toEqual([0, 1]);
    if (!linger) {
      const replay = await page.evaluate(async (assets) => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext(),
          textures = new Map();
        for (const mesh of g.view.meditateDamage.models.values())
          for (const name of ['sourceTexture', 'particleColorTexture']) {
            const texture = mesh.material.uniforms[name]?.value;
            if (texture?.name) textures.set(texture.name, texture);
          }
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
          fb = gl.createFramebuffer(),
          results = [];
        try {
          for (const asset of assets) {
            const texture: any = textures.get(asset.url);
            if (!texture) throw Error('Missing active Meditate damage texture ' + asset.url);
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
                throw Error('Incomplete Meditate damage mip framebuffer');
              const bytes = new Uint8Array(rect.width * rect.height * 4);
              gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              if (gl.getError() !== gl.NO_ERROR) throw Error('Takedown readback failed');
              const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              if (hash !== rect.rgbaSha256) throw Error('Authored Meditate damage mip differs');
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
      expect(replay).toHaveLength(32);
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
            (window as any).__W_DAMAGE_SOURCE__,
            g.world.battlefield
          ),
          start = w.player.meditateDamageVisuals.at(-1).tick;
        try {
          for (; w.tick < start + 15; w.step()) {
            g.view.meditateDamage.update(w, 1, g.view.camera);
            for (const mesh of g.view.meditateDamage.models.values()) {
              const index = mesh.userData.profileIndex;
              if (rows.has(index) || mesh.material.uniforms.particleColor.value.w <= 0) continue;
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
      expect(coverage.map((r: any) => r.profile)).toEqual([0, 1]);
      writeFileSync(
        info.outputPath('ordinary-family-pixel-coverage.json'),
        JSON.stringify(coverage, null, 2)
      );
    }
    await page.screenshot({
      path: info.outputPath(linger ? 'w-linger-damage.png' : 'w-channel-damage.png'),
    });
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
      const textures = new Map();
      for (const m of g.view.meditateDamage.models.values())
        for (const name of ['sourceTexture', 'particleColorTexture']) {
          const t = m.material.uniforms[name]?.value;
          if (t?.name) textures.set(t.name, t);
        }
      (window as any).__W_DAMAGE_TEXTURES__ = textures;
      const saved = w.snapshot(),
        particles = (window as any).__W_DAMAGE_DESCRIBE__();
      w.step(80);
      g.view.render(w, 1, g.view.previousElapsed);
      return {
        saved,
        particles,
        future: w.snapshot(),
        remaining: g.view.meditateDamage.models.size,
      };
    });
    expect(after.saved).toBe(before.saved);
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    const shared = await page.evaluate(
      async (urls) => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.learnSpell('q');
        w.hero.mana = w.hero.maxMana;
        const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
        target.hp = target.maxHp = 1e6;
        w.enqueue({
          type: 'cast',
          unit: w.hero.id,
          ability: 'q',
          point: target,
          targetId: target.id,
        });
        w.step();
        if (!w.player.alphaStrike) throw Error('Texture-sharing Q rejected');
        for (let i = 0; i < 60 && w.player.alphaContactVisuals.length === 0; i++) w.step();
        if (!w.player.alphaContactVisuals.length)
          throw Error('No actual Q contact for texture sharing');
        w.step(2);
        await g.view.alphaContacts.load();
        g.view.render(w, 1, g.view.previousElapsed);
        const contacts = new Map();
        for (const m of g.view.alphaContacts.models.values())
          for (const name of ['sourceTexture', 'particleColorTexture']) {
            const t = m.material.uniforms[name]?.value;
            if (t?.name) contacts.set(t.name, t);
          }
        return urls.map((url) => ({
          url,
          contactPresent: contacts.has(url),
          damagePresent: (window as any).__W_DAMAGE_TEXTURES__.has(url),
          shared:
            contacts.has(url) &&
            contacts.get(url) === (window as any).__W_DAMAGE_TEXTURES__.get(url),
        }));
      },
      data.textures.map((t: any) => t.url)
    );
    writeFileSync(info.outputPath('texture-sharing.json'), JSON.stringify(shared, null, 2));
    expect(shared).toHaveLength(4);
    expect(shared.every((r: any) => r.shared)).toBe(true);
    writeFileSync(
      info.outputPath('w-damage-save-reload.json'),
      JSON.stringify({ before, after, shared }, null, 2)
    );
  });

test('ordinary startup omits damage module; explicit retry retains all verified shared textures', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures[0].url;
  let fail = true;
  page.on('request', (r) => {
    if (data.textures.some((t: any) => r.url().endsWith('/' + t.url))) requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional W damage texture failure' });
    } else await route.continue();
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((e) => e.name.includes('/src/render/masteryi-w-damage.ts'))
    )
  ).toBe(false);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    let rejected = false;
    try {
      await g.view.meditateDamage.load();
    } catch {
      rejected = true;
    }
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.meditateDamage.load();
    await g.view.alphaContacts.load();
    return { rejected };
  });
  expect(result.rejected).toBe(true);
  for (const asset of data.textures)
    expect(requests.filter((url) => url.endsWith('/' + asset.url))).toHaveLength(
      asset.url === failed ? 2 : 1
    );
  writeFileSync(info.outputPath('retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('admission visibility, Q body hiding and finite frozen death/victory tails remain distinct', async ({
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
    w.visible = (u: any, team = 'blue') =>
      u.id === enemy.id && team === 'blue' ? false : visible(u, team);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step();
    const blue = w.spawn('dummy', 'blue', { x: 100, y: 0 });
    w.damage(blue, enemy, 100, 'physical');
    const hiddenAudience = [...w.championState(enemy.id).meditateDamageVisuals[0].audience];
    w.visible = visible;
    w.step(4);
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.meditateDamage.models.size;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step();
    const red = w.spawn('dummy', 'red', { x: 200, y: 0 });
    w.damage(red, w.hero, 100, 'physical');
    w.step(3);
    g.view.render(w, 1, g.view.previousElapsed);
    const known = g.view.meditateDamage.models.size;
    w.learnSpell('q');
    red.hp = red.maxHp = 1e6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: red, targetId: red.id });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const qProfiles = [...g.view.meditateDamage.models.values()].map(
      (m: any) => m.userData.profileIndex
    );
    w.damage(red, w.hero, 1e9, 'true');
    const detached = w.player.meditateDamageVisuals.at(-1).detachedTick;
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(blue, nexus, 1e9, 'true');
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    if (copy.snapshot() !== saved) throw Error('Terminal W damage snapshot differs');
    g.view.meditateDamage.update(w, 1, g.view.camera, 0);
    const terminal = g.view.meditateDamage.models.size;
    g.view.meditateDamage.update(w, 1, g.view.camera, 1);
    return {
      hiddenAudience,
      hidden,
      known,
      qProfiles,
      detached,
      terminal,
      remaining: g.view.meditateDamage.models.size,
      unchanged: w.snapshot() === saved,
      winner: w.winner,
    };
  });
  expect(result.hiddenAudience).toEqual(['red']);
  expect(result.hidden).toBe(0);
  expect(result.known).toBe(2);
  expect(result.qProfiles).toEqual([1]);
  expect(result.detached).not.toBeNull();
  expect(result.terminal).toBe(2);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(info.outputPath('fog-q-death-terminal.json'), JSON.stringify(result, null, 2));
});
