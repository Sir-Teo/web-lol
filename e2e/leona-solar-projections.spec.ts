import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page, team: 'blue' | 'red' = 'blue') {
  // Pause synchronously when boot exposes the development handle, before its
  // first animation frame. Asset/network timing must not run fixture AI first.
  await page.addInitScript(() => {
    let game: any;
    Object.defineProperty(window, '__GAME__', {
      configurable: true,
      get: () => game,
      set(value) {
        game = value;
        value.setPaused(true);
      },
    });
  });
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(async (team) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.setPaused(true);
    // The fixture teleports/removes startup units. Recreate their presentation
    // from this controlled setup, just as a saved match starts with fresh rigs.
    const modelPath = '/src/render/models.ts',
      models = await import(modelPath);
    for (const model of g.view.models.values()) {
      model.root.removeFromParent();
      models.disposeModel(model);
    }
    g.view.models.clear();
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 500, y: -100, previous: { x: 500, y: -100 } });
    Object.assign(u, { team, x: 0, y: 0, previous: { x: 0, y: 0 } });
    for (const v of w.units) v.ai = false;
    w.gainExperience(2400, u.id);
    if (!w.championState(u.id).spellRanks.r) w.learnSpell('r', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: { x: 500, y: 0 } });
    // Advance beyond the view's eight-tick fog refresh interval after teleporting.
    w.step(12);
    g.view.locked = false;
    g.view.zoom = 0.55;
    g.view.recenter({ x: 450, y: 0 });
    g.view.render(w, 1, 22.5);
    return { caster: u.id, snapshot: w.snapshot() };
  }, team);
}
async function capture(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.hovered = null;
    v.selected = null;
    v.rangeVisible = false;
    v.setAim(null, null);
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
    return {
      rigs: [...v.models].map(([id, model]: any) => {
        const bones: number[] = [];
        model.root.traverse((o: any) => {
          if (o.isSkinnedMesh)
            bones.push(...o.skeleton.bones.flatMap((b: any) => b.matrixWorld.toArray()));
        });
        return { id, asset: model.referenceAsset, world: model.root.matrixWorld.toArray(), bones };
      }),
      models: [...v.leonaSolarProjections.models].map(([key, m]: any) => ({
        key,
        ...m.userData,
        positions: Array.from(
          m.geometry.getAttribute('position').array.slice(0, m.geometry.drawRange.count * 3)
        ),
        mapping: m.material.uniforms.worldToUv.value.toArray(),
        height: m.material.uniforms.heightRange.value.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
      })),
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', p))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}
async function contribution(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view,
      gl = v.renderer.getContext(),
      models = [...v.leonaSolarProjections.models.values()] as any[];
    const draw = () => {
      v.renderer.render(v.scene, v.camera);
      v.particleDistortion.render(v.renderer, v.camera);
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
    };
    const full = draw();
    for (const m of models) m.visible = false;
    const without = draw();
    for (const m of models) m.visible = true;
    let changed = 0;
    for (let i = 0; i < full.length; i += 4)
      if (
        full[i] !== without[i] ||
        full[i + 1] !== without[i + 1] ||
        full[i + 2] !== without[i + 2]
      )
        changed++;
    v.render(g.world, 1, 22.5);
    return { changed, totalPixels: full.length / 4, error: gl.getError() };
  });
}
for (const team of ['blue', 'red'] as const)
  test(`${team} R planar sun draws clipped receiver triangles and restores saved pixels`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const prepared = await open(page, team),
      before = await capture(page),
      visible = await contribution(page);
    expect(before.models).toHaveLength(1);
    expect(before.models[0].profileIndex).toBe(team === 'blue' ? 12 : 18);
    expect(before.models[0].receiverCorners).toBeGreaterThan(3);
    expect(before.models[0].receiverTriangles).toBeGreaterThan(1);
    expect(before.snapshot).toBe(prepared.snapshot);
    expect(visible.changed).toBeGreaterThan(10);
    expect(visible.changed).toBeLessThan(visible.totalPixels * 0.2);
    expect(visible.error).toBe(0);
    expect(await capture(page)).toEqual(before);
    const canvasEvidence = async (name: string) => {
      const data = await page.evaluate(() => {
        const g = (window as any).__GAME__;
        g.view.render(g.world, 1, 22.5);
        return g.view.renderer.domElement.toDataURL('image/png') as string;
      });
      writeFileSync(info.outputPath(name), Buffer.from(data.split(',')[1], 'base64'));
    };
    await canvasEvidence('before-save.png');
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
    await canvasEvidence('after-reload.png');
    writeFileSync(
      info.outputPath('restore-diagnostic.json'),
      JSON.stringify({ before, restored }, null, 2)
    );
    expect(restored).toEqual(before);
    const canvas = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.view.render(g.world, 1, 22.5);
      return g.view.renderer.domElement.toDataURL('image/png') as string;
    });
    writeFileSync(
      info.outputPath('planar-sun-canvas.png'),
      Buffer.from(canvas.split(',')[1], 'base64')
    );
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('evidence.json'),
      JSON.stringify({ prepared, before, visible, restored, errors }, null, 2)
    );
  });

test('R planar sun recovers graphics storage and repeated casts retire owned geometry', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = await open(page),
    before = await capture(page);
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
  const rounds = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      s = w.championState(caster),
      rounds = [];
    for (let i = 0; i < 6; i++) {
      if (i) {
        u.mana = u.maxMana;
        s.cooldowns.r = 0;
        w.enqueue({ type: 'cast', unit: caster, ability: 'r', point: { x: 500, y: 0 } });
        w.step(12);
      }
      v.render(w, 1, 22.5);
      const m = [...v.leonaSolarProjections.models.values()][0] as any;
      let geometry = 0,
        material = 0,
        borrowed = 0;
      m.geometry.addEventListener('dispose', () => geometry++);
      m.material.addEventListener('dispose', () => material++);
      m.material.uniforms.diffuseTexture.value.addEventListener('dispose', () => borrowed++);
      w.step(150);
      v.render(w, 1, 22.5);
      rounds.push({
        remaining: v.leonaSolarProjections.models.size,
        geometry,
        material,
        borrowed,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  expect(
    rounds.every(
      (r) => r.remaining === 0 && r.geometry === 1 && r.material === 1 && r.borrowed === 0
    )
  ).toBe(true);
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  writeFileSync(
    info.outputPath('recovery-storage.json'),
    JSON.stringify({ before, recovered, rounds }, null, 2)
  );
});

test('R projector indexes actual Rift receiver geometry lazily and preserves simulation', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto('/?scene=rift');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    const lazy = v.decalReceivers.triangleCount;
    // Keep Leona's development-only simulation gate while using the actual Rift
    // renderer/receivers. This is a geometry probe, not player-Leona acceptance.
    const worldPath = '/src/simulation/world.ts',
      fixturePath = '/src/content/practice-fixture.ts';
    const [{ World }, { PRACTICE_FIXTURE }] = await Promise.all([
      import(worldPath),
      import(fixturePath),
    ]);
    const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
    g.world = w;
    v.lastFogTick = -100;
    Object.assign(w.hero, { x: 500, y: -100, previous: { x: 500, y: -100 } });
    // @ts-ignore Vite browser source module.
    const models = await import('/src/render/models.ts');
    await models.loadReferenceModels([], true);
    for (const model of v.models.values()) {
      model.root.removeFromParent();
      models.disposeModel(model);
    }
    v.models.clear();
    await v.leonaSolarProjections.load();
    const origin = { x: 500, y: 0 },
      u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
    for (const unit of w.units) unit.ai = false;
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.gainExperience(2400, u.id);
    w.learnSpell('r', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: origin });
    w.step(7);
    const before = w.snapshot();
    v.locked = false;
    v.zoom = 0.45;
    v.recenter(origin);
    v.render(w, 1, 22.5);
    const projected = [...v.leonaSolarProjections.models.values()].map((m: any) => {
      const positions = m.geometry
          .getAttribute('position')
          .array.slice(0, m.geometry.drawRange.count * 3),
        ys = [];
      for (let i = 1; i < positions.length; i += 3) ys.push(positions[i]);
      return { ...m.userData, minY: Math.min(...ys), maxY: Math.max(...ys) };
    });
    return {
      lazy,
      indexed: v.decalReceivers.triangleCount,
      projected,
      before,
      after: w.snapshot(),
      error: v.renderer.getContext().getError(),
    };
  });
  expect(result.lazy).toBe(0);
  expect(result.indexed).toBeGreaterThan(1000);
  expect(result.projected).toHaveLength(1);
  expect(result.projected[0].receiverCorners).toBeGreaterThan(6);
  expect(result.before).toBe(result.after);
  expect(result.error).toBe(0);
  const visible = await contribution(page);
  expect(visible.changed).toBeGreaterThan(10);
  writeFileSync(
    info.outputPath('rift-receivers.json'),
    JSON.stringify({ result, visible }, null, 2)
  );
});
