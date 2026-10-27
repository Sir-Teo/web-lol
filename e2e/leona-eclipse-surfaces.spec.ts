import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page) {
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const u = w.units.find((u: any) => u.champion === 'leona');
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const v of w.units) v.ai = false;
    Object.assign(w.hero, { x: -300, y: 0, previous: { x: -300, y: 0 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 100000;
    g.view.zoom = 0.55;
    g.view.recenter(u);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    return { caster: u.id, target: target.id, start: w.tick };
  });
}
async function pixels(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      read = () => {
        const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bytes
        );
        return bytes;
      },
      models = [...v.leonaEclipseSurfaces.models.values()] as any[];
    const draw = () => {
      v.renderer.render(v.scene, v.camera);
      v.particleDistortion.render(v.renderer, v.camera);
      return read();
    };
    for (const m of models) m.visible = false;
    const baseline = draw(),
      profiles = [];
    for (const profile of new Set(models.map((m) => m.userData.profileIndex))) {
      for (const m of models) m.visible = m.userData.profileIndex === profile;
      const current = draw();
      let changed = 0;
      for (let i = 0; i < current.length; i += 4)
        if (
          current[i] !== baseline[i] ||
          current[i + 1] !== baseline[i + 1] ||
          current[i + 2] !== baseline[i + 2]
        )
          changed++;
      const group = models.filter((m) => m.userData.profileIndex === profile);
      profiles.push({
        profile,
        changed,
        count: group.length,
        name: group[0].name,
        role: group[0].userData.role,
        distortion: group[0].parent === v.particleDistortion.scene,
        sourceMesh: group[0].userData.sourceMesh,
        vertexBgra: !!group[0].material.defines.SOURCE_VERTEX_BGRA,
        uv: group[0].material.uniforms.sourceUvTransform?.value.toArray(),
        mult: group[0].material.uniforms.multiplierUvTransform?.value.toArray(),
        erosion: group[0].material.uniforms.erosionParameters?.value.toArray(),
        vertices: group[0].geometry.getAttribute('position').count,
        soft: !!group[0].material.uniforms.softDepth,
        unboundPalette: group[0].userData.unboundPalette,
      });
    }
    for (const m of models) m.visible = true;
    v.render(g.world, 1, v.previousElapsed);
    return { tick: g.world.tick, profiles, error: gl.getError() };
  });
}

test('all 26 enabled non-skin W families draw source pixels across successful and missed phases', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const ids = await open(page),
    stages = [];
  for (const age of [3, 30, 75, 120, 177, 181, 183, 187, 195, 210, 240, 255, 270, 300]) {
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: ids.start, age }
    );
    const result = await pixels(page);
    stages.push({ outcome: 'hit', age, ...result });
    if (age === 30 || age === 187)
      await page.screenshot({ path: info.outputPath(`hit-${age}.png`) });
  }
  const missStart = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(caster);
    w.step(400);
    w.unit(target).x = 3000;
    w.championState(caster).cooldowns.w = 0;
    u.mana = u.maxMana;
    w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
    w.step();
    return w.tick;
  }, ids);
  for (const age of [181, 183, 187, 195, 210, 240, 255]) {
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: missStart, age }
    );
    stages.push({ outcome: 'miss', age, ...(await pixels(page)) });
    if (age === 187) await page.screenshot({ path: info.outputPath('miss-187.png') });
  }
  writeFileSync(info.outputPath('families.json'), JSON.stringify({ stages, errors }, null, 2));
  const seen = new Map<number, number>();
  for (const stage of stages) {
    expect(stage.error).toBe(0);
    for (const p of stage.profiles)
      seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
  }
  expect([...seen.keys()].sort((a, b) => a - b)).toEqual([
    0, 1, 2, 3, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
    29,
  ]);
  expect([...seen].filter(([, changed]) => changed === 0)).toEqual([]);
  const byteColored = new Set([3, 8, 14, 18, 20, 24, 25, 26]);
  for (const stage of stages)
    for (const p of stage.profiles)
      expect(p.vertexBgra, 'source vertex color route ' + p.profile).toBe(
        byteColored.has(p.profile)
      );
  expect(errors).toEqual([]);
});

test('surface shader products, locked alpha, erosion, BGRA and separate soft controls match static native arithmetic', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await open(page);
  const result = await page.evaluate(async () => {
    const three = '/node_modules/three/build/three.module.js',
      materialPath = '/src/render/leona-eclipse-surface-material.ts';
    const THREE = await import(three),
      { createLeonaEclipseSurfaceMaterial } = await import(materialPath);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(1, 1, false);
    renderer.setClearColor(0, 0);
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 10);
    camera.position.z = 1;
    camera.lookAt(0, 0, 0);
    const scene = new THREE.Scene(),
      geometry = new THREE.PlaneGeometry(2, 2),
      mesh = new THREE.Mesh(geometry);
    scene.add(mesh);
    const made: any[] = [],
      texture = (values: number[], width = 1) => {
        const t = new THREE.DataTexture(new Uint8Array(values), width, 1);
        t.flipY = false;
        t.minFilter = t.magFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.needsUpdate = true;
        made.push(t);
        return t;
      },
      white = texture([255, 255, 255, 255]),
      base = texture([128, 192, 64, 128]),
      lookup = texture([64, 128, 192, 200]),
      mult = texture([200, 50, 100, 160]),
      split = texture([50, 100, 150, 25, 200, 50, 100, 230], 2),
      erosion = texture([100, 50, 200, 115]);
    const reports: any[] = [],
      norm = (x: number[]) => x.map((v) => v / 255),
      product = (...v: number[][]) => v.reduce((a, b) => a.map((x, i) => x * b[i]), [1, 1, 1, 1]),
      smooth = (x: number) => {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      },
      tint = [0.5, 0.25, 1, 0.75];
    function probe(name: string, options: any, expected: number[], adjust?: (m: any) => void) {
      const m = createLeonaEclipseSurfaceMaterial({
        kind: 'quad',
        texture: base,
        lookup,
        ...options,
      });
      m.blending = THREE.NoBlending;
      m.depthTest = false;
      m.uniforms.particleColor.value.fromArray(tint);
      adjust?.(m);
      mesh.material = m;
      renderer.render(scene, camera);
      const actual = new Uint8Array(4);
      renderer
        .getContext()
        .readPixels(
          0,
          0,
          1,
          1,
          renderer.getContext().RGBA,
          renderer.getContext().UNSIGNED_BYTE,
          actual
        );
      const bytes = expected.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
      reports.push({
        name,
        actual: [...actual],
        expected: bytes,
        error: Math.max(...bytes.map((v, i) => Math.abs(v - actual[i]))),
      });
      m.dispose();
    }
    const b = norm([128, 192, 64, 128]),
      l = norm([64, 128, 192, 200]),
      mu = norm([200, 50, 100, 160]);
    probe('quad product', {}, product(b, l, tint));
    probe('mesh product', { kind: 'mesh' }, product(b, l, tint));
    probe('quad multiplier retains lookup', { multiplier: mult }, product(b, l, tint, mu));
    probe(
      'mesh multiplier replaces lookup',
      { kind: 'mesh', multiplier: mult },
      product(b, tint, mu)
    );
    const translated = (m: any) =>
      m.uniforms.sourceUvTransform.value.set(0.5, 0, 0.6, 0, 1, 0, 0, 0, 1);
    probe(
      'translated RGB and alpha',
      { texture: split, lookup: white },
      product(norm([200, 50, 100, 230]), tint),
      translated
    );
    probe(
      'locked alpha omits translation',
      { texture: split, lookup: white, lockAlpha: true },
      product(norm([200, 50, 100, 25]), tint),
      translated
    );
    const erode = (drive: number, featherIn: number, featherOut: number, slice: number) => {
      const x = drive - 115 / 255;
      return (
        Math.max(0, Math.min(1, (x + slice) / featherIn)) - Math.max(0, Math.min(1, x / featherOut))
      );
    };
    for (const drive of [0, 0.45, 0.5, 0.7, 1.5]) {
      const expected = product(b, l, tint);
      expected[3] *= erode(drive, 0.2, 0.4, 0.1);
      probe(
        'erosion alpha only ' + drive,
        {
          erosion: {
            texture: erosion,
            mixer: [0, 0, 0, 1],
            featherIn: 0.2,
            featherOut: 0.4,
            sliceWidth: 0.1,
          },
        },
        expected,
        (m) => (m.uniforms.erosionParameters.value.x = drive)
      );
    }
    for (const alpha of [0, 255])
      probe(
        'conditional remap ' + alpha,
        { remap: texture([200, 20, 10, alpha]) },
        alpha ? [200 / 255, 20 / 255, 10 / 255, product(b, l, tint)[3]] : product(b, l, tint)
      );
    geometry.setAttribute(
      '_source_vertex_bgra',
      new THREE.BufferAttribute(
        new Float32Array(Array.from({ length: 4 }, () => [0.1, 0.2, 0.6, 0.8]).flat()),
        4
      )
    );
    probe(
      'native BGRA vertex swizzle',
      { vertexBgra: true },
      product(b, l, tint, [0.6, 0.2, 0.1, 0.8])
    );
    const multCoordinates = (m: any) => {
      m.uniforms.lookupUv.value.set(0.25, 0.5);
      m.uniforms.multiplierUvTransform.value.set(1, 0, 0.25, 0, 1, 0, 0, 0, 1);
    };
    probe(
      'quad multiplier shares lookup coordinates',
      { texture: white, multiplier: split },
      product(l, tint, norm([50, 100, 150, 25])),
      multCoordinates
    );
    probe(
      'mesh multiplier keeps its independent coordinates',
      { kind: 'mesh', texture: white, multiplier: split },
      product(tint, norm([200, 50, 100, 230])),
      multCoordinates
    );
    const paletteTexture = texture([200, 40, 100, 255, 10, 230, 20, 0], 2);
    probe(
      'palette clamps its source dot before scroll and preserves source alpha',
      {
        palette: { texture: paletteTexture, sourceMix: [0, 0, 0, 3], row: 0.5, scroll: [-0.75, 0] },
      },
      product(norm([200, 40, 100, 128]), l, tint)
    );
    const clampDepth = new THREE.DataTexture(
      new Float32Array([(1 / 1.5 - 10) / -9.9, 0, 0, 1]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    clampDepth.needsUpdate = true;
    made.push(clampDepth);
    probe(
      'mesh RGB clamp follows soft fading',
      {
        kind: 'mesh',
        texture: white,
        lookup: white,
        soft: { beginIn: 0, deltaIn: 100, beginOut: 0, deltaOut: 0 },
      },
      [0.75, 0.6, 0.4, 0.4],
      (m) => {
        m.uniforms.particleColor.value.set(1.5, 1.2, 0.8, 0.8);
        m.uniforms.softDepth.value = clampDepth;
        m.uniforms.depthConversion.value.set(10, -9.9);
      }
    );
    for (const gap of [-0.1, 0, 0.25, 0.5, 1, 2.25, 2.5])
      for (const control of [
        [0, 1, 0, 1],
        [1, 0, 0, 1],
        [0.2, 0.6, 0.1, 0.9],
      ]) {
        const near = 0.1,
          far = 10,
          a = 1 / near,
          bb = 1 / far - 1 / near,
          depth = (1 / (1 + gap) - a) / bb;
        const depthTexture = new THREE.DataTexture(
          new Float32Array([depth, 0, 0, 1]),
          1,
          1,
          THREE.RGBAFormat,
          THREE.FloatType
        );
        depthTexture.needsUpdate = true;
        depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
        made.push(depthTexture);
        const amount = smooth(gap) - smooth((gap - 2) / 0.5),
          expected = product(b, l, tint).map(
            (v, i) =>
              v * (i === 3 ? control[2] + amount * control[3] : control[0] + amount * control[1])
          );
        probe(
          `soft ${gap} ${control}`,
          { soft: { beginIn: 0, deltaIn: 100, beginOut: 200, deltaOut: 50, control } },
          expected,
          (m) => {
            m.uniforms.softDepth.value = depthTexture;
            m.uniforms.depthConversion.value.set(a, bb);
          }
        );
      }
    const error = renderer.getContext().getError();
    mesh.removeFromParent();
    geometry.dispose();
    made.forEach((t) => t.dispose());
    renderer.dispose();
    return { reports, error };
  });
  writeFileSync(info.outputPath('arithmetic.json'), JSON.stringify(result, null, 2));
  expect(result.reports.length).toBe(39);
  expect(result.reports.filter((p) => p.error > 1)).toEqual([]);
  expect(result.error).toBe(0);
});

async function surfaceState(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bytes
    );
    const partitionImages: [string, Uint8Array][] = [];
    const surfaces = [...v.leonaEclipseSurfaces.models.values()] as any[],
      skins = [...v.leonaEclipseSkins.models.values()].map((m: any) => m.root),
      sunlight = [...v.sunlight.models.values()] as any[];
    const drawPartition = (name: string) => {
      v.renderer.render(v.scene, v.camera);
      v.particleDistortion.render(v.renderer, v.camera);
      const pixels = new Uint8Array(bytes.length);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      partitionImages.push([name, pixels]);
    };
    for (const m of [...surfaces, ...skins, ...sunlight]) m.visible = false;
    drawPartition('world');
    const worldPng = v.renderer.domElement.toDataURL('image/png');
    const worldOrder = v.renderer.renderLists.get(v.scene, 0).opaque.map((item: any) => {
      const m = item.object,
        g = m.geometry,
        p = g.getAttribute('position'),
        a = p.array;
      let hash = 2166136261;
      for (const n of new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) {
        hash ^= n;
        hash = Math.imul(hash, 16777619);
      }
      return {
        name: m.name,
        geometry: hash >>> 0,
        position: m.matrixWorld.toArray(),
        material: {
          type: item.material.type,
          color: item.material.color?.getHex(),
          map: item.material.map?.image?.src,
          alpha: item.material.alphaTest,
          depthWrite: item.material.depthWrite,
        },
        z: item.z,
        renderOrder: item.renderOrder,
      };
    });
    for (const m of surfaces) m.visible = true;
    drawPartition('surfaces');
    for (const profile of new Set(surfaces.map((m) => m.userData.profileIndex))) {
      for (const m of surfaces) m.visible = m.userData.profileIndex === profile;
      drawPartition('profile:' + profile);
    }
    for (const m of [...surfaces, ...skins, ...sunlight]) m.visible = true;
    v.render(g.world, 1, v.previousElapsed);
    const partitionHashes = Object.fromEntries(
      await Promise.all(
        partitionImages.map(async ([name, pixels]) => [
          name,
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(','),
        ])
      )
    );
    const canvases = new Set<HTMLCanvasElement>([v.fogCanvas]);
    for (const item of v.renderer.renderLists.get(v.scene, 0).opaque) {
      const image = item.material.map?.image;
      if (image instanceof HTMLCanvasElement) canvases.add(image);
    }
    const canvasHashes = await Promise.all(
      [...canvases].map(async (canvas) => ({
        width: canvas.width,
        height: canvas.height,
        hash: [
          ...new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
            )
          ),
        ].join(','),
      }))
    );
    return {
      frame: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].join(','),
      partitionHashes,
      worldPng,
      worldOrder,
      canvasHashes,
      viewState: {
        hovered: v.hovered,
        rangeVisible: v.rangeVisible,
        selection: v.selection.visible,
        hover: v.hover.visible,
        actors: [...v.models].map(([id, m]: any) => {
          const bones: any[] = [];
          m.root.traverse((o: any) => {
            if (o.isBone) bones.push([o.name, ...o.matrixWorld.toArray()]);
          });
          return {
            id,
            position: m.root.position.toArray(),
            rotation: m.root.quaternion.toArray(),
            bones,
          };
        }),
      },
      camera: {
        position: v.camera.position.toArray(),
        quaternion: v.camera.quaternion.toArray(),
        projection: v.camera.projectionMatrix.toArray(),
      },
      snapshot: g.world.snapshot(),
      error: gl.getError(),
      models: [...v.leonaEclipseSurfaces.models].map(([key, m]: any) => ({
        key,
        profile: m.userData.profileIndex,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        packetColor: Array.from(m.geometry.getAttribute('_source_vertex_bgra')?.array ?? []),
        tint: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        uv: m.material.uniforms.sourceUvTransform?.value.toArray(),
        mult: m.material.uniforms.multiplierUvTransform?.value.toArray(),
        erosion: m.material.uniforms.erosionParameters?.value.toArray(),
        power: m.material.uniforms.distortionPower?.value,
        bounds: m.geometry.boundingSphere
          ? {
              center: m.geometry.boundingSphere.center.toArray(),
              radius: m.geometry.boundingSphere.radius,
            }
          : null,
        soft: m.material.uniforms.softParameters?.value.toArray(),
        control: m.material.uniforms.softControl?.value.toArray(),
        vertices: Array.from(m.geometry.getAttribute('position').array),
        indices: m.geometry.index
          ? Array.from(m.geometry.index.array).slice(0, m.geometry.drawRange.count)
          : [],
      })),
    };
  });
}

test('live burst transforms and the framebuffer restore through real Save/reload and graphics recovery', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(187);
  });
  const before = await surfaceState(page);
  expect(before.models.some((m) => m.profile === 18)).toBe(true);
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.zoom = 0.55;
    g.view.recenter(g.world.unit(caster));
    g.view.render(g.world, 1, g.view.previousElapsed);
  }, ids);
  const restored = await surfaceState(page);
  for (const [name, state] of [
    ['before', before],
    ['restored', restored],
  ] as const)
    writeFileSync(
      info.outputPath('world-' + name + '.png'),
      Buffer.from(state.worldPng.split(',')[1], 'base64')
    );
  writeFileSync(
    info.outputPath('restore-before-assert.json'),
    JSON.stringify({ before, restored }, null, 2)
  );
  await page.screenshot({ path: info.outputPath('restored-before-assert.png') });
  // Opaque material IDs/first-pose sort bounds are diagnostic implementation
  // details, not saved state. Keep exact pixels, source data, view and canvases.
  const comparable = (s: typeof before) => ({
    frame: s.frame,
    partitionHashes: s.partitionHashes,
    worldPng: s.worldPng,
    canvasHashes: s.canvasHashes,
    viewState: s.viewState,
    camera: s.camera,
    snapshot: s.snapshot,
    error: s.error,
    models: s.models,
  });
  expect(comparable(restored)).toEqual(comparable(before));
  await page.evaluate(async () => {
    const r = (window as any).__GAME__.view.renderer;
    const lost = new Promise((resolve) =>
      r.domElement.addEventListener('webglcontextlost', resolve, { once: true })
    );
    r.forceContextLoss();
    await lost;
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await page.waitForFunction(() => (window as any).__GAME__.hud.graphicsState === null);
  const recovered = await surfaceState(page);
  expect(comparable(recovered)).toEqual(comparable(before));
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('restore-recovery.json'),
    JSON.stringify({ before, restored, recovered, errors }, null, 2)
  );
});

test('source and contact audiences suppress hidden births while later visible rays can appear', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = await open(page);
  const result = await page.evaluate(({ caster, target, start }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      visible = w.visible;
    w.visible = (u: any, team: any) => (u.id === caster ? false : visible.call(w, u, team));
    w.step(2);
    w.visible = visible;
    w.step(25);
    v.render(w, 1, v.previousElapsed);
    const armed = [
      ...new Set(
        [...v.leonaEclipseSurfaces.models.values()].map((m: any) => m.userData.profileIndex)
      ),
    ];
    const first = w.championState(caster).leonaWVisuals[0].frames[1].audience;
    w.step(start + 179 - w.tick);
    w.visible = (u: any, team: any) =>
      [caster, target].includes(u.id) ? false : visible.call(w, u, team);
    w.step(2);
    w.visible = visible;
    w.step(15);
    v.render(w, 1, v.previousElapsed);
    const r = w.championState(caster).leonaWVisuals[0],
      burst = [...v.leonaEclipseSurfaces.models.values()].map((m: any) => ({
        profile: m.userData.profileIndex,
        role: m.userData.role,
      }));
    const saved = w.snapshot();
    return {
      first,
      armed,
      creation: r.detonation.audience,
      contact: r.detonation.contacts[0].audience,
      burst,
      restores: w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  }, ids);
  expect(result.first).toEqual([]);
  expect(result.armed).toEqual([3]);
  expect(result.creation).toEqual([]);
  expect(result.contact).toEqual([]);
  expect(result.burst.map((p) => p.profile)).not.toContain(7);
  expect(result.burst.every((p) => p.profile === 8)).toBe(true);
  expect(result.burst.length).toBeGreaterThan(0);
  expect(result.restores).toBe(true);
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});

test('lethal endpoints and delayed winning-frame births drain owned resources without changing the save', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const result = await page.evaluate(({ caster, target, start }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(start + 180 - w.tick);
    w.damage(w.hero, w.unit(target), 1e9, 'true');
    w.damage(w.unit(target), w.unit(caster), 1e9, 'true');
    const gate = w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, gate, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1200, y: 1000 });
    w.damage(w.hero, nexus, 1e9, 'true');
    const saved = w.snapshot();
    v.render(w, 1, v.previousElapsed);
    v.render(w, 1, v.previousElapsed + 0.15);
    const models = [...v.leonaEclipseSurfaces.models.values()] as any[],
      materials = new Map<any, number>(),
      owned = new Map<any, number>(),
      borrowed = new Set<any>();
    let sharedDisposed = 0;
    for (const m of models) {
      materials.set(m.material, 0);
      m.material.addEventListener('dispose', () =>
        materials.set(m.material, materials.get(m.material)! + 1)
      );
      if (m.userData.ownedGeometry) {
        owned.set(m.geometry, 0);
        m.geometry.addEventListener('dispose', () =>
          owned.set(m.geometry, owned.get(m.geometry)! + 1)
        );
      } else borrowed.add(m.geometry);
      for (const u of Object.values(m.material.uniforms) as any[])
        if (u.value?.isTexture && !u.value.isDepthTexture && !u.value.isFramebufferTexture)
          borrowed.add(u.value);
    }
    borrowed.forEach((x) => x.addEventListener('dispose', () => sharedDisposed++));
    const roles = [...new Set(models.map((m) => m.userData.role))],
      r = w.championState(caster).leonaWVisuals[0];
    const detached = { source: r.detachedTick, target: r.detonation.contacts[0].detachedTick };
    v.render(w, 1, v.previousElapsed + 10);
    return {
      roles,
      detached,
      winner: w.winner,
      remaining: v.leonaEclipseSurfaces.models.size,
      materials: [...materials.values()],
      owned: [...owned.values()],
      sharedDisposed,
      depthRetired: !v.leonaEclipseSurfaces.renderer.depth.target,
      distortionRetired: !v.particleDistortion.frame,
      sameSave: w.snapshot() === saved,
      restores: w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  }, ids);
  expect(result.winner).toBe('blue');
  expect(result.roles).toContain('cast-hit');
  expect(result.roles).toContain('target');
  expect(result.detached.source).not.toBeNull();
  expect(result.detached.target).not.toBeNull();
  expect(result.remaining).toBe(0);
  expect(result.materials.length).toBeGreaterThan(0);
  expect(result.materials.every((n) => n === 1)).toBe(true);
  expect(result.owned.length).toBeGreaterThan(0);
  expect(result.owned.every((n) => n >= 1)).toBe(true);
  expect(result.sharedDisposed).toBe(0);
  expect(result.depthRetired).toBe(true);
  expect(result.distortionRetired).toBe(true);
  expect(result.sameSave).toBe(true);
  expect(result.restores).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('terminal-resources.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('early recasts and repeated complete hit/miss bursts keep every surface resource bounded', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const result = await page.evaluate(({ caster, target, start }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      s = w.championState(caster);
    w.step(30);
    v.render(w, 1, v.previousElapsed);
    s.cooldowns.w = 0;
    u.mana = u.maxMana;
    w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
    w.step(10);
    v.render(w, 1, v.previousElapsed);
    const recast = {
      records: s.leonaWVisuals.map((r: any) => ({
        start: r.startTick,
        reason: r.endReason,
        detonation: r.detonation,
      })),
      renderedStarts: [
        ...new Set(
          [...v.leonaEclipseSurfaces.models.values()].map((m: any) => m.userData.castTick)
        ),
      ],
    };
    const saved = w.snapshot(),
      restores = w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved;
    w.step(800);
    v.render(w, 1, v.previousElapsed);
    const rounds = [];
    for (let i = 0; i < 6; i++) {
      const t = w.unit(target);
      t.x = i % 2 ? 3000 : 150;
      t.y = 0;
      t.previous = { x: t.x, y: t.y };
      s.cooldowns.w = 0;
      u.mana = u.maxMana;
      w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
      w.step(31);
      v.render(w, 1, v.previousElapsed);
      const armed = v.leonaEclipseSurfaces.models.size;
      w.step(157);
      v.render(w, 1, v.previousElapsed);
      const profiles = [
          ...new Set(
            [...v.leonaEclipseSurfaces.models.values()].map((m: any) => m.userData.profileIndex)
          ),
        ],
        roles = [
          ...new Set([...v.leonaEclipseSurfaces.models.values()].map((m: any) => m.userData.role)),
        ];
      w.step(620);
      v.render(w, 1, v.previousElapsed);
      rounds.push({
        outcome: i % 2 ? 'miss' : 'hit',
        armed,
        profiles,
        roles,
        remaining: v.leonaEclipseSurfaces.models.size,
        skins: v.leonaEclipseSkins.models.size,
        depth: !!v.leonaEclipseSurfaces.renderer.depth.target,
        distortion: !!v.particleDistortion.frame,
        memory: { ...v.renderer.info.memory },
      });
    }
    return {
      recast,
      restores,
      rounds,
      firstStart: start,
      error: v.renderer.getContext().getError(),
    };
  }, ids);
  expect(result.recast.records).toHaveLength(2);
  expect(result.recast.records[0].reason).toBe('recast');
  expect(result.recast.records[0].detonation).toBeNull();
  expect(result.recast.renderedStarts).toContain(result.firstStart);
  expect(result.recast.renderedStarts.length).toBe(2);
  expect(result.restores).toBe(true);
  for (const round of result.rounds) {
    expect(round.armed).toBeGreaterThan(0);
    expect(round.remaining).toBe(0);
    expect(round.skins).toBe(0);
    expect(round.depth).toBe(false);
    expect(round.distortion).toBe(false);
    expect(round.roles).toContain(round.outcome === 'hit' ? 'cast-hit' : 'cast-miss');
    if (round.outcome === 'hit') expect(round.roles).toContain('target');
  }
  // Both outcomes have warmed their shared source assets by the second round.
  expect(
    result.rounds
      .slice(2)
      .every((r) => JSON.stringify(r.memory) === JSON.stringify(result.rounds[1].memory))
  ).toBe(true);
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('full-cycle-storage.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});
