import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-q-end-particles.json', 'utf8'));

let errors: string[];
test.beforeEach(({ page }) => {
  test.setTimeout(120000);
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function prepare(page: Page) {
  await page.goto('/?scene=fixture&champion=masteryi');
  await ready(page);
  return page.evaluate(() => {
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
    w.learnSpell('q');
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { id: target.id, screen: g.view.screenPoint(target, 0.65) };
  });
}

async function installDescribe(page: Page) {
  await page.evaluate(() => {
    (window as any).__Q_END_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.alphaEnds.models]
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
for (const lost of [false, true])
  test(`real ${lost ? 'lost' : 'complete'} Q return restores both source emitters and all authored mips through Save/reload`, async ({
    page,
  }, info) => {
    const target = await prepare(page);
    await installDescribe(page);
    await page.mouse.move(target.screen.x, target.screen.y);
    await page.evaluate(() => {
      window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), {
        once: true,
      });
      (window as any).__GAME__.setPaused(false);
    });
    await page.keyboard.press('q');
    const before = await page.evaluate((lost) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      const q = w.player.alphaStrike;
      if (!q) throw Error('Real Q was not admitted');
      w.step(q.startTick + 7 - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      const castTextures = new Map();
      for (const mesh of g.view.alphaCasts.models.values())
        for (const name of ['sourceTexture', 'particleColorTexture']) {
          const texture = mesh.material.uniforms[name].value;
          castTextures.set(texture.name, texture);
        }
      if (lost) {
        const target = w.unit(q.primaryTargetId);
        target.x = target.previous.x = 5000;
      }
      for (let i = 0; q.reappearTick === null && i < 80; i++) w.step();
      if (q.reappearTick === null) throw Error('Q did not return');
      w.step(7);
      g.view.render(w, 1, g.view.previousElapsed);
      const shared = new Set();
      let early = false,
        power = 0;
      for (const mesh of g.view.alphaEnds.models.values()) {
        for (const name of ['sourceTexture', 'particleColorTexture']) {
          const texture = mesh.material.uniforms[name].value;
          if (castTextures.has(texture.name)) {
            if (castTextures.get(texture.name) !== texture)
              throw Error('Cast/end texture owner differs');
            shared.add(texture.name);
          }
        }
        if (mesh.material.uniforms.distortionPower) {
          early = mesh.parent === g.view.particleEarlyDistortion.scene;
          power = mesh.material.uniforms.distortionPower.value;
        }
      }
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(100);
      return {
        saved,
        future: copy.snapshot(),
        particles: (window as any).__Q_END_DESCRIBE__(),
        body: g.view.models.get(w.hero.id).root.visible,
        record: structuredClone(w.player.alphaEndVisuals[0]),
        shared: [...shared],
        early,
        power,
      };
    }, lost);
    expect(before.record.stopReason).toBe(lost ? 'lost' : 'complete');
    expect(before.body).toBe(true);
    expect(before.particles).toHaveLength(4);
    expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(2);
    expect(before.shared).toHaveLength(2);
    expect(before.early).toBe(true);
    expect(before.power).toBe(0.09000000357627869);
    const replay = await page.evaluate(async (assets) => {
      const g = (window as any).__GAME__,
        renderer = g.view.renderer,
        gl = renderer.getContext(),
        textures = new Map();
      for (const mesh of g.view.alphaEnds.models.values())
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
          if (!texture) throw Error('Missing active Q reappearance texture: ' + asset.url);
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
              throw Error('Incomplete Q reappearance mip framebuffer');
            const bytes = new Uint8Array(rect.width * rect.height * 4);
            gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
            if (gl.getError() !== gl.NO_ERROR) throw Error('Q reappearance mip readback error');
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            if (hash !== rect.rgbaSha256) throw Error('Q reappearance authored mip differs');
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
    expect(replay).toHaveLength(41);
    writeFileSync(
      info.outputPath('active-three-mip-readback.json'),
      JSON.stringify(replay, null, 2)
    );
    await page.screenshot({ path: info.outputPath('alpha-end.png') });
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
        particles = (window as any).__Q_END_DESCRIBE__();
      w.step(100);
      g.view.render(w, 1, g.view.previousElapsed);
      return { saved, particles, future: w.snapshot(), remaining: g.view.alphaEnds.models.size };
    });
    expect(after.saved).toBe(before.saved);
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    writeFileSync(
      info.outputPath('cast-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips reappearance assets and explicit retry requests only the failed texture', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures.find((t: any) => t.url.includes('masteryi-q-end-')).url;
  let fail = true;
  page.on('request', (r) => {
    if (data.textures.some((t: any) => r.url().endsWith('/' + t.url))) requests.push(r.url());
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
      await g.view.alphaEnds.load();
    } catch {
      rejected = true;
    }
    const before = performance.getEntriesByType('resource').length;
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.alphaEnds.load();
    return { rejected, before, loaded: true };
  });
  expect(result.rejected).toBe(true);
  expect(requests).toHaveLength(6);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  for (const t of data.textures.filter((t: any) => t.url !== failed))
    expect(requests.filter((url) => url.endsWith('/' + t.url))).toHaveLength(1);
  writeFileSync(info.outputPath('retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('hidden return stays hidden, bound tails follow movement and body hiding, then finite death/victory tails drain', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    const ally = w.spawn('dummy', 'blue', { x: 400, y: 0 });
    ally.hp = ally.maxHp = 1e6;
    const visible = w.visible.bind(w);
    w.visible = (u: any, team = 'blue') =>
      u.id === enemy.id && team === 'blue' ? false : visible(u, team);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: ally, targetId: ally.id });
    w.step(57);
    const hiddenAudience = [...w.championState(enemy.id).alphaEndVisuals[0].audience];
    w.visible = visible;
    w.step(2);
    g.view.render(w, 1, g.view.previousElapsed);
    const hiddenParticles = g.view.alphaEnds.models.size;
    const target = w.units.find((u: any) => u.kind === 'dummy' && u.team === 'red');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step(57);
    const record = w.player.alphaEndVisuals[0];
    w.setOrder(w.hero, { type: 'move', point: { x: 800, y: 400 } });
    w.step(11);
    g.view.render(w, 1, g.view.previousElapsed);
    const positions = [...g.view.alphaEnds.models.values()].map((mesh: any) => ({
      profile: mesh.userData.profileIndex,
      x: mesh.position.x,
      y: mesh.position.z,
    }));
    const point = { ...record.point },
      root = { x: w.hero.x, y: w.hero.y };
    w.player.cooldowns.q = w.tick;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const vanishedProfiles = [...g.view.alphaEnds.models.values()].map(
      (mesh: any) => mesh.userData.profileIndex
    );
    w.damage(target, w.hero, 1e6, 'true');
    const detachedTick = record.detachedTick;
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(ally, nexus, 1e6, 'true');
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    if (copy.snapshot() !== saved) throw Error('Terminal return snapshot differs');
    g.view.alphaEnds.update(w, 1, g.view.camera, 0);
    const terminalStart = g.view.alphaEnds.models.size;
    g.view.alphaEnds.update(w, 1, g.view.camera, 1);
    return {
      hiddenAudience,
      hiddenParticles,
      positions,
      point,
      root,
      vanishedProfiles,
      detachedTick,
      terminalStart,
      remaining: g.view.alphaEnds.models.size,
      unchanged: saved === w.snapshot(),
      endRecords: w.player.alphaEndVisuals.length,
      winner: w.winner,
    };
  });
  expect(result.hiddenAudience).toEqual(['red']);
  expect(result.hiddenParticles).toBe(0);
  expect(result.positions.filter((p) => p.profile === 0).length).toBeGreaterThan(0);
  for (const p of result.positions) {
    const point = p.profile === 0 ? result.root : result.point;
    expect(p.x).toBeCloseTo(point.x * 0.01, 10);
    expect(p.y).toBeCloseTo(point.y * 0.01, 10);
  }
  expect(result.root).not.toEqual(result.point);
  expect(result.vanishedProfiles).toEqual([1]);
  expect(result.detachedTick).not.toBeNull();
  expect(result.terminalStart).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.endRecords).toBe(1);
  expect(result.winner).toBe('blue');
  writeFileSync(
    info.outputPath('return-fog-movement-death-terminal.json'),
    JSON.stringify(result, null, 2)
  );
});
