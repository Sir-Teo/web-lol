import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/content/masteryi-passive-trail-particles.json', 'utf8'));
data.primaryMarker = JSON.parse(
  readFileSync('src/content/masteryi-primary-trail-particles.json', 'utf8')
).markers[0];
test('both passive events render native trails, exact GPU mips/joint frames and saved futures', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('/assets/models/masteryi-primary-trail.glb')) requests.push(r.url());
  });
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
    const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    const url = performance
      .getEntriesByType('resource')
      .map((r: any) => r.name)
      .find((s: string) => s.includes('/node_modules/.vite/deps/three.js'));
    const THREE = await import(url);
    const textures = new Map(),
      rows = [];
    let geometry: any;
    const describe = () =>
      [...g.view.passiveTrails.models].map(([key, m]: any) => ({
        key,
        data: m.userData,
        position: m.position.toArray(),
        quaternion: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        uv: m.material.uniforms.sourceUvTransform.value.toArray(),
      }));
    let primaryGeometry: any;
    for (let i = 0; i < 4; i++) {
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step(Math.max(1, w.hero.nextAttackTick - w.tick + 1));
      if (i === 0) {
        const r = w.player.masterYiAAAudio.at(-1),
          m = data.primaryMarker,
          rate = m.renderedDuration / ((r.endTick - r.startTick) / 60);
        let offset = 0;
        while ((offset / 60) * rate < m.renderedSeconds) offset++;
        w.step(r.startTick + offset + 2 - w.tick);
        g.view.render(w, 1, g.view.previousElapsed);
        primaryGeometry = [...g.view.primaryTrails.models.values()][0]?.geometry;
        if (!primaryGeometry)
          throw Error('Missing actual primary geometry for shared-resource check');
      }
      w.step(w.hero.releaseTick - w.tick);
      w.setOrder(w.hero, { type: 'idle' });
    }
    const record = w.player.passiveTrailVisuals.at(-1);
    if (!record || w.player.passiveTrailVisuals.length !== 1)
      throw Error('Missing actual fourth-contact admission');
    for (const event of [0, 1]) {
      const marker = data.markers[event],
        duration = record.endTick - record.startTick,
        rate = marker.renderedDuration / (duration / 60);
      let offset = 0;
      while ((offset / 60) * rate < marker.renderedSeconds) offset++;
      const markerTick = record.startTick + offset;
      w.step(markerTick - w.tick);
      g.view.render(w, 1, g.view.previousElapsed);
      if (
        [...g.view.passiveTrails.models.values()].some(
          (m: any) => m.userData.profileIndex === event
        )
      )
        throw Error('Source first update emitted early');
      w.step(2);
      g.view.zoom = 0.6;
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      const meshes = [...g.view.passiveTrails.models.values()].filter(
        (m: any) => m.userData.profileIndex === event
      );
      if (meshes.length !== 1) throw Error('Missing finite passive trail');
      const mesh: any = meshes[0];
      if (mesh.geometry !== primaryGeometry)
        throw Error('Passive and primary did not share page-owned geometry');
      if (geometry && geometry !== mesh.geometry)
        throw Error('Passive families did not share geometry');
      geometry = mesh.geometry;
      if (mesh.geometry.getAttribute('position').count !== 1500)
        throw Error('Wrong native trail corners');
      for (const name of ['sourceTexture', 'particleColorTexture']) {
        const t = mesh.material.uniforms[name].value;
        textures.set(t.name, t);
      }
      const model = g.view.models.get(w.hero.id);
      let bone: any;
      model.root.traverse((node: any) => {
        if (node.name.toLowerCase() === marker.sourceBone.toLowerCase()) bone = node;
      });
      if (!bone) throw Error('Missing named center joint');
      const q = bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
        position = bone.getWorldPosition(new THREE.Vector3()),
        profile = data.profiles[marker.profileIndex];
      const source = profile.position.values[0];
      position.add(
        new THREE.Vector3(-source[0], source[1], source[2]).multiplyScalar(0.01).applyQuaternion(q)
      );
      const angles = profile.rotation.values[0].map((x: number) => THREE.MathUtils.degToRad(x)),
        r = new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles, 'YXZ'));
      r.set(r.x, -r.y, -r.z, r.w);
      q.multiply(r);
      const distance = mesh.position.distanceTo(position),
        angle = mesh.quaternion.angleTo(q);
      const renderer = g.view.renderer,
        targetImage = new THREE.WebGLRenderTarget(64, 64),
        scene = new THREE.Scene(),
        clone = mesh.clone();
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
        ),
        previousTarget = renderer.getRenderTarget(),
        clear = renderer.getClearColor(new THREE.Color()),
        clearAlpha = renderer.getClearAlpha();
      let pixels = 0;
      try {
        for (const sign of [1, -1]) {
          camera.position.set(radius * sign, radius * 0.7 * sign, radius * 2 * sign);
          camera.lookAt(0, 0, 0);
          renderer.setRenderTarget(targetImage);
          renderer.setClearColor(0, 0);
          renderer.clear();
          renderer.render(scene, camera);
          const bytes = new Uint8Array(64 * 64 * 4);
          renderer.readRenderTargetPixels(targetImage, 0, 0, 64, 64, bytes);
          let count = 0;
          for (let i = 0; i < bytes.length; i += 4)
            if (bytes[i] + bytes[i + 1] + bytes[i + 2] > 0) count++;
          pixels = Math.max(pixels, count);
        }
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(clear, clearAlpha);
        scene.remove(clone);
        targetImage.dispose();
        g.view.render(w, 1, g.view.previousElapsed);
      }
      if (!pixels) throw Error('Passive source family has no visible pixels');
      rows.push({
        event,
        pixels,
        markerTick,
        tick: w.tick,
        profile: mesh.userData.profileIndex,
        distance,
        angle,
        particles: describe(),
      });
      if (distance > 1e-10 || angle > 1e-6) throw Error('Current joint frame differs');
    }
    const renderer = g.view.renderer,
      gl = renderer.getContext(),
      previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
      fb = gl.createFramebuffer(),
      mips = [];
    const hash = async (bytes: Uint8Array) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    try {
      for (const asset of data.textures) {
        const t: any = textures.get(asset.url);
        if (!t) throw Error('Missing actual passive texture ' + asset.url);
        renderer.initTexture(t);
        const native = renderer.properties.get(t).__webglTexture;
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
            throw Error('Incomplete primary mip framebuffer');
          const bytes = new Uint8Array(rect.width * rect.height * 4);
          gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          if (gl.getError() !== gl.NO_ERROR) throw Error('Primary GPU readback failed');
          const digest = await hash(bytes);
          if (digest !== rect.rgbaSha256) throw Error('Primary authored GPU mip differs');
          mips.push({ url: asset.url, level: rect.level, sha256: digest });
        }
      }
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
      gl.deleteFramebuffer(fb);
      renderer.resetState();
    }
    const attributes = [];
    for (const [name, key] of [
      ['position', 'positionFloat32Sha256'],
      ['uv', 'uvFloat32Sha256'],
      ['_source_face_rgb', 'faceRgbSha256'],
    ]) {
      const a = geometry.getAttribute(name);
      if (!a) throw Error('Missing source geometry attribute');
      const componentBytes = a.array.BYTES_PER_ELEMENT,
        stride = a.isInterleavedBufferAttribute ? a.data.stride : a.itemSize,
        offset = a.isInterleavedBufferAttribute ? a.offset : 0;
      const bytes = new Uint8Array(a.count * a.itemSize * componentBytes);
      for (let i = 0; i < a.count; i++)
        bytes.set(
          new Uint8Array(
            a.array.buffer,
            a.array.byteOffset + (i * stride + offset) * componentBytes,
            a.itemSize * componentBytes
          ),
          i * a.itemSize * componentBytes
        );
      const digest = await hash(bytes);
      if (digest !== data.mesh.attributes[key])
        throw Error(
          'Actual geometry differs ' +
            JSON.stringify({
              name,
              digest,
              expected: data.mesh.attributes[key],
              interleaved: a.isInterleavedBufferAttribute,
              count: a.count,
              itemSize: a.itemSize,
              arrayLength: a.array.length,
              normalized: a.normalized,
              stride: a.data?.stride,
              offset: a.offset,
            })
        );
      attributes.push({ name, sha256: digest });
    }
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(130);
    (window as any).__PRIMARY_TEXTURES__ = textures;
    return { rows, mips, attributes, saved, future: copy.snapshot(), particles: describe() };
  }, data);
  expect(result.rows.map((r) => r.profile)).toEqual([0, 1]);
  expect(result.mips).toHaveLength(25);
  expect(result.attributes).toHaveLength(3);
  expect(requests).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('passive-trail-events.png') });
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
      particles: [...g.view.passiveTrails.models].map(([key, m]: any) => ({
        key,
        data: m.userData,
        position: m.position.toArray(),
        quaternion: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        uv: m.material.uniforms.sourceUvTransform.value.toArray(),
      })),
    };
  });
  expect(restored.saved).toBe(result.saved);
  expect(restored.future).toBe(result.future);
  expect(restored.particles).toEqual(result.particles);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('passive-trail-gpu-save.json'),
    JSON.stringify({ before: result, after: restored }, null, 2)
  );
});

async function prepare(page: Page) {
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
    g.view.recenter(w.hero);
    (window as any).__ACCEPT_PASSIVE__ = (yi: any, target: any) => {
      const after = w.tick,
        owner = w.championState(yi.id);
      for (let i = 0; i < 4; i++) {
        w.setOrder(yi, { type: 'attack', target: target.id });
        w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
        if (yi.releaseTick === null) throw Error('Fixture primary was not accepted');
        w.step(yi.releaseTick - w.tick);
        w.setOrder(yi, { type: 'idle' });
        const record = owner.passiveTrailVisuals.at(-1);
        if (record && record.startTick > after) return record;
      }
      throw Error('Four real primary contacts did not accept a child');
    };
  });
}

test('ordinary startup skips passive assets and explicit retry retains shared verified downloads', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const paths = new Set([...data.textures.map((t: any) => '/' + t.url), '/' + data.mesh.url]),
    seen: string[] = [];
  let fail = true;
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname;
    if (paths.has(path) || path === '/src/render/masteryi-passive-trails.ts') seen.push(r.url());
  });
  const failed = data.textures.find((t: any) => t.url.includes('masteryi-passive-trail')).url;
  await page.route('**/' + failed, (route) => (fail ? route.abort() : route.continue()));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(seen).toEqual([]);
  await prepare(page);
  const before = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      helper = await import('/src/simulation/masteryi-passive-trails.ts'),
      target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    const record = (window as any).__ACCEPT_PASSIVE__(w.hero, target);
    w.step(helper.passiveTrailMarkerTick(record, 1) + 2 - w.tick);
    for (let i = 0; i < 5; i++) g.view.render(w, 1, g.view.previousElapsed);
    return { models: g.view.passiveTrails.models.size };
  });
  expect(before.models).toBe(0);
  const first = [...seen];
  fail = false;
  const after = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    await g.view.passiveTrails.load();
    g.view.render(g.world, 1, g.view.previousElapsed);
    return g.view.passiveTrails.models.size;
  });
  expect(after).toBe(2);
  const count = (urls: string[], part: string) => urls.filter((s) => s.endsWith(part)).length;
  expect(count(seen, failed)).toBe(count(first, failed) + 1);
  for (const asset of [...data.textures.filter((t: any) => t.url !== failed), data.mesh])
    expect(count(seen, asset.url)).toBe(count(first, asset.url));
  writeFileSync(
    info.outputPath('passive-selective-retry.json'),
    JSON.stringify({ first, after: seen }, null, 2)
  );
});

test('movement keeps event decisions separate while Q, corpse and victory tails preserve saves', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await prepare(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      helper = await import('/src/simulation/masteryi-passive-trails.ts'),
      target = w.spawn('dummy', 'red', { x: 150, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    const render = () => g.view.render(w, 1, g.view.previousElapsed),
      count = () => g.view.passiveTrails.models.size,
      accept = () => (window as any).__ACCEPT_PASSIVE__(w.hero, target),
      future = (ticks: number) => {
        const copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
        copy.step(ticks);
        w.step(ticks);
        if (copy.snapshot() !== w.snapshot()) throw Error('Passive future differs');
      };
    let record = accept();
    w.setOrder(w.hero, { type: 'move', point: { x: 1000, y: 0 } });
    w.step(helper.passiveTrailMarkerTick(record, 0) - w.tick);
    w.setOrder(w.hero, { type: 'idle' });
    w.step(helper.passiveTrailMarkerTick(record, 1) + 2 - w.tick);
    render();
    const movement = {
      events: [...record.events],
      profiles: [...g.view.passiveTrails.models.values()].map((m: any) => m.userData.profileIndex),
    };
    future(100);
    w.gainExperience(1e6);
    w.learnSpell('q');
    record = accept();
    w.step(helper.passiveTrailMarkerTick(record, 0) + 2 - w.tick);
    render();
    const beforeQ = count();
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    render();
    const qHidden = count();
    w.setOrder(w.hero, { type: 'idle' });
    future(100);
    render();
    const afterQ = count();
    record = accept();
    w.step(helper.passiveTrailMarkerTick(record, 0) + 2 - w.tick);
    render();
    const beforeDeath = count();
    w.damage(target, w.hero, 1e9, 'true');
    render();
    const corpse = count();
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 }),
      ally = w.spawn('dummy', 'blue', { x: 1000, y: 1100 });
    w.damage(ally, nexus, 1e9, 'true');
    render();
    const terminal = w.snapshot();
    if (w.constructor.fromSnapshot(terminal, w.battlefield).snapshot() !== terminal)
      throw Error('Passive terminal save differs');
    g.view.passiveTrails.update(w, 1, g.view.camera, g.view.models, 0);
    const terminalTail = count();
    g.view.passiveTrails.update(w, 1, g.view.camera, g.view.models, 2);
    return {
      movement,
      beforeQ,
      qHidden,
      afterQ,
      beforeDeath,
      corpse,
      terminalTail,
      remaining: count(),
      unchanged: terminal === w.snapshot(),
      winner: w.winner,
    };
  });
  expect(result.movement).toEqual({ events: [false, true], profiles: [1] });
  expect(result.beforeQ).toBeGreaterThan(0);
  expect(result.qHidden).toBe(0);
  expect(result.afterQ).toBe(0);
  expect(result.beforeDeath).toBeGreaterThan(0);
  expect(result.corpse).toBeGreaterThan(0);
  expect(result.terminalTail).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(
    info.outputPath('passive-visibility-terminal.json'),
    JSON.stringify(result, null, 2)
  );
});

test('both unseen passive births stay hidden after actual reveal and preserve the saved future', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await prepare(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      helper = await import('/src/simulation/masteryi-passive-trails.ts'),
      yi = w.spawn('champion', 'red', { x: 100, y: 0 }, 'masteryi'),
      target = w.spawn('dummy', 'blue', { x: 250, y: 0 });
    yi.ai = target.ai = false;
    target.hp = target.maxHp = 1e6;
    const original = w.visible;
    w.visible = function (unit: any, team: any) {
      return unit.id === yi.id && team === 'blue' ? false : original.call(this, unit, team);
    };
    const record = (window as any).__ACCEPT_PASSIVE__(yi, target);
    w.step(helper.passiveTrailMarkerTick(record, 1) + 2 - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const select = () =>
      [...g.view.passiveTrails.models.values()].filter((m: any) => m.userData.sourceId === yi.id)
        .length;
    const hidden = select(),
      decisions = [...record.events];
    w.visible = original;
    w.step();
    for (let i = 0; i < 2; i++) {
      g.view.render(w, 1, g.view.previousElapsed);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    g.view.render(w, 1, g.view.previousElapsed);
    if (!w.visible(yi, 'blue')) throw Error('Fixture lacks actual revealed vision');
    let named = false;
    g.view.models.get(yi.id)?.root.traverse((node: any) => {
      if (node.name.toLowerCase() === 'c_buffbone_glb_center_loc') named = true;
    });
    if (!named) throw Error('Revealed red rig is not loaded');
    const revealed = select(),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(100);
    w.step(100);
    if (copy.snapshot() !== w.snapshot()) throw Error('Hidden passive future differs');
    return { hidden, revealed, decisions, futureExact: true };
  });
  expect(result.decisions).toEqual([true, true]);
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.futureExact).toBe(true);
  writeFileSync(info.outputPath('passive-hidden-birth.json'), JSON.stringify(result, null, 2));
});
