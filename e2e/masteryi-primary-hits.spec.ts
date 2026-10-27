import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-primary-hit-particles.json', 'utf8'));

test('all primary-hit families use saved target chest poses, exact GPU mips and real Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture&champion=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async (data) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'ashe');
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    const url = performance
        .getEntriesByType('resource')
        .map((r: any) => r.name)
        .find((s: string) => s.includes('/node_modules/.vite/deps/three.js')),
      THREE = await import(url),
      selector = await import('/src/simulation/masteryi-attack-kind.ts'),
      { ImpactAttachments } = await import('/src/render/impact-attachments.ts'),
      { createTargetPoseSampler } = await import('/src/render/models.ts'),
      { primaryHitParticles } = await import('/src/render/masteryi-primary-hit-particles.ts'),
      textures = new Map(),
      rows = [];
    const describe = () =>
      [...g.view.primaryHits.models].map(([key, mesh]: any) => ({
        key,
        data: mesh.userData,
        position: mesh.position.toArray(),
        quaternion: mesh.quaternion.toArray(),
        scale: mesh.scale.toArray(),
        uv: mesh.material.uniforms.sourceUvTransform.value.toArray(),
        color: mesh.material.uniforms.particleColor.value.toArray(),
        vertexColor: mesh.geometry.getAttribute('_source_vertex_bgra')
          ? Array.from(mesh.geometry.getAttribute('_source_vertex_bgra').array)
          : null,
        blending: mesh.material.blending,
      }));
    for (const kind of ['attack1', 'attack2', 'crit']) {
      while (kind !== 'crit' && selector.masterYiAttackKind(w.hero.id, w.tick + 1, false) !== kind)
        w.step();
      const chance = w.criticalChance;
      if (kind === 'crit') w.criticalChance = () => 1;
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step();
      w.criticalChance = chance;
      const record = w.player.masterYiAAAudio.at(-1);
      if (record.kind !== kind) throw Error('Wrong accepted hit family');
      w.step(record.releaseTick - w.tick);
      w.setOrder(w.hero, { type: 'idle' });
      g.view.recenter(target);
      g.view.zoom = 0.6;
      g.view.render(w, 1, g.view.previousElapsed);
      if (g.view.primaryHits.models.size)
        throw Error('Contact particles emitted before first update');
      w.step();
      g.view.render(w, 1, g.view.previousElapsed);
      const hit = record.impact,
        path = new ImpactAttachments(
          createTargetPoseSampler(record.targetRig),
          (point: any) => g.view.ground(point),
          () => 'C_BUFFBONE_GLB_CHEST_LOC'
        ),
        history = {
          targetRig: record.targetRig,
          critical: kind === 'crit',
          targetTransform: hit.targetTransform,
          frames: hit.frames,
        },
        anchor = path.point(history, w.tick),
        particles = primaryHitParticles(
          w.hero.id ^ Math.imul(record.startTick, 0x9e3779b9),
          1 / 60,
          kind,
          hit.radius
        ),
        models = [...g.view.primaryHits.models.values()] as any[],
        indices = [...new Set(models.map((m) => m.userData.profileIndex))].sort((a, b) => a - b),
        expected = data.profiles.flatMap((p: any, i: number) => (p.role === kind ? [i] : []));
      if (JSON.stringify(indices) !== JSON.stringify(expected))
        throw Error('Incomplete primary-hit emitter family');
      let maximumDistance = 0;
      for (const mesh of models) {
        const p = data.profiles[mesh.userData.profileIndex],
          particle = particles.find(
            (v: any) =>
              v.profileIndex === mesh.userData.profileIndex && v.ordinal === mesh.userData.ordinal
          );
        if (!particle) throw Error('Missing independently sampled source particle');
        const heading = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            hit.facing
          ),
          position = anchor
            .clone()
            .add(
              new THREE.Vector3(-particle.offset[0], particle.offset[1], particle.offset[2])
                .multiplyScalar(0.01)
                .applyQuaternion(heading)
            ),
          distance = mesh.position.distanceTo(position);
        maximumDistance = Math.max(maximumDistance, distance);
        if (distance > 1e-6) throw Error('Primary particle lost target chest attachment');
        if (p.blend === 3 && mesh.material.blending !== THREE.NoBlending)
          throw Error('Fluid became additive');
        for (const name of ['sourceTexture', 'particleColorTexture']) {
          const texture = mesh.material.uniforms[name].value;
          if (texture.name) textures.set(texture.name, texture);
        }
      }
      const liveModel = g.view.models.get(target.id);
      let chest: any;
      liveModel.root.traverse((node: any) => {
        if (node.name.toLowerCase() === 'c_buffbone_glb_chest_loc') chest = node;
      });
      if (!chest || anchor.distanceTo(chest.getWorldPosition(new THREE.Vector3())) > 1e-6)
        throw Error('Saved chest pose differs from current real target skeleton');
      rows.push({ kind, indices, maximumDistance, chest: anchor.toArray(), particles: describe() });
      path.dispose();
      if (kind !== 'crit') w.step(100);
    }
    const renderer = g.view.renderer,
      gl = renderer.getContext(),
      previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
      fb = gl.createFramebuffer(),
      mips = [];
    try {
      for (const asset of data.textures) {
        const texture: any = textures.get(asset.url);
        if (!texture) throw Error('Missing active primary-hit texture ' + asset.url);
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
            throw Error('Incomplete runtime hit mip framebuffer');
          const bytes = new Uint8Array(rect.width * rect.height * 4);
          gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          if (gl.getError() !== gl.NO_ERROR) throw Error('Runtime hit mip readback failed');
          const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          if (sha256 !== rect.rgbaSha256) throw Error('Runtime authored hit mip changed');
          mips.push({ url: asset.url, level: rect.level, sha256 });
        }
      }
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
      gl.deleteFramebuffer(fb);
      renderer.resetState();
    }
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(130);
    return { rows, mips, saved, future: copy.snapshot(), particles: describe() };
  }, data);
  expect(result.rows).toHaveLength(3);
  expect(result.mips).toHaveLength(93);
  await page.screenshot({ path: info.outputPath('primary-critical-hit.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    g.view.render(w, 1, g.view.previousElapsed);
    const copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    copy.step(130);
    return {
      saved: w.snapshot(),
      future: copy.snapshot(),
      particles: [...g.view.primaryHits.models].map(([key, mesh]: any) => ({
        key,
        data: mesh.userData,
        position: mesh.position.toArray(),
        quaternion: mesh.quaternion.toArray(),
        scale: mesh.scale.toArray(),
        uv: mesh.material.uniforms.sourceUvTransform.value.toArray(),
        color: mesh.material.uniforms.particleColor.value.toArray(),
        vertexColor: mesh.geometry.getAttribute('_source_vertex_bgra')
          ? Array.from(mesh.geometry.getAttribute('_source_vertex_bgra').array)
          : null,
        blending: mesh.material.blending,
      })),
    };
  });
  expect(restored.saved).toBe(result.saved);
  expect(restored.future).toBe(result.future);
  expect(restored.particles).toEqual(result.particles);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('primary-hit-gpu-save.json'),
    JSON.stringify({ before: result, after: restored }, null, 2)
  );
});

async function prepare(page: import('@playwright/test').Page) {
  await page.goto('/?scene=fixture&champion=masteryi');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
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
  });
}
test('ordinary startup skips primary hits and an explicit retry requests only the failed transport', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const urls: string[] = [],
    own = data.textures.filter((t: any) => t.url.includes('/masteryi-primary-hit-'));
  const failed = own[0].url;
  let fail = true;
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/assets/effects/masteryi-primary-hit-') ||
      request.url().endsWith('/src/render/masteryi-primary-hits.ts')
    )
      urls.push(request.url());
  });
  await page.route('**/' + failed, (route) => (fail ? route.abort() : route.continue()));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(urls).toEqual([]);
  await prepare(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const r = w.player.masterYiAAAudio.at(-1);
    w.step(r.releaseTick + 1 - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    return { models: g.view.primaryHits.models.size, target: target.id };
  });
  expect(before.models).toBe(0);
  const initial = [...urls];
  fail = false;
  const models = await page.evaluate(async (targetId) => {
    const g = (window as any).__GAME__,
      w = g.world;
    await g.view.primaryHits.load();
    w.step(100);
    w.setOrder(w.hero, { type: 'attack', target: targetId });
    w.step();
    const r = w.player.masterYiAAAudio.at(-1);
    w.step(r.releaseTick + 1 - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    return g.view.primaryHits.models.size;
  }, before.target);
  expect(models).toBeGreaterThan(0);
  const count = (list: string[], url: string) => list.filter((u) => u.endsWith(url)).length;
  for (const asset of own)
    expect(count(urls, asset.url)).toBe(count(initial, asset.url) + (asset.url === failed ? 1 : 0));
  writeFileSync(
    info.outputPath('selective-retry.json'),
    JSON.stringify({ initial, after: urls }, null, 2)
  );
});

test('known birth tails survive source death and victory while a hidden contact stays absent after reveal', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await prepare(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      hiddenTarget = w.spawn('dummy', 'red', { x: 150, y: 0 });
    hiddenTarget.ai = false;
    hiddenTarget.hp = hiddenTarget.maxHp = 1e6;
    w.setOrder(w.hero, { type: 'attack', target: hiddenTarget.id });
    w.step();
    const hiddenRecord = w.player.masterYiAAAudio.at(-1);
    w.step(hiddenRecord.releaseTick - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    const original = w.visible;
    w.visible = function (unit: any, team: any) {
      return unit.id === hiddenTarget.id && team === 'blue'
        ? false
        : original.call(this, unit, team);
    };
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const count = (id: number) =>
        [...g.view.primaryHits.models.values()].filter((mesh: any) => mesh.userData.sourceId === id)
          .length,
      hidden = count(w.hero.id);
    w.visible = original;
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = count(w.hero.id);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(80);
    w.step(80);
    if (copy.snapshot() !== w.snapshot()) throw Error('Hidden primary-hit saved future differs');
    const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const record = w.player.masterYiAAAudio.at(-1);
    w.step(record.releaseTick + 1 - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    g.view.render(w, 1, g.view.previousElapsed);
    const visible = count(w.hero.id);
    // Finish the birth tick before losing the last blue vision source.
    w.step();
    w.damage(target, w.hero, 1e9, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const corpse = count(w.hero.id);
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 }),
      source = w.spawn('dummy', 'blue', { x: 1000, y: 1100 });
    w.damage(source, nexus, 1e9, 'true');
    const terminal = w.snapshot(),
      restored = w.constructor.fromSnapshot(terminal, w.battlefield);
    if (restored.snapshot() !== terminal) throw Error('Terminal hit save differs');
    g.view.primaryHits.update(w, 1, g.view.camera, 0);
    const terminalTail = count(w.hero.id);
    g.view.primaryHits.update(w, 1, g.view.camera, 2);
    return {
      hidden,
      revealed,
      visible,
      corpse,
      terminalTail,
      remaining: count(w.hero.id),
      unchanged: terminal === w.snapshot(),
      winner: w.winner,
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.visible).toBeGreaterThan(0);
  expect(result.corpse).toBeGreaterThan(0);
  expect(result.terminalTail).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(
    info.outputPath('visibility-corpse-terminal.json'),
    JSON.stringify(result, null, 2)
  );
});

test('each source hit emitter produces GPU pixels through its actual runtime material', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await prepare(page);
  const result = await page.evaluate(async (data) => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    const url = performance
        .getEntriesByType('resource')
        .map((r: any) => r.name)
        .find((s: string) => s.includes('/node_modules/.vite/deps/three.js')),
      THREE = await import(url),
      selector = await import('/src/simulation/masteryi-attack-kind.ts'),
      renderer = g.view.renderer,
      image = new THREE.WebGLRenderTarget(64, 64),
      scene = new THREE.Scene(),
      previous = renderer.getRenderTarget(),
      clear = renderer.getClearColor(new THREE.Color()),
      clearAlpha = renderer.getClearAlpha(),
      rows = [];
    try {
      for (const kind of ['attack1', 'attack2', 'crit']) {
        while (
          kind !== 'crit' &&
          selector.masterYiAttackKind(w.hero.id, w.tick + 1, false) !== kind
        )
          w.step();
        const chance = w.criticalChance;
        if (kind === 'crit') w.criticalChance = () => 1;
        w.setOrder(w.hero, { type: 'attack', target: target.id });
        w.step();
        w.criticalChance = chance;
        const record = w.player.masterYiAAAudio.at(-1);
        w.step(record.releaseTick + 4 - w.tick);
        w.setOrder(w.hero, { type: 'idle' });
        g.view.render(w, 1, g.view.previousElapsed);
        for (const index of data.profiles.flatMap((p: any, i: number) =>
          p.role === kind ? [i] : []
        )) {
          const original = [...g.view.primaryHits.models.values()].find(
            (m: any) => m.userData.profileIndex === index
          ) as any;
          if (!original) throw Error('Missing source emitter for GPU pixel probe');
          const clone = original.clone();
          clone.visible = true;
          scene.add(clone);
          const bounds = new THREE.Box3().setFromObject(clone),
            center = bounds.getCenter(new THREE.Vector3()),
            radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
          clone.position.sub(center);
          const camera = new THREE.OrthographicCamera(
            -radius * 1.2,
            radius * 1.2,
            radius * 1.2,
            -radius * 1.2,
            radius * 0.001,
            radius * 10
          );
          let pixels = 0;
          for (const direction of [
            new THREE.Vector3(1, 0.7, 2),
            new THREE.Vector3(-1, -0.7, -2),
            new THREE.Vector3(0, 3, 0.1),
          ]) {
            camera.position.copy(direction.multiplyScalar(radius));
            camera.lookAt(0, 0, 0);
            renderer.setRenderTarget(image);
            renderer.setClearColor(0, 0);
            renderer.clear();
            renderer.render(scene, camera);
            const bytes = new Uint8Array(64 * 64 * 4);
            renderer.readRenderTargetPixels(image, 0, 0, 64, 64, bytes);
            let count = 0;
            for (let i = 0; i < bytes.length; i += 4)
              if (bytes[i] + bytes[i + 1] + bytes[i + 2]) count++;
            pixels = Math.max(pixels, count);
          }
          scene.remove(clone);
          rows.push({
            kind,
            index,
            name: data.profiles[index].name,
            pixels,
            blending: original.material.blending,
          });
        }
        w.step(100);
      }
    } finally {
      renderer.setRenderTarget(previous);
      renderer.setClearColor(clear, clearAlpha);
      image.dispose();
    }
    return rows;
  }, data);
  expect(result).toHaveLength(11);
  for (const row of result) expect(row.pixels, `${row.kind} ${row.name}`).toBeGreaterThan(0);
  writeFileSync(info.outputPath('all-emitter-gpu-pixels.json'), JSON.stringify(result, null, 2));
});
