import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-r-kill-particles.json', 'utf8'));

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
    (window as any).__R_KILL_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.highlanderKills.models]
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
for (const count of [1, 3])
  test(`real active-R ${count} takedowns restore source particles and shared Q geometry`, async ({
    page,
  }, info) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/' + data.mesh.url)) requests.push(r.url());
    });
    await prepare(page);
    await installDescribe(page);
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      window.addEventListener('keyup', () => g.setPaused(true), { once: true });
      g.setPaused(false);
    });
    await page.keyboard.press('r');
    const before = await page.evaluate((count) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      if (!w.player.highlander) throw Error('Actual R input rejected');
      for (let i = 0; i < count; i++) {
        const v = w.spawn('champion', 'red', { x: 400, y: i * 50 }, 'lux');
        v.ai = false;
        w.damage(w.hero, v, 1e6, 'true');
      }
      const record = w.player.highlanderKillVisuals.at(-1);
      w.step(9);
      g.view.render(w, 1, g.view.previousElapsed);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      (window as any).__R_KILL_SOURCE__ = saved;
      copy.step(120);
      const killMeshes = [...g.view.highlanderKills.models.values()].filter(
        (m: any) => m.userData.sourceMesh
      );
      return {
        saved,
        future: copy.snapshot(),
        particles: (window as any).__R_KILL_DESCRIBE__(),
        records: structuredClone(w.player.highlanderKillVisuals),
        geometryCount: new Set(killMeshes.map((m: any) => m.geometry)).size,
      };
    }, count);
    expect(before.records).toHaveLength(count);
    expect(before.geometryCount).toBe(1);
    expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(3);
    expect(
      before.particles.filter((p: any) => p.data.sourceMesh).every((p: any) => p.vertices === 4500)
    ).toBe(true);
    if (count === 1) {
      const replay = await page.evaluate(async (assets) => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext(),
          textures = new Map();
        for (const mesh of g.view.highlanderKills.models.values())
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
            if (!texture) throw Error('Missing active takedown texture ' + asset.url);
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
                throw Error('Incomplete takedown mip framebuffer');
              const bytes = new Uint8Array(rect.width * rect.height * 4);
              gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              if (gl.getError() !== gl.NO_ERROR) throw Error('Takedown readback failed');
              const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              if (hash !== rect.rgbaSha256) throw Error('Authored takedown mip differs');
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
      expect(replay).toHaveLength(42);
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
            (window as any).__R_KILL_SOURCE__,
            g.world.battlefield
          ),
          start = w.player.highlanderKillVisuals.at(-1).tick;
        try {
          for (; w.tick < start + 88; w.step()) {
            g.view.highlanderKills.update(w, 1, g.view.camera);
            for (const mesh of g.view.highlanderKills.models.values()) {
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
      expect(coverage.map((r: any) => r.profile)).toEqual([0, 1, 2]);
      writeFileSync(
        info.outputPath('ordinary-family-pixel-coverage.json'),
        JSON.stringify(coverage, null, 2)
      );
    }
    await page.screenshot({ path: info.outputPath(`r-${count}-takedowns.png`) });
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
        particles = (window as any).__R_KILL_DESCRIBE__();
      (window as any).__R_KILL_SOURCE__ = saved;
      w.step(120);
      g.view.render(w, 1, g.view.previousElapsed);
      return {
        saved,
        particles,
        future: w.snapshot(),
        remaining: g.view.highlanderKills.models.size,
      };
    });
    expect(after.saved).toBe(before.saved);
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    // Build a real Q contact after restoring. Both effects borrow the same immutable trail.
    const shared = await page
      .evaluate(async () => {
        const g = (window as any).__GAME__,
          w = g.world;
        w.learnSpell('q');
        w.player.cooldowns.q = 0;
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
        w.step(30);
        await g.view.alphaContacts.load();
        g.view.render(w, 1, g.view.previousElapsed);
        const contact = [...g.view.alphaContacts.models.values()].find(
          (m: any) => m.geometry.getAttribute('position').count === 4500
        );
        const fresh = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
        fresh.ai = false;
        w.damage(w.hero, fresh, 1e6, 'true');
        w.step(60); // Q-hidden births cannot be used as a visible geometry proof.
        const source = w.constructor.fromSnapshot((window as any).__R_KILL_SOURCE__, w.battlefield);
        g.view.highlanderKills.update(source, 1, g.view.camera);
        const kill = [...g.view.highlanderKills.models.values()].find(
          (m: any) => m.userData.sourceMesh
        );
        return {
          shared: !!contact && !!kill && contact.geometry === kill.geometry,
          corners: contact?.geometry.getAttribute('position').count,
        };
      })
      .catch((e) => {
        throw e;
      });
    expect(shared).toEqual({ shared: true, corners: 4500 });
    expect(requests).toHaveLength(2); // Exactly once for each page lifecycle, including concurrent Yi pack loads.
    writeFileSync(
      info.outputPath('r-kill-save-reload.json'),
      JSON.stringify({ before, after, shared, requests }, null, 2)
    );
  });

test('Q-hidden assist admits only the later known bubble birth and restores its future', async ({
  page,
}, info) => {
  await prepare(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    w.learnSpell('q');
    const dummy = w.spawn('dummy', 'red', { x: 300, y: 0 });
    dummy.hp = dummy.maxHp = 1e6;
    const victim = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux'),
      ally = w.spawn('champion', 'blue', { x: 450, y: 0 }, 'lux');
    victim.ai = ally.ai = false;
    w.damage(w.hero, victim, 1, 'true');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: dummy, targetId: dummy.id });
    w.step();
    w.step(30);
    w.damage(ally, victim, 1e6, 'true');
    const r = w.player.highlanderKillVisuals[0];
    w.step(9);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(21);
    g.view.highlanderKills.update(copy, 1, g.view.camera);
    const later = [...g.view.highlanderKills.models.values()].map((m: any) => m.userData);
    copy.step(100);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      saved,
      future: copy.snapshot(),
      tick: r.tick,
      audience: r.audience,
      hidden: g.view.highlanderKills.models.size,
      later,
    };
  });
  expect(before.hidden).toBe(0);
  expect(before.audience).toContain('blue');
  expect(before.later).toHaveLength(1);
  expect(before.later[0]).toMatchObject({ profileIndex: 2, ordinal: 2 });
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
    w.step(21);
    g.view.render(w, 1, g.view.previousElapsed);
    const later = [...g.view.highlanderKills.models.values()].map((m: any) => m.userData);
    w.step(100);
    return { saved, later, future: w.snapshot() };
  });
  expect(after.saved).toBe(before.saved);
  expect(after.later).toEqual(before.later);
  expect(after.future).toBe(before.future);
  writeFileSync(
    info.outputPath('q-hidden-assist.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});

test('ordinary startup omits takedown assets and retry preserves verified textures and shared geometry', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures.find((t: any) => t.url.includes('masteryi-r-kill-')).url;
  let fail = true;
  page.on('request', (r) => {
    if (/\/masteryi-(?:r-kill-[^/]+\.png|q-contact-trail\.glb)$/.test(r.url()))
      requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional takedown texture failure' });
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
      await g.view.highlanderKills.load();
    } catch {
      rejected = true;
    }
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.highlanderKills.load();
    await g.view.alphaContacts.load();
    return { rejected };
  });
  expect(result.rejected).toBe(true);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  expect(requests.filter((url) => url.endsWith('/' + data.mesh.url))).toHaveLength(1);
  for (const t of data.textures.filter(
    (t: any) => t.url.includes('masteryi-r-kill-') && t.url !== failed
  ))
    expect(requests.filter((url) => url.endsWith('/' + t.url))).toHaveLength(1);
  writeFileSync(info.outputPath('retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('hidden admission, later Q suppression and death/victory tails leave simulation unchanged', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, team = 'blue') =>
      u.id === enemy.id && team === 'blue' ? false : visible(u, team);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'r', point: enemy });
    w.step();
    const victim = w.spawn('champion', 'blue', { x: 300, y: 0 }, 'lux');
    victim.ai = false;
    w.damage(enemy, victim, 1e6, 'true');
    const audience = [...w.championState(enemy.id).highlanderKillVisuals[0].audience];
    w.visible = visible;
    w.step(9);
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.highlanderKills.models.size;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    const red = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    red.ai = false;
    w.damage(w.hero, red, 1e6, 'true');
    w.step(9);
    g.view.render(w, 1, g.view.previousElapsed);
    const known = g.view.highlanderKills.models.size;
    const terminalCopy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    const fatal = terminalCopy.spawn('dummy', 'red', { x: 0, y: 0 });
    terminalCopy.damage(fatal, terminalCopy.hero, 1e6, 'true');
    const terminalAlly = terminalCopy.spawn('dummy', 'blue', { x: 1000, y: 1100 });
    const terminalNexus = terminalCopy.spawn('nexus', 'red', { x: 1000, y: 1000 });
    terminalCopy.damage(terminalAlly, terminalNexus, 1e6, 'true');
    const terminalSaved = terminalCopy.snapshot();
    if (
      terminalCopy.constructor.fromSnapshot(terminalSaved, w.battlefield).snapshot() !==
      terminalSaved
    )
      throw Error('Visible terminal takedown snapshot differs');
    g.view.highlanderKills.update(terminalCopy, 1, g.view.camera, 0);
    const visibleDeathTail = g.view.highlanderKills.models.size;
    g.view.highlanderKills.update(terminalCopy, 1, g.view.camera, 2);
    if (
      visibleDeathTail === 0 ||
      g.view.highlanderKills.models.size !== 0 ||
      terminalSaved !== terminalCopy.snapshot()
    )
      throw Error('Visible death/victory tail failed');
    w.learnSpell('q');
    const dummy = w.spawn('dummy', 'red', { x: 300, y: 0 });
    dummy.hp = dummy.maxHp = 1e6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: dummy, targetId: dummy.id });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const qHidden = g.view.highlanderKills.models.size;
    w.damage(dummy, w.hero, 1e6, 'true');
    const detached = w.player.highlanderKillVisuals[0].detachedTick;
    const ally = w.spawn('dummy', 'blue', { x: 1000, y: 1100 }),
      nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(ally, nexus, 1e6, 'true');
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    if (copy.snapshot() !== saved) throw Error('Terminal takedown snapshot differs');
    g.view.highlanderKills.update(w, 1, g.view.camera, 0);
    const terminal = g.view.highlanderKills.models.size;
    g.view.highlanderKills.update(w, 1, g.view.camera, 2);
    return {
      qCancelledOnDeath: w.player.alphaStrike === null,
      deathRootKnown: w.player.highlanderKillVisuals[0].frames.at(-1).audience.includes('blue'),
      visibleDeathTail,
      audience,
      hidden,
      known,
      qHidden,
      detached,
      terminal,
      remaining: g.view.highlanderKills.models.size,
      unchanged: w.snapshot() === saved,
      winner: w.winner,
    };
  });
  expect(result.audience).toEqual(['red']);
  expect(result.hidden).toBe(0);
  expect(result.known).toBeGreaterThan(0);
  expect(result.qHidden).toBe(0);
  expect(result.detached).not.toBeNull();
  expect(result.qCancelledOnDeath).toBe(true);
  expect(result.deathRootKnown).toBe(true);
  expect(result.terminal).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(info.outputPath('fog-q-death-terminal.json'), JSON.stringify(result, null, 2));
});
