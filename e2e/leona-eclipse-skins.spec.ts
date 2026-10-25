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
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step(31);
    g.view.zoom = 0.35;
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    return { caster: u.id, target: target.id };
  });
}
async function capture(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const models = [...v.leonaEclipseSkins.models];
    return models.map(([key, m]: any) => ({
      key,
      ...m.root.userData,
      position: m.root.position.toArray(),
      facing: m.root.rotation.y,
      scale: m.sampler.renderRoot.scale.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      fresnelPower: m.material.uniforms.fresnelPower.value,
      erosion: m.material.uniforms.erosionParameters?.value.toArray(),
      bones: m.meshes[0].skeleton.bones.flatMap((b: any) => b.matrixWorld.toArray()),
    }));
  });
}
async function sourcePixels(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      read = () => {
        const a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          a
        );
        return a;
      },
      models = [...v.leonaEclipseSkins.models.values()] as any[];
    for (const m of models) m.root.visible = false;
    v.renderer.render(v.scene, v.camera);
    const baseline = read(),
      results = [];
    for (const profile of new Set(models.map((m) => m.root.userData.profileIndex))) {
      for (const m of models) m.root.visible = m.root.userData.profileIndex === profile;
      v.renderer.render(v.scene, v.camera);
      const pixels = read();
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] !== baseline[i] ||
          pixels[i + 1] !== baseline[i + 1] ||
          pixels[i + 2] !== baseline[i + 2]
        )
          changed++;
      const selected = models.filter((m) => m.root.userData.profileIndex === profile),
        powers = selected.map((m) => m.material.uniforms.fresnelPower.value),
        count = (a: Uint8Array, b: Uint8Array) => {
          let n = 0;
          for (let i = 0; i < a.length; i += 4)
            if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
          return n;
        };
      for (const m of selected)
        m.material.uniforms.fresnelPower.value = Math.fround(
          profile === 4 || profile === 9 ? 0.05 : 0.15
        );
      v.renderer.render(v.scene, v.camera);
      const rawPowerChanged = count(pixels, read());
      selected.forEach((m, i) => {
        m.material.uniforms.fresnelPower.value = powers[i];
      });
      v.renderer.render(v.scene, v.camera);
      results.push({
        profile,
        changed,
        powers,
        rawPowerChanged,
        restoredChanged: count(pixels, read()),
      });
    }
    for (const m of models) m.root.visible = true;
    v.render(g.world, 1, v.previousElapsed);
    return { results, error: gl.getError() };
  });
}
async function frame(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    return {
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}

test('all four source skin descriptions draw the authored rig and retain exact saved poses through both W phases', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page),
    armed = await capture(page),
    initialPixels = await sourcePixels(page);
  expect(armed.map((p) => p.profileIndex).sort()).toEqual([4, 4, 5, 6]);
  expect(initialPixels.results.every((p) => p.changed > 0)).toBe(true);
  expect(armed.map((p) => p.fresnelPower).sort()).toEqual([
    0.3449999988079071, 0.3449999988079071, 0.8350000381469727, 0.8350000381469727,
  ]);
  expect(initialPixels.results.every((p) => p.rawPowerChanged > 0 && p.restoredChanged === 0)).toBe(
    true
  );
  expect(initialPixels.error).toBe(0);
  await page.screenshot({ path: info.outputPath('initial.png') });
  const movement = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster);
    w.setOrder(u, { type: 'move', point: { x: 0, y: 400 } });
    w.step(10);
    v.render(w, 1, v.previousElapsed);
    const live = new Map<string, number[]>();
    v.models.get(caster).root.traverse((o: any) => {
      if (o.isBone) live.set(o.name, o.matrixWorld.toArray());
    });
    return [...v.leonaEclipseSkins.models.values()].map((m: any) => {
      return Math.max(
        ...m.meshes[0].skeleton.bones.flatMap((b: any) =>
          b.matrixWorld.toArray().map((x: number, i: number) => Math.abs(x - live.get(b.name)![i]))
        )
      );
    });
  }, ids);
  expect(movement.every((delta) => delta < 1e-7)).toBe(true);
  const moving = await capture(page);
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
  });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await capture(page)).toEqual(moving);
  await page.evaluate(({ caster }) => {
    const w = (window as any).__GAME__.world;
    w.setOrder(w.unit(caster), { type: 'idle' });
    w.step(141);
  }, ids);
  const extended = await capture(page),
    extendedPixels = await sourcePixels(page);
  expect(extended.map((p) => p.profileIndex)).toEqual([9, 9]);
  expect(extendedPixels.results.every((p) => p.changed > 0)).toBe(true);
  expect(extended.every((p) => p.fresnelPower === 0.3449999988079071)).toBe(true);
  expect(
    extendedPixels.results.every((p) => p.rawPowerChanged > 0 && p.restoredChanged === 0)
  ).toBe(true);
  expect(extendedPixels.error).toBe(0);
  await page.screenshot({ path: info.outputPath('extended.png') });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('skins.json'),
    JSON.stringify(
      { armed, initialPixels, movement, moving, extended, extendedPixels, errors },
      null,
      2
    )
  );
});

test('skin framebuffer recovers exactly and death/victory retire private GPU resources against a frozen save', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page),
    before = await capture(page),
    original = await frame(page);
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
  const recovered = await frame(page);
  expect(recovered).toEqual(original);
  expect(await capture(page)).toEqual(before);
  const terminal = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    w.damage(w.unit(target), w.unit(caster), 1e6, 'true');
    const gate = w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, gate, 1e6, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1200, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    v.render(w, 1, v.previousElapsed);
    const models = [...v.leonaEclipseSkins.models.values()] as any[],
      skeletons = new Set(models.flatMap((m) => m.meshes.map((x: any) => x.skeleton))),
      geometry = new Set(models.flatMap((m) => m.meshes.map((x: any) => x.geometry))),
      images = new Set(
        models.flatMap((m) =>
          Object.values(m.material.uniforms)
            .map((u: any) => u.value)
            .filter((x: any) => x?.isTexture)
        )
      );
    let bones = 0,
      materials = 0,
      shared = 0;
    for (const s of skeletons as Set<any>) s.boneTexture.addEventListener('dispose', () => bones++);
    for (const m of models) m.material.addEventListener('dispose', () => materials++);
    for (const x of [...geometry, ...images] as any[])
      x.addEventListener('dispose', () => shared++);
    const saved = w.snapshot(),
      pose = models.map((m) =>
        m.meshes[0].skeleton.bones.flatMap((b: any) => b.matrixWorld.toArray())
      );
    v.render(w, 1, v.previousElapsed + 0.05);
    const frozen = [...v.leonaEclipseSkins.models.values()].map((m: any) =>
      m.meshes[0].skeleton.bones.flatMap((b: any) => b.matrixWorld.toArray())
    );
    v.render(w, 1, v.previousElapsed + 5);
    return {
      winner: w.winner,
      active: models.length,
      remaining: v.leonaEclipseSkins.models.size,
      frozen: JSON.stringify(frozen) === JSON.stringify(pose),
      bones,
      materials,
      shared,
      sameSave: w.snapshot() === saved,
      restores: w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  }, ids);
  expect(terminal).toEqual({
    winner: 'blue',
    active: 4,
    remaining: 0,
    frozen: true,
    bones: 4,
    materials: 4,
    shared: 0,
    sameSave: true,
    restores: true,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('recovery-terminal.json'),
    JSON.stringify({ original, recovered, terminal, errors }, null, 2)
  );
});

test('repeated W casts release private skeleton textures and keep shared GPU storage bounded', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = await open(page);
  const rounds = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      s = w.championState(caster),
      rounds = [];
    for (let i = 0; i < 6; i++) {
      if (i) {
        s.cooldowns.w = 0;
        u.mana = u.maxMana;
        w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
        w.step(30);
      }
      v.render(w, 1, v.previousElapsed);
      const active = v.leonaEclipseSkins.models.size;
      w.step(620);
      v.render(w, 1, v.previousElapsed);
      rounds.push({
        active,
        remaining: v.leonaEclipseSkins.models.size,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  expect(rounds.every((r) => r.active === 4 && r.remaining === 0)).toBe(true);
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  writeFileSync(info.outputPath('storage.json'), JSON.stringify(rounds, null, 2));
});
