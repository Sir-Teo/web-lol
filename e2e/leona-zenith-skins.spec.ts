import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page) {
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
    Object.assign(w.hero, { x: 300, y: -200, previous: { x: 300, y: -200 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    if (!w.championState(u.id).spellRanks.e) w.learnSpell('e', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
    w.step(75);
    g.view.zoom = 0.35;
    g.view.recenter(u);
    g.view.render(w, 1, 22.5);
    return { caster: u.id, target: target.id, snapshot: w.snapshot() };
  });
}
async function capture(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const pixels = new Uint8Array(v.renderer.domElement.width * v.renderer.domElement.height * 4),
      gl = v.renderer.getContext();
    gl.readPixels(
      0,
      0,
      v.renderer.domElement.width,
      v.renderer.domElement.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const models = [...v.leonaZenithSkins.models].map(([key, m]: any) => ({
      key,
      ...m.root.userData,
      position: m.root.position.toArray(),
      facing: m.root.rotation.y,
      scale: m.sampler.renderRoot.scale.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      erosion: m.material.uniforms.erosionParameters.value.toArray(),
      wraps: [
        m.material.uniforms.sourceTexture.value.wrapS,
        m.material.uniforms.erosionTexture.value.wrapS,
      ],
      bones: m.meshes.flatMap((mesh: any) =>
        mesh.skeleton.bones.flatMap((b: any) => b.matrixWorld.toArray())
      ),
    }));
    return {
      models,
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}

test('arrival source skin draws visible pixels and restores exact saved poses and framebuffer', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const prepared = await open(page),
    before = await capture(page);
  expect(before.models).toHaveLength(1);
  expect(before.models[0].profileIndex).toBe(5);
  expect(before.models[0].wraps).toEqual([1000, 1002]);
  expect(before.models[0].scale).toEqual([1, 1, 1]);
  expect(before.snapshot).toBe(prepared.snapshot);
  const visible = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view,
      gl = v.renderer.getContext(),
      models = [...v.leonaZenithSkins.models.values()] as any[];
    const read = () => {
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
    // The browser may clear a non-preserved drawing buffer between callbacks.
    // Render both versions synchronously before comparing source contribution.
    v.renderer.render(v.scene, v.camera);
    const full = read();
    for (const m of models) m.root.visible = false;
    v.renderer.render(v.scene, v.camera);
    const without = read();
    for (const m of models) m.root.visible = true;
    let changed = 0;
    for (let i = 0; i < full.length; i += 4)
      if (
        full[i] !== without[i] ||
        full[i + 1] !== without[i + 1] ||
        full[i + 2] !== without[i + 2]
      )
        changed++;
    v.render(g.world, 1, v.previousElapsed);
    return { changed, totalPixels: full.length / 4, error: gl.getError() };
  });
  expect(visible.changed).toBeGreaterThan(100);
  expect(visible.changed).toBeLessThan(visible.totalPixels * 0.1);
  expect(visible.error).toBe(0);
  expect(await capture(page)).toEqual(before);
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate((caster) => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.zoom = 0.35;
    g.view.recenter(g.world.units.find((u: any) => u.id === caster));
  }, prepared.caster);
  const restored = await capture(page);
  expect(restored).toEqual(before);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('arrival.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ prepared, before, visible, restored, errors }, null, 2)
  );
});

test('arrival tail recovers exact pixels after graphics loss and retires its private rig', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const before = await capture(page);
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
  const released = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view,
      m = [...v.leonaZenithSkins.models.values()][0] as any;
    let material = 0,
      bone = 0,
      borrowed = 0;
    m.material.addEventListener('dispose', () => material++);
    m.meshes[0].skeleton.boneTexture.addEventListener('dispose', () => bone++);
    for (const r of [
      m.meshes[0].geometry,
      m.material.uniforms.sourceTexture.value,
      m.material.uniforms.erosionTexture.value,
    ])
      r.addEventListener('dispose', () => borrowed++);
    g.world.step(30);
    v.render(g.world, 1, v.previousElapsed);
    return { models: v.leonaZenithSkins.models.size, material, bone, borrowed };
  });
  expect(released).toEqual({ models: 0, material: 1, bone: 1, borrowed: 0 });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('recovery-release.json'),
    JSON.stringify({ before, recovered, released, errors }, null, 2)
  );
});

test('repeated arrivals release private skeleton storage and keep shared GPU memory bounded', async ({
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
        Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 }, mana: u.maxMana });
        s.cooldowns.e = 0;
        w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
        w.step(75);
      }
      v.render(w, 1, 22.5);
      const active = v.leonaZenithSkins.models.size;
      w.step(90);
      v.render(w, 1, 22.5);
      rounds.push({
        active,
        remaining: v.leonaZenithSkins.models.size,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  expect(rounds.every((r) => r.active === 1 && r.remaining === 0)).toBe(true);
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  writeFileSync(info.outputPath('storage.json'), JSON.stringify(rounds, null, 2));
});
