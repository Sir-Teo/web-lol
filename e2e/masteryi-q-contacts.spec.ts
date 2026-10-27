import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

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
async function prepare(page: Page, critical: boolean) {
  await page.goto('/?scene=fixture&champion=masteryi');
  await ready(page);
  return page.evaluate((critical) => {
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
    if (critical) w.player.inventory = Array(6).fill('agility');
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    target.armor = 0;
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { id: target.id, screen: g.view.screenPoint(target, 0.65) };
  }, critical);
}

for (const critical of [false, true])
  test(`real ${critical ? 'critical' : 'ordinary'} Q contacts retain source particles through Save/reload`, async ({
    page,
  }, info) => {
    const target = await prepare(page, critical);
    await page.mouse.move(target.screen.x, target.screen.y);
    await page.evaluate(() => {
      window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), {
        once: true,
      });
      (window as any).__GAME__.setPaused(false);
    });
    await page.keyboard.press('q');
    const pending = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.step();
      const q = w.player.alphaStrike;
      if (!q) throw Error('Real Q was not admitted');
      w.step(q.startTick + 14 - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      return {
        marks: q.marks.map((m: any) => m.result),
        contacts: w.player.alphaContactVisuals.length,
        particles: g.view.alphaContacts.models.size,
        visible: g.view.models.get(w.hero.id).root.visible,
      };
    });
    expect(pending).toEqual({ marks: ['pending'], contacts: 0, particles: 0, visible: false });
    const before = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.step(w.player.alphaStrike.startTick + 30 - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      const describe = () =>
        [...g.view.alphaContacts.models]
          .map(([key, mesh]: any) => ({
            key,
            name: mesh.name,
            data: mesh.userData,
            position: mesh.position.toArray(),
            scale: mesh.scale.toArray(),
            quaternion: mesh.quaternion.toArray(),
            lookup: mesh.material.uniforms.lookupUv.value.toArray(),
            scroll: mesh.material.uniforms.sourceUvOffset.value.toArray(),
            color: mesh.material.uniforms.particleColor.value.toArray(),
            baseMips: mesh.material.uniforms.sourceTexture.value.mipmaps.map((m: any) => [
              m.width,
              m.height,
            ]),
            lookupMips: mesh.material.uniforms.particleColorTexture.value.mipmaps.map((m: any) => [
              m.width,
              m.height,
            ]),
          }))
          .sort((a: any, b: any) => a.key.localeCompare(b.key));
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(100);
      (window as any).__CONTACT_DESCRIBE__ = describe;
      return {
        saved,
        future: copy.snapshot(),
        contacts: structuredClone(w.player.alphaContactVisuals),
        particles: describe(),
      };
    });
    expect(before.contacts).toHaveLength(1);
    expect(before.contacts[0].critical).toBe(critical);
    expect(before.particles).toHaveLength(critical ? 3 : 4);
    expect(before.particles.every((p) => p.data.critical === critical)).toBe(true);
    if (!critical) {
      const replay = await page.evaluate(async () => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext();
        const { default: source } = await import('/src/content/masteryi-q-contact-particles.json');
        const digest = async (bytes: Uint8Array) =>
          Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
            b.toString(16).padStart(2, '0')
          ).join('');
        const textures = new Map();
        for (const mesh of g.view.alphaContacts.models.values())
          for (const key of ['sourceTexture', 'particleColorTexture']) {
            const texture = mesh.material.uniforms[key].value;
            textures.set(texture.name, texture);
          }
        const framebuffer = gl.createFramebuffer(),
          previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
          results = [];
        try {
          for (const asset of source.textures) {
            const texture: any = textures.get(asset.url);
            if (!texture) throw Error('Selected source texture is absent');
            renderer.initTexture(texture);
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            const native = renderer.properties.get(texture).__webglTexture;
            for (const rect of asset.rectangles) {
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                native,
                rect.level
              );
              if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                throw Error('Three mip framebuffer incomplete');
              const pixels = new Uint8Array(rect.width * rect.height * 4);
              gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              const hash = await digest(pixels);
              if (hash !== rect.rgbaSha256)
                throw Error(`Three mip pixels differ: ${asset.url} ${rect.level}`);
              if (gl.getError() !== gl.NO_ERROR) throw Error('Three mip readback error');
              results.push({ url: asset.url, level: rect.level, rgbaSha256: hash });
            }
          }
        } finally {
          gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
          gl.deleteFramebuffer(framebuffer);
          renderer.resetState();
        }
        return results;
      });
      expect(replay).toHaveLength(59);
      writeFileSync(
        info.outputPath('three-authored-mip-readback.json'),
        JSON.stringify(replay, null, 2)
      );
    }
    await page.screenshot({
      path: info.outputPath(critical ? 'critical-contact.png' : 'ordinary-contact.png'),
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before.saved);
    const after = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      g.view.zoom = 0.6;
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      const particles = [...g.view.alphaContacts.models]
        .map(([key, mesh]: any) => ({
          key,
          name: mesh.name,
          data: mesh.userData,
          position: mesh.position.toArray(),
          scale: mesh.scale.toArray(),
          quaternion: mesh.quaternion.toArray(),
          lookup: mesh.material.uniforms.lookupUv.value.toArray(),
          scroll: mesh.material.uniforms.sourceUvOffset.value.toArray(),
          color: mesh.material.uniforms.particleColor.value.toArray(),
          baseMips: mesh.material.uniforms.sourceTexture.value.mipmaps.map((m: any) => [
            m.width,
            m.height,
          ]),
          lookupMips: mesh.material.uniforms.particleColorTexture.value.mipmaps.map((m: any) => [
            m.width,
            m.height,
          ]),
        }))
        .sort((a: any, b: any) => a.key.localeCompare(b.key));
      w.step(100);
      g.view.render(w, 1, g.view.previousElapsed);
      return { particles, future: w.snapshot(), remaining: g.view.alphaContacts.models.size };
    });
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    writeFileSync(
      info.outputPath('contact-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips the pack and late presence retries only a failed texture explicitly', async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (/masteryi-q-contact-(?:[0-9a-f]+\.png|trail\.glb)$/.test(r.url())) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  let failedUrl = '';
  await page.route('**/assets/effects/masteryi-q-contact-*.png', async (route) => {
    if (!failedUrl) {
      failedUrl = route.request().url();
      await route.fulfill({ status: 503, body: 'fixture failure' });
    } else await route.continue();
  });
  const first = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    try {
      await g.view.alphaContacts.load();
      return 'unexpected success';
    } catch (error) {
      return String(error);
    }
  });
  expect(first).toContain('Source asset fetch failed');
  expect(requests).toHaveLength(8);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.view.alphaContacts.update(g.world, 1, g.view.camera);
  });
  expect(requests).toHaveLength(8);
  await page.unroute('**/assets/effects/masteryi-q-contact-*.png');
  await page.evaluate(async () => {
    await (window as any).__GAME__.view.alphaContacts.load();
  });
  expect(requests).toHaveLength(9);
  expect(requests.filter((url) => url === failedUrl)).toHaveLength(2);
  expect(new Set(requests).size).toBe(8);
  writeFileSync(
    info.outputPath('late-load-explicit-retry.json'),
    JSON.stringify({ requests, failedUrl, first }, null, 2)
  );
});
