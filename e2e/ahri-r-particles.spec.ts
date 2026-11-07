import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('keyboard R loads its exact spell closure and restores flight, contact and flipbook packets', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    glowRequests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-r-')) requests.push(new URL(r.url()).pathname);
    if (r.url().includes('/assets/effects/ahri-q-cast-b4f44f95abaa3e8a.png'))
      glowRequests.push(new URL(r.url()).pathname);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriRParticles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 300, y: -225, previous: { x: 300, y: -225 }, ai: false });
    const target = w.spawn('champion', 'red', { x: 600, y: -450 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.gainExperience(1e6);
    w.learnSpell('r');
    v.zoom = 0.6;
    v.recenter({ x: 420, y: -315 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriRVisuals.length) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    g.setPaused(false);
    return v.screenPoint({ x: 600, y: -450 });
  });
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('r');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriRVisuals.length))
    .toBe(1);
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const seen = new Set<number>();
    const digest = (attribute: any, count: number) => {
      const bytes = new Uint8Array(
        attribute.array.buffer,
        attribute.array.byteOffset,
        count * attribute.itemSize * 4
      );
      let hash = 2166136261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return (hash >>> 0).toString(16);
    };
    const capture = () => ({
      surfaces: [...v.ahriRParticles.surfaces.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          return {
            key,
            profile: m.userData.profileIndex,
            position: m.position.toArray(),
            quaternion: m.quaternion.toArray(),
            scale: m.scale.toArray(),
            color: m.material.uniforms.particleColor.value.toArray(),
            uv: m.material.uniforms.sourceUvTransform.value.toArray(),
            mips: m.material.uniforms.sourceTexture.value.mipmaps.length,
            colors: m.geometry.getAttribute('_source_vertex_bgra')?.count ?? 0,
            normals: !!m.geometry.getAttribute('normal'),
            soft: !!m.material.uniforms.softDepth,
            unboundPalette: m.userData.unboundPalette,
          };
        }),
      ribbons: [...v.ahriRParticles.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          const count = m.geometry.drawRange.count;
          return {
            key,
            profile: m.userData.profileIndex,
            count,
            position: digest(m.geometry.getAttribute('position'), count),
            cell: digest(m.geometry.getAttribute('sourceCell'), count),
            multCell: digest(m.geometry.getAttribute('sourceMultCell'), count),
            mult: digest(m.geometry.getAttribute('sourceMultUv'), count),
            color: digest(m.geometry.getAttribute('sourceTint'), count),
            soft: !!m.material.uniforms.softDepth,
            cellSize: m.material.uniforms.sourceCellSize.value.toArray(),
            palette: m.material.userData.paletteBinding
              ? {
                  mix: m.material.uniforms.paletteSourceMix.value.toArray(),
                  row: m.material.uniforms.paletteRow.value,
                  filter: m.material.uniforms.paletteTexture.value.minFilter,
                  nativeConstructorVerified:
                    m.material.userData.paletteBinding.nativeConstructorVerified,
                }
              : null,
          };
        }),
    });
    const record = w.ahriRVisuals[0],
      draws = [];
    for (const offset of [2, 5, 8, 11]) {
      w.step(record.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(capture());
    }
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    g.__rCapture = capture;
    g.__rSeen = seen;
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      placeholder: v.spiritBoltModels.size,
      deferred: v.ahriRParticles.deferredProfiles.map((p: any) => ({
        index: p.profileIndex,
        reason: p.reason,
      })),
    };
  });
  expect(flight.unchanged).toBe(true);
  expect(flight.restored).toEqual(flight.before);
  expect(flight.placeholder).toBe(0);
  expect(flight.deferred).toHaveLength(24);
  expect(flight.before.ribbons.length).toBeGreaterThan(0);
  expect(flight.before.surfaces.some((m: any) => m.colors === 209 && !m.normals)).toBe(true);
  expect(flight.before.ribbons.some((m: any) => m.cellSize[0] === 0.5)).toBe(true);
  expect(flight.before.ribbons.some((m: any) => m.soft)).toBe(true);
  expect(flight.draws.flatMap((draw: any) => draw.ribbons).filter((m: any) => m.palette)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        profile: 30,
        palette: {
          mix: [0.9499961733818054, 0, 0, 0],
          row: 0.5,
          filter: 1006,
          nativeConstructorVerified: false,
        },
      }),
    ])
  );
  await page.screenshot({ path: info.outputPath('ahri-r-flight.png') });
  const hit = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      record = w.ahriRVisuals[0],
      draws = [];
    for (const offset of [15, 18, 22, 26, 32]) {
      w.step(record.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(g.__rCapture());
    }
    const saved = w.snapshot(),
      before = g.__rCapture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = g.__rCapture();
    v.render(w, 1, v.previousElapsed);
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      seen: [...g.__rSeen].sort((a: any, b: any) => a - b),
      hit: record.bursts[0].bolts[0].hit,
      attachments: v.ahriRParticles.attachmentFallbacks,
    };
  });
  expect(hit.unchanged).toBe(true);
  expect(hit.restored).toEqual(hit.before);
  expect(hit.seen).toHaveLength(21);
  expect(hit.hit.targetRig).toBe('lux-base');
  expect(hit.attachments).toEqual([]);
  expect(hit.draws.some((draw: any) => draw.surfaces.some((m: any) => m.unboundPalette))).toBe(
    true
  );
  await page.screenshot({ path: info.outputPath('ahri-r-contact.png') });
  const eyes = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const record = w.ahriRVisuals[0];
    w.step(record.startTick + 95 - w.tick);
    w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x, y: w.hero.y + 1500 } });
    w.step(30);
    v.zoom = 0.12;
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    const capture = () =>
      [...v.ahriRParticles.buffSurfaces.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, model]: any) => ({
          key,
          profile: model.userData.profileIndex,
          position: model.position.toArray(),
          quaternion: model.quaternion.toArray(),
          scale: model.scale.toArray(),
          color: model.material.uniforms.particleColor.value.toArray(),
          uv: model.material.uniforms.sourceUvTransform.value.toArray(),
          mips: model.material.uniforms.sourceTexture.value.mipmaps.length,
          multiplierMips: model.material.uniforms.multiplierTexture?.value.mipmaps.length ?? null,
          erosionMips: model.material.uniforms.erosionTexture?.value.mipmaps.length ?? null,
          softParameters: model.material.uniforms.softParameters?.value.toArray() ?? null,
          softControl: model.material.uniforms.softControl?.value.toArray() ?? null,
          softDepthReady: !!model.material.uniforms.softDepth?.value,
          softSize: model.material.uniforms.softSize?.value.toArray() ?? null,
          geometryVertices: model.geometry.getAttribute('position').count,
          geometryIndices: model.geometry.getIndex()?.count ?? null,
          packedColors: model.geometry.getAttribute('_source_vertex_bgra')?.count ?? null,
          packedNormalized: model.geometry.getAttribute('_source_vertex_bgra')?.normalized ?? false,
          geometryScale: model.geometry.userData.sourceCentimetresScaleApplied ?? null,
          ownsGeometry: !!model.userData.ownedGeometry,
        }));
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    return {
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      attachments: v.ahriRParticles.attachmentFallbacks,
      nativeMeshGeometries: new Set(
        [...v.ahriRParticles.buffSurfaces.models.values()]
          .filter((model: any) => [51, 52, 54].includes(model.userData.profileIndex))
          .map((model: any) => model.geometry)
      ).size,
    };
  });
  expect(eyes.unchanged).toBe(true);
  expect(eyes.restored).toEqual(eyes.before);
  expect(eyes.before.length).toBeGreaterThanOrEqual(4);
  expect([...new Set(eyes.before.map((model: any) => model.profile))].sort()).toEqual([
    45, 46, 49, 50, 51, 52, 53, 54,
  ]);
  expect(eyes.before.every((model: any) => model.mips > 1)).toBe(true);
  expect(eyes.before.some((model: any) => model.key.includes(':buff:L_Eye:'))).toBe(true);
  expect(eyes.before.some((model: any) => model.key.includes(':buff:R_Eye:'))).toBe(true);
  expect(eyes.before.find((model: any) => model.profile === 50)).toMatchObject({
    key: expect.stringContaining(':buff:C_Buffbone_Glb_Layout_Loc:'),
    mips: 9,
  });
  const continuousGlows = eyes.before.filter((model: any) => model.profile === 53);
  expect(continuousGlows.length).toBeGreaterThan(0);
  for (const model of continuousGlows)
    expect(model).toMatchObject({
      key: expect.stringContaining(':buff:C_Buffbone_Glb_Layout_Loc:'),
      mips: 9,
      multiplierMips: 9,
      erosionMips: 7,
      softParameters: [0, 0, 100 / 30, 0],
      softControl: [1, 0, 0, 1],
      softDepthReady: true,
      softSize: [1440, 900],
    });
  expect(eyes.nativeMeshGeometries).toBe(1);
  for (const profile of [51, 52, 54]) {
    const models = eyes.before.filter((model: any) => model.profile === profile);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models)
      expect(model).toMatchObject({
        key: expect.stringContaining(':buff:C_Buffbone_Glb_Layout_Loc:'),
        mips: 4,
        erosionMips: 8,
        geometryVertices: 230,
        geometryIndices: 1140,
        packedColors: 230,
        packedNormalized: true,
        geometryScale: 0.01,
        ownsGeometry: false,
        softDepthReady: true,
        softParameters: [0, 0, 100 / 30, 0],
      });
  }
  expect(eyes.attachments).toEqual([]);
  expect(glowRequests).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('ahri-r-eye-glows.png') });
  const pixelProofs = [];
  for (const profile of [49, 50, 51, 52, 53, 54]) {
    const pixels = await page.evaluate((profile) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      const saved = w.snapshot();
      const meshes = [...v.ahriRParticles.buffSurfaces.models.values()].filter(
        (model: any) => model.userData.profileIndex === profile
      ) as any[];
      if (!meshes.length) throw Error('Missing selected buff profile ' + profile);
      const canvas = document.createElement('canvas');
      canvas.width = v.renderer.domElement.width;
      canvas.height = v.renderer.domElement.height;
      const context = canvas.getContext('2d')!;
      const depth = v.ahriRParticles.surfaces.depth,
        original = depth.capture;
      let depthCaptures = 0;
      depth.capture = (...args: any[]) => {
        depthCaptures++;
        return original.apply(depth, args);
      };
      const capture = () => {
        v.render(w, 1, v.previousElapsed);
        context.drawImage(v.renderer.domElement, 0, 0);
        return {
          png: canvas.toDataURL('image/png'),
          pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
        };
      };
      try {
        meshes.forEach((mesh) => (mesh.visible = false));
        const off = capture();
        meshes.forEach((mesh) => (mesh.visible = true));
        const on = capture();
        let changedPixels = 0;
        for (let i = 0; i < on.pixels.length; i += 4)
          if (
            Math.abs(on.pixels[i] - off.pixels[i]) +
              Math.abs(on.pixels[i + 1] - off.pixels[i + 1]) +
              Math.abs(on.pixels[i + 2] - off.pixels[i + 2]) >
            3
          )
            changedPixels++;
        return {
          off: off.png,
          on: on.png,
          changedPixels,
          depthCaptures,
          unchanged: w.snapshot() === saved,
        };
      } finally {
        depth.capture = original;
        meshes.forEach((mesh) => (mesh.visible = true));
      }
    }, profile);
    for (const state of ['off', 'on'] as const)
      await writeFile(
        info.outputPath(`ahri-r-buff-${profile}-${state}.png`),
        Buffer.from(pixels[state].split(',')[1], 'base64')
      );
    expect(pixels.changedPixels).toBeGreaterThan(0);
    expect(pixels.unchanged).toBe(true);
    expect(pixels.depthCaptures).toBe(2);
    pixelProofs.push({
      profile,
      changedPixels: pixels.changedPixels,
      depthCaptures: pixels.depthCaptures,
      unchanged: pixels.unchanged,
      scope:
        'Complete gameplay renderer, profile hidden/enabled, one shared R depth capture per render, no world step',
    });
  }
  const layoutPixelProof = pixelProofs.find((proof) => proof.profile === 50)!;
  const layoutBasePixelProof = pixelProofs.find((proof) => proof.profile === 49)!;
  const continuousGlowPixelProof = pixelProofs.find((proof) => proof.profile === 53)!;
  const meshPixelProofs = pixelProofs.filter((proof) => [51, 52, 54].includes(proof.profile));
  const eyeTrails = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      record = w.ahriRVisuals[0];
    v.zoom = 0.22;
    const digest = (attribute: any, count: number) => {
      let hash = 2166136261;
      const bytes = new Uint8Array(
        attribute.array.buffer,
        attribute.array.byteOffset,
        count * attribute.itemSize * 4
      );
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return (hash >>> 0).toString(16);
    };
    const capture = () =>
      [...v.ahriRParticles.buffModels]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, model]: any) => {
          const count = model.geometry.drawRange.count;
          return {
            key,
            profile: model.userData.profileIndex,
            count,
            attributes: Object.fromEntries(
              [
                'position',
                'uv',
                'sourceTint',
                'sourceLookup',
                'sourceErosion',
                'sourceMultUv',
                'sourceCell',
                'sourceMultCell',
              ].map((name) => [name, digest(model.geometry.getAttribute(name), count)])
            ),
            mode: model.userData.trailMode,
            ground: model.userData.sourceGroundLayer,
            nativeConstructorVerified: model.userData.nativeConstructorVerified,
            mips: model.material.uniforms.sourceTexture.value.mipmaps.length,
            multiplierMips: model.material.uniforms.multiplierTexture?.value.mipmaps.length ?? null,
            erosionMips: model.material.uniforms.erosionTexture?.value.mipmaps.length ?? null,
            softParameters: model.material.uniforms.softParameters?.value.toArray() ?? null,
            softControl: model.material.uniforms.softControl?.value.toArray() ?? null,
            softDepthReady: !!model.material.uniforms.softDepth?.value,
            softSize: model.material.uniforms.softSize?.value.toArray() ?? null,
            geometryVertices: model.geometry.getAttribute('position').count,
            geometryIndices: model.geometry.getIndex()?.count ?? null,
            packedColors: model.geometry.getAttribute('_source_vertex_bgra')?.count ?? null,
            packedNormalized:
              model.geometry.getAttribute('_source_vertex_bgra')?.normalized ?? false,
            geometryScale: model.geometry.userData.sourceCentimetresScaleApplied ?? null,
            ownsGeometry: !!model.userData.ownedGeometry,
          };
        });
    const frames = [];
    for (const offset of [165, 183, 210]) {
      w.step(record.startTick + offset - w.tick);
      v.recenter(w.hero);
      v.render(w, 1, v.previousElapsed);
      frames.push({ offset, models: capture() });
    }
    const before = capture(),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    return {
      frames,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      attachments: v.ahriRParticles.attachmentFallbacks,
    };
  });
  expect(eyeTrails.unchanged).toBe(true);
  expect(eyeTrails.restored).toEqual(eyeTrails.before);
  expect(
    [
      ...new Set(
        eyeTrails.frames.flatMap((frame: any) => frame.models.map((model: any) => model.profile))
      ),
    ].sort()
  ).toEqual([47, 48]);
  expect(eyeTrails.frames[0].models.some((model: any) => model.profile === 48)).toBe(true);
  expect(eyeTrails.frames[2].models.some((model: any) => model.profile === 48)).toBe(false);
  expect(
    eyeTrails.frames
      .flatMap((frame: any) => frame.models)
      .every(
        (model: any) =>
          model.count > 0 &&
          model.mips === 10 &&
          model.mode === 'local-default-ribbon' &&
          model.ground &&
          model.nativeConstructorVerified === false
      )
  ).toBe(true);
  expect(eyeTrails.attachments).toEqual([]);
  await page.screenshot({ path: info.outputPath('ahri-r-eye-trails.png') });
  const front = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      record = w.ahriRVisuals[0];
    w.step(record.startTick + 315 - w.tick);
    v.zoom = 0.16;
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      model = v.models.get(w.hero.id).root;
    const left = model.getObjectByName('L_Eye').getWorldPosition(v.camera.position.clone());
    const right = model.getObjectByName('R_Eye').getWorldPosition(v.camera.position.clone());
    const center = left.clone().add(right).multiplyScalar(0.5);
    const forward = right.clone().sub(left);
    forward.y = 0;
    forward.cross({ x: 0, y: 1, z: 0 }).normalize();
    const camera = v.camera.clone();
    camera.position.copy(center).addScaledVector(forward, 1.8);
    camera.position.y += 1.3;
    camera.lookAt(center.clone().add({ x: 0, y: -0.25, z: 0 }));
    camera.updateMatrixWorld(true);
    v.ahriRParticles.update(w, 1, camera);
    v.ahriRParticles.prepareDepth(v.renderer, camera);
    const meshes = [...v.ahriRParticles.buffModels.values()] as any[];
    const canvas = document.createElement('canvas');
    canvas.width = v.renderer.domElement.width;
    canvas.height = v.renderer.domElement.height;
    const context = canvas.getContext('2d')!;
    const capture = () => {
      v.renderer.render(v.scene, camera);
      context.drawImage(v.renderer.domElement, 0, 0);
      return {
        png: canvas.toDataURL('image/png'),
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      };
    };
    meshes.forEach((mesh) => (mesh.visible = false));
    const baseline = capture();
    const streams = [];
    for (const profile of [47, 48]) {
      meshes.forEach((mesh) => (mesh.visible = mesh.userData.profileIndex === profile));
      const enabled = capture();
      let changed = 0;
      for (let i = 0; i < enabled.pixels.length; i += 4)
        if (
          Math.abs(enabled.pixels[i] - baseline.pixels[i]) +
            Math.abs(enabled.pixels[i + 1] - baseline.pixels[i + 1]) +
            Math.abs(enabled.pixels[i + 2] - baseline.pixels[i + 2]) >
          3
        )
          changed++;
      streams.push({ profile, changedPixels: changed, png: enabled.png });
    }
    meshes.forEach((mesh) => (mesh.visible = true));
    const combined = capture();
    v.render(w, 1, v.previousElapsed);
    return {
      profiles: [
        ...new Set(
          [...v.ahriRParticles.buffModels.values()].map((model: any) => model.userData.profileIndex)
        ),
      ].sort(),
      attachments: v.ahriRParticles.attachmentFallbacks,
      unchanged: w.snapshot() === saved,
      baseline: baseline.png,
      combined: combined.png,
      streams,
    };
  });
  expect(front.profiles).toEqual([47, 48]);
  expect(front.attachments).toEqual([]);
  expect(front.unchanged).toBe(true);
  await writeFile(
    info.outputPath('ahri-r-eye-trails-off.png'),
    Buffer.from(front.baseline.split(',')[1], 'base64')
  );
  await writeFile(
    info.outputPath('ahri-r-eye-trails-on.png'),
    Buffer.from(front.combined.split(',')[1], 'base64')
  );
  for (const stream of front.streams) {
    await writeFile(
      info.outputPath(`ahri-r-eye-trail-${stream.profile}.png`),
      Buffer.from(stream.png.split(',')[1], 'base64')
    );
    expect(stream.changedPixels).toBeGreaterThan(0);
  }
  const frontProof = {
    profiles: front.profiles,
    attachments: front.attachments,
    unchanged: front.unchanged,
    streams: front.streams.map(({ profile, changedPixels }) => ({ profile, changedPixels })),
    scope:
      'Diagnostic eye-facing camera; each ribbon profile compared against the same scene with both ribbon profiles hidden.',
  };
  const layout = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    // Stop through the ordinary order path before the fixture's decorative rocks.
    w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x, y: w.hero.y } });
    w.step(w.ahriRVisuals[0].startTick + 595 - w.tick);
    v.zoom = 0.08;
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    const capture = () =>
      [...v.ahriRParticles.buffSurfaces.models]
        .filter(([, model]: any) => model.userData.profileIndex === 50)
        .map(([key, model]: any) => ({
          key,
          position: model.position.toArray(),
          quaternion: model.quaternion.toArray(),
          scale: model.scale.toArray(),
          color: model.material.uniforms.particleColor.value.toArray(),
          vertices: model.geometry.getAttribute('position').count,
          terrainProjected: model.geometry.userData.groundQuadTopology !== undefined,
        }));
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    return {
      before,
      restored,
      unchanged: w.snapshot() === saved && copy.snapshot() === saved,
      attachments: v.ahriRParticles.attachmentFallbacks,
    };
  });
  expect(layout.before).toHaveLength(1);
  expect(layout.before[0]).toMatchObject({ vertices: 4, terrainProjected: false });
  expect(layout.restored).toEqual(layout.before);
  expect(layout.unchanged).toBe(true);
  expect(layout.attachments).toEqual([]);
  await page.screenshot({ path: info.outputPath('ahri-r-layout-near-expiry.png') });
  const layoutDrained = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(20);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return ![...g.view.ahriRParticles.buffSurfaces.models.values()].some(
      (model: any) => model.userData.profileIndex === 50
    );
  });
  expect(layoutDrained).toBe(true);
  const buffOnlyDepth = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const saved = w.snapshot(),
      depth = v.ahriRParticles.surfaces.depth,
      original = depth.capture;
    let captures = 0;
    depth.capture = (...args: any[]) => {
      captures++;
      return original.apply(depth, args);
    };
    try {
      v.render(w, 1, v.previousElapsed);
      const models = [...v.ahriRParticles.buffSurfaces.models.values()].filter(
        (model: any) => model.userData.profileIndex === 53
      ) as any[];
      return {
        captures,
        glows: models.length,
        spellSurfaces: v.ahriRParticles.surfaces.models.size,
        spellRibbons: v.ahriRParticles.models.size,
        sharedTarget:
          !!depth.target &&
          models.every(
            (model) => model.material.uniforms.softDepth.value === depth.target.depthTexture
          ),
        unchanged: w.snapshot() === saved,
      };
    } finally {
      depth.capture = original;
    }
  });
  expect(buffOnlyDepth.glows).toBeGreaterThan(0);
  expect(buffOnlyDepth).toMatchObject({
    captures: 1,
    spellSurfaces: 0,
    spellRibbons: 0,
    sharedTarget: true,
    unchanged: true,
  });

  expect(requests.filter((path) => path.endsWith('/ahri-r-b28f3ac6819dd4e1.png'))).toHaveLength(1);
  for (const name of [
    '2f5d10bd024f378a',
    '448c3877b6693762',
    'cde0d94435baa941',
    '812974fe434afa99',
    'dd852bde9dedd7f1',
  ])
    expect(requests.filter((path) => path.endsWith(`/ahri-r-${name}.png`))).toHaveLength(1);
  expect(requests.filter((path) => path.endsWith('/ahri-r-e44c1023b3871ca4.png'))).toHaveLength(1);
  expect(requests).toHaveLength(14);
  expect(new Set(requests).size).toBe(14);
  expect(requests.filter((path) => path.endsWith('.glb'))).toEqual([
    '/assets/effects/ahri-r-0216531e0d20ebea.glb',
  ]);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('ahri-r-packets.json'),
    JSON.stringify(
      {
        requests,
        glowRequests,
        flight,
        hit,
        eyes,
        eyeTrails,
        front: frontProof,
        layout,
        layoutDrained,
        layoutPixelProof,
        layoutBasePixelProof,
        continuousGlowPixelProof,
        meshPixelProofs,
        buffOnlyDepth,
        errors,
      },
      null,
      2
    )
  );
});

test('a roster without Ahri never requests R transports', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-r-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(20);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      ahri: g.world.units.some((u: any) => u.champion === 'ahri'),
      ready: g.view.ahriRParticles.ready,
    };
  });
  expect(result).toEqual({ ahri: false, ready: false });
  expect(requests).toEqual([]);
});
