import { expect, test } from '@playwright/test';

test('Courage renders all eleven cast/ground/shoulder layers, follows movement and restores early-death particles by stable identity', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const cast = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(2);
    g.view.recenter({ x: 0, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    const draws = [...g.view.garenCourage.models.values()] as any[];
    const names = [...new Set(draws.map((m) => m.name))].sort();
    const before = draws.find((m) => m.name === 'Garen W cast 0 shield').position.toArray();
    Object.assign(w.hero, { x: 100, y: 150, previous: { x: 100, y: 150 } });
    g.view.render(w, 1, g.view.previousElapsed);
    const after = draws.find((m) => m.name === 'Garen W cast 0 shield').position.toArray();
    return {
      names,
      count: draws.length,
      finite: draws.every((m) =>
        [...m.position, ...m.scale, ...m.quaternion].every(Number.isFinite)
      ),
      loaded: draws.every((m) => m.material.uniforms.sourceTexture.value.image.width > 0),
      delta: after.map((v: number, i: number) => v - before[i]),
      bone: draws.find((m) => m.name === 'Garen W cast 0 shield').userData.attachment,
      height: before[1],
    };
  });
  expect(cast.names).toEqual([
    'Garen W buff 0 ground_glow',
    'Garen W buff 1 symbol',
    'Garen W buff 2 waves',
    'Garen W cast 0 shield',
    'Garen W cast 1 ground_glow',
    'Garen W cast 2 energy_up',
    'Garen W cast 3 flash',
    'Garen W shoulder-left 0 Streak',
    'Garen W shoulder-left 1 hoop',
    'Garen W shoulder-right 0 Streak',
    'Garen W shoulder-right 1 hoop',
  ]);
  expect(cast.count).toBe(31);
  expect(cast.finite && cast.loaded).toBe(true);
  for (const [i, value] of [1, 0, 1.5].entries()) expect(cast.delta[i]).toBeCloseTo(value, 10);
  expect(cast.bone.toLowerCase()).toBe('c_buffbone_glb_center_loc');
  expect(cast.height).toBeGreaterThan(0.5);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(10);
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.hud.update(60);
  });
  await page.screenshot({ path: 'artifacts/browser-garen-courage-cast.png' });
  const sustained = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(w.player.garenWVisual.startTick + 180 - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    return [...g.view.garenCourage.models.values()].map((m: any) => m.name);
  });
  expect(sustained.length).toBeGreaterThan(0);
  expect(sustained.every((name: string) => name.startsWith('Garen W buff '))).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-courage-sustained.png' });
  const replaced = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      original = w.player.garenWVisual.startTick;
    // Practice cooldown resets may replace the one retained W interval.
    w.player.cooldowns.w = 0;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(2);
    g.view.render(w, 1, g.view.previousElapsed);
    return [...g.view.garenCourage.models.values()].every(
      (m: any) => m.userData.startTick !== original
    );
  });
  expect(replaced).toBe(true);
  const poses = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(10);
    w.damage(w.hero, w.hero, 1e6, 'true');
    g.view.recenter({ x: 0, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    return [...g.view.garenCourage.models.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, m]: any) => ({
        key,
        name: m.name,
        position: m.position.toArray(),
        scale: m.scale.toArray(),
        rotation: m.quaternion.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        uv: m.material.uniforms.sourceUvOffset.value.toArray(),
      }));
  });
  expect(poses.length).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.view.recenter({ x: 0, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    const snapshot = w.snapshot(),
      draws = [...g.view.garenCourage.models.values()] as any[];
    let disposed = 0,
      geometryDisposed = 0;
    for (const m of draws) {
      m.material.addEventListener('dispose', () => disposed++);
      m.geometry.addEventListener('dispose', () => geometryDisposed++);
    }
    const poses = [...g.view.garenCourage.models.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, m]: any) => ({
        key,
        name: m.name,
        position: m.position.toArray(),
        scale: m.scale.toArray(),
        rotation: m.quaternion.toArray(),
        color: m.material.uniforms.particleColor.value.toArray(),
        lookup: m.material.uniforms.lookupUv.value.toArray(),
        uv: m.material.uniforms.sourceUvOffset.value.toArray(),
      }));
    w.step(400);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      snapshot,
      poses,
      disposed,
      geometryDisposed,
      remaining: g.view.garenCourage.models.size,
      history: w.player.garenWVisual,
    };
  });
  expect(restored.snapshot).toBe(saved);
  expect(restored.poses).toEqual(poses);
  expect(restored.disposed).toBe(poses.length);
  expect(restored.geometryDisposed).toBe(0);
  expect(restored.remaining).toBe(0);
  expect(restored.history).toBeNull();
  expect(errors).toEqual([]);
});

test('Courage shoulders follow independent posed joint frames, ignore camera rotation and recover across replacement rigs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const threeUrl = '/node_modules/three/build/three.module.js',
      T = await import(threeUrl),
      g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, facing: 0.7 });
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(25);
    g.view.recenter({ x: 0, y: 0 });
    g.view.render(w, 1, g.view.previousElapsed);
    const courage = g.view.garenCourage,
      rig = g.view.models.get(w.hero.id),
      left = rig.root.getObjectByName('L_Shoulder'),
      right = rig.root.getObjectByName('R_Shoulder'),
      find = (side: string, index: number) =>
        [...courage.models.values()].find((m: any) =>
          m.name.startsWith(`Garen W shoulder-${side} ${index} `)
        ) as any,
      // Source offsets/rotations are independently taken from the frozen BIN,
      // rather than the live sampler or generated playback profiles.
      error = (bone: any, side: string, offset: number[], rotation: number[]) => {
        const mesh = find(side, 1),
          frame = bone.getWorldQuaternion(new T.Quaternion()).normalize(),
          expectedPosition = bone
            .getWorldPosition(new T.Vector3())
            .add(new T.Vector3(...offset).multiplyScalar(0.01).applyQuaternion(frame)),
          expectedRotation = frame.multiply(
            new T.Quaternion().setFromEuler(
              new T.Euler(...rotation.map(T.MathUtils.degToRad), 'YXZ')
            )
          );
        return [
          mesh.position.distanceTo(expectedPosition),
          mesh.quaternion.angleTo(expectedRotation),
        ];
      },
      originalErrors = [
        ...error(left, 'left', [6, -19, 6], [90, 0, 90]),
        ...error(right, 'right', [6, -9, 6], [90, 30, -60]),
      ],
      before = find('left', 0).position.clone();
    left.position.y += 0.35;
    left.rotateX(0.4);
    courage.update(w, 1, g.view.camera, g.view.models);
    const animatedError = error(left, 'left', [6, -19, 6], [90, 0, 90]),
      movement = find('left', 0).position.distanceTo(before),
      shoulderRotation = find('left', 1).quaternion.clone(),
      originalCamera = g.view.camera.quaternion.clone();
    g.view.camera.rotateY(0.6);
    courage.update(w, 1, g.view.camera, g.view.models);
    const cameraError = find('left', 1).quaternion.angleTo(shoulderRotation);
    g.view.camera.quaternion.copy(originalCamera);

    const replacement = { root: new T.Group() },
      replacementLeft = new T.Bone();
    replacement.root.position.set(4, 3, 2);
    replacement.root.rotation.y = -0.6;
    replacementLeft.name = 'l_sHoUlDeR';
    replacementLeft.position.set(-0.3, 0.6, 0);
    replacement.root.add(replacementLeft);
    const replacementModels = new Map([[w.hero.id, replacement]]);
    courage.update(w, 1, g.view.camera, replacementModels);
    const replacementError = error(replacementLeft, 'left', [6, -19, 6], [90, 0, 90]),
      fallbackError = error(replacement.root, 'right', [6, -9, 6], [90, 30, -60]),
      labels = [find('left', 1).userData.attachment, find('right', 1).userData.attachment];
    replacement.root.visible = false;
    courage.update(w, 1, g.view.camera, replacementModels);
    const hiddenRoles = [...courage.models.values()].map((m: any) => m.name);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      errors: [...originalErrors, ...animatedError, ...replacementError, ...fallbackError],
      movement,
      cameraError,
      labels,
      hiddenRoles,
      separation: left
        .getWorldPosition(new T.Vector3())
        .distanceTo(right.getWorldPosition(new T.Vector3())),
    };
  });
  expect(Math.max(...result.errors), JSON.stringify(result)).toBeLessThan(1e-6);
  expect(result.movement).toBeGreaterThan(0.1);
  expect(result.cameraError).toBeLessThan(1e-6);
  expect(result.separation).toBeGreaterThan(0.3);
  expect(result.labels).toEqual(['l_sHoUlDeR', 'local-root-fallback']);
  expect(result.hiddenRoles.length).toBeGreaterThan(0);
  expect(result.hiddenRoles.every((name: string) => name.startsWith('Garen W buff '))).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-courage-shoulders.png' });
  expect(errors).toEqual([]);
});

test('enemy Courage obeys unit fog and disposes hidden materials while natural expiry keeps only bounded final waves', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    w.learnSpell('w', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    const before = [...g.view.garenCourage.models.values()] as any[];
    let disposed = 0;
    for (const m of before) m.material.addEventListener('dispose', () => disposed++);
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const hidden = g.view.garenCourage.models.size;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const revealed = g.view.garenCourage.models.size;
    w.step(w.championState(enemy.id).garenW.defenseUntil - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
    const final = [...g.view.garenCourage.models.values()].map((m: any) => m.name),
      history = !!w.championState(enemy.id).garenWVisual;
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      before: before.length,
      disposed,
      hidden,
      revealed,
      final,
      history,
      after: g.view.garenCourage.models.size,
    };
  });
  expect(result.before).toBeGreaterThan(5);
  expect(result.disposed).toBe(result.before);
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBeGreaterThan(0);
  expect(result.final.length).toBeGreaterThan(0);
  expect(result.final.every((name: string) => name === 'Garen W buff 2 waves')).toBe(true);
  expect(result.history).toBe(true);
  expect(result.after).toBe(0);
});

test('a later Garen loads one Courage resource set and reconstructs an already accepted W', async ({
  page,
}) => {
  const requests: string[] = [],
    modules: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/models/garen-w-')) requests.push(r.url());
    if (r.url().includes('/src/render/garen-courage.ts')) modules.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(modules).toEqual([]);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const u = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    w.learnSpell('w', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step(40);
    w.damage(w.hero, u, 10, 'physical');
    w.step(2);
    g.view.render(w, 1, g.view.previousElapsed);
    // A manually paused fixture needs a draw after its pending lazy load.
    await g.view.garenCourage.load();
    g.view.render(w, 1, g.view.previousElapsed);
  });
  await page.waitForFunction(() => (window as any).__GAME__.view.garenCourage.models.size > 0);
  await page.waitForFunction(() =>
    [...(window as any).__GAME__.view.garenCourage.models.values()].some((m: any) =>
      m.name.includes('deflect')
    )
  );
  expect(modules).toHaveLength(1);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('garen-w-shield.glb');
});

test('Courage terminal particles finish using presentation time while the winner freezes simulation time', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(30);
    const nexus = w.spawn('nexus', 'red', w.hero);
    w.damage(w.hero, nexus, 1e6, 'true');
    g.view.render(w, 1, g.view.previousElapsed);
    const before = g.view.garenCourage.models.size,
      tick = w.tick;
    g.view.render(w, 1, g.view.previousElapsed + 4);
    return {
      before,
      after: g.view.garenCourage.models.size,
      tick,
      afterTick: w.tick,
      reason: w.player.garenWVisual.endReason,
    };
  });
  expect(result.before).toBeGreaterThan(0);
  expect(result.after).toBe(0);
  expect(result.afterTick).toBe(result.tick);
  expect(result.reason).toBe('match-end');
});
