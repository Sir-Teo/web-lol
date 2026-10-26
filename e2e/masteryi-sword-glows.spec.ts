import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-sword-particles.json', 'utf8'));

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
    for (const a of ['e', 'r', 'w', 'q'])
      if (w.learnSpell(a) !== null) throw Error('Cannot learn Yi spell');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
}
async function installDescribe(page: Page) {
  await page.evaluate(() => {
    (window as any).__SWORD_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.swordGlows.models]
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
test('real E and R render all authored sword instances and restore exact saved particles', async ({
  page,
}, info) => {
  await prepare(page);
  await installDescribe(page);
  for (const key of ['e', 'r']) {
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      window.addEventListener('keyup', () => g.setPaused(true), { once: true });
      g.setPaused(false);
    });
    await page.keyboard.press(key);
  }
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step();
    if (!w.player.wujuStyle || !w.player.highlander) throw Error('Real E/R input rejected');
    w.step(8);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    (window as any).__SWORD_SOURCE__ = saved;
    copy.step(500);
    return {
      saved,
      future: copy.snapshot(),
      particles: (window as any).__SWORD_DESCRIBE__(),
      histories: structuredClone(w.player.swordGlowVisuals),
    };
  });
  expect(before.histories).toHaveLength(2);
  expect(before.particles.length).toBeGreaterThan(10);
  expect(
    new Set(before.particles.map((p: any) => p.key.split(':').slice(0, 4).join(':'))).size
  ).toBe(5);
  const replay = await page.evaluate(async (assets) => {
    const g = (window as any).__GAME__,
      renderer = g.view.renderer,
      gl = renderer.getContext(),
      textures = new Map();
    for (const mesh of g.view.swordGlows.models.values())
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
  expect(replay).toHaveLength(78);
  writeFileSync(info.outputPath('active-three-mip-readback.json'), JSON.stringify(replay, null, 2));
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
        (window as any).__SWORD_SOURCE__,
        g.world.battlefield
      ),
      start = Math.min(...w.player.swordGlowVisuals.map((r: any) => r.castTick));
    try {
      for (; w.tick < start + 62; w.step()) {
        g.view.swordGlows.update(w, 1, g.view.camera, g.view.models);
        for (const mesh of g.view.swordGlows.models.values()) {
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
  expect(coverage.map((r: any) => r.profile)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  writeFileSync(
    info.outputPath('ordinary-family-pixel-coverage.json'),
    JSON.stringify(coverage, null, 2)
  );
  const joints = await page.evaluate(async (source) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const url = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((n) => /\/deps\/three\.js(?:\?|$)/.test(n));
    if (!url) throw Error('Three module missing');
    const THREE = await import(url),
      sampler = await import('/src/render/masteryi-sword-particles.ts'),
      rows = [];
    for (const [key, mesh] of g.view.swordGlows.models) {
      const [unitId, condition, castTick, slot] = key.split(':').map(Number),
        binding = source.bindings.find(
          (b: any) => b.conditionIndex === condition && b.index === slot
        ),
        unit = w.unit(unitId),
        model = g.view.models.get(unitId);
      if (!binding || !model) throw Error('Missing declared sword binding');
      let bone: any;
      model.root.traverse((node: any) => {
        if (node.name.toLowerCase() === binding.sourceBone.toLowerCase()) bone = node;
      });
      if (!bone) throw Error('Missing actual sword joint');
      const seed =
        unitId ^ Math.imul(castTick, 0x9e3779b9) ^ Math.imul(slot + 1 + condition * 4, 0x85ebca6b);
      const p = sampler
        .swordGlowParticles(seed, (w.tick - castTick) / 60, Infinity, binding.effectKey)
        .find(
          (p: any) =>
            p.profileIndex === mesh.userData.profileIndex && p.ordinal === mesh.userData.ordinal
        );
      if (!p) throw Error('Actual sword particle absent from source sample');
      const anchor = bone.getWorldPosition(new THREE.Vector3()),
        rotation = bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
        position = anchor
          .clone()
          .add(
            new THREE.Vector3(-p.offset[0], p.offset[1], p.offset[2])
              .multiplyScalar(0.01)
              .applyQuaternion(rotation)
          );
      const turn = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...p.rotation.map(THREE.MathUtils.degToRad), 'YXZ')
      );
      const expected = rotation
        .clone()
        .multiply(new THREE.Quaternion(turn.x, -turn.y, -turn.z, turn.w));
      rows.push({
        key,
        bone: bone.name,
        condition,
        positionError: position.distanceTo(mesh.position),
        angleError: expected.angleTo(mesh.quaternion),
        nonYaw: Math.abs(rotation.x) + Math.abs(rotation.z),
      });
    }
    return rows;
  }, data);
  expect(new Set(joints.map((r: any) => r.bone)).size).toBe(4);
  expect(new Set(joints.map((r: any) => r.condition)).size).toBe(2);
  expect(joints.every((r: any) => r.positionError < 1e-9 && r.angleError < 1e-7)).toBe(true);
  expect(joints.some((r: any) => r.nonYaw > 0.1)).toBe(true);
  writeFileSync(info.outputPath('actual-joint-transforms.json'), JSON.stringify(joints, null, 2));

  await page.screenshot({ path: info.outputPath('e-r-sword-glows.png') });
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
      particles = (window as any).__SWORD_DESCRIBE__();
    w.step(500);
    g.view.render(w, 1, g.view.previousElapsed);
    return { saved, particles, future: w.snapshot(), remaining: g.view.swordGlows.models.size };
  });
  expect(after.saved).toBe(before.saved);
  expect(after.particles).toEqual(before.particles);
  expect(after.future).toBe(before.future);
  expect(after.remaining).toBe(0);
  writeFileSync(
    info.outputPath('sword-save-reload.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});
for (const ability of ['e', 'r'] as const)
  test(`${ability} alone uses only its authored bindings while Meditate pauses the buff`, async ({
    page,
  }, info) => {
    await prepare(page);
    const result = await page.evaluate((ability) => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
      w.step();
      const start = w.tick;
      w.step(80);
      w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
      w.step(30);
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      const particles = [...g.view.swordGlows.models].map(([key, m]: any) => ({
          key,
          profile: m.userData.profileIndex,
          born: m.userData.bornTick,
          position: m.position.toArray(),
        })),
        saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(100);
      return {
        start,
        particles,
        records: structuredClone(w.player.swordGlowVisuals),
        paused: (ability === 'e' ? w.player.wujuStyle : w.player.highlander).pausedTicks,
        saved,
        future: copy.snapshot(),
      };
    }, ability);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].condition).toBe(ability === 'e' ? 0 : 1);
    expect(result.records[0].frames[0].tick).toBe(JSON.parse(result.saved).tick - 61);
    expect(result.paused).toBeGreaterThan(0);
    expect(
      new Set(result.particles.map((p: any) => p.key.split(':').slice(0, 4).join(':'))).size
    ).toBe(ability === 'e' ? 4 : 1);
    expect(result.particles.every((p: any) => p.born > result.start + 40)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${ability}-during-meditate.png`) });
    const future = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      w.step(100);
      return w.snapshot();
    });
    expect(future).toBe(result.future);
    writeFileSync(info.outputPath('single-condition.json'), JSON.stringify(result, null, 2));
  });

test('ordinary startup omits sword assets and selective retry retains verified transports', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures.find((t: any) => t.url.includes('masteryi-sword-')).url;
  let fail = true;
  page.on('request', (r) => {
    if (data.textures.some((t: any) => r.url().endsWith('/' + t.url))) requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional sword texture failure' });
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
      await g.view.swordGlows.load();
    } catch {
      rejected = true;
    }
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.swordGlows.load();
    return { rejected };
  });
  expect(result.rejected).toBe(true);
  for (const asset of data.textures)
    expect(requests.filter((url) => url.endsWith('/' + asset.url))).toHaveLength(
      asset.url === failed ? 2 : 1
    );
  writeFileSync(info.outputPath('sword-retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('hidden births, Q reveal, and bone-bound death/victory tails preserve the saved world', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('e', enemy.id);
    w.learnSpell('r', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, t = 'blue') => (u.id === enemy.id && t === 'blue' ? false : visible(u, t));
    for (const ability of ['e', 'r'])
      w.enqueue({ type: 'cast', unit: enemy.id, ability, point: enemy });
    w.step(3);
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.swordGlows.models.size;
    w.visible = visible;
    w.step(5);
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = [...g.view.swordGlows.models.values()].map((m: any) => ({
      source: m.userData.sourceId,
      born: m.userData.bornTick,
    }));
    for (const ability of ['e', 'r'])
      w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
    w.step(6);
    g.view.render(w, 1, g.view.previousElapsed);
    const ownBefore = [...g.view.swordGlows.models.values()].filter(
      (m: any) => m.userData.sourceId === w.hero.id
    ).length;
    const dummy = w.spawn('dummy', 'red', { x: 300, y: 0 });
    dummy.hp = dummy.maxHp = 1e6;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: dummy, targetId: dummy.id });
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const ownHidden = [...g.view.swordGlows.models.values()].filter(
        (m: any) => m.userData.sourceId === w.hero.id
      ).length,
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(40);
    w.step(40);
    if (copy.snapshot() !== w.snapshot()) throw Error('Q-hidden sword future differs');
    g.view.render(w, 1, g.view.previousElapsed);
    const ownReturned = [...g.view.swordGlows.models.values()].filter(
      (m: any) => m.userData.sourceId === w.hero.id
    ).length;
    w.damage(dummy, w.hero, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 }),
      ally = w.spawn('dummy', 'blue', { x: 1000, y: 1100 });
    w.damage(ally, nexus, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const terminal = w.snapshot(),
      restored = w.constructor.fromSnapshot(terminal, w.battlefield);
    if (restored.snapshot() !== terminal) throw Error('Terminal sword save differs');
    g.view.swordGlows.update(w, 1, g.view.camera, g.view.models, 0);
    const tail = g.view.swordGlows.models.size;
    g.view.swordGlows.update(w, 1, g.view.camera, g.view.models, 2);
    return {
      hidden,
      revealed,
      ownBefore,
      ownHidden,
      ownReturned,
      tail,
      remaining: g.view.swordGlows.models.size,
      unchanged: terminal === w.snapshot(),
      winner: w.winner,
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.revealed.length).toBeGreaterThan(0);
  expect(result.revealed.every((r: any) => r.born >= 4)).toBe(true);
  expect(result.ownBefore).toBeGreaterThan(0);
  expect(result.ownHidden).toBe(0);
  expect(result.ownReturned).toBeGreaterThan(0);
  expect(result.tail).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(info.outputPath('sword-visibility-terminal.json'), JSON.stringify(result, null, 2));
});
