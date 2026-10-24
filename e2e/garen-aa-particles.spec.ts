import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page, kind: 'attack1' | 'attack2' | 'crit') {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate((kind) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    if (kind === 'crit') {
      w.player.inventory = Array(6).fill('agility');
      w.random.state = 1;
    }
    const target = w.spawn('champion', 'red', { x: 100, y: 0 }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 1000000;
    let r;
    for (let tries = 0; tries < 128; tries++) {
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step();
      r = w.player.garenAAVisuals.at(-1);
      if (r.kind === kind) break;
      w.setOrder(w.hero, { type: 'idle' });
      w.step();
    }
    if (r.kind !== kind) throw Error('Desired source swing not reached');
    w.step(r.releaseTick - w.tick + 4);
    g.view.recenter(w.hero);
    g.view.zoom = 0.65;
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      start: r.startTick,
      release: r.releaseTick,
      kind: r.kind,
      target: target.id,
      tick: w.tick,
    };
  }, kind);
}
async function capture(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view,
      w = g.world;
    v.zoom = 0.65;
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    const hash = async (bytes: ArrayBuffer) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
    return Promise.all(
      [...v.garenBasicAttacks.models].map(async ([key, m]: any) => ({
        key,
        position: m.position.toArray(),
        rotation: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        profile: m.userData.profileIndex,
        phase: m.userData.phase,
        bone: m.userData.bone,
        born: m.userData.bornTick,
        geometry: await hash(m.geometry.getAttribute('position').array.slice().buffer),
        uniforms: {
          tint: m.material.uniforms.particleColor.value.toArray(),
          lookup: m.material.uniforms.lookupUv.value.toArray(),
          offset: m.material.uniforms.sourceUvOffset.value.toArray(),
          scale: m.material.uniforms.sourceUvScale.value.toArray(),
        },
      }))
    );
  });
}
for (const kind of ['attack1', 'attack2', 'crit'] as const)
  test(`${kind} source AA particles attach to saved bones, survive UI reload and retire without touching shared geometry`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const initial = await open(page, kind);
    expect(initial.kind).toBe(kind);
    const before = await capture(page);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((p) => p.phase === 'hit' && p.bone === 'C_BUFFBONE_GLB_CHEST_LOC')).toBe(
      true
    );
    if (kind !== 'crit') expect(before.some((p) => p.phase === 'swing')).toBe(true);
    expect(
      before.every((p) =>
        [...p.position, ...p.rotation, ...p.scale, ...p.uniforms.tint].every(Number.isFinite)
      )
    ).toBe(true);
    const pixels = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        v = g.view,
        gl = v.renderer.getContext(),
        size = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
      v.render(g.world, 1, v.previousElapsed);
      const a = new Uint8Array(size),
        b = new Uint8Array(size);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a
      );
      for (const m of v.garenBasicAttacks.models.values()) m.visible = false;
      v.renderer.render(v.scene, v.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b
      );
      let changed = 0;
      for (let i = 0; i < size; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
      const perProfile = [];
      for (const profile of new Set(
        [...v.garenBasicAttacks.models.values()].map((m: any) => m.userData.profileIndex)
      )) {
        for (const m of v.garenBasicAttacks.models.values())
          m.visible = m.userData.profileIndex === profile;
        v.renderer.render(v.scene, v.camera);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          a
        );
        let count = 0;
        for (let i = 0; i < size; i += 4)
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
        perProfile.push({ profile, changed: count });
      }
      v.render(g.world, 1, v.previousElapsed);
      return { changed, perProfile, error: gl.getError() };
    });
    writeFileSync(testInfo.outputPath('pixel-probe.json'), JSON.stringify(pixels, null, 2) + '\n');
    expect(pixels.error).toBe(0);
    expect(pixels.changed).toBeGreaterThan(0);
    expect(pixels.perProfile.every((p) => p.changed > 0)).toBe(true);
    // Rendering restores existing meshes' visibility as well as newly created ones.
    await page.evaluate(() => {
      for (const m of (window as any).__GAME__.view.garenBasicAttacks.models.values())
        m.visible = true;
    });
    await page.screenshot({ path: testInfo.outputPath('source-particles.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    expect(JSON.parse(saved).version).toBe(120);
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
    expect(await capture(page)).toEqual(before);
    const result = await page.evaluate((targetId) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      w.setOrder(w.hero, { type: 'idle' });
      w.setOrder(w.unit(targetId), { type: 'move', point: { x: 600, y: 500 } });
      w.step(3);
      v.render(w, 1, v.previousElapsed);
      const moved = [...v.garenBasicAttacks.models.values()].map((m: any) => ({
        phase: m.userData.phase,
        position: m.position.toArray(),
      }));
      const original = w.pointVisible;
      w.pointVisible = () => false;
      v.render(w, 1, v.previousElapsed);
      const hidden = v.garenBasicAttacks.models.size;
      w.pointVisible = original;
      v.render(w, 1, v.previousElapsed);
      let materials = 0,
        rays = 0,
        shared = 0;
      const seen = new Set();
      for (const m of v.garenBasicAttacks.models.values()) {
        m.material.addEventListener('dispose', () => materials++);
        if (!seen.has(m.geometry)) {
          seen.add(m.geometry);
          m.geometry.addEventListener('dispose', () =>
            m.userData.ownedGeometry ? rays++ : shared++
          );
        }
      }
      const count = v.garenBasicAttacks.models.size;
      w.step(90);
      v.render(w, 1, v.previousElapsed);
      return {
        moved,
        hidden,
        count,
        materials,
        rays,
        shared,
        remaining: v.garenBasicAttacks.models.size,
      };
    }, initial.target);
    expect(result.moved.length).toBeGreaterThan(0);
    expect(result.moved.every((p: any) => p.phase === 'hit')).toBe(true);
    expect(result.hidden).toBe(0);
    expect(result.materials).toBe(result.count);
    expect(result.shared).toBe(0);
    expect(result.remaining).toBe(0);
    expect(errors).toEqual([]);
    writeFileSync(
      testInfo.outputPath('evidence.json'),
      JSON.stringify({ initial, before, pixels, result, exactUiRestore: true, errors }, null, 2) +
        '\n'
    );
  });

test('an active critical hit survives real graphics recovery and terminal playback retires it without advancing the winning save', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'crit');
  const before = await capture(page),
    saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.evaluate(() => {
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
    (window as any).__GAREN_AA_RECOVERY_PIXELS__ = pixels;
    v.renderer.forceContextLoss();
  });
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await capture(page)).toEqual(before);
  const pixels = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      before = (window as any).__GAREN_AA_RECOVERY_PIXELS__,
      after = new Uint8Array(before.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      after
    );
    let differences = 0;
    for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) differences++;
    delete (window as any).__GAREN_AA_RECOVERY_PIXELS__;
    return { differences, error: gl.getError() };
  });
  expect(pixels).toEqual({ differences: 0, error: 0 });
  const terminal = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      target = w.units.find((u: any) => u.champion === 'lux');
    const gate = w.spawn('inhibitor', 'blue', { x: 1000, y: 1000 });
    w.damage(target, gate, 1e6, 'true');
    const nexus = w.spawn('nexus', 'blue', { x: 1200, y: 1000 });
    w.damage(target, nexus, 1e6, 'true');
    v.render(w, 1, v.previousElapsed);
    const active = v.garenBasicAttacks.models.size,
      save = w.snapshot();
    v.render(w, 1, v.previousElapsed + 2);
    return {
      winner: w.winner,
      active,
      remaining: v.garenBasicAttacks.models.size,
      frozen: w.snapshot() === save,
    };
  });
  expect(terminal).toMatchObject({ winner: 'red', remaining: 0, frozen: true });
  expect(terminal.active).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  writeFileSync(
    testInfo.outputPath('recovery-terminal.json'),
    JSON.stringify({ pixels, terminal, errors }, null, 2) + '\n'
  );
});

test('a later reveal cannot expose an enemy swing or contact created outside the viewing team audience', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const enemy = w.spawn('champion', 'red', { x: 5000, y: 0 }, 'garen'),
      target = w.spawn('dummy', 'neutral', { x: 5090, y: 0 });
    enemy.ai = false;
    target.ai = false;
    target.hp = target.maxHp = 1e6;
    w.setOrder(enemy, { type: 'attack', target: target.id });
    w.step();
    const unseen = w.championState(enemy.id).garenAAVisuals.at(-1);
    w.step(unseen.releaseTick - w.tick + 4);
    const hiddenAtCreation = !w.visible(enemy, 'blue'),
      castAudience = [...unseen.castAudience],
      hitAudience = [...unseen.impact.audience];
    Object.assign(w.hero, { x: 4600, y: 0, previous: { x: 4600, y: 0 } });
    w.step();
    v.recenter(enemy);
    v.render(w, 1, v.previousElapsed);
    const revealed = w.visible(enemy, 'blue'),
      oldMeshes = [...v.garenBasicAttacks.models.values()].filter(
        (m: any) => m.userData.sourceId === enemy.id
      ).length;
    w.setOrder(enemy, { type: 'idle' });
    w.setOrder(enemy, { type: 'attack', target: target.id });
    // The prior contact keeps its normal cooldown. Wait for a fresh real swing.
    let seen = unseen;
    for (let i = 0; i < 150 && seen.startTick === unseen.startTick; i++) {
      w.step();
      seen = w.championState(enemy.id).garenAAVisuals.at(-1);
    }
    if (seen.startTick === unseen.startTick) throw Error('No new visible swing');
    w.step(seen.releaseTick - w.tick + 4);
    v.render(w, 1, v.previousElapsed);
    const newMeshes = [...v.garenBasicAttacks.models.values()].filter(
      (m: any) => m.userData.sourceId === enemy.id && m.userData.startTick === seen.startTick
    ).length;
    return {
      hiddenAtCreation,
      castAudience,
      hitAudience,
      revealed,
      oldMeshes,
      newMeshes,
      newCastAudience: seen.castAudience,
      newStart: seen.startTick,
      oldStart: unseen.startTick,
    };
  });
  writeFileSync(
    testInfo.outputPath('audience-evidence.json'),
    JSON.stringify({ result, errors }, null, 2) + '\n'
  );
  expect(result).toMatchObject({ hiddenAtCreation: true, revealed: true, oldMeshes: 0 });
  expect(result.castAudience).not.toContain('blue');
  expect(result.hitAudience).not.toContain('blue');
  expect(result.newMeshes).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
