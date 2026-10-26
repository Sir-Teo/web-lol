import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-q-cast-particles.json', 'utf8'));

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
    (window as any).__Q_CAST_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.alphaCasts.models]
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
test('real Q cast remains visible during body vanish, reads all authored mips and restores through Save/reload', async ({
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
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.step();
    const q = w.player.alphaStrike;
    if (!q) throw Error('Real Q was not admitted');
    w.step(q.startTick + 7 - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(100);
    return {
      saved,
      future: copy.snapshot(),
      particles: (window as any).__Q_CAST_DESCRIBE__(),
      body: g.view.models.get(w.hero.id).root.visible,
      vanished: q.reappearTick === null,
    };
  });
  expect(before.vanished).toBe(true);
  expect(before.body).toBe(false);
  expect(before.particles).toHaveLength(6);
  expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(2);
  const replay = await page.evaluate(async (assets) => {
    const g = (window as any).__GAME__,
      renderer = g.view.renderer,
      gl = renderer.getContext(),
      textures = new Map();
    for (const mesh of g.view.alphaCasts.models.values())
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
        if (!texture) throw Error('Missing active Q cast texture: ' + asset.url);
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
            throw Error('Incomplete Q cast mip framebuffer');
          const bytes = new Uint8Array(rect.width * rect.height * 4);
          gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          if (gl.getError() !== gl.NO_ERROR) throw Error('Q cast mip readback error');
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          if (hash !== rect.rgbaSha256) throw Error('Q cast authored mip differs');
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
  expect(replay).toHaveLength(35);
  writeFileSync(info.outputPath('active-three-mip-readback.json'), JSON.stringify(replay, null, 2));
  await page.screenshot({ path: info.outputPath('alpha-cast.png') });
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
      particles = (window as any).__Q_CAST_DESCRIBE__();
    const lookups = new Map();
    for (const mesh of g.view.alphaCasts.models.values()) {
      const texture = mesh.material.uniforms.particleColorTexture.value;
      lookups.set(texture.name, texture);
    }
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const shared = new Set();
    for (const mesh of g.view.alphaContacts.models.values()) {
      const texture = mesh.material.uniforms.particleColorTexture.value;
      if (lookups.has(texture.name)) {
        if (texture !== lookups.get(texture.name))
          throw Error('Q cast/contact texture ownership differs');
        shared.add(texture.name);
      }
    }
    w.step(70);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      saved,
      particles,
      future: w.snapshot(),
      remaining: g.view.alphaCasts.models.size,
      shared: [...shared],
    };
  });
  expect(after.saved).toBe(before.saved);
  expect(after.particles).toEqual(before.particles);
  expect(after.future).toBe(before.future);
  expect(after.remaining).toBe(0);
  expect(after.shared).toHaveLength(2);
  writeFileSync(
    info.outputPath('cast-save-reload.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});

test('ordinary startup skips cast assets and explicit retry requests only the failed texture', async ({
  page,
}, info) => {
  const requests: string[] = [],
    failed = data.textures.find((t: any) => t.url.includes('masteryi-q-cast-')).url;
  let fail = true;
  page.on('request', (r) => {
    if (data.textures.some((t: any) => r.url().endsWith('/' + t.url))) requests.push(r.url());
  });
  await page.route('**/' + failed, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'intentional cast texture failure' });
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
      await g.view.alphaCasts.load();
    } catch {
      rejected = true;
    }
    const before = performance.getEntriesByType('resource').length;
    for (let i = 0; i < 10; i++) g.view.render(g.world, 1, g.view.previousElapsed);
    await g.view.alphaCasts.load();
    return { rejected, before, loaded: true };
  });
  expect(result.rejected).toBe(true);
  expect(requests).toHaveLength(5);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  for (const t of data.textures.filter((t: any) => t.url !== failed))
    expect(requests.filter((url) => url.endsWith('/' + t.url))).toHaveLength(1);
  writeFileSync(info.outputPath('retry.json'), JSON.stringify({ result, requests }, null, 2));
});

test('hidden creation stays hidden, death freezes roots and terminal age drains without changing the world', async ({
  page,
}, info) => {
  await prepare(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, team = 'blue') =>
      u.id === enemy.id && team === 'blue' ? false : visible(u, team);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: w.hero, targetId: w.hero.id });
    w.step();
    const hiddenAudience = [...w.championState(enemy.id).alphaCastVisuals[0].audience];
    w.visible = visible;
    w.step(3);
    g.view.render(w, 1, g.view.previousElapsed);
    const hiddenParticles = g.view.alphaCasts.models.size;
    const target = w.units.find((u: any) => u.kind === 'dummy');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step(3);
    g.view.render(w, 1, g.view.previousElapsed);
    const beforeDeath = g.view.alphaCasts.models.size;
    w.damage(target, w.hero, 1e6, 'true');
    w.step();
    const record = structuredClone(w.player.alphaCastVisuals.at(-1));
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(target, nexus, 1e6, 'true');
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    if (copy.snapshot() !== saved) throw Error('Terminal cast snapshot differs');
    g.view.alphaCasts.update(w, 1, g.view.camera, 0);
    const terminalStart = g.view.alphaCasts.models.size;
    g.view.alphaCasts.update(w, 1, g.view.camera, 60);
    return {
      hiddenAudience,
      hiddenParticles,
      beforeDeath,
      record,
      winner: w.winner,
      terminalStart,
      remaining: g.view.alphaCasts.models.size,
      unchanged: saved === w.snapshot(),
    };
  });
  expect(result.hiddenAudience).toEqual(['red']);
  expect(result.hiddenParticles).toBe(0);
  expect(result.beforeDeath).toBeGreaterThan(0);
  expect(result.record.detachedTick).not.toBeNull();
  expect(result.winner).toBe('blue');
  expect(result.terminalStart).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  writeFileSync(info.outputPath('fog-death-terminal.json'), JSON.stringify(result, null, 2));
});
