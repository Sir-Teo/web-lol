import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const supported = [11, 14];
async function open(page: Page) {
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.setPaused(true);
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 800, y: -100, previous: { x: 800, y: -100 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    if (!w.championState(u.id).spellRanks.e) w.learnSpell('e', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    g.view.locked = false;
    g.view.zoom = 0.55;
    g.view.recenter({ x: 450, y: 0 });
    g.view.render(w, 1, 22.5);
    return {
      caster: u.id,
      target: target.id,
      start: w.tick,
      heroBrush: w.battlefield.inBrush?.(w.hero),
      targetBrush: w.battlefield.inBrush?.(target),
      targetVisible: w.visible(target),
    };
  });
}
async function sourcePixels(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const gl = v.renderer.getContext(),
      models = [...v.leonaZenithTrails.models.values()] as any[],
      read = () => {
        const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          p
        );
        return p;
      },
      draw = () => {
        v.renderer.render(v.scene, v.camera);
        return read();
      };
    for (const m of models) m.visible = false;
    const baseline = draw(),
      profiles = [];
    for (const profile of new Set(models.map((m) => m.userData.profileIndex))) {
      for (const m of models) m.visible = m.userData.profileIndex === profile;
      const pixels = draw();
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] !== baseline[i] ||
          pixels[i + 1] !== baseline[i + 1] ||
          pixels[i + 2] !== baseline[i + 2]
        )
          changed++;
      const m = models.find((m) => m.userData.profileIndex === profile);
      profiles.push({
        profile,
        changed,
        count: models.filter((m) => m.userData.profileIndex === profile).length,
        name: m.name,
        paletteRow: m.material.uniforms.paletteRow?.value,
        vertices: m.geometry.drawRange.count,
        capacity: m.userData.capacity,
      });
    }
    for (const m of models) m.visible = true;
    v.render(g.world, 1, 22.5);
    return {
      tick: g.world.tick,
      totalPixels: gl.drawingBufferWidth * gl.drawingBufferHeight,
      profiles,
      error: gl.getError(),
    };
  });
}
async function capture(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const gl = v.renderer.getContext(),
      p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      p
    );
    const models = [...v.leonaZenithTrails.models].map(([key, m]: any) => ({
      key,
      ...m.userData,
      count: m.geometry.drawRange.count,
      attributes: Object.fromEntries(
        Object.entries(m.geometry.attributes).map(([name, a]: any) => [
          name,
          Array.from(a.array.slice(0, m.geometry.drawRange.count * a.itemSize)),
        ])
      ),
      paletteRow: m.material.uniforms.paletteRow?.value,
    }));
    return {
      models,
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', p))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}

test('both source ribbons contribute localized pixels through flight and stopped tails', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const ids = await open(page),
    stages = [];
  for (const age of [
    13, 15, 18, 20, 24, 29, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 75, 85, 100, 120,
  ]) {
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: ids.start, age }
    );
    stages.push({ age, ...(await sourcePixels(page)) });
    if (age === 29 || age === 54 || age === 75)
      await page.screenshot({ path: info.outputPath(`source-${age}.png`) });
  }
  const seen = new Map<number, number>();
  for (const stage of stages) {
    expect(stage.error).toBe(0);
    for (const p of stage.profiles) {
      expect(p.changed).toBeLessThan(stage.totalPixels * 0.5);
      seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
    }
  }
  writeFileSync(
    info.outputPath('families.json'),
    JSON.stringify({ ids, stages, seen: [...seen], errors }, null, 2)
  );
  expect([...seen.keys()].sort((a, b) => a - b)).toEqual(supported);
  expect([...seen].filter(([, changed]) => changed === 0)).toEqual([]);
  expect(errors).toEqual([]);
});

for (const age of [29, 54])
  test(`ribbon age ${age} restores exact source state and pixels through Save/reload and graphics recovery`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ids = await open(page);
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: ids.start, age }
    );
    const before = await capture(page);
    expect(before.models.length).toBeGreaterThan(0);
    expect(before.error).toBe(0);
    expect(await capture(page)).toEqual(before);
    if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
      await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      g.view.locked = false;
      g.view.zoom = 0.55;
      g.view.recenter({ x: 450, y: 0 });
    });
    const restored = await capture(page);
    writeFileSync(
      info.outputPath('pre-recovery.json'),
      JSON.stringify({ age, before, restored, errors }, null, 2)
    );
    expect(restored).toEqual(before);
    await page.evaluate(async () => {
      const v = (window as any).__GAME__.view;
      await new Promise<void>((resolve) => {
        v.renderer.domElement.addEventListener(
          'webglcontextrestored',
          () => setTimeout(resolve, 100),
          { once: true }
        );
        v.renderer.forceContextLoss();
        setTimeout(() => v.renderer.forceContextRestore(), 250);
      });
    });
    const recovered = await capture(page);
    expect(recovered).toEqual(before);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('restore-recovery.json'),
      JSON.stringify({ age, before, restored, recovered, errors }, null, 2)
    );
  });

test('repeated hits and misses retire ribbon buffers and materials with bounded GPU memory', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const rounds = await page.evaluate(({ caster, target, start }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      t = w.unit(target),
      state = w.championState(caster),
      rounds = [];
    for (let i = 0; i < 6; i++) {
      let begun = start;
      if (i) {
        Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 }, mana: u.maxMana });
        Object.assign(t, {
          x: i % 2 ? 3000 : 800,
          y: 0,
          previous: { x: i % 2 ? 3000 : 800, y: 0 },
        });
        state.cooldowns.e = 0;
        w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
        w.step();
        begun = w.tick;
      }
      for (const age of [16, 18, 20, 24, 29]) {
        w.step(begun + age - w.tick);
        v.render(w, 1, 22.5);
      }
      const models = [...v.leonaZenithTrails.models.values()] as any[],
        owned = models.filter((m) => m.userData.ownedGeometry);
      let materials = 0,
        geometry = 0;
      for (const m of models) m.material.addEventListener('dispose', () => materials++);
      for (const m of owned) m.geometry.addEventListener('dispose', () => geometry++);
      w.step(begun + 75 - w.tick);
      v.render(w, 1, 22.5);
      w.step(240);
      v.render(w, 1, 22.5);
      rounds.push({
        outcome: i % 2 ? 'miss' : 'hit',
        active: models.length,
        owned: owned.length,
        materials,
        geometry,
        remaining: v.leonaZenithTrails.models.size,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  for (const r of rounds) {
    expect(r.active).toBeGreaterThan(0);
    expect(r.owned).toBe(2);
    expect(r.remaining).toBe(0);
    expect(r.materials).toBe(r.active);
    expect(r.geometry).toBeGreaterThanOrEqual(r.owned);
  }
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('storage.json'), JSON.stringify({ rounds, errors }, null, 2));
});

test('ribbon quad shader preserves per-vertex RGBA, lookup, untinted palette and remap alpha arithmetic', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await open(page);
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { createParticleRibbonMaterial } =
      await import('/src/render/particle-ribbon-material.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(8, 8, false);
    renderer.setClearColor(0, 0);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;
    camera.lookAt(0, 0, 0);
    const geometry = new THREE.PlaneGeometry(2, 2),
      scene = new THREE.Scene(),
      mesh = new THREE.Mesh(geometry);
    scene.add(mesh);
    const made: any[] = [],
      reports: any[] = [];
    const texture = (values: number[], width = 1, height = 1) => {
      const t = new THREE.DataTexture(new Uint8Array(values), width, height);
      t.flipY = false;
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.needsUpdate = true;
      made.push(t);
      return t;
    };
    const white = texture([255, 255, 255, 255]),
      baseBytes = [128, 192, 64, 128],
      lookupBytes = [64, 128, 192, 200];
    const base = texture(baseBytes),
      lookup = texture(lookupBytes);
    const norm = (v: number[]) => v.map((x) => x / 255),
      product = (...v: number[][]) => v.reduce((a, b) => a.map((x, i) => x * b[i]), [1, 1, 1, 1]);
    const tint = [0.5, 0.25, 1, 0.75];
    function attributes(vary = false) {
      const colors = [],
        lookups = [],
        uv = geometry.getAttribute('uv');
      for (let i = 0; i < 4; i++) {
        colors.push(...(vary ? [uv.getX(i), uv.getY(i), 0.4, 0.6] : tint));
        lookups.push(...(vary ? [uv.getX(i), uv.getY(i)] : [0.5, 0.5]));
      }
      geometry.setAttribute('particleTint', new THREE.Float32BufferAttribute(colors, 4));
      geometry.setAttribute('particleLookupUv', new THREE.Float32BufferAttribute(lookups, 2));
    }
    function probe(
      name: string,
      options: any,
      expected: (x: number, y: number) => number[],
      vary = false,
      adjust?: (m: any) => void
    ) {
      attributes(vary);
      const material = createParticleRibbonMaterial({ texture: base, lookup, ...options });
      material.blending = THREE.NoBlending;
      material.depthTest = false;
      adjust?.(material);
      mesh.material = material;
      renderer.render(scene, camera);
      const gl = renderer.getContext(),
        pixels = new Uint8Array(8 * 8 * 4);
      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const actual = [...pixels.slice((y * 8 + x) * 4, (y * 8 + x + 1) * 4)],
            want = expected(x, y).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
          reports.push({
            name,
            x,
            y,
            actual,
            expected: want,
            error: Math.max(...want.map((v, i) => Math.abs(v - actual[i]))),
          });
        }
      material.dispose();
    }
    probe('RGBA product', {}, () => product(norm(baseBytes), norm(lookupBytes), tint));
    const paletteBytes: number[] = [];
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 4; col++)
        paletteBytes.push(20 + col * 50, 10 + row * 13, 220 - col * 40, 0);
    const palette = {
      texture: texture(paletteBytes, 4, 16),
      sourceMix: [0.299, 0.587, 0.114, 0],
      row: 9.5 / 16,
    };
    const index = Math.min(3, Math.floor(((0.299 * 128 + 0.587 * 192 + 0.114 * 64) / 255) * 4));
    const pal = norm(paletteBytes.slice((9 * 4 + index) * 4, (9 * 4 + index + 1) * 4));
    pal[3] = 128 / 255;
    probe('untinted palette row9 ignores palette alpha', { palette }, () =>
      product(pal, norm(lookupBytes), tint)
    );
    probe('transparent remap preserves product', { remap: texture([50, 100, 200, 0]) }, () =>
      product(norm(baseBytes), norm(lookupBytes), tint)
    );
    probe('positive remap replaces RGB only', { remap: texture([50, 100, 200, 1]) }, () => [
      ...norm([50, 100, 200]),
      (((128 / 255) * 200) / 255) * 0.75,
    ]);
    const grid: number[] = [];
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) grid.push(40 + x * 50, 30 + y * 55, 180, 160 + x * 10 + y * 5);
    probe(
      'interpolated vertex tint and lookup',
      { texture: white, lookup: texture(grid, 4, 4) },
      (x, y) => {
        const u = (x + 0.5) / 8,
          v = (y + 0.5) / 8,
          i = (Math.floor(v * 4) * 4 + Math.floor(u * 4)) * 4;
        return product([u, v, 0.4, 0.6], norm(grid.slice(i, i + 4)));
      },
      true
    );
    probe(
      'source alpha threshold discards',
      {},
      () => [0, 0, 0, 0],
      false,
      (m) => (m.uniforms.alphaRef.value = 0.9)
    );
    probe(
      'source-alpha additive blend',
      { texture: base, lookup: white },
      () => {
        const lit = product(norm(baseBytes), tint);
        return [...lit.slice(0, 3).map((x) => x * lit[3]), lit[3] * lit[3]];
      },
      false,
      (m) => {
        m.blending = THREE.CustomBlending;
        m.blendEquation = THREE.AddEquation;
        m.blendSrc = THREE.SrcAlphaFactor;
        m.blendDst = THREE.OneFactor;
      }
    );
    // Orthographic depth of a fragment must move away from camera for positive push.
    attributes();
    const depthMaterial = createParticleRibbonMaterial({ texture: white, lookup: white });
    mesh.material = depthMaterial;
    depthMaterial.blending = THREE.NoBlending;
    // Check displacement via an occluding red plane, without reading implementation shader text.
    const blocker = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    blocker.position.z = -0.1;
    blocker.renderOrder = -1;
    scene.add(blocker);
    const sampleDepth = (push: number) => {
      depthMaterial.uniforms.depthPushPull.value = push;
      renderer.render(scene, camera);
      const p = new Uint8Array(4);
      const gl = renderer.getContext();
      gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [...p];
    };
    const depth = { zero: sampleDepth(0), positive: sampleDepth(0.5), negative: sampleDepth(-0.5) };
    const error = renderer.getContext().getError();
    blocker.geometry.dispose();
    blocker.material.dispose();
    depthMaterial.dispose();
    geometry.dispose();
    for (const t of made) t.dispose();
    renderer.dispose();
    return { reports, depth, error };
  });
  writeFileSync(info.outputPath('arithmetic.json'), JSON.stringify({ ...result, errors }, null, 2));
  expect(result.reports.every((p) => p.error <= 1)).toBe(true);
  expect(result.depth.zero[1]).toBeGreaterThan(0);
  expect(result.depth.positive).toEqual([255, 0, 0, 255]);
  expect(result.depth.negative).toEqual(result.depth.zero);
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
});
