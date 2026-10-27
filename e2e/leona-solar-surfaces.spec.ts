import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const common = [
  4, 5, 6, 7, 8, 9, 10, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  42, 43,
];
const supported = (team: 'blue' | 'red') =>
  [...common, ...(team === 'blue' ? [11, 13, 14, 15, 16] : [17, 19, 20, 21, 22])].sort(
    (a, b) => a - b
  );
async function open(page: Page, team: 'blue' | 'red' = 'blue') {
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate((team) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.setPaused(true);
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 500, y: -100, previous: { x: 500, y: -100 } });
    Object.assign(u, { team, x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 500, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    w.gainExperience(2400, u.id);
    if (!w.championState(u.id).spellRanks.r) w.learnSpell('r', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: 500, y: 0 } });
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
  }, team);
}
async function sourcePixels(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/render/particle-color-phase.ts';
    const { renderParticleColorPhase } = await import(modulePath);
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const gl = v.renderer.getContext(),
      models = [...v.leonaSolarSurfaces.models.values()] as any[],
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
        renderParticleColorPhase(v.renderer, v.scene, v.camera, v.particleEarlyDistortion);
        v.particleDistortion.render(v.renderer, v.camera);
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
        mesh: m.userData.sourceMesh,
        vertexBgra: !!m.material.defines.SOURCE_VERTEX_BGRA,
        soft: !!m.material.uniforms.softDepth,
        vertices: m.geometry.getAttribute('position')?.count ?? 0,
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
    const models = [...v.leonaSolarSurfaces.models].map(([key, m]: any) => ({
      key,
      ...m.userData,
      position: m.position.toArray(),
      quaternion: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      packetColor: Array.from(m.geometry.getAttribute('_source_vertex_bgra')?.array ?? []),
      color: m.material.uniforms.particleColor.value.toArray(),
      uv: m.material.uniforms.sourceUvTransform?.value.toArray(),
      mult: m.material.uniforms.multiplierUvTransform?.value.toArray(),
      erosion: m.material.uniforms.erosionParameters?.value.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
      vertices: m.userData.ownedGeometry
        ? Array.from(m.geometry.getAttribute('position')?.array ?? [])
        : null,
    }));
    return {
      models,
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', p))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}

for (const team of ['blue', 'red'] as const)
  test(`Solar Flare ${team} source families contribute localized pixels through saved phases`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const ids = await open(page, team),
      stages = [];
    for (const age of [
      1, 3, 6, 12, 20, 29, 32, 36, 38, 39, 40, 42, 44, 46, 50, 54, 62, 72, 90, 120, 180,
    ]) {
      await page.evaluate(
        ({ start, age }) => {
          const w = (window as any).__GAME__.world;
          w.step(start + age - w.tick);
        },
        { start: ids.start, age }
      );
      stages.push({ age, ...(await sourcePixels(page)) });
      if (age === 12 || age === 40 || age === 62)
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
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual(supported(team));
    expect([...seen].filter(([, changed]) => changed === 0)).toEqual([]);
    expect(errors).toEqual([]);
  });

for (const age of [12, 46])
  test(`surface age ${age} restores exact source state and pixels through Save/reload and graphics recovery`, async ({
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

test('repeated hits and misses retire ground grids, materials and distortion copies with bounded GPU memory', async ({
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
          x: i % 2 ? 3000 : 500,
          y: 0,
          previous: { x: i % 2 ? 3000 : 500, y: 0 },
        });
        state.cooldowns.r = 0;
        w.enqueue({ type: 'cast', unit: caster, ability: 'r', point: { x: 500, y: 0 } });
        w.step();
        begun = w.tick;
      }
      // Exercise delayed families and distortion copies before comparing settled memory.
      for (const age of [3, 12, 32, 40, 44, 46]) {
        w.step(begun + age - w.tick);
        v.render(w, 1, 22.5);
      }
      const models = [...v.leonaSolarSurfaces.models.values()] as any[],
        owned = models.filter((m) => m.userData.ownedGeometry);
      let materials = 0,
        geometry = 0;
      for (const m of models) m.material.addEventListener('dispose', () => materials++);
      for (const m of owned) m.geometry.addEventListener('dispose', () => geometry++);
      const depthActive = !!v.leonaSolarSurfaces.renderer.depth.target,
        copyActive = !!v.particleDistortion.frame,
        earlyActive = !!v.particleEarlyDistortion.frame;
      w.step(begun + 90 - w.tick);
      v.render(w, 1, 22.5);
      w.step(1000);
      v.render(w, 1, 22.5);
      rounds.push({
        outcome: i % 2 ? 'miss' : 'hit',
        active: models.length,
        owned: owned.length,
        materials,
        geometry,
        depthActive,
        copyActive,
        earlyActive,
        copyRemaining: !!v.particleDistortion.frame,
        earlyRemaining: !!v.particleEarlyDistortion.frame,
        depthRemaining: !!v.leonaSolarSurfaces.renderer.depth.target,
        remaining: v.leonaSolarSurfaces.models.size,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  writeFileSync(info.outputPath('storage.json'), JSON.stringify({ rounds, errors }, null, 2));
  for (const r of rounds) {
    expect(r.active).toBeGreaterThan(0);
    expect(r.owned).toBeGreaterThan(0);
    expect(r.depthActive).toBe(false);
    expect(r.copyActive).toBe(true);
    expect(r.earlyActive).toBe(true);
    expect(r.copyRemaining).toBe(false);
    expect(r.earlyRemaining).toBe(false);
    expect(r.depthRemaining).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.materials).toBe(r.active);
    expect(r.geometry).toBeGreaterThanOrEqual(r.owned);
  }
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('three impact warps share one early capture and each changes pixels while another keeps the stage active', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = await open(page);
  const result = await page.evaluate(async ({ start }) => {
    const path = '/src/render/particle-color-phase.ts',
      { renderParticleColorPhase } = await import(path),
      g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.step(start + 46 - w.tick);
    let earlyCopies = 0,
      lateCopies = 0;
    const copy = v.renderer.copyFramebufferToTexture.bind(v.renderer);
    v.renderer.copyFramebufferToTexture = (...args: any[]) => {
      if (args[0] === v.particleEarlyDistortion.frame) earlyCopies++;
      if (args[0] === v.particleDistortion.frame) lateCopies++;
      return copy(...args);
    };
    const snapshot = w.snapshot();
    try {
      v.render(w, 1, 22.5);
    } finally {
      v.renderer.copyFramebufferToTexture = copy;
    }
    const models = [...v.leonaSolarSurfaces.models.values()].filter(
        (m: any) => m.parent === v.particleEarlyDistortion.scene
      ) as any[],
      state = models.map((m) => ({
        profile: m.userData.profileIndex,
        strength: m.material.uniforms.distortionPower.value,
        depthTest: m.material.depthTest,
        alphaTest: !!m.material.defines.SOURCE_ALPHA_TEST,
        shared: m.material.uniforms.backBuffer.value === v.particleEarlyDistortion.frame,
      }));
    const draw = () => {
        renderParticleColorPhase(v.renderer, v.scene, v.camera, v.particleEarlyDistortion);
        v.particleDistortion.render(v.renderer, v.camera);
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
        return p;
      },
      full = draw(),
      contributions = [];
    for (const m of models) {
      m.visible = false;
      const without = draw();
      m.visible = true;
      let changed = 0;
      for (let i = 0; i < full.length; i += 4)
        if (
          full[i] !== without[i] ||
          full[i + 1] !== without[i + 1] ||
          full[i + 2] !== without[i + 2]
        )
          changed++;
      contributions.push({ profile: m.userData.profileIndex, changed });
    }
    draw();
    return {
      earlyCopies,
      lateCopies,
      state,
      contributions,
      unchanged: snapshot === w.snapshot(),
      error: v.renderer.getContext().getError(),
      canvas: v.renderer.domElement.toDataURL('image/png') as string,
    };
  }, ids);
  const { canvas, ...evidence } = result;
  writeFileSync(
    info.outputPath('R-early-impact-canvas.png'),
    Buffer.from(canvas.split(',')[1], 'base64')
  );
  writeFileSync(info.outputPath('early-capture.json'), JSON.stringify(evidence, null, 2));
  expect(result.earlyCopies).toBe(1);
  expect(result.lateCopies).toBe(1);
  expect(result.state.map((m: any) => m.profile)).toEqual([27, 30, 33]);
  expect(result.state.map((m: any) => m.strength)).toEqual([
    0.07000000029802322, 0.15000000596046448, 0.10000000149011612,
  ]);
  expect(result.state.every((m: any) => !m.depthTest && !m.alphaTest && m.shared)).toBe(true);
  expect(result.contributions.every((p: any) => p.changed > 10)).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.error).toBe(0);
});
