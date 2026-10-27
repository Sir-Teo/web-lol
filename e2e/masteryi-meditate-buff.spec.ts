import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-w-buff-particles.json', 'utf8'));

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
    (window as any).__W_BUFF_DESCRIBE__ = () =>
      [...(window as any).__GAME__.view.meditateBuffs.models]
        .map(([key, mesh]: any) => ({
          key,
          name: mesh.name,
          data: mesh.userData,
          position: mesh.position.toArray(),
          quaternion: mesh.quaternion.toArray(),
          scale: mesh.scale.toArray(),
          color: mesh.material.uniforms.particleColor.value.toArray(),
          vertexColor: mesh.geometry.hasAttribute('_source_vertex_bgra')
            ? Array.from(mesh.geometry.getAttribute('_source_vertex_bgra').array)
            : null,
          lookup: mesh.material.uniforms.lookupUv.value.toArray(),
          uv: mesh.material.uniforms.sourceUvTransform.value.toArray(),
          mult: mesh.material.uniforms.multiplierUvTransform.value.toArray(),
          defines: mesh.material.defines,
          vertices: mesh.geometry.getAttribute('position').count,
        }))
        .sort((a: any, b: any) => a.key.localeCompare(b.key));
  });
}
for (const [offset, cancelled] of [
  [9, false],
  [135, false],
  [9, true],
] as const)
  test(`real W ${cancelled ? 'cancelled' : 'active'} buff at ${offset} ticks restores exact source particles`, async ({
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
    const before = await page.evaluate(
      ({ cancelled, offset }) => {
        const g = (window as any).__GAME__,
          w = g.world;
        g.setPaused(true);
        w.step();
        const record = w.player.meditateBuffVisuals.at(-1);
        if (!record) throw Error('Real W was not admitted');
        if (cancelled) {
          w.step(record.startTick + 5 - w.tick);
          w.setOrder(w.hero, { type: 'move', point: { x: 150, y: 90 } });
        }
        w.step(record.startTick + offset - w.tick);
        g.view.render(w, 1, g.view.previousElapsed);
        const saved = w.snapshot(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        copy.step(361);
        return {
          saved,
          future: copy.snapshot(),
          record: structuredClone(record),
          channel: structuredClone(w.player.meditate),
          particles: (window as any).__W_BUFF_DESCRIBE__(),
        };
      },
      { cancelled, offset }
    );
    expect(before.channel.stopReason).toBe(cancelled ? 'order' : null);
    expect(new Set(before.particles.map((p: any) => p.data.profileIndex)).size).toBe(
      offset === 135 ? 3 : 4
    );
    const orb = before.particles.find((p: any) => p.name.endsWith('orb'));
    expect(orb.defines).toMatchObject({ SOURCE_MULT: 1, SOURCE_LOCK_ALPHA: 1 });
    expect(orb.uv).not.toEqual(orb.mult);
    expect(
      before.particles
        .filter((p: any) => p.name.endsWith('orb'))
        .every((p: any) => p.vertices === 2199)
    ).toBe(true);
    if (offset === 135) expect(before.record.frames).toHaveLength(1);
    if (!cancelled && offset === 9) {
      const shared = await page.evaluate(() => {
        const view = (window as any).__GAME__.view;
        const collect = (models: Map<any, any>) => {
          const textures = new Map<string, any>();
          for (const mesh of models.values())
            for (const name of ['sourceTexture', 'particleColorTexture', 'multiplierTexture']) {
              const texture = mesh.material.uniforms[name]?.value;
              if (texture?.name) textures.set(texture.name, texture);
            }
          return textures;
        };
        const cast = collect(view.meditateCasts.models),
          buff = collect(view.meditateBuffs.models);
        return [...buff]
          .filter(([name]) => cast.has(name))
          .map(([name, texture]) => ({ url: name, sameTexture: cast.get(name) === texture }));
      });
      expect(shared).toHaveLength(2);
      expect(shared.every((row) => row.sameTexture)).toBe(true);
      writeFileSync(
        info.outputPath('shared-cast-buff-textures.json'),
        JSON.stringify(shared, null, 2)
      );
      const replay = await page.evaluate(async (assets) => {
        const g = (window as any).__GAME__,
          renderer = g.view.renderer,
          gl = renderer.getContext(),
          textures = new Map();
        for (const mesh of g.view.meditateBuffs.models.values())
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
      expect(replay).toHaveLength(54);
      writeFileSync(
        info.outputPath('active-three-mip-readback.json'),
        JSON.stringify(replay, null, 2)
      );
    }
    await page.screenshot({
      path: info.outputPath(`buff-${offset}-${cancelled}.png`),
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
      const particles = (window as any).__W_BUFF_DESCRIBE__();
      w.step(361);
      g.view.render(w, 1, g.view.previousElapsed);
      return { particles, future: w.snapshot(), remaining: g.view.meditateBuffs.models.size };
    });
    expect(after.particles).toEqual(before.particles);
    expect(after.future).toBe(before.future);
    expect(after.remaining).toBe(0);
    writeFileSync(
      info.outputPath('buff-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips buff assets and explicit retry fetches only the failed resource', async ({
  page,
}, info) => {
  const requests: string[] = [];
  let fail = true;
  const failed = data.textures.find((t: any) => t.url.includes('masteryi-w-buff-')).url;
  page.on('request', (r) => {
    if (/\/masteryi-w-buff-[^/]+\.(?:png|glb)$/.test(r.url())) requests.push(r.url());
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
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.waitForFunction(() => {
    const a = (window as any).__GAME__.view.meditateBuffs;
    return a.attempted && !a.pending;
  });
  expect(requests).toHaveLength(5);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.view.render(g.world, 1, g.view.previousElapsed);
  });
  expect(requests).toHaveLength(5);
  await page.evaluate(async () => {
    await (window as any).__GAME__.view.meditateBuffs.load();
  });
  expect(requests).toHaveLength(6);
  expect(requests.filter((url) => url.endsWith('/' + failed))).toHaveLength(2);
  const families = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      yi = w.units.find((u: any) => u.champion === 'masteryi');
    yi.ai = false;
    w.learnSpell('w', yi.id);
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'w', point: yi });
    w.step(10);
    g.view.render(w, 1, g.view.previousElapsed);
    return new Set(
      [...g.view.meditateBuffs.models.values()].map((m: any) => m.userData.profileIndex)
    ).size;
  });
  expect(families).toBe(4);
  writeFileSync(
    info.outputPath('buff-resource-retry.json'),
    JSON.stringify({ requests, families }, null, 2)
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
    const unseen = g.view.meditateBuffs.models.size;
    w.visible = () => true;
    g.view.render(w, 1, g.view.previousElapsed);
    const later = g.view.meditateBuffs.models.size;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(7);
    g.view.render(w, 1, g.view.previousElapsed);
    const known = g.view.meditateBuffs.models.size;
    w.damage(enemy, w.hero, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const afterDeath = g.view.meditateBuffs.models.size;
    const nexus = w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
    w.damage(enemy, nexus, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot();
    g.view.render(w, 1, g.view.previousElapsed + 3);
    return {
      unseen,
      later,
      known,
      afterDeath,
      remaining: g.view.meditateBuffs.models.size,
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
